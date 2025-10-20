#!/usr/bin/env python3
"""
Backfill script for workflow_task_item_associations

Populates workflow_task_item_associations from jobs.checklist_items JSONB data.

Strategy:
1. Find all jobs with checklist_items but no workflow_task_item_associations
2. For each job, find or create a default workflow task
3. Create workflow_task_item_associations from checklist_items
4. Mark items as 'loaded' if checklist_items.loaded == true

Usage:
  python3 scripts/backfill-workflow-task-items.py [--dry-run] [--limit N]
"""

import requests
import json
import sys
import argparse
from typing import List, Dict, Any

# From .env.local
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def fetch_jobs_with_checklist_items(limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch jobs that have checklist_items"""
    print(f"📥 Fetching jobs with checklist_items (limit={limit})...")

    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/jobs?select=id,title,tenant_id,checklist_items&checklist_items=not.is.null&limit={limit}",
        headers=headers
    )

    if response.status_code != 200:
        print(f"❌ Error fetching jobs: {response.status_code} - {response.text}")
        sys.exit(1)

    jobs = response.json()
    print(f"✅ Found {len(jobs)} jobs with checklist_items")
    return jobs

def fetch_items_by_ids(item_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Fetch items from database by IDs"""
    if not item_ids:
        return {}

    # Build filter: id.in.(id1,id2,id3)
    ids_param = ",".join(item_ids)
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/items?select=id,name,item_type&id=in.({ids_param})",
        headers=headers
    )

    if response.status_code != 200:
        print(f"⚠️  Warning: Error fetching items: {response.status_code}")
        return {}

    items = response.json()
    return {item['id']: item for item in items}

def get_or_create_default_task(job_id: str, tenant_id: str, job_title: str) -> str:
    """Get existing workflow task or create a default one for the job"""

    # Check if job already has workflow tasks
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/workflow_tasks?select=id&job_id=eq.{job_id}&limit=1",
        headers=headers
    )

    if response.status_code == 200:
        tasks = response.json()
        if len(tasks) > 0:
            print(f"   ✓ Using existing task {tasks[0]['id']}")
            return tasks[0]['id']

    # Create default task
    print(f"   + Creating default task for job '{job_title}'")
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/workflow_tasks",
        headers=headers,
        json={
            "job_id": job_id,
            "tenant_id": tenant_id,
            "task_description": "Job Load Verification (auto-created for checklist items migration)",
            "task_order": 1,
            "status": "pending"
        }
    )

    if response.status_code not in [200, 201]:
        print(f"❌ Error creating task: {response.status_code} - {response.text}")
        sys.exit(1)

    task = response.json()
    task_id = task[0]['id'] if isinstance(task, list) else task['id']
    print(f"   ✓ Created task {task_id}")
    return task_id

def backfill_job(job: Dict[str, Any], dry_run: bool = False) -> Dict[str, int]:
    """Backfill workflow_task_item_associations for a single job"""
    job_id = job['id']
    job_title = job['title']
    tenant_id = job['tenant_id']
    checklist_items = job.get('checklist_items', [])

    if not checklist_items:
        return {"skipped": 1, "created": 0, "errors": 0}

    print(f"\n🔄 Processing job: {job_title} ({job_id})")
    print(f"   Checklist items: {len(checklist_items)}")

    if dry_run:
        print(f"   [DRY RUN] Would create {len(checklist_items)} associations")
        return {"skipped": 0, "created": len(checklist_items), "errors": 0}

    # Get or create default task
    task_id = get_or_create_default_task(job_id, tenant_id, job_title)

    # Fetch all item IDs to validate they exist in database
    item_ids = [item.get('id') for item in checklist_items if item.get('id')]
    items_map = fetch_items_by_ids(item_ids)

    created = 0
    errors = 0

    for checklist_item in checklist_items:
        item_id = checklist_item.get('id')
        if not item_id:
            print(f"   ⚠️  Skipping checklist item without ID: {checklist_item}")
            continue

        # Skip if item doesn't exist in database
        if item_id not in items_map:
            print(f"   ⚠️  Skipping non-existent item: {item_id}")
            errors += 1
            continue

        # Determine status from checklist_item
        status = 'loaded' if checklist_item.get('loaded') else 'pending'
        if checklist_item.get('verified'):
            status = 'verified'
        if checklist_item.get('missing'):
            status = 'missing'

        # Create association
        association = {
            "tenant_id": tenant_id,
            "workflow_task_id": task_id,
            "item_id": item_id,
            "quantity": checklist_item.get('quantity', 1),
            "is_required": True,  # All checklist items are required
            "status": status
        }

        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/workflow_task_item_associations",
            headers=headers,
            json=association
        )

        if response.status_code in [200, 201]:
            created += 1
            print(f"   ✓ Created association for item {item_id} (status={status})")
        else:
            # Check if it's a duplicate (unique constraint violation)
            if "duplicate" in response.text.lower() or "unique" in response.text.lower():
                print(f"   ⊘ Association already exists for item {item_id}")
            else:
                print(f"   ❌ Error creating association: {response.status_code} - {response.text}")
                errors += 1

    return {"skipped": 0, "created": created, "errors": errors}

def main():
    parser = argparse.ArgumentParser(description='Backfill workflow_task_item_associations from jobs.checklist_items')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--limit', type=int, default=100, help='Maximum number of jobs to process')
    args = parser.parse_args()

    print("="*60)
    print("🚀 BACKFILL WORKFLOW_TASK_ITEM_ASSOCIATIONS")
    print("="*60)
    if args.dry_run:
        print("⚠️  DRY RUN MODE - No changes will be made")
    print()

    # Fetch jobs
    jobs = fetch_jobs_with_checklist_items(limit=args.limit)

    if not jobs:
        print("✅ No jobs to backfill")
        sys.exit(0)

    # Process each job
    total_created = 0
    total_errors = 0
    total_skipped = 0

    for job in jobs:
        stats = backfill_job(job, dry_run=args.dry_run)
        total_created += stats['created']
        total_errors += stats['errors']
        total_skipped += stats['skipped']

    # Summary
    print("\n" + "="*60)
    print("📊 BACKFILL SUMMARY")
    print("="*60)
    print(f"Jobs processed: {len(jobs)}")
    print(f"Associations created: {total_created}")
    print(f"Errors: {total_errors}")
    print(f"Skipped: {total_skipped}")
    print("="*60)

    if args.dry_run:
        print("\n💡 Run without --dry-run to apply changes")
    else:
        print("\n✅ Backfill complete!")

if __name__ == '__main__':
    main()
