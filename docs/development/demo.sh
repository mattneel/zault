#!/bin/bash
# Zault CLI Demo Script

set -e

echo "=== Zault CLI Demo ==="
echo ""

# Clean up any previous demo
export ZAULT_PATH=/tmp/zault-demo
rm -rf $ZAULT_PATH

echo "1. Initialize vault"
./zig-out/bin/zault init
echo ""

echo "2. Create test files"
echo "Secret document" > /tmp/secret.txt
echo "Another secret" > /tmp/another.txt
echo ""

echo "3. Add files to vault"
./zig-out/bin/zault add /tmp/secret.txt > /tmp/add1.out
cat /tmp/add1.out
HASH1=$(grep "Hash:" /tmp/add1.out | cut -d' ' -f2)
echo ""
./zig-out/bin/zault add /tmp/another.txt > /tmp/add2.out
cat /tmp/add2.out
HASH2=$(grep "Hash:" /tmp/add2.out | cut -d' ' -f2)
echo ""

echo "4. List all blocks"
./zig-out/bin/zault list
echo ""

echo "5. Verify first block"
echo "Hash: $HASH1"
./zig-out/bin/zault verify $HASH1
echo ""

echo "6. Retrieve file"
./zig-out/bin/zault get $HASH1 /tmp/retrieved.txt
echo ""

echo "7. Verify retrieved content"
echo "Original:"
cat /tmp/secret.txt
echo ""
echo "Retrieved:"
cat /tmp/retrieved.txt
echo ""

echo "✓ Demo complete!"
echo ""
echo "Vault location: $ZAULT_PATH"
ls -lah $ZAULT_PATH/
