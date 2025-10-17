#!/usr/bin/env python3
import requests
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

job_id = '5714f0f2-b43a-43bc-8e6b-a7202dd49c11'

# Delete the orphaned test items from job_checklist_items
# (Excavator, Concrete Mix, Safety Cones, Rebar Bundle)
print(f"\n🧹 Deleting orphaned test items from job_checklist_items...\n")

orphaned_item_ids = [
    '881faa71-e2fd-470f-871a-6944ee3a0850',  # Excavator
    '79a025c6-5ace-461c-b530-436f7bbdee5f',  # Concrete Mix
    '7fe0d4a5-eb99-4acd-b7a5-44a9ed60f193',  # Safety Cones
    'ab3b90fc-9b45-44b2-941c-9cfb67d20f04'   # Rebar Bundle
]

for item_id in orphaned_item_ids:
    response = requests.delete(
        f"{SUPABASE_URL}/rest/v1/job_checklist_items",
        headers=headers,
        params={
            "job_id": f"eq.{job_id}",
            "item_id": f"eq.{item_id}"
        }
    )

    if response.status_code == 204:
        print(f"✅ Deleted checklist items for item_id: {item_id}")
    else:
        print(f"❌ Error deleting item_id {item_id}: {response.status_code}")
        print(response.text)

print("\n✅ Cleanup complete!")
print("\nNow the job details page should show the real assigned items:")
print("- Roxk (equipment)")
print("- String Trimmer (equipment)")
print("- saw (equipment)")
