# ─────────────────────────────────────────────
# Stage 1 — Install Dependencies
# ─────────────────────────────────────────────
FROM node:24-bookworm-slim AS deps

# Improve security and reproducibility
ENV NODE_ENV=production
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apt-get update \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies deterministically
COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
 && npm cache clean --force


# ─────────────────────────────────────────────
# Stage 2 — Builder
# ─────────────────────────────────────────────
FROM node:24-bookworm-slim AS builder

RUN apt-get update \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install full dependencies for building
COPY package.json package-lock.json ./

RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript
RUN npx tsc \
  --outDir dist \
  --declaration false \
  --inlineSourceMap false \
  --inlineSources false

# Remove dev dependencies after build
RUN npm prune --omit=dev


# ─────────────────────────────────────────────
# Stage 3 — Production (Distroless)
# ─────────────────────────────────────────────
FROM gcr.io/distroless/nodejs24-debian12

WORKDIR /app

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled application
COPY --from=builder /app/dist ./dist

# Distroless already provides a nonroot user
USER nonroot

# App port
EXPOSE 3000

# Healthcheck using Node (no curl/wget available)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node","-e","require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

# Start application
CMD ["dist/adapters/driving/server.js"]