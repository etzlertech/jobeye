# Monitoring and Logging Setup Guide

**Version**: 1.0  
**Last Updated**: 2025-09-30  
**Audience**: DevOps engineers and system administrators

## Application Monitoring

### Built-in Health Dashboard
1. Log in as Admin
2. Navigate to Settings > System > Health
3. View metrics:
   - API response times
   - Error rates
   - Database performance
   - Background job status

### External Monitoring (Optional)

**Sentry** (Error Tracking):
```bash
npm install @sentry/nextjs
```

Configure `sentry.config.js`:
```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
});
```

**Datadog** (APM):
```bash
npm install dd-trace
```

## Logging

### Application Logs

**Voice-Aware Logger** (built-in):
```typescript
import { VoiceLogger } from '@/core/logger/voice-logger';

const logger = new VoiceLogger('my-service');

logger.info('Job completed', { 
  jobId, 
  duration,
  isVoiceAction: true 
});

logger.error('API error', { error, userId });
```

**Log Levels**:
- INFO: Normal operations
- WARN: Potential issues
- ERROR: Errors requiring attention
- CRITICAL: System failures

### Viewing Logs

**In Application**:
1. Settings > System > Logs
2. Filter by level, date, user
3. Export to CSV

**Supabase Logs**:
1. Supabase Dashboard
2. Logs section
3. Filter by service (API, Database, Auth)

## Alerts

### Configuring Alerts
1. Settings > System > Alerts
2. Add alert rules:
   - High error rate (>1%)
   - Slow API (>2s avg)
   - Failed background jobs
   - Budget cap approaching

### Alert Channels
- Email
- SMS (Twilio integration)
- Slack (webhook)
- PagerDuty (enterprise)

## Performance Monitoring

### Key Metrics to Monitor
- **API Response Time**: <500ms (p95)
- **Database Query Time**: <100ms (p95)
- **GPS Tracking**: 30s interval maintained
- **Offline Queue**: <100 pending items
- **Error Rate**: <0.5%

### Setting Up Monitoring

**Uptime Monitoring** (UptimeRobot):
- Ping https://your-domain.com every 5 minutes
- Alert if down for >2 minutes

**Performance Monitoring** (Vercel Analytics):
- Automatically enabled on Vercel
- View in Vercel Dashboard > Analytics

## Database Monitoring

**Supabase Monitoring**:
1. Supabase Dashboard > Database
2. View:
   - Connection pool usage
   - Query performance
   - Table sizes
   - Index usage

**Slow Query Detection**:
- Automatic in Settings > System > Performance
- Queries >1s are flagged
- Optimization suggestions provided

---
**Document Version**: 1.0
