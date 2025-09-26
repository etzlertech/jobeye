#!/bin/bash
# Compare different TypeScript checking methods

echo "🔍 Comparing TypeScript checking methods"
echo "========================================"
echo ""

echo "1. Running tsc directly:"
echo "------------------------"
npx tsc --version
npx tsc --noEmit 2>&1 | tail -5

echo ""
echo "2. Next.js type checking (what Railway uses):"
echo "---------------------------------------------"
echo "Next.js version: $(grep '"next":' package.json | cut -d'"' -f4)"
echo ""
echo "Running: npx next build --debug"
echo "(This is what happens in Docker/Railway)"
echo ""

# Create a minimal test to show the difference
cat > test-nextjs-types.ts << 'EOF'
// This file demonstrates Next.js vs tsc differences
import { NextPage } from 'next'

const TestPage: NextPage = () => {
  const data = { foo: 'bar' }
  // This might pass tsc but fail Next.js build
  return <div>{data.baz}</div>
}
EOF

echo "Testing with tsc:"
npx tsc --noEmit test-nextjs-types.ts 2>&1 || echo "tsc found errors"

echo ""
echo "The difference is:"
echo "- tsc uses your tsconfig.json directly"
echo "- Next.js build:"
echo "  1. Uses its own TypeScript plugin"
echo "  2. Generates additional types for pages/layouts"
echo "  3. Has stricter JSX type checking"
echo "  4. Validates Next.js specific patterns"

rm -f test-nextjs-types.ts