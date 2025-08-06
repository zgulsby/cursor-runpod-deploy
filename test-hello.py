#!/usr/bin/env python3

import os
import json

def main():
    print("🚀 Hello from Runpod deployment!")
    print(f"Python version: {os.sys.version}")
    print(f"Current working directory: {os.getcwd()}")
    
    # Test environment variables
    test_var = os.environ.get('TEST_VAR', 'not set')
    print(f"TEST_VAR: {test_var}")
    
    # List files in current directory
    files = os.listdir('.')
    print(f"Files in directory: {files}")
    
    return {
        "message": "Deployment test successful!",
        "environment": dict(os.environ),
        "files": files
    }

if __name__ == "__main__":
    result = main()
    print("Result:", json.dumps(result, indent=2))