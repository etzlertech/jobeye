#!/usr/bin/env python3
"""
Generate TypeScript types from Supabase schema via API
Task: T006a - Regenerate TypeScript types
"""
import requests
import sys

# From .env.local
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"
PROJECT_REF = "rtwigjwqufozqfwozpvo"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
}

print("Generating TypeScript types from Supabase schema...")
print(f"Project: {PROJECT_REF}\n")

try:
    # Use Supabase Management API to generate types
    # https://supabase.com/docs/reference/cli/supabase-gen-types-typescript

    # Alternative: Use the generator endpoint if available
    response = requests.get(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/types/typescript",
        headers={
            **headers,
            "Content-Type": "application/json"
        },
        timeout=30
    )

    if response.status_code == 200:
        types_content = response.text

        # Write to file
        output_file = "src/types/database.ts"
        with open(output_file, 'w') as f:
            f.write(types_content)

        print(f"✅ TypeScript types generated successfully!")
        print(f"   Output: {output_file}")
        print(f"   Size: {len(types_content)} bytes")

        # Check if job_assignments is included
        if 'job_assignments' in types_content:
            print("\n✅ job_assignments table types included!")
        else:
            print("\n⚠️  Warning: job_assignments not found in generated types")

    else:
        print(f"❌ API request failed: {response.status_code}")
        print(f"Response: {response.text[:500]}")

        print("\n📝 Alternative: Use npx with supabase CLI")
        print("Run: npx supabase gen types typescript --project-ref rtwigjwqufozqfwozpvo --schema public > src/types/database.ts")
        sys.exit(1)

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

    print("\n📝 Alternative method:")
    print("1. Install Supabase CLI: https://github.com/supabase/cli#install-the-cli")
    print("2. Run: supabase gen types typescript --linked --schema public > src/types/database.ts")
    sys.exit(1)
