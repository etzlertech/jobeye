#!/usr/bin/env python3
"""
Script to check if properties table exists in Supabase database
and investigate similar table names
"""
import requests
import json
import sys
from typing import Dict, List, Any

# Database credentials
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

# Setup headers
headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

def execute_sql(sql: str) -> Dict[str, Any]:
    """Execute SQL query via Supabase RPC"""
    try:
        # First try the standard exec_sql RPC
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
            headers=headers,
            json={"sql": sql}
        )
        
        if response.status_code == 404:
            # exec_sql function might not exist, try direct REST API query
            print("⚠️  exec_sql RPC not found, trying REST API approach...")
            return execute_via_rest(sql)
        elif response.status_code == 204:
            # Successful execution with no return data
            return {"success": True, "data": None}
        elif response.status_code == 200:
            # Successful execution with data
            return {"success": True, "data": response.json()}
        else:
            print(f"Response status: {response.status_code}")
            print(f"Response text: {response.text}")
            return {
                "success": False, 
                "error": f"Status {response.status_code}: {response.text}"
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

def execute_via_rest(sql: str) -> Dict[str, Any]:
    """Execute query via REST API instead of RPC"""
    # For simple SELECT queries on information_schema, we can query directly
    if "information_schema.tables" in sql and "SELECT" in sql.upper():
        try:
            # Query the pg_tables view which should be accessible
            response = requests.get(
                f"{SUPABASE_URL}/rest/v1/pg_tables?select=*",
                headers=headers
            )
            
            if response.status_code == 200:
                tables = response.json()
                # Filter for public schema tables
                public_tables = [t for t in tables if t.get('schemaname') == 'public']
                return {"success": True, "data": public_tables}
        except:
            pass
    
    # Try querying properties table directly
    if "properties" in sql:
        try:
            response = requests.get(
                f"{SUPABASE_URL}/rest/v1/properties?select=*&limit=1",
                headers=headers
            )
            
            if response.status_code == 200:
                print("✅ Properties table exists and is accessible via REST API")
                return {"success": True, "data": [{"table_name": "properties", "exists": True}]}
            elif response.status_code == 404:
                print("❌ Properties table not found via REST API")
                return {"success": True, "data": []}
        except Exception as e:
            print(f"Error querying properties table: {e}")
    
    return {"success": False, "error": "Cannot execute this query via REST"}

def check_properties_table():
    """Check if properties table exists and get its structure"""
    print("🔍 Checking for properties table in database...\n")
    
    # 1. Check if properties table exists
    sql_check_table = """
    SELECT 
        table_schema,
        table_name,
        table_type
    FROM information_schema.tables
    WHERE table_name = 'properties'
        AND table_schema = 'public';
    """
    
    result = execute_sql(sql_check_table)
    
    if not result["success"]:
        print(f"❌ Error executing query: {result['error']}")
        return
    
    if result["data"]:
        print("✅ Found 'properties' table:")
        for table in result["data"]:
            print(f"   Schema: {table['table_schema']}")
            print(f"   Name: {table['table_name']}")
            print(f"   Type: {table['table_type']}")
    else:
        print("❌ 'properties' table NOT FOUND in database")
    
    # 2. Look for similar table names
    print("\n🔍 Looking for tables with similar names...")
    
    sql_similar_tables = """
    SELECT 
        table_schema,
        table_name,
        table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND (
            table_name LIKE '%propert%'
            OR table_name LIKE '%real_%'
            OR table_name LIKE '%estate%'
            OR table_name LIKE '%location%'
            OR table_name LIKE '%address%'
        )
    ORDER BY table_name;
    """
    
    result_similar = execute_sql(sql_similar_tables)
    
    if result_similar["success"] and result_similar["data"]:
        print(f"\nFound {len(result_similar['data'])} potentially related tables:")
        for table in result_similar["data"]:
            print(f"   - {table['table_name']} ({table['table_type']})")
    else:
        print("No similar tables found")
    
    # 3. If properties table exists, get its columns
    if result["data"]:
        print("\n📊 Getting column information for properties table...")
        
        sql_columns = """
        SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_name = 'properties'
            AND table_schema = 'public'
        ORDER BY ordinal_position;
        """
        
        result_columns = execute_sql(sql_columns)
        
        if result_columns["success"] and result_columns["data"]:
            print("\nColumns in properties table:")
            for col in result_columns["data"]:
                nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
                print(f"   - {col['column_name']}: {col['data_type']} {nullable}{default}")
    
    # 4. Check for RLS policies on properties table
    if result["data"]:
        print("\n🔐 Checking Row Level Security policies...")
        
        sql_policies = """
        SELECT 
            policyname,
            cmd,
            qual,
            with_check
        FROM pg_policies
        WHERE tablename = 'properties'
            AND schemaname = 'public';
        """
        
        result_policies = execute_sql(sql_policies)
        
        if result_policies["success"] and result_policies["data"]:
            print(f"\nFound {len(result_policies['data'])} RLS policies:")
            for policy in result_policies["data"]:
                print(f"   - {policy['policyname']} ({policy['cmd']})")
        else:
            print("No RLS policies found on properties table")
    
    # 5. List all tables in the database for reference
    print("\n📋 All tables in the database:")
    
    sql_all_tables = """
    SELECT 
        table_name,
        table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
    LIMIT 50;
    """
    
    result_all = execute_sql(sql_all_tables)
    
    if result_all["success"] and result_all["data"]:
        print(f"\nShowing first 50 tables (total count may be higher):")
        for table in result_all["data"]:
            print(f"   - {table['table_name']}")

if __name__ == "__main__":
    check_properties_table()