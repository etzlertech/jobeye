# API Key Configuration Guide

**Version**: 1.0  
**Last Updated**: 2025-09-30  
**Audience**: System administrators

## Required API Keys

### Supabase
**Purpose**: Database, authentication, storage

**Setup**:
1. Sign up at supabase.com
2. Create new project
3. Navigate to Settings > API
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

**Security**: Never expose service_role key in client code.

### OpenAI (Optional)
**Purpose**: OCR, task parsing, AI features

**Setup**:
1. Sign up at platform.openai.com
2. Navigate to API Keys
3. Create new key
4. Copy key → `OPENAI_API_KEY`

**Cost Management**:
- Set billing limits in OpenAI dashboard
- Monitor usage in JobEye Cost Dashboard
- Average: $50-100/month for 50-user company

### Mapbox (Optional)
**Purpose**: Route optimization, geocoding

**Setup**:
1. Sign up at mapbox.com
2. Navigate to Account > Tokens
3. Create token with scopes: Directions, Geocoding
4. Copy token → `MAPBOX_API_TOKEN`

**Free Tier**: 100,000 requests/month (sufficient for most)

## Environment Variable Storage

### Local Development
`.env.local` file (not committed to Git):
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
MAPBOX_API_TOKEN=...
```

### Production (Railway)
1. Project Settings > Variables
2. Add each key-value pair
3. Redeploy after adding

### Production (Vercel)
1. Project Settings > Environment Variables
2. Add variables
3. Redeploy

## Security Best Practices

- ✅ Use separate API keys for staging/production
- ✅ Rotate keys quarterly
- ✅ Restrict key permissions when possible
- ✅ Monitor key usage for anomalies
- ❌ Never commit keys to Git
- ❌ Don't share keys via email/Slack

---
**Document Version**: 1.0
