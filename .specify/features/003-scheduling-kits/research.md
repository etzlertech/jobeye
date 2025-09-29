# Research Findings: Scheduling, Day Plan & Kit Assignment

## Executive Summary

This document consolidates research findings for implementing the voice-driven scheduling system with offline-first capabilities, route optimization, and real-time notifications for the JobEye field service management platform.

## Route Optimization

### Decision: Hybrid Approach with Mapbox Primary
**Rationale**: Mapbox Optimization API v2 provides the best balance of cost ($5/1000 requests after 50k free), features (time windows, vehicle capacity), and field service specific capabilities.

**Alternatives Considered**:
- Google Maps Route Optimization: Better real-time traffic but more expensive
- GraphHopper/OpenRouteService: Self-hosted options requiring infrastructure management
- Pure PostGIS: Limited to basic distance calculations without traffic consideration

### Implementation Strategy:
1. **PostGIS Foundation**: Use for spatial queries and distance matrix caching
2. **Mapbox API**: Primary optimization engine for online route calculation
3. **Offline Fallback**: Nearest neighbor heuristic with 2-opt improvements
4. **Performance**: Cluster large routes (>30 stops) before optimization
5. **Re-optimization**: Trigger after each job completion if savings >10 minutes

## Notification System (Twilio)

### Decision: Supabase Edge Functions with Multi-Channel Strategy
**Rationale**: Edge functions provide global distribution, automatic scaling, direct database access, and cost-effective execution compared to Next.js API routes.

**Alternatives Considered**:
- Next.js API Routes: Higher latency, requires separate deployment
- Direct database triggers: Limited flexibility for complex notification logic
- Third-party services (SendGrid, OneSignal): Additional vendor lock-in

### Notification Priority:
1. Push Notifications (fastest, free)
2. SMS ($0.0079/message)
3. Voice Calls ($0.0140/minute) - emergency only

### Security Implementation:
- Credentials stored in Supabase Edge Function Secrets
- Rate limiting per user/job
- Webhook signature verification
- Cost caps with daily threshold alerts ($50 default)

## Offline-First Sync Architecture

### Decision: PowerSync Integration with Custom Conflict Resolution
**Rationale**: PowerSync is the most mature offline-first solution for Supabase with automatic conflict resolution, native RLS support, and WAL replication handling.

**Alternatives Considered**:
- Custom sync implementation: High complexity, requires extensive testing
- WatermelonDB: Limited Supabase integration
- RxDB: Requires additional sync server infrastructure

### Conflict Resolution Strategy:
- **Role-based priority**: dispatcher > supervisor > technician
- **Field-level resolution**: Different roles win for different fields
- **Version vectors**: Track changes at field level for granular merging
- **Audit trail**: All conflicts logged for review

### Cache Management (100MB limit):
- **Tiered approach**: 
  - Critical (40MB): Active schedules, current week
  - Important (30MB): Next 2 weeks, recent history
  - Standard (20MB): Equipment, customer data
  - Low Priority (10MB): Historical data
- **Smart eviction**: Based on access patterns and role
- **Compression**: For data older than 7 days

## Technology Stack Decisions

### Frontend:
- **Next.js 14 App Router**: Server components for initial load performance
- **TanStack Query**: Client-side cache management with offline support
- **IndexedDB**: Primary offline storage (via Dexie.js for better API)
- **Service Workers**: Via Workbox for easier management

### Backend:
- **Supabase**: PostgreSQL with PostGIS extension
- **Edge Functions**: For complex operations and integrations
- **Real-time subscriptions**: For live schedule updates

### Voice Integration:
- **Intent recognition**: Extend existing voice pipeline
- **Confirmation flows**: For critical actions (scheduling, overrides)
- **Offline queuing**: Voice commands stored and synced later

## Performance Targets Validation

### Route Optimization:
- **<3s for 50 stops**: Achievable with clustering strategy
- **Mapbox typically returns in 500-1500ms** for 30 stops
- **Offline calculation**: 1-2s using nearest neighbor

### Day Plan Load:
- **<500ms target**: Achievable with:
  - Server component initial render
  - Optimistic cache updates
  - Background data refresh

### Voice-to-Schedule:
- **<2s target**: Requires:
  - Pre-loaded intent patterns
  - Optimistic UI updates
  - Background API calls

## Implementation Risks & Mitigations

### Risk: Route optimization costs
**Mitigation**: Implement intelligent caching, batch optimizations, use free tier effectively

### Risk: Notification delivery reliability
**Mitigation**: Multi-channel approach, delivery confirmations, retry logic

### Risk: Offline sync conflicts
**Mitigation**: Clear role-based rules, audit trail, supervisor override capability

### Risk: 100MB cache limit exceeded
**Mitigation**: Smart prefetching, tiered eviction, data compression

## Recommended Implementation Order

1. **Database schema and RLS policies** (Week 1)
2. **Basic CRUD services with repositories** (Week 1-2)
3. **Offline queue and sync foundation** (Week 2-3)
4. **Route optimization integration** (Week 3-4)
5. **Notification system** (Week 4)
6. **Voice command integration** (Week 5-6)
7. **Full offline sync with PowerSync** (Week 6-7)
8. **UI components and integration** (Week 7-8)
9. **Testing and optimization** (Week 9-10)

## Cost Projections

### Monthly Operational Costs (1000 technicians):
- **Mapbox**: ~$250 (50k optimizations)
- **Twilio SMS**: ~$150 (20k notifications)
- **PowerSync**: ~$500 (1000 devices)
- **Total**: ~$900/month

### Development Investment:
- **Initial implementation**: 10 weeks
- **PowerSync integration**: +2 weeks
- **Testing and optimization**: +2 weeks

## Key Success Factors

1. **Implement field-level conflict resolution** from the start
2. **Design for offline-first**, not offline-as-afterthought
3. **Monitor cache usage** proactively with telemetry
4. **Use optimistic updates** for better perceived performance
5. **Implement comprehensive audit logging** for compliance
6. **Test with real field conditions** (poor connectivity, device constraints)

## Next Steps

With research complete and no remaining NEEDS CLARIFICATION items, proceed to Phase 1 design:
- Create detailed data models
- Design API contracts
- Generate contract tests
- Create quickstart guide