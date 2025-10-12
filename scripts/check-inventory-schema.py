#!/usr/bin/env python3
import requests
import json

# From .env.local
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Query for inventory-related tables
queries = [
    # Check all tables that might be inventory-related
    """
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (
        table_name LIKE '%item%'
        OR table_name LIKE '%material%'
        OR table_name LIKE '%container%'
        OR table_name LIKE '%inventory%'
        OR table_name LIKE '%equipment%'
        OR table_name LIKE '%tool%'
        OR table_name LIKE '%supply%'
        OR table_name LIKE '%stock%'
    )
    ORDER BY table_name;
    """,
    
    # Get detailed schema for items table if it exists
    """
    SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'items'
    ORDER BY ordinal_position;
    """,
    
    # Get detailed schema for item_transactions if it exists
    """
    SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'item_transactions'
    ORDER BY ordinal_position;
    """,
    
    # Check for any foreign key relationships
    """
    SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND (tc.table_name IN ('items', 'item_transactions')
         OR ccu.table_name IN ('items', 'item_transactions'));
    """
]

print("🔍 Checking JobEye Inventory Schema...\n")

for i, query in enumerate(queries):
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": query}
    )
    
    if response.status_code == 200:
        try:
            result = response.json()
            if result:
                if i == 0:
                    print("📊 Inventory-related tables found:")
                    for row in result:
                        print(f"  - {row['table_name']} ({row['table_type']})")
                elif i == 1:
                    print("\n📋 'items' table schema:")
                    for row in result:
                        nullable = "NULL" if row['is_nullable'] == 'YES' else "NOT NULL"
                        default = f" DEFAULT {row['column_default']}" if row['column_default'] else ""
                        print(f"  - {row['column_name']}: {row['data_type']} {nullable}{default}")
                elif i == 2:
                    print("\n📋 'item_transactions' table schema:")
                    for row in result:
                        nullable = "NULL" if row['is_nullable'] == 'YES' else "NOT NULL"
                        default = f" DEFAULT {row['column_default']}" if row['column_default'] else ""
                        print(f"  - {row['column_name']}: {row['data_type']} {nullable}{default}")
                elif i == 3:
                    print("\n🔗 Foreign key relationships:")
                    for row in result:
                        print(f"  - {row['table_name']}.{row['column_name']} -> {row['foreign_table_name']}.{row['foreign_column_name']}")
                print()
            else:
                if i == 0:
                    print("❌ No inventory-related tables found")
                elif i == 1:
                    print("❌ 'items' table not found")
                elif i == 2:
                    print("❌ 'item_transactions' table not found")
                elif i == 3:
                    print("❌ No foreign key relationships found")
        except Exception as e:
            print(f"Error parsing response: {e}")
            print(f"Response: {response.text}")
    elif response.status_code == 204:
        print(f"✅ Query {i+1} executed (no results)")
    else:
        print(f"❌ Error {response.status_code}: {response.text}")