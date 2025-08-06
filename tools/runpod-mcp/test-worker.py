"""
Minimal Runpod serverless worker for testing the MCP deployment tool.

This worker accepts deployments from the MCP server and executes them
in a controlled environment for testing purposes.
"""

import json
import os
import tempfile
import zipfile
import base64
import subprocess
import sys
from typing import Dict, Any, Optional
import traceback


def runpod_handler(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main handler function for Runpod serverless worker.
    
    Expected input format:
    {
        "artifact"?: string (base64 encoded zip),
        "file"?: string (file content),
        "filename"?: string,
        "entrypoint"?: string,
        "env"?: Dict[str, str],
        "workdir"?: string
    }
    """
    try:
        print(f"Received deployment request: {json.dumps(event, indent=2)[:500]}...")
        
        # Set up environment variables
        env_vars = event.get('env', {})
        for key, value in env_vars.items():
            os.environ[key] = value
            print(f"Set env var: {key}={value[:10]}...")
        
        # Handle artifact (zipped directory)
        if 'artifact' in event:
            return handle_artifact_deployment(event)
        
        # Handle single file
        elif 'file' in event:
            return handle_file_deployment(event)
        
        else:
            return {
                "error": "No artifact or file provided in deployment",
                "status": "FAILED"
            }
            
    except Exception as e:
        error_msg = f"Deployment error: {str(e)}"
        print(f"ERROR: {error_msg}")
        traceback.print_exc()
        
        return {
            "error": error_msg,
            "status": "FAILED",
            "traceback": traceback.format_exc()
        }


def handle_artifact_deployment(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle deployment of a zipped artifact (directory)."""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"Created temp directory: {temp_dir}")
        
        # Decode and extract the zip
        artifact_b64 = event['artifact']
        artifact_bytes = base64.b64decode(artifact_b64)
        
        zip_path = os.path.join(temp_dir, 'deployment.zip')
        with open(zip_path, 'wb') as f:
            f.write(artifact_bytes)
        
        # Extract the zip
        extract_dir = os.path.join(temp_dir, 'extracted')
        os.makedirs(extract_dir)
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        print(f"Extracted files to: {extract_dir}")
        
        # List extracted files
        files = []
        for root, dirs, filenames in os.walk(extract_dir):
            for filename in filenames:
                rel_path = os.path.relpath(os.path.join(root, filename), extract_dir)
                files.append(rel_path)
        
        print(f"Extracted files: {files}")
        
        # Execute entrypoint if provided
        entrypoint = event.get('entrypoint')
        if entrypoint:
            return execute_entrypoint(entrypoint, extract_dir, files)
        else:
            return {
                "message": "Artifact deployed successfully",
                "files": files,
                "status": "COMPLETED",
                "workdir": extract_dir
            }


def handle_file_deployment(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle deployment of a single file."""
    
    file_content = event['file']
    filename = event.get('filename', 'deployed_file.txt')
    
    with tempfile.TemporaryDirectory() as temp_dir:
        file_path = os.path.join(temp_dir, filename)
        
        with open(file_path, 'w') as f:
            f.write(file_content)
        
        print(f"Created file: {file_path}")
        
        # Execute entrypoint if provided
        entrypoint = event.get('entrypoint')
        if entrypoint:
            return execute_entrypoint(entrypoint, temp_dir, [filename])
        else:
            return {
                "message": f"File {filename} deployed successfully",
                "content_preview": file_content[:200],
                "status": "COMPLETED",
                "filename": filename
            }


def execute_entrypoint(entrypoint: str, workdir: str, files: list) -> Dict[str, Any]:
    """Execute the specified entrypoint."""
    
    print(f"Executing entrypoint: {entrypoint}")
    
    try:
        # Change to working directory
        original_cwd = os.getcwd()
        os.chdir(workdir)
        
        # Parse entrypoint (e.g., "script.py:main" or just "script.py")
        if ':' in entrypoint:
            script_part, function_part = entrypoint.split(':', 1)
        else:
            script_part = entrypoint
            function_part = None
        
        # Determine execution method based on file extension
        if script_part.endswith('.py'):
            if function_part:
                # Python module:function
                result = execute_python_function(script_part, function_part)
            else:
                # Python script
                result = execute_python_script(script_part)
        elif script_part.endswith('.js') or script_part.endswith('.ts'):
            result = execute_node_script(script_part)
        else:
            # Try to execute as shell command
            result = execute_shell_command(entrypoint)
        
        os.chdir(original_cwd)
        
        return {
            "message": f"Entrypoint {entrypoint} executed successfully",
            "entrypoint": entrypoint,
            "files": files,
            "result": result,
            "status": "COMPLETED"
        }
        
    except Exception as e:
        os.chdir(original_cwd)
        raise e


def execute_python_script(script_path: str) -> Dict[str, Any]:
    """Execute a Python script."""
    result = subprocess.run([
        sys.executable, script_path
    ], capture_output=True, text=True, timeout=30)
    
    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode
    }


def execute_python_function(script_path: str, function_name: str) -> Dict[str, Any]:
    """Execute a specific function from a Python module."""
    # Remove .py extension for import
    module_name = script_path[:-3] if script_path.endswith('.py') else script_path
    
    # Import and execute the function
    import importlib.util
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    
    func = getattr(module, function_name)
    result = func()
    
    return {
        "function_result": result,
        "function_name": function_name
    }


def execute_node_script(script_path: str) -> Dict[str, Any]:
    """Execute a Node.js script."""
    result = subprocess.run([
        'node', script_path
    ], capture_output=True, text=True, timeout=30)
    
    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode
    }


def execute_shell_command(command: str) -> Dict[str, Any]:
    """Execute a shell command."""
    result = subprocess.run(
        command, shell=True, capture_output=True, text=True, timeout=30
    )
    
    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode
    }


# For testing locally
if __name__ == "__main__":
    # Test with a simple file deployment
    test_event = {
        "file": "print('Hello from deployed Python file!')\nprint('Environment test:', os.environ.get('TEST_VAR', 'not set'))",
        "filename": "test.py",
        "entrypoint": "test.py",
        "env": {"TEST_VAR": "Hello World"}
    }
    
    result = runpod_handler(test_event)
    print("Test result:")
    print(json.dumps(result, indent=2))