// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/property/validators/property-validators.ts
// phase: 2
// domain: property-management
// purpose: Validate property data with address verification and voice support
// spec_ref: phase2/property-management#validators
// version: 2025-08-1
// complexity_budget: 200 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/property/types/property-types
//     - /src/core/errors/error-types
//   external:
//     - zod: ^3.23.8
//
// exports:
//   - validatePropertyCreate: function - Validate new property
//   - validatePropertyUpdate: function - Validate updates
//   - validateAddress: function - Address validation
//   - validateServiceLocation: function - Service detail validation
//   - normalizeAddress: function - Address standardization
//   - getVoiceFriendlyError: function - Voice error messages
//
// voice_considerations: |
//   Provide voice-friendly validation errors.
//   Support flexible address formats from voice input.
//   Validate gate codes are speakable.
//   Ensure landmarks are properly formatted.
//
// test_requirements:
//   coverage: 95%
//   test_files:
//     - src/__tests__/domains/property/validators/property-validators.test.ts
//
// tasks:
//   1. Create property validation schemas
//   2. Add address validation logic
//   3. Implement gate code validation
//   4. Build voice error formatting
//   5. Add coordinate validation
//   6. Create business rule validators
// --- END DIRECTIVE BLOCK ---

// Implementation will go here
export {}; // Ensure module scope
