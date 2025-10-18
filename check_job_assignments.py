#!/usr/bin/env python3
"""Check which jobs have crew members assigned"""

import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

headers = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

# Query to get jobs with their assignments
query = """
SELECT
  j.id as job_id,
  j.job_number,
  j.title,
  j.scheduled_start,
  j.scheduled_end,
  j.status,
  ja.assigned_user_id,
  ue.email,
  ue.full_name,
  ja.assigned_at
FROM jobs j
LEFT JOIN job_assignments ja ON j.id = ja.job_id
LEFT JOIN users_extended ue ON ja.assigned_user_id = ue.id
WHERE j.tenant_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY j.scheduled_start DESC, j.job_number, ue.full_name
"""

# Execute via PostgREST rpc if available, otherwise try direct query
try:
    # Try using PostgREST query parameter
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={'query': query}
    )

    if response.status_code == 404:
        # RPC doesn't exist, let's query the tables directly
        print("Fetching jobs...")
        jobs_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/jobs",
            headers=headers,
            params={
                'select': '*',
                'tenant_id': 'eq.550e8400-e29b-41d4-a716-446655440000',
                'order': 'scheduled_start.desc',
                'limit': 20
            }
        )

        if jobs_response.status_code != 200:
            print(f"Error fetching jobs: {jobs_response.status_code}")
            print(jobs_response.text)
            exit(1)

        jobs = jobs_response.json()

        print("\n=== JOBS WITH CREW ASSIGNMENTS ===\n")

        for job in jobs:
            print(f"Job: {job['job_number']} - {job['title']}")
            print(f"  Schedule: {job['scheduled_start']} to {job.get('scheduled_end', 'N/A')}")
            print(f"  Status: {job['status']}")

            # Fetch assignments for this job
            assignments_response = requests.get(
                f"{SUPABASE_URL}/rest/v1/job_assignments",
                headers=headers,
                params={
                    'select': 'assigned_user_id,assigned_at',
                    'job_id': f"eq.{job['id']}"
                }
            )

            if assignments_response.status_code == 200:
                assignments = assignments_response.json()

                if assignments:
                    print(f"  Assigned Crew ({len(assignments)}):")
                    for assignment in assignments:
                        # Fetch user details
                        user_response = requests.get(
                            f"{SUPABASE_URL}/rest/v1/users_extended",
                            headers=headers,
                            params={
                                'select': 'email,full_name',
                                'id': f"eq.{assignment['assigned_user_id']}"
                            }
                        )

                        if user_response.status_code == 200:
                            users = user_response.json()
                            if users:
                                user = users[0]
                                print(f"    - {user.get('full_name', 'N/A')} ({user['email']})")
                                print(f"      Assigned at: {assignment['assigned_at']}")
                else:
                    print("  Assigned Crew: None")
            else:
                print(f"  Error fetching assignments: {assignments_response.status_code}")

            print()
    else:
        print(f"Query result: {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"Error: {e}")
