/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-properties/utils.ts
phase: dev-crud
domain: supervisor
purpose: Utility helpers for dev property CRUD flows
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 120
dependencies:
  internal:
    - '@/app/demo-properties/_components/PropertyForm'
  external: []
voice_considerations:
  - Centralizing formatting ensures consistent spoken prompts for addresses
*/

import type { PropertyFormState } from '@/app/demo-properties/_components/PropertyForm';

export function formatPropertyAddress(address: Record<string, any> | string | null): string {
  if (!address) {
    return 'Address not set';
  }

  if (typeof address === 'string') {
    return address;
  }

  const parts = [
    address.line1 || address.street || address.address1,
    [address.city, address.state].filter(Boolean).join(', '),
    address.postalCode || address.postal_code || address.zip
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' ') : 'Address not set';
}

export function buildPropertyPayload(form: PropertyFormState) {
  return {
    customer_id: form.customerId,
    name: form.propertyName || form.addressLine1,
    property_number: `PROP-${Date.now()}`,
    address: {
      line1: form.addressLine1,
      city: form.city || 'N/A',
      state: form.state || 'N/A',
      postal_code: form.postalCode || '00000'
    },
    is_active: true,
    metadata: {},
    photos: [],
    access_notes: form.notes || null,
    special_instructions: null,
    gate_code: null,
    voice_navigation_notes: null,
    zones: null,
    location: null,
    property_type: null,
    size_sqft: null,
    lot_size_acres: null
  };
}
