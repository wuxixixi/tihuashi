#!/bin/bash
# Usage: ./autocannon_linux.sh /absolute/path/to/backend/uploads/sample.jpg
if [ -z "$1" ]; then
  echo "Usage: $0 /absolute/path/to/backend/uploads/sample.jpg"
  exit 1
fi
IMAGE_PATH="$1"
echo "Running autocannon against /api/analyze with image $IMAGE_PATH"
# Requires npx/autocannon installed or will use npx
npx autocannon -c 10 -d 30 -m POST -H "Content-Type: application/json" -b '{"imagePath":"'$IMAGE_PATH'"}' http://localhost:3001/api/analyze
