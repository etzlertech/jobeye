#!/bin/bash

# JobEye v4 Test Runner
# This script runs all tests with proper environment setup

echo "🧪 JobEye v4 Test Suite"
echo "======================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Install test dependencies if not present
echo -e "${YELLOW}Checking test dependencies...${NC}"
npm list jest @testing-library/react @testing-library/jest-dom @testing-library/user-event > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Installing test dependencies...${NC}"
    npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom jest-watch-typeahead babel-jest identity-obj-proxy
fi

# Clean previous test results
echo -e "${YELLOW}Cleaning previous test results...${NC}"
rm -rf coverage .nyc_output

# Run different test suites based on argument
case "$1" in
    "unit")
        echo -e "${GREEN}Running unit tests...${NC}"
        npm test -- --testPathPattern="^((?!integration).)*\\.test\\.[jt]sx?$"
        ;;
    "integration")
        echo -e "${GREEN}Running integration tests...${NC}"
        npm test -- --testPathPattern="integration.*\\.test\\.[jt]sx?$"
        ;;
    "watch")
        echo -e "${GREEN}Running tests in watch mode...${NC}"
        npm test -- --watch
        ;;
    "coverage")
        echo -e "${GREEN}Running tests with coverage...${NC}"
        npm test -- --coverage
        ;;
    "ci")
        echo -e "${GREEN}Running tests in CI mode...${NC}"
        npm test -- --ci --coverage --maxWorkers=2
        ;;
    *)
        echo -e "${GREEN}Running all tests...${NC}"
        npm test
        ;;
esac

# Check test results
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    
    # If coverage was generated, show summary
    if [ -d "coverage" ]; then
        echo ""
        echo -e "${YELLOW}Coverage Summary:${NC}"
        cat coverage/lcov-report/index.html | grep -A 4 "fraction" | grep -E "([0-9]+\.[0-9]+%|[0-9]+%)" | head -4
    fi
else
    echo ""
    echo -e "${RED}❌ Some tests failed!${NC}"
    exit 1
fi

echo ""
echo "Test run complete!"