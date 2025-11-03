#!/bin/bash

# Simple test for S3 upload functionality
echo "🧪 Testing S3 upload functionality..."

# Create a test document
echo "This is a test document for AI Real Estate Collateral System
Created: $(date)
Document Type: Test
Content: Sample property ownership information
Owner: John Doe
Property: 123 Main Street, Anytown, USA
Value: $250,000" > test-document.txt

echo "📄 Created test document: test-document.txt"

# Test upload to backend
echo "📤 Testing upload to backend..."
curl -X POST \
  -F "file=@test-document.txt" \
  -F "document_type=Ownership" \
  -F "user_id=1" \
  http://localhost:3001/upload

echo ""
echo "✅ Upload test completed!"

# Clean up
rm -f test-document.txt
echo "🧹 Cleaned up test file"