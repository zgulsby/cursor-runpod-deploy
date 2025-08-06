#!/usr/bin/env python3
"""
Example: Image processing service
Resize, filter, and analyze images at scale
"""

import os
import base64
import json
from PIL import Image, ImageFilter, ImageEnhance
import io
import cv2
import numpy as np

def process_image(image_data, operations):
    """Process an image with specified operations"""
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        results = {
            "original_size": image.size,
            "operations_applied": []
        }
        
        # Apply operations
        for op in operations:
            operation = op.get('type')
            params = op.get('params', {})
            
            if operation == 'resize':
                width = params.get('width', 800)
                height = params.get('height', 600)
                image = image.resize((width, height), Image.Resampling.LANCZOS)
                results["operations_applied"].append(f"resized to {width}x{height}")
                
            elif operation == 'blur':
                radius = params.get('radius', 2)
                image = image.filter(ImageFilter.GaussianBlur(radius=radius))
                results["operations_applied"].append(f"blurred with radius {radius}")
                
            elif operation == 'enhance':
                factor = params.get('brightness', 1.0)
                enhancer = ImageEnhance.Brightness(image)
                image = enhancer.enhance(factor)
                results["operations_applied"].append(f"brightness enhanced by {factor}")
                
            elif operation == 'grayscale':
                image = image.convert('L')
                results["operations_applied"].append("converted to grayscale")
        
        # Convert back to base64
        output_buffer = io.BytesIO()
        image.save(output_buffer, format='PNG')
        output_data = base64.b64encode(output_buffer.getvalue()).decode()
        
        results.update({
            "final_size": image.size,
            "output_image": output_data[:100] + "...",  # Truncate for display
            "output_size_bytes": len(output_data)
        })
        
        return results
        
    except Exception as e:
        return {"error": f"Image processing failed: {str(e)}"}

def main():
    """Main handler for Runpod"""
    # Get configuration from environment
    image_data = os.environ.get('IMAGE_DATA')
    operations_str = os.environ.get('OPERATIONS', '[]')
    
    if not image_data:
        return {"error": "No image data provided in IMAGE_DATA environment variable"}
    
    try:
        operations = json.loads(operations_str)
    except json.JSONDecodeError:
        operations = []
    
    # Process the image
    result = process_image(image_data, operations)
    
    return {
        "service": "image-processor",
        "timestamp": "2024-08-06",
        "result": result
    }

if __name__ == "__main__":
    # Example usage
    result = main()
    print(json.dumps(result, indent=2))