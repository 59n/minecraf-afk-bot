# MinecraftAFK.com WebSocket Bot 

A Node.js WebSocket bot for monitoring MinecraftAFK.com accounts with Discord notifications and chat logging.

## Features

- 🔌 Real-time WebSocket monitoring of MinecraftAFK accounts
- 📱 Discord webhook notifications for account status changes
- 💬 Automatic chat logging per account
- 🔄 Automatic reconnection with exponential backoff
- 🐳 Docker support for easy deployment
- ⚙️ Configurable via environment variables
- 
![wXPFoZOIpoibZSQl](https://github.com/user-attachments/assets/1d9cb1d0-d27b-4492-b8ee-e7d57d684a41)

## Quick Start

### Prerequisites

- Node.js 18+ or Docker
- Discord webhook URL
- MinecraftAFK account session token

### Local Installation

1. Clone the repository:
```bash
git clone https://github.com/59n/minecraft-afk-bot.git
cd minecraft-afk-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the bot:
```bash
npm start
```

### Docker Installation

1. Clone and configure:
```bash
git clone https://github.com/59n/minecraft-afk-bot.git
cd minecraft-afk-bot
cp .env.example .env
# Edit .env with your configuration
```

2. Run with Docker Compose:
```bash
docker-compose up -d
```

## Configuration

All configuration is done via environment variables in the `.env` file. See `.env.example` for all available options.

### Required Variables

- `DISCORD_WEBHOOK_URL`: Your Discord webhook URL
- `MINECRAFTAFK_TOKEN`: Your MinecraftAFK session token

### Getting Your Session Token

1. Log into minecraftafk.com in your browser
2. Open Developer Tools (F12)
3. Go to Application/Storage → Cookies → minecraftafk.com
4. Copy the value of the `token` cookie

### Getting Your Discord Webhook URL

1. Go to your Discord server
2. Right-click on the channel where you want notifications
3. Select "Edit Channel" → "Integrations" → "Webhooks"
4. Click "Create Webhook"
5. Copy the webhook URL

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_WEBHOOK_URL` | ✅ | - | Discord webhook URL for notifications |
| `MINECRAFTAFK_TOKEN` | ✅ | - | Your MinecraftAFK session token |
| `WEBSOCKET_URL` | ❌ | `wss://minecraftafk.com/ws` | WebSocket endpoint |
| `MAX_RECONNECT_ATTEMPTS` | ❌ | `10` | Maximum reconnection attempts |
| `RECONNECT_INTERVAL` | ❌ | `1000` | Initial reconnection delay (ms) |
| `DISCORD_PING_INTERVAL` | ❌ | `7200000` | Health check interval (ms) |
| `STATUS_SUMMARY_INTERVAL` | ❌ | `7200000` | Status summary interval (ms) |
| `LOGS_DIRECTORY` | ❌ | `./chat_logs` | Chat logs directory |
| `DEBUG_MODE` | ❌ | `false` | Enable debug logging |

## Usage

The bot will automatically:
- Connect to MinecraftAFK WebSocket
- Monitor account status changes
- Send Discord notifications for important events
- Log all chat messages to individual JSON files
- Reconnect automatically if connection is lost

### Monitored Events

- **Account Connections**: When accounts connect/disconnect from servers
- **State Changes**: Online/Offline status transitions
- **Chat Messages**: All chat activity (logged to files)
- **Connection Health**: Periodic health checks and reconnection events

### Discord Notifications

The bot sends color-coded Discord notifications:
- 🟢 **Green**: Successful connections and confirmations
- 🔴 **Red**: Disconnections and offline states
- 🟡 **Yellow**: Pending actions (connecting/disconnecting)
- 🔵 **Blue**: Health checks and general information

## Docker Commands

Build and start:
```bash
docker-compose up -d
```

View logs:
```bash
docker-compose logs -f
```

Stop the bot:
```bash
docker-compose down
```

Rebuild after changes:
```bash
docker-compose up -d --build
```

View container status:
```bash
docker-compose ps
```

## File Structure

```
minecraft-afk-bot/
├── bot.js            # Main bot application
├── chat_logs/            # Chat logs per account (auto-created)
├── .env                  # Your configuration (create from .env.example)
├── .env.example          # Configuration template
├── package.json          # Node.js dependencies and scripts
├── docker-compose.yml    # Docker Compose configuration
├── Dockerfile           # Docker build configuration
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Chat Logging

Chat messages are automatically saved to individual JSON files in the `chat_logs/` directory:
- `username_chat.json`
- `username_chat.json`
- `username_chat.json`
- `username_chat.json`
- `username_chat.json`

Each log entry contains:
```json
{
    "timestamp": "2025-06-16T14:08:00.000Z",
    "account": "username",
    "message": "extracted chat text",
    "raw_data": { /* original minecraft chat data */ }
}
```

## Troubleshooting

### Common Issues

**"fetch failed" Error**
- Ensure you're using Node.js 18+ for native fetch support
- Check your Discord webhook URL is valid
- Verify network connectivity

**WebSocket Error 1006**
- This is normal for temporary network issues
- The bot will automatically reconnect
- Only long disconnections trigger Discord notifications

**Missing Environment Variables**
- Copy `.env.example` to `.env`
- Fill in all required variables
- Restart the bot after configuration changes

**Docker Issues**
- Ensure Docker and Docker Compose are installed
- Check that ports aren't already in use
- Verify `.env` file exists and is properly configured

### Debug Mode

Enable debug mode for detailed logging:
```bash
DEBUG_MODE=true
```

This will show additional information about:
- WebSocket message parsing
- Discord notification attempts
- Connection state changes
- Environment variable validation

## Development

### Running in Development Mode
```bash
npm run dev
```

This uses nodemon for automatic restarts when code changes.

### Building Docker Image
```bash
npm run docker:build
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- Never commit your `.env` file to version control
- Keep your Discord webhook URL and MinecraftAFK token secure
- Use environment variables for all sensitive configuration
- The Docker container runs as a non-root user for security

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Enable debug mode for detailed logs
3. Create an issue on GitHub with:
   - Your Node.js version
   - Error messages and logs
   - Configuration (without sensitive data)

## Changelog

### v1.0.0
- WebSocket monitoring for MinecraftAFK accounts
- Discord webhook notifications
- Automatic chat logging
- Docker support
- Environment variable configuration
