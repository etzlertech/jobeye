# MVP Deployment Guide

> **Feature 007**: Intent-Driven Mobile App Deployment Documentation

## Overview

This guide covers deploying the MVP Intent-Driven Mobile App to production environments, with primary support for Railway.app and alternative deployment options.

## Prerequisites

### Required Accounts
- **GitHub**: Source code repository
- **Railway.app**: Primary hosting platform
- **Supabase**: Database and authentication
- **OpenAI**: VLM API access (optional but recommended)

### Required Tools
- **Node.js**: 18.x or later
- **npm**: 9.x or later
- **Git**: Version control
- **Railway CLI**: For deployment management

## Environment Setup

### 1. Environment Variables

Create `.env.local` for development and configure the following in Railway:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (Optional - for VLM features)
OPENAI_API_KEY=sk-...

# Application Configuration
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Security (Auto-generated in Railway)
NEXTAUTH_SECRET=your-secure-secret
NEXTAUTH_URL=https://your-app.railway.app
```

### 2. Supabase Project Setup

#### Database Configuration
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('super_admin', 'supervisor', 'crew');
CREATE TYPE job_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
```

#### Storage Buckets
```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('job-photos', 'job-photos', true),
  ('voice-recordings', 'voice-recordings', false),
  ('equipment-images', 'equipment-images', true);

-- Storage policies
CREATE POLICY "Users can upload job photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-photos');
```

#### Row Level Security Policies
```sql
-- Jobs table policies
CREATE POLICY "Users see jobs from their company" ON jobs
  FOR ALL TO authenticated
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- User management policies  
CREATE POLICY "Admins manage company users" ON auth.users
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin' AND
    (auth.jwt() ->> 'company_id') = (raw_app_meta_data ->> 'company_id')
  );
```

## Railway.app Deployment

### 1. Railway Project Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init
railway link
```

### 2. Railway Configuration

Create `railway.toml`:
```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "never"

[env]
NODE_ENV = "production"
```

### 3. Deployment Pipeline

```bash
# Deploy to Railway
git push origin main

# Monitor deployment
railway logs

# Check deployment status
railway status
```

### 4. Custom Domain Setup

```bash
# Add custom domain
railway domain

# Configure DNS (add CNAME record)
CNAME your-app.yourdomain.com -> your-app.railway.app
```

### 5. Railway Monitoring Commands

```bash
# Monitor specific deployment
npm run railway:monitor <deployment-id>

# View build logs
npm run railway:build-logs <deployment-id>

# View runtime logs
npm run railway:deploy-logs <deployment-id>

# Check latest deployment
npm run railway:check
```

## Alternative Deployment Options

### 1. Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod

# Configure environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

Create `vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

### 2. Docker Deployment

```dockerfile
# Multi-stage Dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS production
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package*.json ./

EXPOSE 3000
CMD ["npm", "start"]
```

Build and deploy:
```bash
# Build image
docker build -t jobeye-mvp .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  -e SUPABASE_SERVICE_ROLE_KEY=your_key \
  jobeye-mvp
```

### 3. AWS Deployment

Using AWS Amplify:
```yaml
# amplify.yml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

## Production Configuration

### 1. Performance Optimization

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@supabase/supabase-js']
  },
  images: {
    domains: ['your-project.supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  httpAgentOptions: {
    keepAlive: true,
  }
};

module.exports = nextConfig;
```

### 2. Security Headers

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CSP for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;"
    );
  }

  return response;
}
```

### 3. Database Connection Pooling

```typescript
// lib/supabase/client.ts
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    db: {
      schema: 'public',
    },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 2
      }
    }
  }
);
```

## Monitoring & Observability

### 1. Health Checks

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkStorage(),
    checkVoiceAPI(),
    checkVisionAPI()
  ]);

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: checks[0].status === 'fulfilled' ? 'up' : 'down',
      storage: checks[1].status === 'fulfilled' ? 'up' : 'down',
      voice: checks[2].status === 'fulfilled' ? 'up' : 'down',
      vision: checks[3].status === 'fulfilled' ? 'up' : 'down'
    },
    version: process.env.npm_package_version || '1.0.0'
  };

  const statusCode = Object.values(health.services).every(s => s === 'up') ? 200 : 503;
  return Response.json(health, { status: statusCode });
}
```

### 2. Error Tracking

```typescript
// lib/monitoring/error-tracker.ts
export class ErrorTracker {
  static track(error: Error, context: any) {
    const errorEvent = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      environment: process.env.NODE_ENV
    };

    // Send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(errorEvent);
    } else {
      console.error('Error tracked:', errorEvent);
    }
  }

  private static async sendToMonitoring(event: any) {
    // Implementation depends on monitoring service
    // Could be Sentry, LogRocket, etc.
  }
}
```

### 3. Performance Monitoring

```typescript
// lib/monitoring/performance.ts
export function trackPerformance() {
  if (typeof window !== 'undefined') {
    // Core Web Vitals tracking
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(sendToAnalytics);
      getFID(sendToAnalytics);
      getFCP(sendToAnalytics);
      getLCP(sendToAnalytics);
      getTTFB(sendToAnalytics);
    });
  }
}

function sendToAnalytics(metric: any) {
  // Send to analytics service
  console.log('Performance metric:', metric);
}
```

## SSL/TLS Configuration

### 1. Railway SSL
Railway automatically provides SSL certificates for all deployments.

### 2. Custom Domain SSL
```bash
# Railway handles SSL automatically for custom domains
railway domain add yourdomain.com

# Verify SSL certificate
curl -I https://yourdomain.com
```

### 3. HSTS Configuration
```typescript
// Security headers include HSTS
response.headers.set(
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains; preload'
);
```

## Backup & Recovery

### 1. Database Backups
Supabase automatically creates daily backups. For additional protection:

```bash
# Manual backup
pg_dump -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  --verbose --clean --no-owner --no-privileges \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Storage Backups
```typescript
// Backup critical files
async function backupStorageFiles() {
  const files = await supabase.storage
    .from('job-photos')
    .list();

  for (const file of files.data || []) {
    const { data } = await supabase.storage
      .from('job-photos')
      .download(file.name);
    
    // Save to backup location
  }
}
```

### 3. Configuration Backups
```bash
# Export environment variables
railway variables > env_backup_$(date +%Y%m%d).txt

# Export database schema
pg_dump --schema-only -h db.your-project.supabase.co \
  -U postgres -d postgres > schema_backup.sql
```

## Scaling Configuration

### 1. Horizontal Scaling
Railway automatically scales based on traffic. Configure scaling limits:

```bash
# Set scaling limits in Railway dashboard
Min instances: 1
Max instances: 10
CPU threshold: 80%
Memory threshold: 85%
```

### 2. Database Scaling
```sql
-- Optimize for high concurrency
SET max_connections = 200;
SET shared_buffers = '256MB';
SET effective_cache_size = '1GB';
SET work_mem = '4MB';
```

### 3. CDN Configuration
Configure Supabase Storage CDN:
```typescript
const CDN_URL = 'https://your-project.supabase.co/storage/v1/object/public';

export function getOptimizedImageUrl(path: string, width?: number) {
  const params = width ? `?width=${width}&quality=80` : '';
  return `${CDN_URL}/${path}${params}`;
}
```

## Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates active
- [ ] Health checks passing
- [ ] Performance optimized
- [ ] Security headers configured
- [ ] Error tracking enabled
- [ ] Monitoring dashboards setup

### Post-Deployment
- [ ] Application accessible
- [ ] Authentication working
- [ ] Voice features functional
- [ ] Camera access working
- [ ] Offline sync operational
- [ ] Performance metrics normal
- [ ] Error rates acceptable
- [ ] User acceptance testing passed

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   railway logs --deployment <deployment-id>
   
   # Common fixes
   npm run build  # Test locally
   npm ci --force # Clear node_modules
   ```

2. **Environment Variable Issues**
   ```bash
   # List current variables
   railway variables
   
   # Add missing variable
   railway variables set KEY=value
   ```

3. **Database Connection Issues**
   ```bash
   # Test database connection
   npm run check:db-actual
   
   # Check Supabase status
   curl https://status.supabase.com/api/v2/status.json
   ```

4. **SSL Certificate Issues**
   ```bash
   # Check certificate status
   curl -I https://your-app.railway.app
   
   # Force certificate renewal (Railway support)
   railway support
   ```

### Performance Issues
- Check Core Web Vitals in deployment logs
- Monitor memory usage and optimize caching
- Verify database query performance
- Check image optimization settings

### Security Issues
- Verify CSP headers are properly set
- Check for exposed sensitive data in logs
- Validate authentication flows
- Test RLS policies

## Maintenance

### Regular Tasks
- **Weekly**: Review error logs and performance metrics
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Database cleanup and optimization
- **Annually**: SSL certificate renewal (automatic with Railway)

### Update Process
```bash
# 1. Update dependencies
npm update

# 2. Test locally
npm run test
npm run build
npm run start

# 3. Deploy to staging
git push origin staging

# 4. Run E2E tests
npm run test:e2e

# 5. Deploy to production
git push origin main
```

---

This deployment guide ensures a reliable, secure, and scalable production environment for the MVP Intent-Driven Mobile App.