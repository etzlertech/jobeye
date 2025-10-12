#!/usr/bin/env python3
import requests
import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv(dotenv_path='.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Create Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("🔍 Checking item_transactions structure...\n")

# Get sample transaction
response = supabase.table('item_transactions').select('*').limit(1).execute()
if response.data:
    print("Sample transaction:")
    for key, value in response.data[0].items():
        print(f"  - {key}: {value} ({type(value).__name__})")
else:
    print("No transactions found")

# Check if there's a job_id or similar field
print("\nChecking for job-related fields...")
# Try to get a transaction with non-null values
response = supabase.rpc('exec_sql', {
    'sql': """
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'item_transactions'
    AND (column_name LIKE '%job%' OR column_name LIKE '%location%')
    ORDER BY ordinal_position
    """
}).execute()

if response.data:
    print("Job/location related columns:")
    for col in response.data:
        print(f"  - {col}")