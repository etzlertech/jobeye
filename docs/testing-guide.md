# JobEye v4 Testing Guide

## Overview
This guide covers how to run and write tests for the JobEye v4 application. The test suite includes unit tests, integration tests, and component tests.

## Test Structure

```
src/__tests__/
├── setup.ts                    # Global test setup and configuration
├── mocks/                      # Mock implementations
│   ├── supabase.ts            # Supabase client mocks
│   ├── styleMock.js           # CSS mock for Jest
│   └── fileMock.js            # File import mock for Jest
├── lib/                       # Library tests
│   ├── supabase/              # Supabase client tests
│   └── repositories/          # Repository pattern tests
├── components/                # Component tests
│   └── auth/                  # Authentication component tests
└── integration/               # Integration tests
    └── auth-flow.test.ts      # Full auth flow integration test
```

## Running Tests

### Install Dependencies
First, ensure all test dependencies are installed:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom jest-watch-typeahead babel-jest identity-obj-proxy
```

### Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in CI mode
npm run test:ci

# Use the test runner script
./scripts/run-tests.sh [unit|integration|watch|coverage|ci]
```

## Test Coverage

The project has coverage thresholds set at 80% for:
- Branches
- Functions
- Lines
- Statements

View the coverage report after running tests with coverage:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Writing Tests

### Unit Test Example
```typescript
import { CustomerRepository } from '@/lib/repositories/customer.repository';
import { createMockSupabaseClient } from '@/__tests__/mocks/supabase';

describe('CustomerRepository', () => {
  let repository: CustomerRepository;
  
  beforeEach(() => {
    const mockSupabase = createMockSupabaseClient();
    repository = new CustomerRepository(mockSupabase);
  });

  it('should find customer by ID', async () => {
    const customer = await repository.findById('123');
    expect(customer).toBeDefined();
  });
});
```

### Component Test Example
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import SignInForm from '@/components/auth/SignInForm';

describe('SignInForm', () => {
  it('should render email and password fields', () => {
    render(<SignInForm />);
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });
});
```

### Integration Test Example
```typescript
describe('Authentication Flow', () => {
  it('should handle complete sign in flow', async () => {
    // 1. User signs in
    const signInResult = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'password123',
    });
    
    // 2. Check tenant assignment
    const tenant = await supabase
      .from('tenant_assignments')
      .select('*')
      .eq('user_id', signInResult.data.user.id)
      .single();
      
    expect(tenant.data).toBeDefined();
  });
});
```

## Mocking

### Supabase Client Mock
The project includes comprehensive Supabase mocks in `src/__tests__/mocks/supabase.ts`:

```typescript
import { createMockSupabaseClient, mockCustomer } from '@/__tests__/mocks/supabase';

const mockSupabase = createMockSupabaseClient();
const customer = mockCustomer({ name: 'Test Customer' });
```

### Available Mock Generators
- `mockCustomer()` - Generate customer test data
- `mockJob()` - Generate job test data
- `mockVoiceTranscript()` - Generate voice transcript test data

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Mock External Dependencies**: Always mock Supabase and other external services
3. **Use Descriptive Names**: Test names should clearly describe what is being tested
4. **Follow AAA Pattern**: Arrange, Act, Assert
5. **Test Edge Cases**: Include tests for error states and edge cases
6. **Keep Tests Simple**: Each test should focus on one specific behavior

## Debugging Tests

### Run a Single Test File
```bash
npm test -- src/__tests__/lib/repositories/customer.repository.test.ts
```

### Run Tests Matching a Pattern
```bash
npm test -- --testNamePattern="should find customer by ID"
```

### Debug in VS Code
Add this configuration to `.vscode/launch.json`:

```json
{
  "type": "node",
  "name": "Debug Jest Tests",
  "request": "launch",
  "args": [
    "node_modules/.bin/jest",
    "--runInBand",
    "--no-cache",
    "${file}"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Continuous Integration

For CI environments, use:
```bash
npm run test:ci
```

This runs tests with:
- Coverage reporting
- No watch mode
- Limited parallel workers
- CI-optimized output

## Troubleshooting

### Common Issues

1. **Module not found errors**
   - Ensure all dependencies are installed
   - Check that path aliases in `jest.config.js` match `tsconfig.json`

2. **Async test timeouts**
   - Increase timeout: `jest.setTimeout(10000)`
   - Ensure all promises are awaited

3. **Mock not working**
   - Clear mocks between tests: `jest.clearAllMocks()`
   - Check mock implementation matches actual interface

4. **Coverage not meeting threshold**
   - Write tests for edge cases
   - Test error handling paths
   - Add integration tests for complex flows