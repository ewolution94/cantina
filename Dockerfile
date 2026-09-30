# syntax=docker/dockerfile:1

# The build only produces static files, which are identical on every CPU, so it runs
# natively on the build machine. Only the tiny runtime stage is per-platform, which
# keeps multi-arch CI builds from crawling through arm64 emulation.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# The server has zero dependencies, so the runtime image is just Node + the built app.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 CANTINA_CACHE=/data/menu.json TZ=Europe/Berlin
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
# The last good menu lives here, so a restart (or Kochwerk being down) never shows an empty
# page. Owned by `node` so a fresh named volume is writable without any setup on the NAS.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
# Shell form so $PORT expands: the NAS stack runs on a different port than the default.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["node", "server/server.mjs"]
