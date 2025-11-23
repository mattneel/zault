#!/bin/bash
# Zault CLI Demo Script - Simple version

set -e

echo "=== Zault CLI Demo ==="
echo ""

# Clean up
export ZAULT_PATH=/tmp/zault-demo
rm -rf $ZAULT_PATH

echo "1. Initialize vault"
./zig-out/bin/zault init
echo ""

echo "2. Create and add files"
echo "Secret document" > /tmp/secret.txt
./zig-out/bin/zault add /tmp/secret.txt | tee /tmp/hash.txt
HASH=$(grep "Hash:" /tmp/hash.txt | awk '{print $2}')
echo ""

echo "3. List files"
./zig-out/bin/zault list
echo ""

echo "4. Verify signature"
./zig-out/bin/zault verify $HASH
echo ""

echo "5. Retrieve file"
./zig-out/bin/zault get $HASH -o /tmp/retrieved.txt
cat /tmp/retrieved.txt
echo ""

echo "✓ Demo complete! Vault at: $ZAULT_PATH"
