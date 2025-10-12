#!/usr/bin/env python3
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

print("🔍 Checking for demo tenant...\n")

# Check if there's a company/tenant called 'demo' or similar
print("1. Checking companies table:")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/companies?or=(name.ilike.*demo*,id.eq.demo-company)",
    headers=headers
)
if response.status_code == 200:
    companies = response.json()
    print(f"   Found {len(companies)} demo-related companies")
    for company in companies:
        print(f"   - {company.get('name', 'Unknown')} (ID: {company.get('id', 'Unknown')})")
else:
    print(f"   Error: {response.text}")

# Check tenants table
print("\n2. Checking tenants table:")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/tenants?or=(name.ilike.*demo*,id.eq.demo-company)",
    headers=headers
)
if response.status_code == 200:
    tenants = response.json()
    print(f"   Found {len(tenants)} demo-related tenants")
    for tenant in tenants:
        print(f"   - {tenant.get('name', 'Unknown')} (ID: {tenant.get('id', 'Unknown')})")
else:
    print(f"   Error: {response.text}")

# Check the default tenant
print("\n3. Checking default tenant (00000000-0000-0000-0000-000000000000):")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/items?tenant_id=eq.00000000-0000-0000-0000-000000000000&limit=5",
    headers=headers
)
if response.status_code == 200:
    items = response.json()
    print(f"   Found {len(items)} items")
    if items:
        print(f"   First item: {items[0].get('name', 'Unknown')}")

# Check jobs to see what tenant_id they use
print("\n4. Checking jobs table for tenant_ids:")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/jobs?select=tenant_id,job_number&limit=10",
    headers=headers
)
if response.status_code == 200:
    jobs = response.json()
    tenant_ids = list(set([job['tenant_id'] for job in jobs if 'tenant_id' in job]))
    print(f"   Unique tenant_ids in jobs: {tenant_ids[:5]}")  # Show first 5