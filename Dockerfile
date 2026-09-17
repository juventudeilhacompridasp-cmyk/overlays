FROM node:22-alpine

LABEL org.opencontainers.image.title="Juventude Overlay Studio"
LABEL org.opencontainers.image.description="Painel e overlays esportivos para OBS"

WORKDIR /app

COPY package.json ./
COPY server.mjs auth.mjs ./
COPY public ./public

RUN mkdir -p /app/.data/assets && chown -R node:node /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173
ENV OVERLAY_STATE_FILE=/app/.data/overlay-state.json

USER node

EXPOSE 4173
VOLUME ["/app/.data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:4173/health >/dev/null || exit 1

CMD ["node", "server.mjs"]
