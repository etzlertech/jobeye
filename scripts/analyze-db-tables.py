#!/usr/bin/env python3
"""
Analyze Supabase database tables using REST API
"""

import requests
import json
import os
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    exit(1)

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# List of known tables based on the TypeScript types file
KNOWN_TABLES = [
    "tenants", "tenant_members", "tenant_invitations",
    "users_extended", "user_sessions", "auth_audit_log",
    "customers", "contacts", "properties", 
    "jobs", "job_assignments", "job_verifications",
    "items", "inventory_items", "item_transactions",
    "equipment", "materials", "media_assets",
    "voice_profiles", "voice_transcripts", "intent_recognitions",
    "company_settings", "routes", "work_orders"
]

def get_table_schema(table_name):
    """Get schema for a specific table"""
    print(f"  📊 Analyzing {table_name}...")
    
    # Try to get one row to analyze structure
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table_name}?limit=1",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        if data and len(data) > 0:
            return {
                "exists": True,
                "sample": data[0],
                "columns": list(data[0].keys())
            }
        else:
            # Table exists but is empty - try to get columns from error
            response2 = requests.get(
                f"{SUPABASE_URL}/rest/v1/{table_name}?select=*&limit=0",
                headers=headers
            )
            return {
                "exists": True,
                "sample": None,
                "columns": []
            }
    elif response.status_code == 404:
        return {
            "exists": False,
            "error": f"Table '{table_name}' not found"
        }
    else:
        return {
            "exists": False,
            "error": f"Error {response.status_code}: {response.text}"
        }

def main():
    print("🔍 Analyzing Supabase database tables...")
    
    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M")
    schema_info = {
        "generated_at": timestamp,
        "database_url": SUPABASE_URL,
        "tables": {}
    }
    
    # Check each known table
    for table_name in KNOWN_TABLES:
        table_info = get_table_schema(table_name)
        schema_info["tables"][table_name] = table_info
        
        if table_info["exists"]:
            print(f"    ✅ Found with {len(table_info['columns'])} columns")
        else:
            print(f"    ❌ {table_info.get('error', 'Not found')}")
    
    # Save results
    output_file = f"docs/database-schema-analysis-{timestamp}.json"
    with open(output_file, 'w') as f:
        json.dump(schema_info, f, indent=2, default=str)
    
    print(f"\n✅ Saved analysis to {output_file}")
    
    # Create markdown report
    markdown_file = f"docs/database-schema-analysis-{timestamp}.md"
    with open(markdown_file, 'w') as f:
        f.write(f"""# Database Schema Analysis
Generated: {timestamp}

## Tables Found

""")
        
        for table_name, info in schema_info["tables"].items():
            if info["exists"]:
                f.write(f"### ✅ {table_name}\n\n")
                if info["columns"]:
                    f.write("Columns:\n")
                    for col in info["columns"]:
                        f.write(f"- `{col}`\n")
                    f.write("\n")
                    
                    if info["sample"]:
                        f.write("Sample data structure:\n```json\n")
                        f.write(json.dumps(info["sample"], indent=2, default=str))
                        f.write("\n```\n\n")
                else:
                    f.write("(Empty table - no columns detected)\n\n")
        
        f.write("\n## Tables Not Found\n\n")
        for table_name, info in schema_info["tables"].items():
            if not info["exists"]:
                f.write(f"- ❌ **{table_name}**: {info.get('error', 'Not found')}\n")
    
    print(f"✅ Created markdown report in {markdown_file}")
    
    # Summary
    found = sum(1 for t in schema_info["tables"].values() if t["exists"])
    total = len(schema_info["tables"])
    print(f"\n📊 Summary: Found {found}/{total} tables")

if __name__ == "__main__":
    main()