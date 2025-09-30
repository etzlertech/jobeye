# Backup and Disaster Recovery Guide

**Version**: 1.0  
**Last Updated**: 2025-09-30  
**Audience**: System administrators and IT managers

## Automatic Backups

### Supabase Backups
**Automatic Schedule**:
- **Full Backup**: Daily at 2:00 AM UTC
- **Incremental**: Every hour
- **Retention**: 30 days (standard), 90 days (enterprise)

**No Configuration Needed**: Supabase handles automatically.

### Viewing Backups
1. Supabase Dashboard
2. Settings > Database > Backups
3. See list of available backups with timestamps

## Manual Backups

### Creating Manual Backup
1. Log in to JobEye as Admin
2. Settings > System > Backups
3. Click "Create Manual Backup"
4. Backup created and stored
5. Download option available

### Exporting Data
```bash
# Export all data as JSON
npm run export:data -- --format=json --output=backup.json

# Export specific tables
npm run export:data -- --tables=jobs,customers,time_entries
```

## Restore Procedures

### Restoring from Backup

**Process**:
1. Contact support@jobeye.com
2. Provide:
   - Backup date/time to restore
   - Reason for restore
   - Approval from authorized personnel
3. Support team performs restore
4. Typical time: 1-2 hours
5. Downtime: 15-30 minutes during restore

**Testing Restores**:
- Quarterly restore tests recommended
- Restore to staging environment
- Verify data integrity

## Disaster Recovery Plan

### RTO and RPO
- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 1 hour (incremental backups)

### Disaster Scenarios

**Scenario 1: Data Corruption**
1. Identify corrupted data
2. Determine last known good state
3. Contact support for restore
4. Restore specific tables if possible
5. Validate restored data

**Scenario 2: Supabase Outage**
1. Monitor status.supabase.com
2. Enable maintenance mode in JobEye
3. Wait for Supabase recovery
4. Test system after recovery
5. Review any data loss

**Scenario 3: Accidental Deletion**
1. Immediately stop operations
2. Contact support (don't wait!)
3. Provide deleted data details
4. Restore from most recent backup
5. Review access controls

### Emergency Contacts
- **JobEye Support**: support@jobeye.com
- **Phone**: 1-800-JOBEYE-1
- **Emergency (Enterprise)**: 24/7 hotline in support portal

## Data Retention Policies

### Application Data
- **Active Data**: Unlimited retention
- **GPS Breadcrumbs**: 90 days
- **Voice Recordings**: 30 days
- **Logs**: 90 days
- **Audit Trail**: 1 year

### Configuring Retention
1. Settings > System > Data Retention
2. Set retention periods per data type
3. Automatic cleanup jobs run daily

## Compliance Backups

### Regulatory Requirements
- **GDPR**: Data export on request
- **Labor Law**: 7-year retention (time records)
- **Tax**: 7-year retention (invoices, payments)

### Long-Term Archives
1. Export data quarterly
2. Store in secure location (S3, on-premise)
3. Encrypt archives
4. Document archive locations

---
**Document Version**: 1.0
