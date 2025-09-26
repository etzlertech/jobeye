#!/bin/bash
# Setup git hooks for pre-commit validation

echo "🔧 Setting up git hooks..."

# Create .husky directory
mkdir -p .husky

# Initialize husky
npx husky init || true

# Create pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run quick type check first (fast fail)
echo "🔍 Running quick type check..."
npm run type-check
if [ $? -ne 0 ]; then
  echo "❌ Type check failed! Fix errors before committing."
  exit 1
fi

# Run lint-staged for changed files
echo "🔍 Running lint-staged on changed files..."
npx lint-staged

# Optional: Run full pre-commit checks (uncomment if desired)
# echo "🔍 Running full pre-commit checks..."
# npm run pre-commit

echo "✅ Pre-commit checks passed!"
EOF

# Make pre-commit hook executable
chmod +x .husky/pre-commit

# Create commit-msg hook for conventional commits
cat > .husky/commit-msg << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Simple commit message validation
commit_regex='^(feat|fix|docs|style|refactor|test|chore|build|ci)(\(.+\))?: .{1,50}'

if ! grep -qE "$commit_regex" "$1"; then
    echo "❌ Invalid commit message format!"
    echo "📝 Format: <type>(<scope>): <subject>"
    echo "📝 Example: fix: correct TypeScript compilation errors"
    echo "📝 Types: feat, fix, docs, style, refactor, test, chore, build, ci"
    exit 1
fi
EOF

# Make commit-msg hook executable
chmod +x .husky/commit-msg

echo "✅ Git hooks setup complete!"
echo ""
echo "Available npm scripts for manual checking:"
echo "  npm run quick-check    - Fast TypeScript check"
echo "  npm run type-check     - Full TypeScript check"
echo "  npm run pre-commit     - Comprehensive pre-commit validation"
echo ""
echo "Hooks installed:"
echo "  pre-commit - Runs type check and lint-staged"
echo "  commit-msg - Validates commit message format"