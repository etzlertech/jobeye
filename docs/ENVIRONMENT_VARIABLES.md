# Environment Variables - Canonical Usage

## ✅ REQUIRED Environment Variables

### Client-Side (Next.js public, baked at build time)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL (e.g., https://rtwigjwqufozqfwozpvo.supabase.co)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous/public key for browser access

### Server-Side Only
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key with admin access (NEVER expose to client)
- `SAFETY_YOLO_ENDPOINT` - Remote YOLO inference endpoint used by safety verification (fallback: `VISION_YOLO_ENDPOINT`)
- `SAFETY_YOLO_API_KEY` - Optional bearer token passed to the YOLO endpoint (fallback: `VISION_YOLO_API_KEY`)
- `SAFETY_YOLO_MODEL` - Model identifier supplied to the YOLO endpoint (fallback: `VISION_YOLO_MODEL`)
- `SAFETY_YOLO_TIMEOUT_MS` - Request timeout in milliseconds (fallback: `VISION_YOLO_TIMEOUT_MS`, default 15000)
- `VISION_YOLO_ENDPOINT` - Remote YOLO inference endpoint for kit verification workflows
- `VISION_YOLO_API_KEY` - Optional bearer token for the vision YOLO endpoint
- `VISION_YOLO_MODEL` - Preferred model identifier supplied to the vision YOLO endpoint
- `VISION_YOLO_TIMEOUT_MS` - Request timeout in milliseconds for kit verification remote YOLO

## ❌ DO NOT USE These Alternate Names

The following variable names cause confusion and inconsistent behavior:
- `SUPABASE_anonpublic` ❌
- `SUPABASE_PUBLISHABLE_KEY` ❌
- `SUPABASE_SECRET_KEY` ❌
- `SUPABASE_service_role` ❌
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` ❌

## 📁 Usage in Code

### Client Components
```typescript
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```

### Server Components/API Routes
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

### Scripts
```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Then use process.env.NEXT_PUBLIC_SUPABASE_URL etc.
```

## 🚨 Important Notes

1. **Build Time vs Runtime**: `NEXT_PUBLIC_*` variables are baked into the client bundle at build time. Changes require a rebuild.

2. **Railway Deployment**: Ensure Railway has the exact same variable names as local development.

3. **No Hardcoding**: Never hardcode URLs or keys in scripts. Always use environment variables.

4. **Single Source of Truth**: Use only the canonical names listed above across all environments.
5. For safety verification, prefer the `SAFETY_YOLO_*` variables; `VISION_YOLO_*` now powers kit verification and acts as a fallback for safety when the dedicated values are missing.

## 🔍 Debugging Tips

To verify your environment:
```bash
# Check local env
grep -E "NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local

# Decode JWT to check project ref
node -e "console.log(JSON.parse(Buffer.from(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.split('.')[1], 'base64')))"
```

The `ref` in the decoded JWT must match the project ID in your URL.
