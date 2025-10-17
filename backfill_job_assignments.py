#!/usr/bin/env python3
"""
Backfill job_assignments table from jobs.assigned_to field.

This script:
1. Queries all jobs with assigned_to IS NOT NULL
2. For each job, creates a job_assignments record
3. Sets assigned_by to the same user (supervisor unknown)
4. Reports count of assignments created

Expected: 17 assignments based on research.md
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Get database connection parameters from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    # Construct from Supabase credentials
    project_id = os.getenv('SUPABASE_PROJECT_ID')
    password = os.getenv('SUPABASE_DB_PASSWORD')
    if not project_id or not password:
        raise ValueError("DATABASE_URL or SUPABASE credentials not found in .env.local")
    DATABASE_URL = f"postgresql://postgres:{password}@db.{project_id}.supabase.co:5432/postgres"

def main():
    print(f"[{datetime.now().isoformat()}] Starting job_assignments backfill...")

    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Step 1: Query jobs with assigned_to
        print("\n[1/3] Querying jobs with assigned_to...")
        cursor.execute("""
            SELECT
                id,
                tenant_id,
                assigned_to,
                job_number,
                status
            FROM jobs
            WHERE assigned_to IS NOT NULL
            ORDER BY created_at
        """)

        jobs_with_assignments = cursor.fetchall()
        total_jobs = len(jobs_with_assignments)
        print(f"      Found {total_jobs} jobs with assigned_to set")

        if total_jobs == 0:
            print("      No jobs to backfill. Exiting.")
            return

        # Step 2: Insert into job_assignments
        print("\n[2/3] Inserting into job_assignments...")
        inserted_count = 0
        skipped_count = 0

        for job in jobs_with_assignments:
            try:
                # Check if assignment already exists
                cursor.execute("""
                    SELECT id FROM job_assignments
                    WHERE job_id = %s AND user_id = %s AND tenant_id = %s
                """, (job['id'], job['assigned_to'], job['tenant_id']))

                if cursor.fetchone():
                    print(f"      SKIP: Job {job['job_number']} already has assignment")
                    skipped_count += 1
                    continue

                # Insert new assignment (skip if tenant doesn't exist)
                # First verify tenant exists
                cursor.execute("SELECT id FROM tenants WHERE id = %s", (job['tenant_id'],))
                if not cursor.fetchone():
                    print(f"      SKIP: Job {job['job_number']} has invalid tenant_id (test data)")
                    skipped_count += 1
                    continue

                # Insert new assignment
                cursor.execute("""
                    INSERT INTO job_assignments (
                        tenant_id,
                        job_id,
                        user_id,
                        assigned_by,
                        assigned_at,
                        created_at,
                        updated_at
                    ) VALUES (
                        %s, %s, %s, %s, NOW(), NOW(), NOW()
                    )
                    RETURNING id
                """, (
                    job['tenant_id'],
                    job['id'],
                    job['assigned_to'],
                    job['assigned_to']  # Use same user as assigned_by (supervisor unknown)
                ))

                assignment_id = cursor.fetchone()['id']
                print(f"      ✓ Created assignment for job {job['job_number']} (status: {job['status']})")
                inserted_count += 1

            except Exception as e:
                print(f"      ✗ Failed for job {job['job_number']}: {e}")
                conn.rollback()
                continue

        # Commit all inserts
        conn.commit()

        # Step 3: Verify counts
        print("\n[3/3] Verifying backfill...")
        cursor.execute("SELECT COUNT(*) as count FROM job_assignments")
        final_count = cursor.fetchone()['count']

        print(f"\n✅ Backfill complete!")
        print(f"   - Jobs with assigned_to: {total_jobs}")
        print(f"   - Assignments inserted:  {inserted_count}")
        print(f"   - Assignments skipped:   {skipped_count}")
        print(f"   - Total in table:        {final_count}")

        # Verification against research.md expectation
        expected_count = 17
        if total_jobs == expected_count:
            print(f"\n✅ Matches expected count from research.md ({expected_count} assignments)")
        else:
            print(f"\n⚠️  Count differs from research.md (expected {expected_count}, found {total_jobs})")
            print(f"   This may be due to data changes since research phase.")

        # Show sample assignments (if any were created)
        if inserted_count > 0:
            print("\n📋 Sample assignments created:")
            cursor.execute("""
                SELECT
                    ja.id,
                    j.job_number,
                    j.status,
                    au.email as assigned_user
                FROM job_assignments ja
                JOIN jobs j ON j.id = ja.job_id
                JOIN auth.users au ON au.id = ja.user_id
                ORDER BY ja.created_at DESC
                LIMIT 5
            """)
            samples = cursor.fetchall()
            for sample in samples:
                print(f"   - Job {sample['job_number']} ({sample['status']}) → {sample['assigned_user']}")
        else:
            print("\n📋 No assignments created (all skipped due to invalid tenant_ids)")

    except Exception as e:
        print(f"\n❌ Error during backfill: {e}")
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
