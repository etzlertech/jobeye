#!/usr/bin/env python3
import requests
import json
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv('.env.local')

# Get credentials
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing Supabase credentials")
    exit(1)

# Remove quotes if present
SUPABASE_URL = SUPABASE_URL.strip('"')
SUPABASE_SERVICE_KEY = SUPABASE_SERVICE_KEY.strip('"')

print(f"Using Supabase URL: {SUPABASE_URL}")

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

demo_tenant_id = "00000000-0000-0000-0000-000000000000"

print("🌱 Seeding demo data...\n")

# First, check if we have customers
print("📋 Checking existing customers...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/customers",
    headers=headers,
    params={
        "tenant_id": f"eq.{demo_tenant_id}",
        "limit": 1
    }
)

if response.status_code == 200:
    customers = response.json()
    if customers:
        print(f"Found existing customer: {customers[0]['id']}")
        customer_id = customers[0]['id']
    else:
        # Create a customer
        print("Creating new demo customer...")
        customer_data = {
            "id": "demo-customer-py",
            "tenant_id": demo_tenant_id,
            "name": "Demo Customer Python",
            "email": "demo-py@example.com", 
            "phone": "555-9999",
            "status": "active"
        }
        
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/customers",
            headers=headers,
            json=customer_data
        )
        
        if response.status_code in [200, 201]:
            customer = response.json()[0] if isinstance(response.json(), list) else response.json()
            customer_id = customer['id']
            print(f"✅ Created customer: {customer_id}")
        else:
            print(f"❌ Error creating customer: {response.status_code}")
            print(f"Response: {response.text}")
            exit(1)
else:
    print(f"❌ Error checking customers: {response.status_code}")
    print(f"Response: {response.text}")
    exit(1)

# Create a job
print("\n💼 Creating demo job...")
tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
job_data = {
    "tenant_id": demo_tenant_id,
    "title": "Demo Job Python",
    "description": "Created via Python script",
    "customer_id": customer_id,
    "status": "scheduled",
    "priority": "medium",
    "scheduled_date": tomorrow,
    "created_by": "python-script",
    "estimated_duration_hours": 2
}

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/jobs",
    headers=headers,
    json=job_data
)

if response.status_code in [200, 201]:
    job = response.json()[0] if isinstance(response.json(), list) else response.json()
    print(f"✅ Created job: {job.get('id', 'unknown')}")
else:
    print(f"❌ Error creating job: {response.status_code}")
    print(f"Response: {response.text}")

# List all jobs
print("\n📋 Listing all jobs...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/jobs",
    headers=headers,
    params={
        "tenant_id": f"eq.{demo_tenant_id}",
        "select": "id,title,status,customer_id"
    }
)

if response.status_code == 200:
    jobs = response.json()
    print(f"Found {len(jobs)} jobs:")
    for job in jobs:
        print(f"  - {job['id']}: {job['title']} ({job['status']})")
else:
    print(f"❌ Error listing jobs: {response.status_code}")
    print(f"Response: {response.text}")

print("\n✅ Demo data seeding complete!")