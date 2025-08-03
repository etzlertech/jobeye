# 🏗️ Control Tower Local Development Setup

The Construction Control Tower is designed to run locally during development for full access to your codebase and git history.

## Quick Start

### 1. Environment Variables
Copy the environment template and add your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your actual values:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CONTROL_TOWER_ENABLED=true
NODE_ENV=development
```

### 2. Start Development Server
```bash
npm install
npm run dev
```

### 3. Access Control Tower
Open your browser and go to:
- **Homepage:** http://localhost:3000 (or 3001 if 3000 is busy)
- **Control Tower:** http://localhost:3000/(control-tower)

## Features Available Locally

### ✅ **Full Manifest Generation**
- Real-time analysis of your actual codebase
- Git branch and commit information
- File count and completion statistics
- Voice-first compliance metrics
- Automatic saving to Supabase database

### ✅ **Development Tools**
- Live codebase scanning
- Progress tracking with real data
- Architecture health monitoring
- Standards compliance checking

## Railway vs Local

| Feature | Local Development | Railway Deployment |
|---------|------------------|-------------------|
| **Manifest Generation** | ✅ Real data | ❌ Demo only |
| **Codebase Analysis** | ✅ Full access | ❌ No source code |
| **Git Information** | ✅ Live git data | ❌ Build artifacts only |
| **Development Workflow** | ✅ Perfect fit | ❌ Wrong environment |
| **Demo/Documentation** | ⚠️ Requires running | ✅ Always available |

## Troubleshooting

### Port Already in Use
If port 3000 is busy, Next.js will automatically use 3001. Check the console output for the correct URL.

### Database Connection Issues
1. Verify your Supabase credentials in `.env.local`
2. Ensure your Supabase project has the Control Tower tables:
   ```bash
   # Apply database migrations
   supabase db push
   ```

### Manifest Generation Fails
1. Ensure you're running in development mode (`NODE_ENV=development`)
2. Verify the `src/` directory exists and contains your source files
3. Check that the `report:progress` script works:
   ```bash
   npm run report:progress
   ```

## Architecture Philosophy

The Control Tower is designed as a **"construction trailer"** - it's on-site during development but separate from the main application. This ensures:

- 🏗️ **Isolation:** No production bundle pollution
- 🔒 **Security:** Developer-only access controls
- 🚀 **Performance:** Zero impact on end-user application
- 📊 **Insight:** Full development workflow visibility

## Next Steps

Once you have the Control Tower running locally:

1. **Generate your first manifest** to see real project metrics
2. **Explore the dashboard** to understand your architecture health
3. **Use it as part of your development workflow** for progress tracking
4. **Generate reports** for architectural reviews and audits

---

*The Control Tower runs locally for development and deploys to Railway for documentation/demo purposes.*