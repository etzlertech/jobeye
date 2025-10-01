# Research & Technical Decisions

**Feature**: MVP Intent-Driven Mobile App  
**Date**: 2025-01-27

## Executive Summary

This research consolidates technical decisions for building an intent-driven mobile PWA. Key findings:
- Leverage existing vision services with new intent classification layer
- Use Next.js PWA capabilities for offline support
- Implement role-based routing with middleware
- Reuse existing Supabase tables with minimal new schemas

## Technical Decisions

### 1. Intent Recognition Architecture

**Decision**: Layered approach with intent classifier on top of existing VLM
**Rationale**: 
- Existing dual-vlm.service.ts already handles Gemini/GPT-4 detection
- Adding intent classification prompt is more efficient than new model
- Maintains cost optimization (Gemini first, GPT-4 fallback)

**Alternatives considered**:
- Separate intent model: Rejected - additional latency and cost
- Client-side only: Rejected - need server-side for logging/analytics

**Implementation approach**:
```typescript
// Extend existing VLM prompt
const intentPrompt = `
Classify the user's intent from this image:
1. INVENTORY_ADD - New item not in database
2. JOB_LOAD_VERIFY - Items match assigned job
3. RECEIPT_SCAN - Paper receipt visible
4. MAINTENANCE_EVENT - Equipment damage/issue
5. VEHICLE_ADD - Vehicle/container detection
Return: {intent: string, confidence: number, context: object}
`;
```

### 2. Offline Capabilities

**Decision**: PWA with IndexedDB + Background Sync API
**Rationale**:
- Next.js has built-in PWA support via next-pwa
- IndexedDB already used in offline-queue.ts
- Background Sync handles reconnection automatically

**Alternatives considered**:
- Service Worker cache only: Rejected - need structured data storage
- LocalStorage: Rejected - size limits, no complex queries

**Key components**:
- Cache job data on assignment
- Queue item checks locally
- Sync when online via Background Sync API
- Show sync status in UI

### 3. Role-Based Access Architecture

**Decision**: Middleware-based routing with role checks
**Rationale**:
- Next.js middleware runs before page load
- Single source of truth for role permissions
- Works with existing auth setup

**Alternatives considered**:
- Client-side guards: Rejected - security risk
- Page-level checks: Rejected - repetitive code

**Implementation**:
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const user = await getUser(request);
  const role = user?.app_metadata?.role;
  
  if (request.nextUrl.pathname.startsWith('/supervisor') && role !== 'supervisor') {
    return NextResponse.redirect('/crew');
  }
  // Similar for other role checks
}
```

### 4. Voice Integration Strategy

**Decision**: Web Speech API with server fallback
**Rationale**:
- Native browser support on mobile
- No additional dependencies
- Server fallback for unsupported browsers

**Alternatives considered**:
- Third-party SDK: Rejected - adds complexity
- Server-only: Rejected - higher latency

**Architecture**:
- Client: Web Speech API for STT/TTS
- Server: OpenAI Whisper/TTS for fallback
- LLM: Use existing GPT-4 integration

### 5. Camera Capture Optimization

**Decision**: Canvas-based frame extraction at 1fps
**Rationale**:
- Existing pattern in job-load-checklist-start
- Efficient memory usage
- Easy to throttle/control

**Alternatives considered**:
- MediaRecorder API: Rejected - overkill for images
- WebRTC: Rejected - complexity for simple capture

### 6. Database Schema Extensions

**Decision**: Minimal new tables, extend existing where possible
**Rationale**:
- Reduces migration complexity
- Maintains referential integrity
- Leverages existing RLS policies

**New tables needed**:
- `ai_interaction_logs` - Complete LLM/VLM audit trail
- `intent_classifications` - Intent recognition history
- `offline_sync_queue` - Pending offline operations

**Extended tables**:
- `users` - Add default_role to app_metadata
- `jobs` - Add assigned_vehicle_id
- `equipment_items` - Already has container_id

### 7. UI Component Strategy

**Decision**: Compound component pattern with 4-button constraint
**Rationale**:
- Enforces UI consistency
- Easy to test max button limit
- Composable for different contexts

**Example**:
```typescript
<ActionPanel>
  <ActionPanel.Button primary onClick={handlePrimary}>
    {primaryLabel}
  </ActionPanel.Button>
  <ActionPanel.Button onClick={handleSecondary}>
    {secondaryLabel}
  </ActionPanel.Button>
  {/* Max 2 more buttons */}
</ActionPanel>
```

### 8. Performance Optimization

**Decision**: Progressive enhancement with skeleton states
**Rationale**:
- Better perceived performance
- Graceful degradation
- Works offline

**Key strategies**:
- Lazy load VLM services
- Prefetch job data on login
- Image optimization via Next.js Image
- Virtual scrolling for long lists

### 9. Testing Strategy

**Decision**: Contract-first with visual regression
**Rationale**:
- API contracts ensure integration
- Visual tests catch UI regressions
- E2E tests validate workflows

**Test pyramid**:
- Unit: Business logic, utilities
- Integration: API contracts, service calls  
- E2E: Complete user workflows
- Visual: Screenshot comparisons

### 10. Deployment Architecture

**Decision**: Railway with CDN for assets
**Rationale**:
- Existing Railway setup
- Automatic deployments
- Built-in SSL and scaling

**Optimizations**:
- Static assets to CDN
- API routes remain on Railway
- Database connection pooling
- Redis for session cache (future)

## Implementation Priority

1. **Core Intent System** - Foundation for everything
2. **Role-based routing** - Security and access control
3. **Offline support** - Critical for field use
4. **Camera/Voice UI** - User interaction layer
5. **Analytics logging** - Performance tracking

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| VLM API downtime | Offline mode with manual entry |
| Poor image quality | Clear UI feedback, retry options |
| Role permission errors | Comprehensive middleware tests |
| Offline sync conflicts | Last-write-wins with audit log |
| Performance on old devices | Progressive enhancement |

## Dependencies to Monitor

- Gemini API quotas and pricing
- Web Speech API browser support
- IndexedDB storage limits
- Next.js PWA plugin updates
- Supabase connection limits

## Next Steps

With research complete, Phase 1 will:
1. Define data models for new entities
2. Create API contracts for all endpoints
3. Generate contract tests
4. Update quickstart guide
5. Configure development environment