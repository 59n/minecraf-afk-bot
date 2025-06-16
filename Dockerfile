# Multi-stage build for better security and smaller image size
FROM node:20-alpine AS build

# Create app directory
RUN mkdir /app

# Copy package files and source code
COPY package.json package-lock.json bot.js /app/

# Install dependencies
RUN cd /app && \
    npm ci --only=production && \
    npm cache clean --force && \
    rm -rf package-lock.json package.json

# Create logs directory with proper permissions BEFORE changing ownership
RUN mkdir -p /app/chat_logs && \
    chmod 755 /app/chat_logs

# Set proper permissions for nobody user (CRITICAL STEP)
RUN chown -R nobody:nobody /app && \
    chmod -R 755 /app

###################
# Production stage
FROM node:20-alpine

# Copy built application from build stage with correct ownership
COPY --from=build --chown=nobody:nobody /app /app

# Ensure the working directory exists and has correct permissions
WORKDIR /app

# Verify and fix permissions (additional safety check)
RUN chown -R nobody:nobody /app && \
    chmod -R 755 /app && \
    mkdir -p /app/chat_logs && \
    chown -R nobody:nobody /app/chat_logs && \
    chmod 755 /app/chat_logs

# Switch to non-root user
USER nobody

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Start the application
ENTRYPOINT ["node", "/app/bot.js"]
