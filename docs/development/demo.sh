#!/bin/bash
# Zault CLI Demo - Working version

set -e

echo "=== Zault CLI Demo ==="
echo ""

# Clean up
export ZAULT_PATH=/tmp/zault-demo
rm -rf $ZAULT_PATH /tmp/demo-*.txt

echo "1. Initialize vault"
./zig-out/bin/zault init
echo ""

echo "2. Add file"
echo "Secret document content" > /tmp/demo-secret.txt
./zig-out/bin/zault add /tmp/demo-secret.txt > /tmp/add-output.txt 2>&1
cat /tmp/add-output.txt
HASH=$(cat /tmp/add-output.txt | grep "Hash:" | cut -d' ' -f2)
echo ""

echo "3. List files"
./zig-out/bin/zault list
echo ""

echo "4. Verify signature (hash: ${HASH:0:16}...)"
./zig-out/bin/zault verify $HASH
echo ""

echo "5. Retrieve and decrypt"
./zig-out/bin/zault get $HASH -o /tmp/demo-retrieved.txt
echo "Content: $(cat /tmp/demo-retrieved.txt)"
echo ""

echo "✓ All operations successful!"
