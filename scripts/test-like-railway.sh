#!/bin/bash
# Test exactly like Railway does

echo "🚂 Testing like Railway/Docker build"
echo "===================================="
echo ""

# 1. Clean environment
echo "1. Cleaning build artifacts..."
rm -rf .next/
rm -rf node_modules/.cache/

# 2. Set production environment
export NODE_ENV=production

# 3. Run Next.js build (this is what fails in Railway)
echo ""
echo "2. Running Next.js build (same as Railway)..."
echo "   This will show the EXACT errors Railway sees:"
echo ""
npm run build

# Reset environment
export NODE_ENV=development