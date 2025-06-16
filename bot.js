require('dotenv').config();
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

class MinecraftAFKBot {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10;
        this.reconnectInterval = parseInt(process.env.RECONNECT_INTERVAL) || 1000;
        this.maxReconnectInterval = parseInt(process.env.MAX_RECONNECT_INTERVAL) || 30000;
        this.lastPingTime = null;
        this.lastAccountStates = new Map();
        this.lastDiscordPing = null;
        this.lastStatusSummary = null;
        this.lastProfileNotification = null;
        
        
        this.connectionStartTime = null;
        this.lastDisconnectTime = null;
        this.stableConnectionThreshold = parseInt(process.env.STABLE_CONNECTION_THRESHOLD) || 300000;
        this.disconnectCooldown = parseInt(process.env.DISCONNECT_COOLDOWN) || 120000;
        this.pendingReconnectTimeout = null;
        
        
        this.stateChangeBuffer = new Map(); 
        this.stateChangeDelay = 5000; 
        this.lastStateNotification = new Map(); 
        this.minNotificationInterval = 30000; 
        
        
        this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
        this.wsUrl = process.env.WEBSOCKET_URL || 'wss://minecraftafk.com/ws';
        this.cookies = `token=${process.env.MINECRAFTAFK_TOKEN}; checked=false`;
        this.debugMode = process.env.DEBUG_MODE === 'true';
        
        
        this.discordPingInterval = parseInt(process.env.DISCORD_PING_INTERVAL) || 7200000;
        this.statusSummaryInterval = parseInt(process.env.STATUS_SUMMARY_INTERVAL) || 7200000;
        
        
        this.validateEnvironment();
        
        
        try {
            this.logsDir = process.env.LOGS_DIRECTORY || '/app/chat_logs';
            
            
            if (!fs.existsSync(this.logsDir)) {
                
                fs.mkdirSync(this.logsDir, { recursive: true, mode: 0o755 });
                console.log(`✅ Created logs directory: ${this.logsDir}`);
            } else {
                console.log(`✅ Logs directory exists: ${this.logsDir}`);
            }
            
            
            const testFile = path.join(this.logsDir, '.write-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log(`✅ Write permissions verified for: ${this.logsDir}`);
            
        } catch (error) {
            if (error.code === 'EACCES') {
                console.warn('⚠️ Cannot create chat_logs directory due to permissions.');
                console.warn('⚠️ Chat logging will be disabled. Bot will continue without file logging.');
                this.logsDir = null; 
            } else {
                console.error('❌ Unexpected error creating logs directory:', error);
                throw error;
            }
        }
    }

    validateEnvironment() {
        const required = ['DISCORD_WEBHOOK_URL', 'MINECRAFTAFK_TOKEN'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            console.error('❌ Missing required environment variables:');
            missing.forEach(key => console.error(`   - ${key}`));
            console.error('\nPlease copy .env.example to .env and fill in the required values.');
            process.exit(1);
        }
        
        if (!this.discordWebhookUrl.startsWith('https://discord.com/api/webhooks/')) {
            console.error('❌ Invalid Discord webhook URL format');
            process.exit(1);
        }
        
        if (this.debugMode) {
            console.log('✅ Environment variables validated successfully');
        }
    }

    async sendDiscordNotification(title, description, color = 3447003) {
        if (!this.discordWebhookUrl) return;

        const payload = {
            username: "MinecraftAFK Bot",
            embeds: [{
                title: title,
                description: description,
                color: color,
                timestamp: new Date().toISOString(),
                footer: {
                    text: "MinecraftAFK Monitor"
                }
            }]
        };

        try {
            const response = await fetch(this.discordWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'MinecraftAFK-Bot/1.0'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                console.error(`Discord webhook failed: ${response.status} ${response.statusText}`);
            } else if (this.debugMode) {
                console.log(`✅ Discord notification sent: ${title}`);
            }
        } catch (error) {
            console.error('❌ Discord notification error:', error.message);
        }
    }

    wasConnectionStable() {
        if (!this.connectionStartTime) return false;
        const connectionDuration = Date.now() - this.connectionStartTime;
        return connectionDuration >= this.stableConnectionThreshold;
    }

    shouldNotifyDisconnection(code, reason) {
        if (code === 1006) {
            return this.wasConnectionStable();
        }
        return true;
    }

    shouldNotifyReconnection() {
        if (!this.lastDisconnectTime) return true;
        const timeSinceDisconnect = Date.now() - this.lastDisconnectTime;
        return timeSinceDisconnect >= this.disconnectCooldown;
    }

    connect() {
        try {
            console.log('🔄 Attempting to connect to MinecraftAFK WebSocket...');
            
            this.ws = new WebSocket(this.wsUrl, {
                headers: {
                    'Host': 'minecraftafk.com',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:139.0) Gecko/20100101 Firefox/139.0',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Origin': 'https://minecraftafk.com',
                    'Sec-GPC': '1',
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    'Cookie': this.cookies
                }
            });

            this.setupEventHandlers();
            
        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
            this.scheduleReconnect();
        }
    }

    setupEventHandlers() {
        this.ws.on('open', async () => {
            console.log('✅ Connected to MinecraftAFK WebSocket');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.reconnectInterval = parseInt(process.env.RECONNECT_INTERVAL) || 1000;
            this.connectionStartTime = Date.now();
            
            if (this.shouldNotifyReconnection()) {
                await this.sendDiscordNotification(
                    "🟢 WebSocket Connected",
                    "Successfully connected to MinecraftAFK WebSocket",
                    3066993
                );
            }
        });

        this.ws.on('message', (data) => {
            this.handleMessage(data);
        });

        this.ws.on('ping', (data) => {
            if (this.debugMode) {
                console.log('📡 Received WebSocket ping frame');
            }
            this.ws.pong(data);
        });

        this.ws.on('close', async (code, reason) => {
            const reasonText = reason ? reason.toString() : 'Unknown';
            console.log(`❌ WebSocket closed: ${code} - ${reasonText}`);
            
            this.isConnected = false;
            this.lastDisconnectTime = Date.now();
            
            if (this.shouldNotifyDisconnection(code, reasonText)) {
                let notificationTitle = "🔴 WebSocket Disconnected";
                let notificationDescription = `Connection closed with code: ${code}`;
                
                if (code === 1006) {
                    notificationTitle = "⚠️ WebSocket Connection Lost";
                    notificationDescription = `Connection lost after ${Math.round((Date.now() - this.connectionStartTime) / 60000)} minutes (Error 1006)`;
                } else if (reasonText !== 'Unknown') {
                    notificationDescription += `\nReason: ${reasonText}`;
                }
                
                await this.sendDiscordNotification(
                    notificationTitle,
                    notificationDescription,
                    15158332
                );
            }
            
            this.scheduleReconnect();
        });

        this.ws.on('error', async (error) => {
            console.error('⚠️ WebSocket error:', error);
            
            if (!error.message.includes('ECONNREFUSED') && !error.message.includes('ENOTFOUND')) {
                await this.sendDiscordNotification(
                    "⚠️ WebSocket Error",
                    `Error occurred: ${error.message}`,
                    16776960
                );
            }
        });
    }

    async handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.action) {
                case 0:
                    console.log('🔗 Connection acknowledged');
                    break;
                    
                case 3:
                    console.log('🔌 Account connection request:');
                    await this.handleAccountConnectionRequest(message.params);
                    break;
                    
                case 4:
                    if (typeof message.params === 'number') {
                        const pingTime = new Date(message.params);
                        console.log('📡 Server ping/timestamp:', pingTime.toISOString());
                        this.lastPingTime = pingTime;
                        
                        if (!this.lastDiscordPing || (Date.now() - this.lastDiscordPing) > this.discordPingInterval) {
                            await this.sendDiscordNotification(
                                "📡 Connection Health Check",
                                `Last server ping: ${pingTime.toISOString()}\nConnection status: Active`,
                                3447003
                            );
                            this.lastDiscordPing = Date.now();
                        }
                    } else {
                        console.log('🔌 Account disconnection request:');
                        await this.handleAccountDisconnectionRequest(message.params);
                    }
                    break;
                    
                case 7:
                    console.log('👤 User profile received:');
                    await this.handleUserProfile(message.params);
                    break;
                    
                case 11:
                    console.log('🔌 Account disconnect event:');
                    await this.handleAccountDisconnect(message.params);
                    break;
                    
                case 12:
                    this.handleChatMessage(message.params);
                    break;
                    
                case 13:
                    console.log('🔄 Account state change:');
                    await this.handleAccountStateChange(message.params);
                    break;
                    
                case 14:
                    console.log('✅ Account connection confirmation:');
                    await this.handleAccountConnectionConfirmation(message.params);
                    break;
                    
                default:
                    if (this.debugMode) {
                        console.log('📦 Unknown message type:', message);
                    }
            }
            
        } catch (error) {
            console.error('❌ Failed to parse message:', error);
            if (this.debugMode) {
                console.log('Raw data:', data.toString());
            }
        }
    }

    async handleAccountConnectionRequest(connectionData) {
        const account = connectionData.account;
        console.log(`  Initiating connection for account: ${account}`);
        
        await this.sendDiscordNotification(
            "🔄 Account Connection Initiated",
            `**${account}** connection request initiated`,
            16776960
        );
    }

    async handleAccountDisconnectionRequest(account) {
        console.log(`  Initiating disconnection for account: ${account}`);
        
        await this.sendDiscordNotification(
            "🔄 Account Disconnection Initiated",
            `**${account}** disconnection request initiated`,
            16776960
        );
    }

    async handleAccountDisconnect(disconnectData) {
        const account = disconnectData.account;
        const connectStatus = disconnectData.connect;
        
        console.log(`  Account: ${account}, Connect Status: ${connectStatus}`);
        
        await this.sendDiscordNotification(
            "🔌 Account Disconnected",
            `**${account}** has been disconnected from the server`,
            15158332
        );
    }

    async handleAccountStateChange(stateData) {
        const account = stateData.account;
        const newState = stateData.state;
        const stateDescription = this.getDetailedState(newState);
        
        console.log(`  Account: ${account}, New State: ${stateDescription} (${newState})`);
        
        
        if (this.stateChangeBuffer.has(account)) {
            const existingData = this.stateChangeBuffer.get(account);
            if (existingData.timeoutId) {
                clearTimeout(existingData.timeoutId);
            }
        }
        
        
        const lastNotification = this.lastStateNotification.get(account);
        const now = Date.now();
        
        if (lastNotification && (now - lastNotification) < this.minNotificationInterval) {
            console.log(`  Skipping notification for ${account} - too soon since last notification`);
            return;
        }
        
        
        const timeoutId = setTimeout(async () => {
            
            const bufferedData = this.stateChangeBuffer.get(account);
            if (bufferedData && bufferedData.state === newState) {
                await this.sendStateChangeNotification(account, newState, stateDescription);
                this.lastStateNotification.set(account, Date.now());
            }
            
            
            this.stateChangeBuffer.delete(account);
        }, this.stateChangeDelay);
        
        
        this.stateChangeBuffer.set(account, {
            state: newState,
            timestamp: now,
            timeoutId: timeoutId
        });
    }

    async sendStateChangeNotification(account, state, stateDescription) {
        
        const significantStates = [0, 2]; 
        
        if (!significantStates.includes(state)) {
            console.log(`  Skipping notification for ${account} - non-significant state: ${stateDescription}`);
            return;
        }
        
        let color = 3447003; 
        if (state === 2) color = 3066993; 
        if (state === 0) color = 15158332; 
        
        await this.sendDiscordNotification(
            "🔄 Account State Change",
            `**${account}** state changed to: **${stateDescription}**`,
            color
        );
    }

    async handleAccountConnectionConfirmation(confirmationMessage) {
        console.log(`  Confirmation: ${confirmationMessage}`);
        
        const accountMatch = confirmationMessage.match(/Connected (\w+) to server/);
        if (accountMatch) {
            const account = accountMatch[1];
            
            await this.sendDiscordNotification(
                "✅ Account Connected",
                `**${account}** has successfully connected to the server`,
                3066993
            );
        }
    }

    async handleUserProfile(profileData) {
        console.log(`User: ${profileData.discord_display}`);
        console.log(`Plan: ${profileData.plan}`);
        console.log(`Accounts: ${profileData.accounts.length}`);
        
        let significantChanges = [];
        let currentStates = new Map();
        
        profileData.accounts.forEach((account, index) => {
            const stateDescription = this.getSimplifiedState(account.state);
            const previousState = this.lastAccountStates.get(account.username);
            
            currentStates.set(account.username, stateDescription);
            console.log(`  ${index + 1}. ${account.username} - State: ${stateDescription}`);
            
            
            if (previousState && previousState !== stateDescription) {
                significantChanges.push({
                    username: account.username,
                    previousState: previousState,
                    currentState: stateDescription
                });
            }
        });
        
        
        if (significantChanges.length > 0) {
            const now = Date.now();
            const lastProfileNotification = this.lastProfileNotification || 0;
            
            
            if ((now - lastProfileNotification) > 60000) {
                let changeDescription = significantChanges.map(change => 
                    `**${change.username}**: ${change.previousState} → ${change.currentState}`
                ).join('\n');
                
                await this.sendDiscordNotification(
                    "🔄 Account Status Changes",
                    changeDescription,
                    significantChanges.some(c => c.currentState === 'Offline') ? 15158332 : 3066993
                );
                
                this.lastProfileNotification = now;
            }
        }
        
        this.lastAccountStates = currentStates;
        
        
        if (!this.lastStatusSummary || (Date.now() - this.lastStatusSummary) > this.statusSummaryInterval) {
            let summaryDescription = Array.from(currentStates.entries())
                .map(([username, state]) => `**${username}**: ${state}`)
                .join('\n');
            
            await this.sendDiscordNotification(
                "📊 Account Status Summary",
                summaryDescription,
                3447003
            );
            this.lastStatusSummary = Date.now();
        }
    }

    getDetailedState(state) {
        switch (state) {
            case 0: return 'Offline';
            case 1: return 'Connecting';
            case 2: return 'Connected';
            case 3: return 'Disconnecting';
            default: return `Unknown State (${state})`;
        }
    }

    getSimplifiedState(state) {
        switch (state) {
            case 0: return 'Offline';
            case 1:
            case 2:
            case 3: return 'Online';
            default: return 'Offline';
        }
    }

    handleChatMessage(chatData) {
        const account = chatData.account;
        const timestamp = new Date(chatData.timestamp);
        
        let chatText = this.extractChatText(chatData.data);
        
        const logEntry = {
            timestamp: timestamp.toISOString(),
            account: account,
            message: chatText,
            raw_data: chatData.data
        };
        
        this.saveChatToFile(account, logEntry);
    }

    extractChatText(chatData) {
        try {
            if (chatData.translate === '%s' && chatData.with && chatData.with[0] && chatData.with[0].extra) {
                return chatData.with[0].extra
                    .filter(part => part.text && !part.bold && !part.color)
                    .map(part => part.text)
                    .join('')
                    .trim();
            } else if (chatData.extra) {
                return chatData.extra
                    .map(part => part.text || '')
                    .join('')
                    .trim();
            } else if (chatData.text) {
                return chatData.text;
            }
            
            return 'Complex message format';
        } catch (error) {
            return 'Failed to parse chat text';
        }
    }

    saveChatToFile(account, logEntry) {
        
        if (!this.logsDir) {
            return;
        }
        
        const fileName = `${account.toLowerCase()}_chat.json`;
        const filePath = path.join(this.logsDir, fileName);
        
        try {
            let existingLogs = [];
            
            if (fs.existsSync(filePath)) {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                if (fileContent.trim()) {
                    existingLogs = JSON.parse(fileContent);
                }
            }
            
            existingLogs.push(logEntry);
            fs.writeFileSync(filePath, JSON.stringify(existingLogs, null, 2));
            
        } catch (error) {
            console.error(`❌ Failed to save chat for ${account}:`, error);
            
            if (error.code === 'EACCES') {
                console.warn('⚠️ Disabling chat logging due to permission errors');
                this.logsDir = null;
            }
        }
    }

    async scheduleReconnect() {
        if (this.pendingReconnectTimeout) {
            clearTimeout(this.pendingReconnectTimeout);
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached. Stopping reconnection.');
            
            await this.sendDiscordNotification(
                "🚨 Connection Failed",
                "Maximum reconnection attempts reached. Bot has stopped trying to reconnect.",
                15158332
            );
            return;
        }

        this.reconnectAttempts++;
        console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval / 1000} seconds...`);

        this.pendingReconnectTimeout = setTimeout(() => {
            this.connect();
        }, this.reconnectInterval);

        this.reconnectInterval = Math.min(this.reconnectInterval * 2, this.maxReconnectInterval);
    }

    cleanup() {
        
        for (const [account, data] of this.stateChangeBuffer.entries()) {
            if (data.timeoutId) {
                clearTimeout(data.timeoutId);
            }
        }
        this.stateChangeBuffer.clear();
    }

    disconnect() {
        if (this.pendingReconnectTimeout) {
            clearTimeout(this.pendingReconnectTimeout);
        }
        
        this.cleanup();
        
        if (this.ws) {
            this.ws.close();
            console.log('🔌 Disconnected from WebSocket');
        }
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            lastPing: this.lastPingTime,
            accountStates: Object.fromEntries(this.lastAccountStates),
            reconnectAttempts: this.reconnectAttempts,
            connectionUptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0
        };
    }
}


const bot = new MinecraftAFKBot();
bot.connect();


process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down bot...');
    
    bot.cleanup();
    
    await bot.sendDiscordNotification(
        "🛑 Bot Shutdown",
        "MinecraftAFK monitoring bot is shutting down",
        16776960
    );
    
    bot.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    
    bot.cleanup();
    
    await bot.sendDiscordNotification(
        "🛑 Bot Shutdown",
        "MinecraftAFK monitoring bot is shutting down (SIGTERM)",
        16776960
    );
    
    bot.disconnect();
    process.exit(0);
});

module.exports = MinecraftAFKBot;
