#!/usr/bin/env python3
import requests
import json

API_URL = "https://jobeye-production.up.railway.app/api/health"

print("Testing GET /api/health...")
response = requests.get(API_URL)
print(f"Status: {response.status_code}\n")

if response.status_code == 200:
    data = response.json()
    print(json.dumps(data, indent=2))
else:
    print(f"Error: {response.text}")
