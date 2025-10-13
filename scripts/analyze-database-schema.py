#!/usr/bin/env python3
"""
Analyze live Supabase database schema and create comprehensive documentation
for TypeScript type fixes.

Run with: python scripts/analyze-database-schema.py
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

def execute_sql(sql):
    """Execute SQL query via Supabase RPC"""
    print(f"Executing SQL: {sql[:100]}...")
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": sql}
    )
    
    print(f"Response status: {response.status_code}")
    if response.status_code == 204:
        return []
    elif response.status_code == 200:
        return response.json()
    else:
        print(f"❌ SQL Error ({response.status_code}): {response.text}")
        return None

def analyze_schema():
    """Analyze complete database schema"""
    print("🔍 Analyzing Supabase database schema...")
    
    # Get all tables
    tables_sql = """
    SELECT 
        table_schema,
        table_name,
        table_type
    FROM information_schema.tables 
    WHERE table_schema IN ('public', 'auth')
    AND table_type IN ('BASE TABLE', 'VIEW')
    ORDER BY table_schema, table_name;
    """
    
    tables = execute_sql(tables_sql)
    if not tables:
        print("❌ Failed to fetch tables")
        return None
    
    schema_info = {
        "generated_at": datetime.now().isoformat(),
        "database_url": SUPABASE_URL,
        "tables": {},
        "views": {},
        "enums": {},
        "functions": {}
    }
    
    # Analyze each table
    for table_info in tables:
        schema = table_info['table_schema']
        table_name = table_info['table_name']
        table_type = table_info['table_type']
        
        print(f"  📊 Analyzing {schema}.{table_name}...")
        
        # Get columns
        columns_sql = f"""
        SELECT 
            column_name,
            data_type,
            udt_name,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
        FROM information_schema.columns
        WHERE table_schema = '{schema}'
        AND table_name = '{table_name}'
        ORDER BY ordinal_position;
        """
        
        columns = execute_sql(columns_sql)
        
        # Get constraints
        constraints_sql = f"""
        SELECT
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = '{schema}'
        AND tc.table_name = '{table_name}';
        """
        
        constraints = execute_sql(constraints_sql)
        
        table_data = {
            "schema": schema,
            "type": table_type,
            "columns": {},
            "primary_key": [],
            "foreign_keys": {},
            "unique_constraints": [],
            "check_constraints": []
        }
        
        # Process columns
        for col in columns:
            col_name = col['column_name']
            table_data['columns'][col_name] = {
                "type": col['data_type'],
                "udt_name": col['udt_name'],
                "nullable": col['is_nullable'] == 'YES',
                "default": col['column_default'],
                "max_length": col['character_maximum_length'],
                "precision": col['numeric_precision'],
                "scale": col['numeric_scale']
            }
        
        # Process constraints
        for constraint in constraints:
            if constraint['constraint_type'] == 'PRIMARY KEY':
                table_data['primary_key'].append(constraint['column_name'])
            elif constraint['constraint_type'] == 'FOREIGN KEY':
                table_data['foreign_keys'][constraint['column_name']] = {
                    "references_table": constraint['foreign_table_name'],
                    "references_column": constraint['foreign_column_name']
                }
            elif constraint['constraint_type'] == 'UNIQUE':
                table_data['unique_constraints'].append(constraint['column_name'])
        
        if table_type == 'BASE TABLE':
            schema_info['tables'][f"{schema}.{table_name}"] = table_data
        else:
            schema_info['views'][f"{schema}.{table_name}"] = table_data
    
    # Get enum types
    enum_sql = """
    SELECT 
        t.typname AS enum_name,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typtype = 'e'
    GROUP BY t.typname
    ORDER BY t.typname;
    """
    
    enums = execute_sql(enum_sql)
    for enum in enums:
        schema_info['enums'][enum['enum_name']] = enum['enum_values']
    
    # Get functions (RPC endpoints)
    functions_sql = """
    SELECT 
        routine_name,
        routine_type,
        data_type AS return_type
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    ORDER BY routine_name;
    """
    
    functions = execute_sql(functions_sql)
    for func in functions:
        schema_info['functions'][func['routine_name']] = {
            "type": func['routine_type'],
            "returns": func['return_type']
        }
    
    return schema_info

def generate_typescript_types(schema_info):
    """Generate TypeScript type definitions from schema"""
    types_content = []
    
    # Header
    types_content.append(f"""// Generated from live Supabase database
// Date: {schema_info['generated_at']}
// Database: {schema_info['database_url']}

export type Database = {{
  public: {{
    Tables: {{""")
    
    # Generate table types
    for table_name, table_info in schema_info['tables'].items():
        if table_info['schema'] != 'public':
            continue
            
        table_name_clean = table_name.replace('public.', '')
        types_content.append(f"\n      {table_name_clean}: {{")
        types_content.append("        Row: {")
        
        # Add columns
        for col_name, col_info in table_info['columns'].items():
            ts_type = sql_to_typescript_type(col_info['type'], col_info['udt_name'])
            nullable = " | null" if col_info['nullable'] else ""
            types_content.append(f"          {col_name}: {ts_type}{nullable};")
        
        types_content.append("        };")
        
        # Generate Insert type
        primary_keys = table_info['primary_key']
        auto_columns = ['created_at', 'updated_at'] + primary_keys
        
        excluded_cols = ' | '.join([f"'{col}'" for col in auto_columns if col in table_info['columns']])
        types_content.append(f"        Insert: Omit<Database['public']['Tables']['{table_name_clean}']['Row'], {excluded_cols}> & {{")
        for col in auto_columns:
            if col in table_info['columns']:
                col_info = table_info['columns'][col]
                ts_type = sql_to_typescript_type(col_info['type'], col_info['udt_name'])
                types_content.append(f"          {col}?: {ts_type};")
        types_content.append("        };")
        
        # Generate Update type
        types_content.append(f"        Update: Partial<Database['public']['Tables']['{table_name_clean}']['Insert']>;")
        types_content.append("      };")
    
    types_content.append("""    };
    Views: {""")
    
    # Add views
    for view_name, view_info in schema_info['views'].items():
        if view_info['schema'] != 'public':
            continue
            
        view_name_clean = view_name.replace('public.', '')
        types_content.append(f"\n      {view_name_clean}: {{")
        types_content.append("        Row: {")
        
        for col_name, col_info in view_info['columns'].items():
            ts_type = sql_to_typescript_type(col_info['type'], col_info['udt_name'])
            nullable = " | null" if col_info['nullable'] else ""
            types_content.append(f"          {col_name}: {ts_type}{nullable};")
        
        types_content.append("        };")
        types_content.append("      };")
    
    types_content.append("""    };
    Enums: {""")
    
    # Add enums
    for enum_name, enum_values in schema_info['enums'].items():
        values_str = " | ".join([f"'{val}'" for val in enum_values])
        types_content.append(f"      {enum_name}: {values_str};")
    
    types_content.append("""    };
  };
};""")
    
    return '\n'.join(types_content)

def sql_to_typescript_type(sql_type, udt_name):
    """Convert SQL types to TypeScript types"""
    type_map = {
        'uuid': 'string',
        'text': 'string',
        'character varying': 'string',
        'varchar': 'string',
        'char': 'string',
        'timestamp with time zone': 'string',
        'timestamp without time zone': 'string',
        'timestamptz': 'string',
        'timestamp': 'string',
        'date': 'string',
        'time': 'string',
        'integer': 'number',
        'bigint': 'number',
        'smallint': 'number',
        'numeric': 'number',
        'decimal': 'number',
        'real': 'number',
        'double precision': 'number',
        'boolean': 'boolean',
        'bool': 'boolean',
        'jsonb': 'Record<string, any>',
        'json': 'Record<string, any>',
        'ARRAY': 'any[]',
        'USER-DEFINED': udt_name  # Use the UDT name for custom types
    }
    
    return type_map.get(sql_type, 'any')

def main():
    # Analyze schema
    schema_info = analyze_schema()
    
    if not schema_info:
        print("❌ Failed to analyze schema")
        return
    
    # Save raw schema analysis
    timestamp = datetime.now().strftime("%Y-%m-%d")
    output_file = f"docs/database-schema-analysis-{timestamp}.json"
    
    with open(output_file, 'w') as f:
        json.dump(schema_info, f, indent=2, default=str)
    
    print(f"\n✅ Saved raw schema analysis to {output_file}")
    
    # Generate TypeScript types
    typescript_types = generate_typescript_types(schema_info)
    types_file = f"docs/database-types-generated-{timestamp}.ts"
    
    with open(types_file, 'w') as f:
        f.write(typescript_types)
    
    print(f"✅ Generated TypeScript types in {types_file}")
    
    # Create markdown documentation
    markdown_file = f"docs/database-schema-analysis-{timestamp}.md"
    
    with open(markdown_file, 'w') as f:
        f.write(f"""# Database Schema Analysis
Generated: {schema_info['generated_at']}

## Summary
- Total Tables: {len(schema_info['tables'])}
- Total Views: {len(schema_info['views'])}
- Total Enums: {len(schema_info['enums'])}
- Total Functions: {len(schema_info['functions'])}

## Tables

""")
        
        for table_name, table_info in sorted(schema_info['tables'].items()):
            f.write(f"### {table_name}\n\n")
            f.write("| Column | Type | Nullable | Default | Constraints |\n")
            f.write("|--------|------|----------|---------|-------------|\n")
            
            for col_name, col_info in table_info['columns'].items():
                constraints = []
                if col_name in table_info['primary_key']:
                    constraints.append("PK")
                if col_name in table_info['foreign_keys']:
                    fk = table_info['foreign_keys'][col_name]
                    constraints.append(f"FK → {fk['references_table']}.{fk['references_column']}")
                if col_name in table_info['unique_constraints']:
                    constraints.append("UNIQUE")
                
                nullable = "✓" if col_info['nullable'] else "✗"
                default = col_info['default'] or "-"
                constraints_str = ", ".join(constraints) or "-"
                
                f.write(f"| {col_name} | {col_info['type']} | {nullable} | {default} | {constraints_str} |\n")
            
            f.write("\n")
        
        f.write("\n## Enums\n\n")
        for enum_name, values in schema_info['enums'].items():
            f.write(f"### {enum_name}\n")
            f.write("```typescript\n")
            enum_values = ' | '.join([f"'{v}'" for v in values])
            f.write(f"type {enum_name} = {enum_values};\n")
            f.write("```\n\n")
    
    print(f"✅ Created markdown documentation in {markdown_file}")
    
    # Print summary
    print(f"\n📊 Schema Analysis Complete!")
    print(f"   - Tables: {len(schema_info['tables'])}")
    print(f"   - Views: {len(schema_info['views'])}")
    print(f"   - Enums: {len(schema_info['enums'])}")
    print(f"   - Functions: {len(schema_info['functions'])}")

if __name__ == "__main__":
    main()