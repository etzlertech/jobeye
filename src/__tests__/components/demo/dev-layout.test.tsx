/*
AGENT DIRECTIVE BLOCK
file: /src/__tests__/components/demo/dev-layout.test.tsx
phase: dev-crud
domain: supervisor
purpose: Ensure DevLayout renders navigation for demo CRUD pages
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 80
dependencies:
  internal:
    - '@/components/demo/DevLayout'
  external:
    - '@testing-library/react'
voice_considerations:
  - N/A (test)
*/

import { render, screen } from '@testing-library/react';
import DevLayout from '@/components/demo/DevLayout';

describe('DevLayout', () => {
  it('renders navigation links and content', () => {
    render(
      <DevLayout title="Demo Tools">
        <div data-testid="content">Hello Demo</div>
      </DevLayout>
    );

    expect(screen.getByRole('heading', { name: /Demo Tools/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Customers/i })).toHaveAttribute('href', '/demo-crud');
    expect(screen.getByRole('link', { name: /Properties/i })).toHaveAttribute('href', '/demo-properties');
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});
