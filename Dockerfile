FROM node:20-alpine AS build

RUN mkdir /app

COPY package.json package-lock.json bot.js /app/

RUN cd /app && \
    npm ci --only=production && \
    npm cache clean --force && \
    rm -rf package-lock.json package.json

RUN mkdir -p /app/chat_logs && \
    chmod 755 /app/chat_logs

RUN chown -R nobody:nobody /app && \
    chmod -R 755 /app

FROM node:20-alpine

COPY --from=build --chown=nobody:nobody /app /app

WORKDIR /app

RUN chown -R nobody:nobody /app && \
    chmod -R 755 /app && \
    mkdir -p /app/chat_logs && \
    chown -R nobody:nobody /app/chat_logs && \
    chmod 755 /app/chat_logs

USER nobody

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

ENTRYPOINT ["node", "/app/bot.js"]
