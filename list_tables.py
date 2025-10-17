#!/usr/bin/env python3
"""List all tables in the Supabase database using psycopg2."""

import os
os.environ['PGPASSWORD'] = 'Duke-neepo-oliver-ttq5'

import subprocess
import sys

# Connection string
connection_string = "postgresql://postgres:Duke-neepo-oliver-ttq5@db.rtwigjwqufozqfwozpvo.supabase.co:5432/postgres"

# SQL query to list all tables
sql = """
SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"""

try:
    # Use psql command
    result = subprocess.run(
        ['psql', connection_string, '-c', sql],
        capture_output=True,
        text=True,
        timeout=10
    )

    if result.returncode == 0:
        print("✅ Successfully connected to database!")
        print("\n" + result.stdout)
    else:
        print(f"❌ Error: {result.stderr}")

        # Try with Python's psycopg2 if psql fails
        print("\nTrying with psycopg2...")
        try:
            import psycopg2

            conn = psycopg2.connect(connection_string)
            cur = conn.cursor()
            cur.execute(sql)

            rows = cur.fetchall()
            print(f"\n✅ Found {len(rows)} tables:\n")
            for i, row in enumerate(rows, 1):
                print(f"{i}. {row[1]} (schema: {row[0]})")

            cur.close()
            conn.close()
        except ImportError:
            print("❌ psycopg2 not installed. Run: pip install psycopg2-binary")
        except Exception as e:
            print(f"❌ Error with psycopg2: {e}")

except FileNotFoundError:
    print("❌ psql command not found. Trying with psycopg2...")
    try:
        import psycopg2

        conn = psycopg2.connect(connection_string)
        cur = conn.cursor()
        cur.execute(sql)

        rows = cur.fetchall()
        print(f"\n✅ Found {len(rows)} tables:\n")
        for i, row in enumerate(rows, 1):
            print(f"{i}. {row[1]} (schema: {row[0]})")

        cur.close()
        conn.close()
    except ImportError:
        print("❌ psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
