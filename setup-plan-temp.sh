#!/bin/bash
set -e

# Get current branch and paths
BRANCH=$(git branch --show-current)
REPO_ROOT=$(pwd)
SPECS_DIR="$REPO_ROOT/specs"
FEATURE_DIR="$SPECS_DIR/$BRANCH"
FEATURE_SPEC="$FEATURE_DIR/spec.md"
IMPL_PLAN="$FEATURE_DIR/plan.md"

# Check if we're on a feature branch
if [[ ! "$BRANCH" =~ ^[0-9]{3}- ]]; then
    echo "Error: Not on a feature branch (expected format: ###-feature-name)" >&2
    exit 1
fi

# Check if spec exists
if [ ! -f "$FEATURE_SPEC" ]; then
    echo "Error: Feature spec not found at $FEATURE_SPEC" >&2
    exit 1
fi

# Copy template if plan doesn't exist
TEMPLATE="$REPO_ROOT/.specify/templates/plan-template.md"
if [ ! -f "$IMPL_PLAN" ]; then
    if [ -f "$TEMPLATE" ]; then
        cp "$TEMPLATE" "$IMPL_PLAN"
    else
        echo "Error: Template not found at $TEMPLATE" >&2
        exit 1
    fi
fi

# Output JSON
printf '{"FEATURE_SPEC":"%s","IMPL_PLAN":"%s","SPECS_DIR":"%s","BRANCH":"%s"}\n' \
    "$FEATURE_SPEC" "$IMPL_PLAN" "$SPECS_DIR" "$BRANCH"