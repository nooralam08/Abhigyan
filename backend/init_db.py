"""
Abhigyan Top-Level Database Initialization Launcher.
Convenience entrypoint: python backend/init_db.py
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.init_db import init_database

if __name__ == "__main__":
    result = init_database(raise_on_error=True)
    if result.get("status") == "success":
        print("\n=======================================================")
        print(" SUCCESS: Database initialized with all required tables.")
        print(f" Tables present: {', '.join(result.get('tables', []))}")
        counts = result.get('counts', {})
        if counts:
            print(f" Records: {counts.get('users', 0)} users, {counts.get('institutions', 0)} institutions, {counts.get('settings', 0)} settings.")
        print("=======================================================\n")
        sys.exit(0)
    else:
        print("\n=======================================================")
        print(" FAILED: Database initialization error.")
        print(f" Details: {result}")
        print("=======================================================\n")
        sys.exit(1)

