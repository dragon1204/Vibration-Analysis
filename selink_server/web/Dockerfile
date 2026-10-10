# Build the React app and serve it with Caddy (reverse proxy to the API). Context: selink_server/
FROM node:20-alpine AS build
WORKDIR /src
COPY web/package.json web/package-lock.json* ./
RUN npm ci || npm install
COPY web/ ./
RUN npm run build

FROM caddy:2.8-alpine
COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
