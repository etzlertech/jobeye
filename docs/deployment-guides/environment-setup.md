# Environment Setup Guide

**Version**: 1.0  
**Last Updated**: 2025-09-30  
**Audience**: DevOps engineers and system administrators

## Prerequisites
- Node.js 18+ and npm
- Supabase account
- Git

## Local Development Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/jobeye.git
cd jobeye
npm install
```

### 2. Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
OPENAI_API_KEY=sk-...
MAPBOX_API_TOKEN=pk....
```

### 3. Run Development Server
```bash
npm run dev
# Open http://localhost:3000
```

## Production Deployment

### Railway.app (Recommended)
1. Connect GitHub repo
2. Add environment variables
3. Deploy automatically on push to main

### Vercel
```bash
npm install -g vercel
vercel --prod
```

### Docker
```bash
docker build -t jobeye .
docker run -p 3000:3000 --env-file .env.local jobeye
```

## Environment Variables Reference

### Required
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side service key

### Optional (Feature-Specific)
- `OPENAI_API_KEY`: AI features (OCR, task parsing)
- `MAPBOX_API_TOKEN`: Route optimization
- `NODE_ENV`: production/development

---
**Document Version**: 1.0
