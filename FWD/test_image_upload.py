"""Test script to verify image upload and OCR work"""
import os
import io
from PIL import Image
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("ERROR: GEMINI_API_KEY not found")
    exit(1)

# Create client
client = genai.Client(api_key=api_key)

# Create a simple test image (1x1 red pixel)
test_image = Image.new('RGB', (100, 100), color='red')

# Save to buffer
img_buffer = io.BytesIO()
test_image.save(img_buffer, format='JPEG')
img_buffer.seek(0)

print("Uploading test image...")

# Upload file
uploaded_file = client.files.upload(
    file=img_buffer,
    config=dict(
        mime_type="image/jpeg",
        display_name="test.jpg"
    )
)

print(f"File uploaded: {uploaded_file.name}")
print(f"File URI: {uploaded_file.uri}")

# Test generate content
print("\nTesting OCR...")

response = client.models.generate_content(
    model="models/gemini-2.5-flash",
    contents=["What do you see?", uploaded_file]
)

print(f"Response: {response.text}")

print("\n*** SUCCESS: Image upload and OCR working! ***")
