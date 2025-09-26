#!/bin/bash
# List all TypeScript errors in the project

echo "🔍 Running full TypeScript check..."
echo "=================================="
echo ""

# Run tsc and capture all errors
npx tsc --noEmit 2>&1 | grep -E "error TS" | sort | uniq -c | sort -nr

echo ""
echo "Top error codes:"
echo "================"
npx tsc --noEmit 2>&1 | grep -oE "error TS[0-9]+" | sort | uniq -c | sort -nr | head -20

echo ""
echo "Total errors:"
echo "============"
npx tsc --noEmit 2>&1 | grep -c "error TS"