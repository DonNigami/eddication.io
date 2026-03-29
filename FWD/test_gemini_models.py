"""Test script to check available Gemini models using NEW google.genai package"""
import os
import sys
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("ERROR: GEMINI_API_KEY not found in .env file")
    sys.exit(1)

print(f"OK: API Key loaded: {api_key[:20]}...")

# Create client
client = genai.Client(api_key=api_key)

# Test specific models WITH models/ prefix
test_models = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
    "models/gemini-flash-latest",
]

print("\nTesting specific models...")
for model_name in test_models:
    try:
        print(f"  Testing {model_name}...", end=" ")
        response = client.models.generate_content(
            model=model_name,
            contents="Hello"
        )
        print(f"OK - Response: {response.text[:50] if response.text else 'No text'}...")
        print(f"\n*** SUCCESS: Using model: {model_name} ***")
        sys.exit(0)
    except Exception as e:
        error_msg = str(e)
        if "404" in error_msg or "not found" in error_msg.lower():
            print("NOT FOUND")
        else:
            print(f"ERROR: {error_msg[:100]}...")

print("\nNo models worked!")
