#!/bin/bash
# JETSETGO - Deployment Test Scripts
# Run these to verify deployment

SUPABASE_URL="https://icgtllieipahixesllux.supabase.co"

echo "Testing JETSETGO Deployment..."
echo ""

echo "1. Testing Agent Orchestrator..."
curl -X POST \
  "$SUPABASE_URL/functions/v1/jetsetgo-agent" \
  -H "Content-Type: application/json" \
  -d '{"query":"ยาง Michelin","sessionId":"test-001"}' \
  | jq .

echo ""
echo "2. Testing RAG Query..."
curl -X POST \
  "$SUPABASE_URL/functions/v1/jetsetgo-rag-query" \
  -H "Content-Type: application/json" \
  -d '{"query":"น้ำมันเครื่อง","sessionId":"test-002"}' \
  | jq .

echo ""
echo "3. Testing Embedding..."
curl -X POST \
  "$SUPABASE_URL/functions/v1/jetsetgo-embed" \
  -H "Content-Type: application/json" \
  -d '{"text":"ยางรถยนต์ขนาด 205/55R16"}' \
  | jq .

echo ""
echo "✅ Tests complete!"
