# Cost Tracking Dashboard Guide

**Version**: 1.0  
**Last Updated**: 2025-09-30  
**Audience**: Financial managers and administrators

## AI/LLM Cost Tracking

### OpenAI Costs
- **OCR** (GPT-4 Vision): ~$0.01/request
- **Task Parsing** (GPT-4): ~$0.03/request
- **Completion Verification** (GPT-4V): ~$0.02/request
- **Instruction Search** (Embeddings): ~$0.001/search

### Mapbox Costs
- **Route Optimization**: Free tier (100K/month)
- **Geocoding**: Included
- Daily dispatcher limit enforced (1/day)

### Viewing Costs
1. Analytics > Costs > AI Spending
2. See real-time totals:
   - Today, week, month
   - By feature (OCR, task parsing, etc.)
   - By user/crew
3. Export to CSV

### Budget Management
1. Settings > Integrations > OpenAI
2. Set monthly cap (e.g., $100)
3. Alerts at 80%, 90%, 100%
4. Auto-disable at cap (optional)

## Labor Cost Analytics

### Setup
1. Enter hourly rates in user profiles
2. Set overtime multipliers
3. Track hours worked vs estimated

### Dashboard Metrics
- Total labor cost (regular + OT)
- Utilization rate
- Cost per job
- Overtime percentage
- Monthly forecast

### Cost Optimization
- Monitor OT trends (alert if >20%)
- Compare estimated vs actual hours
- Identify inefficient job types
- Adjust scheduling to reduce OT

---
**Document Version**: 1.0
