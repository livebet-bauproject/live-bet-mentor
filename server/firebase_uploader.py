# Firebase Uploader for Python Scrapers
# Uses REST API for simplicity (no service account needed)

import requests
import json

FIREBASE_URL = "https://livebetmentor-default-rtdb.europe-west1.firebasedatabase.app"

def sanitise_for_firebase(data):
    """Recursively sanitise keys for Firebase (no . $ # [ ] /)"""
    if isinstance(data, dict):
        new_dict = {}
        for k, v in data.items():
            # Sanitise the key
            safe_key = str(k).replace('.', '_').replace('$', '_').replace('#', '_').replace('[', '_').replace(']', '_').replace('/', '_')
            new_dict[safe_key] = sanitise_for_firebase(v)
        return new_dict
    elif isinstance(data, list):
        return [sanitise_for_firebase(i) for i in data]
    else:
        return data

def upload_to_firebase(path, data):
    """Upload data to Firebase Realtime Database"""
    try:
        # Sanitise data before upload
        safe_data = sanitise_for_firebase(data)
        url = f"{FIREBASE_URL}/{path}.json"
        response = requests.put(url, json=safe_data)
        if response.status_code == 200:
            print(f"[FIREBASE] Successfully uploaded to /{path}")
            return True
        else:
            if response.status_code != 401:
                print(f"[FIREBASE] Upload failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        return False

def get_from_firebase(path):
    """Get data from Firebase Realtime Database"""
    try:
        url = f"{FIREBASE_URL}/{path}.json"
        response = requests.get(url)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"[FIREBASE] Get failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"[FIREBASE] Error getting: {e}")
        return None

# Test function
if __name__ == "__main__":
    # Test upload
    test_data = {"test": "Hello from Python!", "timestamp": "2026-01-05"}
    success = upload_to_firebase("test", test_data)
    print(f"Upload test: {'SUCCESS' if success else 'FAILED'}")
    
    # Test get
    result = get_from_firebase("test")
    print(f"Get test: {result}")
