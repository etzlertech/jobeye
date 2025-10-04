#!/usr/bin/env python3
import subprocess
import time
import sys
from datetime import datetime

def get_latest_commit():
    """Get the latest commit hash"""
    try:
        result = subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True)
        return result.stdout.strip()[:7]
    except:
        return None

def check_deployment_status(commit_hash):
    """
    Monitor deployment status
    Since we can't use Railway API directly, we'll use timing heuristics
    """
    print(f"🚂 Monitoring Railway deployment for commit: {commit_hash}")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\n📊 Deployment typically takes 2-3 minutes...")
    
    # Check GitHub Actions if available
    print("\nCheck deployment status at:")
    print(f"  https://github.com/etzlertech/jobeye/actions")
    print(f"  https://railway.app/dashboard")
    
    # Simple progress indicator
    duration = 180  # 3 minutes
    interval = 30   # Update every 30 seconds
    
    for i in range(0, duration, interval):
        elapsed = i
        remaining = duration - i
        progress = (elapsed / duration) * 100
        
        print(f"\n⏳ Progress: {progress:.0f}% ({elapsed}s elapsed, ~{remaining}s remaining)")
        
        if i < duration - interval:
            print("   Status: Deploying... (waiting)")
            time.sleep(interval)
        else:
            print("   Status: Should be deployed!")
    
    print(f"\n✅ Deployment should be complete!")
    print(f"⏰ Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\n🌐 Test your changes at: https://jobeye-production.up.railway.app")

def main():
    # Get latest commit
    commit = get_latest_commit()
    if not commit:
        print("❌ Could not get latest commit")
        return
    
    # Check for uncommitted changes
    result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
    if result.stdout.strip():
        print("⚠️  Warning: You have uncommitted changes")
        print("   These changes won't be deployed until committed and pushed\n")
    
    # Monitor deployment
    check_deployment_status(commit)

if __name__ == "__main__":
    main()