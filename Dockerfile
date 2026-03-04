# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ .

# Build arguments for environment variables (set at build time or runtime)
ARG K2_API_KEY
ARG K2_API_URL=https://api.k2think.ai/v1/chat/completions
ARG K2_MODEL=MBZUAI-IFM/K2-Think-v2

ENV K2_API_KEY=$K2_API_KEY
ENV K2_API_URL=$K2_API_URL
ENV K2_MODEL=$K2_MODEL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
