// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/property/services/property-voice-commands.ts
// phase: 2
// domain: property-management
// purpose: Natural language command processing for property operations
// spec_ref: phase2/property-management#voice-commands
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/property/types/property-types
//     - /src/domains/property/services/property-service
//     - /src/domains/voice/types/voice-types
//     - /src/core/logger/voice-logger
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - PropertyVoiceCommandHandler: class - Voice command processor
//   - parsePropertyCommand: function - Parse voice to command
//   - executePropertyCommand: function - Execute parsed command
//   - getPropertySuggestions: function - Context-aware hints
//
// voice_considerations: |
//   Support commands like "add property at 123 Main Street".
//   Handle "show properties for John Doe" queries.
//   Parse "update gate code to 1234" commands.
//   Enable "find properties near downtown" searches.
//   Support "add service note about broken sprinkler" updates.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/property/services/property-voice-commands.test.ts
//
// tasks:
//   1. Define command patterns
//   2. Implement address parsing
//   3. Create command execution
//   4. Add context management
//   5. Build suggestion engine
//   6. Handle offline commands
// --- END DIRECTIVE BLOCK ---

// Implementation will go here
export {}; // Ensure module scope
