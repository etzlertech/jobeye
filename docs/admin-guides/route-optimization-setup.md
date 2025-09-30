# Route Optimization Setup Guide

**Version**: 1.0  
**Last Updated**: 2025-09-30  
**Audience**: Dispatchers and system administrators

## Mapbox Integration

### Setup
1. Create Mapbox account at mapbox.com (free tier: 100K requests/month)
2. Generate API token
3. Settings > Integrations > Mapbox > Paste token
4. Test connection

### Daily Optimization Workflow
1. Navigate to Routes
2. Select date and crew
3. Review unoptimized schedule
4. Click "Optimize Route"
5. Review savings (distance, time, fuel)
6. Apply optimization

### Limits & Fallback
- **Daily Limit**: 1 optimization per dispatcher per day
- **Fallback**: Greedy nearest-neighbor algorithm (no Mapbox cost)
- **Budget**: Monitor in Cost Dashboard

### Property Boundaries
- Draw geofences for each property
- Circular (radius) or polygon
- Arrival: 50m default
- Departure: 100m default

## Best Practices
- Optimize early morning before crews depart
- Group jobs by geographic clusters
- Account for traffic patterns
- Manual reordering available unlimited

---
**Document Version**: 1.0
