# Use Node.js 20 alpine image
FROM node:20-alpine AS deps
# Install libc6-compat for Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
# Install dependencies (using npm install to handle lock file mismatch)
RUN npm install --frozen-lockfile || npm install

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set dummy environment variables for build
ENV NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key-for-build
ENV SUPABASE_SERVICE_ROLE_KEY=dummy-service-key-for-build

# Build the application (with verbose logging)
RUN npm run build || (echo "Build failed. Showing package.json:" && cat package.json && echo "Showing node version:" && node --version && echo "Showing npm version:" && npm --version && exit 1)

# Debug: List build output
RUN echo "=== Checking build output ===" && \
    ls -la .next/ && \
    echo "=== Checking for standalone ===" && \
    ls -la .next/standalone/ || echo "No standalone directory found"

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application and public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application (server.js is in the root of standalone)
CMD ["node", "server.js"]