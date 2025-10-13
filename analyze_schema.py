#!/usr/bin/env python3
import requests
import json
from datetime import datetime

# Supabase credentials from .env.local
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

def execute_sql(sql):
    """Execute SQL query and return results"""
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": sql}
    )
    if response.status_code == 204:
        return None
    elif response.status_code == 200:
        return response.json()
    else:
        print(f"Error executing SQL: {response.status_code}")
        print(response.text)
        return None

# First, let's try a different approach - use the REST API to get table information
def get_tables_via_rest():
    """Get tables using REST API"""
    # Try to get schema information through the REST API
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/",
        headers=headers
    )
    if response.status_code == 200:
        return response.json()
    return None

# Let's also try direct queries to information_schema
def analyze_schema():
    """Analyze database schema"""
    results = {}
    
    # 1. Get all tables
    tables_query = """
    SELECT 
        table_schema,
        table_name,
        table_type
    FROM information_schema.tables
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name;
    """
    
    # 2. Get all columns with details
    columns_query = """
    SELECT 
        table_schema,
        table_name,
        column_name,
        ordinal_position,
        column_default,
        is_nullable,
        data_type,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        udt_name
    FROM information_schema.columns
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name, ordinal_position;
    """
    
    # 3. Get primary keys
    pk_query = """
    SELECT 
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')
    GROUP BY tc.table_schema, tc.table_name, tc.constraint_name
    ORDER BY tc.table_schema, tc.table_name;
    """
    
    # 4. Get foreign keys
    fk_query = """
    SELECT
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
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
        AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY tc.table_schema, tc.table_name, tc.constraint_name;
    """
    
    # 5. Get check constraints
    check_query = """
    SELECT 
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
        AND tc.table_schema = cc.constraint_schema
    WHERE tc.constraint_type = 'CHECK'
        AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY tc.table_schema, tc.table_name, tc.constraint_name;
    """
    
    # 6. Get unique constraints
    unique_query = """
    SELECT 
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')
    GROUP BY tc.table_schema, tc.table_name, tc.constraint_name
    ORDER BY tc.table_schema, tc.table_name;
    """
    
    # 7. Get indexes
    indexes_query = """
    SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
    FROM pg_indexes
    WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
    ORDER BY schemaname, tablename, indexname;
    """
    
    # 8. Get enum types
    enum_query = """
    SELECT 
        n.nspname as schema_name,
        t.typname as enum_name,
        string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname NOT IN ('information_schema', 'pg_catalog')
    GROUP BY n.nspname, t.typname
    ORDER BY n.nspname, t.typname;
    """
    
    # 9. Get views
    views_query = """
    SELECT 
        table_schema,
        table_name,
        view_definition
    FROM information_schema.views
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name;
    """
    
    # 10. Get functions
    functions_query = """
    SELECT 
        n.nspname as schema_name,
        p.proname as function_name,
        pg_catalog.pg_get_function_arguments(p.oid) as arguments,
        pg_catalog.pg_get_function_result(p.oid) as return_type,
        CASE
            WHEN p.prokind = 'f' THEN 'function'
            WHEN p.prokind = 'p' THEN 'procedure'
            WHEN p.prokind = 'a' THEN 'aggregate'
            WHEN p.prokind = 'w' THEN 'window'
        END as function_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    ORDER BY n.nspname, p.proname;
    """
    
    # Execute all queries
    print("Fetching tables...")
    results['tables'] = execute_sql(tables_query)
    
    print("Fetching columns...")
    results['columns'] = execute_sql(columns_query)
    
    print("Fetching primary keys...")
    results['primary_keys'] = execute_sql(pk_query)
    
    print("Fetching foreign keys...")
    results['foreign_keys'] = execute_sql(fk_query)
    
    print("Fetching check constraints...")
    results['check_constraints'] = execute_sql(check_query)
    
    print("Fetching unique constraints...")
    results['unique_constraints'] = execute_sql(unique_query)
    
    print("Fetching indexes...")
    results['indexes'] = execute_sql(indexes_query)
    
    print("Fetching enum types...")
    results['enums'] = execute_sql(enum_query)
    
    print("Fetching views...")
    results['views'] = execute_sql(views_query)
    
    print("Fetching functions...")
    results['functions'] = execute_sql(functions_query)
    
    return results

# Main execution
if __name__ == "__main__":
    print("Analyzing Supabase database schema...")
    
    # First check if exec_sql RPC exists
    check_rpc = """
    SELECT proname 
    FROM pg_proc 
    WHERE proname = 'exec_sql';
    """
    
    rpc_exists = execute_sql(check_rpc)
    
    if rpc_exists is None:
        print("The exec_sql RPC function doesn't exist. Let me try a different approach...")
        
        # Let's try using the REST API to query tables directly
        # First, let's get available endpoints
        response = requests.options(
            f"{SUPABASE_URL}/rest/v1/",
            headers=headers
        )
        print(f"OPTIONS response: {response.status_code}")
        if response.status_code == 200:
            print(response.headers)
        
        # Try to list available tables through REST
        print("\nTrying to get table list via REST API...")
        tables_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/",
            headers=headers
        )
        
        if tables_response.status_code == 200:
            print("Available endpoints:", tables_response.json())
        else:
            print(f"REST API response: {tables_response.status_code}")
            print(tables_response.text)
    else:
        print("exec_sql RPC exists, proceeding with analysis...")
        schema_data = analyze_schema()
        
        # Save results to a JSON file for processing
        with open('schema_analysis.json', 'w') as f:
            json.dump(schema_data, f, indent=2, default=str)
        
        print("Schema analysis complete. Results saved to schema_analysis.json")