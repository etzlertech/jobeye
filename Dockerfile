# Simple Dockerfile for Railway deployment
FROM node:20-alpine

WORKDIR /app

# Install Python and build dependencies for native modules
RUN apk add --no-cache python3 make g++ libc-dev

# Copy package files
COPY package*.json ./

# Update npm to latest version first
RUN npm install -g npm@latest

# Install ALL dependencies (including devDependencies for build)
# Add --legacy-peer-deps to handle peer dependency conflicts
# Also add verbose logging to debug any issues
RUN npm ci --legacy-peer-deps --verbose || (cat /root/.npm/_logs/*.log && exit 1)

# Copy all source files
COPY . .

# Build the Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Set dummy Supabase vars for build if not provided
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://dummy.supabase.co}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-dummy-anon-key}

# Start the app using Next.js built-in server
CMD ["npm", "start"]