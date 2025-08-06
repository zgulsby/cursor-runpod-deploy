#!/usr/bin/env python3
"""
Example: Web scraper that processes URLs and returns clean text
Perfect for deploying to Runpod for scalable web scraping
"""

import requests
from bs4 import BeautifulSoup
import json
import os

def scrape_url(url):
    """Scrape a URL and return clean text content"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text content
        text = soup.get_text()
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return {
            "url": url,
            "status": "success",
            "text": text[:5000],  # Limit output size
            "length": len(text)
        }
        
    except Exception as e:
        return {
            "url": url,
            "status": "error",
            "error": str(e)
        }

def main():
    """Main handler function - called by Runpod"""
    # Get URLs from environment variable
    urls_env = os.environ.get('URLS', '')
    if not urls_env:
        return {"error": "No URLs provided in URLS environment variable"}
    
    # Parse URLs (comma-separated)
    urls = [url.strip() for url in urls_env.split(',') if url.strip()]
    
    results = []
    for url in urls:
        print(f"Scraping: {url}")
        result = scrape_url(url)
        results.append(result)
    
    return {
        "processed_count": len(results),
        "results": results
    }

if __name__ == "__main__":
    result = main()
    print(json.dumps(result, indent=2))