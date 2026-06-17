###############################################################################
# Stage 1 — install all workspace dependencies
###############################################################################
FROM node:24-alpine AS deps

RUN npm install -g pnpm@10 --silent

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json             ./lib/db/
COPY lib/api-zod/package.json        ./lib/api-zod/
COPY lib/api-spec/package.json       ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY artifacts/api-server/package.json ./artifacts/api-server/

# Install production + dev deps needed for the build
RUN pnpm install --frozen-lockfile

###############################################################################
# Stage 2 — build the API server bundle
###############################################################################
FROM deps AS builder

COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm --filter @workspace/api-server build

###############################################################################
# Stage 3 — lean production image
###############################################################################
FROM node:24-alpine AS runner

RUN npm install -g pnpm@10 --silent

WORKDIR /app

# Copy only what the runtime needs
COPY --from=deps    /app/package.json             ./
COPY --from=deps    /app/pnpm-workspace.yaml      ./
COPY --from=deps    /app/pnpm-lock.yaml           ./
COPY --from=deps    /app/node_modules             ./node_modules
COPY --from=deps    /app/lib/db/package.json      ./lib/db/
COPY --from=deps    /app/lib/db/node_modules      ./lib/db/node_modules/
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/api-server/package.json ./artifacts/api-server/

# pino-pretty log transport files are emitted alongside the bundle
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
