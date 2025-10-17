#!/usr/bin/env python3
"""
Create crew member users in Supabase Auth
Uses Admin API to create users with proper metadata
"""

import requests
import json

# Configuration from .env.local
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"
TENANT_ID = "550e8400-e29b-41d4-a716-446655440000"

# Crew members to create
crew_members = [
    {
        "email": "jackson@tophand.tech",
        "password": "demo123",
        "full_name": "Jackson Etzler",
        "role": "technician"
    },
    {
        "email": "rose@tophand.tech",
        "password": "demo123",
        "full_name": "Rose Egan",
        "role": "technician"
    },
    {
        "email": "jj@tophand.tech",
        "password": "demo123",
        "full_name": "Jeremiah Vasquez",
        "role": "technician"
    },
    {
        "email": "david@tophand.tech",
        "password": "demo123",
        "full_name": "David Heneke",
        "role": "technician"
    },
    {
        "email": "travis@tophand.tech",
        "password": "demo123",
        "full_name": "Travis Etzler",
        "role": "technician"
    }
]

def create_user(user_data):
    """Create a user via Supabase Admin API"""
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "email": user_data["email"],
        "password": user_data["password"],
        "email_confirm": True,  # Auto-confirm email
        "user_metadata": {
            "full_name": user_data["full_name"]
        },
        "app_metadata": {
            "tenant_id": TENANT_ID,
            "roles": [user_data["role"]]
        }
    }

    response = requests.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=headers,
        json=payload
    )

    return response

print("Creating crew members...\n")

for crew in crew_members:
    print(f"Creating {crew['full_name']} ({crew['email']})...")
    response = create_user(crew)

    if response.status_code in [200, 201]:
        user_id = response.json().get("id")
        print(f"  ✓ Created successfully (ID: {user_id})")
    else:
        print(f"  ✗ Failed: {response.status_code}")
        print(f"    {response.text}")
    print()

print("Done!")
