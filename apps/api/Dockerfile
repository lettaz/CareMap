FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
COPY apps/api/package.json apps/api/
RUN npm install --workspace=api --include-workspace-root

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api/ apps/api/
RUN npm run build -w api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/
COPY package.json ./

WORKDIR /app/apps/api
EXPOSE ${PORT:-3001}
CMD ["node", "dist/server.js"]
