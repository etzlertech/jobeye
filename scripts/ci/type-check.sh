#!/bin/bash
# Quick type checking script for local development

set -e

echo "🔍 Running TypeScript type check..."
echo "================================"

# Run TypeScript compiler in no-emit mode
npx tsc --noEmit

if [ $? -eq 0 ]; then
  echo "✅ TypeScript check passed!"
else
  echo "❌ TypeScript check failed!"
  exit 1
fi

# Optional: Run with strict mode to see additional issues
echo -e "\n📋 Running strict mode check (informational only)..."
echo "================================"
npx tsc --noEmit --strict || true

echo -e "\n✨ Type check complete!"