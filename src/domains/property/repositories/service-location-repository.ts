// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/property/repositories/service-location-repository.ts
// phase: 2
// domain: property-management
// purpose: Manage service-specific location details and access instructions
// spec_ref: phase2/property-management#service-location
// version: 2025-08-1
// complexity_budget: 250 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/lib/repositories/base.repository
//     - /src/domains/property/types/property-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - ServiceLocationRepository: class - Service location data access
//   - createServiceLocation: function - Add service details
//   - updateAccessInstructions: function - Update access info
//   - findByProperty: function - Get service locations
//   - updateGateCode: function - Update security codes
//
// voice_considerations: |
//   Store gate codes in voice-speakable format.
//   Track pet warnings and special instructions.
//   Support natural language access directions.
//   Enable voice updates to access information.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/property/repositories/service-location-repository.test.ts
//
// tasks:
//   1. Extend BaseRepository
//   2. Implement service location CRUD
//   3. Add access instruction management
//   4. Create gate code handling
//   5. Build special instruction storage
//   6. Add voice metadata support
// --- END DIRECTIVE BLOCK ---

// Implementation will go here
export {}; // Ensure module scope
