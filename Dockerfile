# ---- build the SPA ----
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json ./
RUN npm install

COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
RUN npm run build

# ---- the projects API (no dependencies, so nothing to install) ----
FROM node:22-alpine AS api

WORKDIR /app
COPY server/ ./server/
COPY common-tools/ ./common-tools/

ENV PROJECTS_ROOT=/resources/projects
ENV COMMON_TOOLS_ROOT=/app/common-tools
EXPOSE 20445
CMD ["node", "server/index.mjs"]

# ---- serve the built assets (the default stage) ----
FROM nginx:1.27-alpine AS serve

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 20444
