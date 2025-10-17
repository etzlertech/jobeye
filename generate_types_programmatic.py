#!/usr/bin/env python3
"""
Generate TypeScript types from Supabase database schema via psycopg2
Task: T006a - Regenerate TypeScript types
"""
import sys

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("❌ psycopg2 not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
    import psycopg2
    from psycopg2.extras import RealDictCursor

# Database connection
DB_PASSWORD = "Duke-neepo-oliver-ttq5"
DB_CONNECTION = f"postgresql://postgres:{DB_PASSWORD}@db.rtwigjwqufozqfwozpvo.supabase.co:5432/postgres"

print("Connecting to Supabase database...")

try:
    conn = psycopg2.connect(DB_CONNECTION)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # Get all tables in public schema
    print("Fetching table schemas...")
    cursor.execute("""
        SELECT
            t.table_name,
            json_agg(
                json_build_object(
                    'column_name', c.column_name,
                    'data_type', c.data_type,
                    'udt_name', c.udt_name,
                    'is_nullable', c.is_nullable,
                    'column_default', c.column_default
                ) ORDER BY c.ordinal_position
            ) as columns
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        GROUP BY t.table_name
        ORDER BY t.table_name;
    """)

    tables = cursor.fetchall()
    print(f"Found {len(tables)} tables")

    # Get enum types
    print("Fetching enum types...")
    cursor.execute("""
        SELECT
            t.typname as enum_name,
            array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
        ORDER BY t.typname;
    """)

    enums = cursor.fetchall()
    print(f"Found {len(enums)} enum types")

    cursor.close()
    conn.close()

    # Generate TypeScript types
    print("\nGenerating TypeScript types...")

    ts_output = []
    ts_output.append("// Generated TypeScript types from Supabase database")
    ts_output.append("// Generated: " + __import__('datetime').datetime.now().isoformat())
    ts_output.append("")
    ts_output.append("export type Json =")
    ts_output.append("  | string")
    ts_output.append("  | number")
    ts_output.append("  | boolean")
    ts_output.append("  | null")
    ts_output.append("  | { [key: string]: Json | undefined }")
    ts_output.append("  | Json[]")
    ts_output.append("")

    # Generate enum types
    if enums:
        ts_output.append("// Database Enums")
        for enum in enums:
            enum_name = enum['enum_name']
            values = enum['enum_values']
            enum_values_str = ' | '.join([f"'{v}'" for v in values])
            ts_output.append(f"export type {enum_name} = {enum_values_str}")
        ts_output.append("")

    # Generate table types
    ts_output.append("export interface Database {")
    ts_output.append("  public: {")
    ts_output.append("    Tables: {")

    for table in tables:
        table_name = table['table_name']
        columns = table['columns']

        ts_output.append(f"      {table_name}: {{")
        ts_output.append("        Row: {")

        for col in columns:
            col_name = col['column_name']
            data_type = col['data_type']
            udt_name = col['udt_name']
            is_nullable = col['is_nullable'] == 'YES'

            # Map PostgreSQL types to TypeScript
            if data_type == 'uuid':
                ts_type = 'string'
            elif data_type == 'text' or data_type == 'character varying':
                ts_type = 'string'
            elif data_type == 'integer' or data_type == 'bigint' or data_type == 'smallint':
                ts_type = 'number'
            elif data_type == 'numeric' or data_type == 'real' or data_type == 'double precision':
                ts_type = 'number'
            elif data_type == 'boolean':
                ts_type = 'boolean'
            elif data_type == 'timestamp with time zone' or data_type == 'timestamp without time zone':
                ts_type = 'string'
            elif data_type == 'date':
                ts_type = 'string'
            elif data_type == 'jsonb' or data_type == 'json':
                ts_type = 'Json'
            elif data_type == 'ARRAY':
                ts_type = 'string[]'  # Simplified, could be more specific
            elif data_type == 'USER-DEFINED':
                # Check if it's an enum
                ts_type = udt_name  # Use the enum type name
            else:
                ts_type = 'unknown'  # Fallback

            nullable_suffix = ' | null' if is_nullable else ''
            ts_output.append(f"          {col_name}: {ts_type}{nullable_suffix}")

        ts_output.append("        }")
        ts_output.append("        Insert: {")

        for col in columns:
            col_name = col['column_name']
            has_default = col['column_default'] is not None
            is_nullable = col['is_nullable'] == 'YES'

            # Determine if optional in Insert
            optional = has_default or is_nullable

            # Re-use same type logic
            data_type = col['data_type']
            udt_name = col['udt_name']

            if data_type == 'uuid':
                ts_type = 'string'
            elif data_type == 'text' or data_type == 'character varying':
                ts_type = 'string'
            elif data_type == 'integer' or data_type == 'bigint' or data_type == 'smallint':
                ts_type = 'number'
            elif data_type == 'numeric' or data_type == 'real' or data_type == 'double precision':
                ts_type = 'number'
            elif data_type == 'boolean':
                ts_type = 'boolean'
            elif data_type == 'timestamp with time zone' or data_type == 'timestamp without time zone':
                ts_type = 'string'
            elif data_type == 'date':
                ts_type = 'string'
            elif data_type == 'jsonb' or data_type == 'json':
                ts_type = 'Json'
            elif data_type == 'ARRAY':
                ts_type = 'string[]'
            elif data_type == 'USER-DEFINED':
                ts_type = udt_name
            else:
                ts_type = 'unknown'

            optional_marker = '?' if optional else ''
            nullable_suffix = ' | null' if is_nullable else ''
            ts_output.append(f"          {col_name}{optional_marker}: {ts_type}{nullable_suffix}")

        ts_output.append("        }")
        ts_output.append("        Update: {")

        for col in columns:
            col_name = col['column_name']
            data_type = col['data_type']
            udt_name = col['udt_name']
            is_nullable = col['is_nullable'] == 'YES'

            # All Update fields are optional
            if data_type == 'uuid':
                ts_type = 'string'
            elif data_type == 'text' or data_type == 'character varying':
                ts_type = 'string'
            elif data_type == 'integer' or data_type == 'bigint' or data_type == 'smallint':
                ts_type = 'number'
            elif data_type == 'numeric' or data_type == 'real' or data_type == 'double precision':
                ts_type = 'number'
            elif data_type == 'boolean':
                ts_type = 'boolean'
            elif data_type == 'timestamp with time zone' or data_type == 'timestamp without time zone':
                ts_type = 'string'
            elif data_type == 'date':
                ts_type = 'string'
            elif data_type == 'jsonb' or data_type == 'json':
                ts_type = 'Json'
            elif data_type == 'ARRAY':
                ts_type = 'string[]'
            elif data_type == 'USER-DEFINED':
                ts_type = udt_name
            else:
                ts_type = 'unknown'

            nullable_suffix = ' | null' if is_nullable else ''
            ts_output.append(f"          {col_name}?: {ts_type}{nullable_suffix}")

        ts_output.append("        }")
        ts_output.append("      }")

    ts_output.append("    }")
    ts_output.append("    Views: {}")
    ts_output.append("    Functions: {}")
    ts_output.append("    Enums: {}")
    ts_output.append("  }")
    ts_output.append("}")

    # Write to file
    output_file = "src/types/database.ts"
    with open(output_file, 'w') as f:
        f.write('\n'.join(ts_output))

    print(f"\n✅ TypeScript types generated successfully!")
    print(f"   Output: {output_file}")
    print(f"   Lines: {len(ts_output)}")

    # Verify job_assignments is included
    with open(output_file, 'r') as f:
        content = f.read()
        if 'job_assignments' in content:
            print("   ✅ job_assignments table types included!")
        else:
            print("   ⚠️  Warning: job_assignments not found in generated types")

except psycopg2.Error as e:
    print(f"❌ Database error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
