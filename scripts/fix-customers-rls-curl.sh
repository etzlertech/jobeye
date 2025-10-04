#!/bin/bash

# Supabase credentials
SUPABASE_URL="https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

echo "🔧 Fixing customer RLS policies for demo mode..."
echo ""

# Function to execute SQL via Supabase RPC
exec_sql() {
    local sql="$1"
    local description="$2"
    
    echo "→ $description"
    
    response=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "{\"sql\": \"$sql\"}")
    
    # Check if response contains error
    if echo "$response" | grep -q '"error"'; then
        echo "  ❌ Error: $response"
    else
        echo "  ✓ Success"
    fi
}

# Drop existing policies
echo "1️⃣ Dropping existing customer policies..."
exec_sql "DROP POLICY IF EXISTS customers_company_isolation ON public.customers;" "Dropping customers_company_isolation"
exec_sql "DROP POLICY IF EXISTS customers_service_role ON public.customers;" "Dropping customers_service_role"
exec_sql "DROP POLICY IF EXISTS customers_tenant_isolation ON public.customers;" "Dropping customers_tenant_isolation"
exec_sql "DROP POLICY IF EXISTS customers_demo_mode ON public.customers;" "Dropping customers_demo_mode"

echo ""
echo "2️⃣ Creating new customer policies..."

# Create tenant isolation policy
tenant_policy="CREATE POLICY customers_tenant_isolation ON public.customers FOR ALL TO authenticated USING (tenant_id = COALESCE((current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'), (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'tenant_id'), (current_setting('request.jwt.claims', true)::json ->> 'tenant_id'))) WITH CHECK (tenant_id = COALESCE((current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'), (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'tenant_id'), (current_setting('request.jwt.claims', true)::json ->> 'tenant_id')));"
exec_sql "$tenant_policy" "Creating customers_tenant_isolation"

# Create service role policy
service_policy="CREATE POLICY customers_service_role ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);"
exec_sql "$service_policy" "Creating customers_service_role"

echo ""
echo "3️⃣ Creating demo mode support policy..."

# Create demo mode policy
demo_policy="CREATE POLICY customers_demo_mode ON public.customers FOR ALL TO anon, authenticated USING (tenant_id = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e' AND (current_setting('request.jwt.claims', true) IS NULL OR current_setting('request.jwt.claims', true) = '' OR current_setting('request.jwt.claims', true)::text = 'null')) WITH CHECK (tenant_id = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e' AND (current_setting('request.jwt.claims', true) IS NULL OR current_setting('request.jwt.claims', true) = '' OR current_setting('request.jwt.claims', true)::text = 'null'));"
exec_sql "$demo_policy" "Creating customers_demo_mode"

echo ""
echo "4️⃣ Verifying policies..."

# Verify policies
verify_sql="SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' ORDER BY policyname;"
exec_sql "$verify_sql" "Checking current policies"

echo ""
echo "✅ RLS policy update complete!"
echo ""
echo "📝 Demo mode should now be able to create customers with tenant_id: 86a0f1f5-30cd-4891-a7d9-bfc85d8b259e"