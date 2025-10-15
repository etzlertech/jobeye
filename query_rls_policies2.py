#!/usr/bin/env python3
import psycopg2
import json

# From .env.local
DB_PASSWORD = "Duke-neepo-oliver-ttq5"
DB_HOST = "db.rtwigjwqufozqfwozpvo.supabase.co"
DB_PORT = "5432"
DB_NAME = "postgres"
DB_USER = "postgres"

# Connect directly to PostgreSQL
conn_string = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

try:
    conn = psycopg2.connect(conn_string)
    cur = conn.cursor()

    # Query to get all RLS policies
    sql_query = """
    SELECT
        schemaname,
        tablename,
        policyname,
        cmd,
        qual,
        with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
    """

    cur.execute(sql_query)

    # Fetch all results
    rows = cur.fetchall()

    # Print header
    print(f"\n{'='*150}")
    print(f"Found {len(rows)} RLS policies")
    print(f"{'='*150}\n")

    # Track policies that reference users_extended
    suspicious_policies = []

    for row in rows:
        schemaname, tablename, policyname, cmd, qual, with_check = row

        print(f"\nTable: {tablename}")
        print(f"Policy Name: {policyname}")
        print(f"Command: {cmd}")
        print(f"USING (qual): {qual}")
        print(f"WITH CHECK: {with_check}")
        print(f"-" * 150)

        # Check if this policy references users_extended
        qual_str = str(qual) if qual else ""
        with_check_str = str(with_check) if with_check else ""

        if "users_extended" in qual_str.lower() or "users_extended" in with_check_str.lower():
            suspicious_policies.append({
                'table': tablename,
                'policy': policyname,
                'cmd': cmd,
                'qual': qual,
                'with_check': with_check
            })

    # Print suspicious policies
    if suspicious_policies:
        print(f"\n\n{'='*150}")
        print(f"SUSPICIOUS POLICIES REFERENCING users_extended ({len(suspicious_policies)} found):")
        print(f"{'='*150}\n")

        for pol in suspicious_policies:
            print(f"\n🚨 Table: {pol['table']}")
            print(f"   Policy: {pol['policy']}")
            print(f"   Command: {pol['cmd']}")
            print(f"   USING: {pol['qual']}")
            print(f"   WITH CHECK: {pol['with_check']}")
            print(f"   {'-'*140}")
    else:
        print("\n\n✅ No policies found that reference users_extended table")

    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
