#!/usr/bin/env python3
import requests
import json

# Test the inventory API directly
API_URL = "https://jobeye-production.up.railway.app/api/supervisor/inventory"

print("Testing GET /api/supervisor/inventory...")
response = requests.get(API_URL)
print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500]}")
print()

# Try to get more details from the error
if response.status_code == 500:
    try:
        error_data = response.json()
        print(f"Error JSON: {json.dumps(error_data, indent=2)}")
    except:
        print("Could not parse error as JSON")
