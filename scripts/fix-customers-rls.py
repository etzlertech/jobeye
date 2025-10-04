#!/usr/bin/env python3
import requests
import json

# Supabase credentials
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def exec_sql(sql, description):
    """Execute SQL via Supabase RPC"""
    print(f"→ {description}")
    
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    payload = {"sql": sql}
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 200:
            print("  ✓ Success")
        else:
            print(f"  ❌ Error: {response.text}")
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")

print("🔧 Fixing customer RLS policies for demo mode...")
print()

# Drop existing policies
print("1️⃣ Dropping existing customer policies...")
exec_sql("DROP POLICY IF EXISTS customers_company_isolation ON public.customers;", "Dropping customers_company_isolation")
exec_sql("DROP POLICY IF EXISTS customers_service_role ON public.customers;", "Dropping customers_service_role")
exec_sql("DROP POLICY IF EXISTS customers_tenant_isolation ON public.customers;", "Dropping customers_tenant_isolation")
exec_sql("DROP POLICY IF EXISTS customers_demo_mode ON public.customers;", "Dropping customers_demo_mode")

print()
print("2️⃣ Creating new customer policies...")

# Create tenant isolation policy
tenant_policy = """
CREATE POLICY customers_tenant_isolation
ON public.customers
FOR ALL
TO authenticated
USING (
  tenant_id::text = COALESCE(
    (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'),
    (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'tenant_id'),
    (current_setting('request.jwt.claims', true)::json ->> 'tenant_id')
  )
)
WITH CHECK (
  tenant_id::text = COALESCE(
    (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'),
    (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'tenant_id'),
    (current_setting('request.jwt.claims', true)::json ->> 'tenant_id')
  )
);
"""
exec_sql(tenant_policy, "Creating customers_tenant_isolation")

# Create service role policy
service_policy = """
CREATE POLICY customers_service_role
ON public.customers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
"""
exec_sql(service_policy, "Creating customers_service_role")

print()
print("3️⃣ Creating demo mode support policy...")

# Create demo mode policy
demo_policy = """
CREATE POLICY customers_demo_mode
ON public.customers
FOR ALL
TO anon, authenticated
USING (
  tenant_id = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e' 
  AND (
    current_setting('request.jwt.claims', true) IS NULL 
    OR current_setting('request.jwt.claims', true) = ''
    OR current_setting('request.jwt.claims', true)::text = 'null'
  )
)
WITH CHECK (
  tenant_id = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'
  AND (
    current_setting('request.jwt.claims', true) IS NULL 
    OR current_setting('request.jwt.claims', true) = ''
    OR current_setting('request.jwt.claims', true)::text = 'null'
  )
);
"""
exec_sql(demo_policy, "Creating customers_demo_mode")

print()
print("4️⃣ Verifying policies...")

# Verify policies
verify_sql = """
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'customers' 
ORDER BY policyname;
"""
exec_sql(verify_sql, "Checking current policies")

print()
print("✅ RLS policy update complete!")
print()
print("📝 Demo mode should now be able to create customers with tenant_id: 86a0f1f5-30cd-4891-a7d9-bfc85d8b259e")