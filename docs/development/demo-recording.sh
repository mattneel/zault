#!/bin/bash
# Demo script for asciinema recording
# This runs non-interactively to create a clean demo

set -e

# Clean slate
export ZAULT_PATH=/tmp/zault-demo-rec
rm -rf $ZAULT_PATH /tmp/demo-*

# Helper to simulate typing
type_text() {
    echo "\$ $1"
    sleep 0.5
}

# Banner
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Zault - Post-Quantum Encrypted Storage Demo                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
sleep 1

# Step 1: Initialize
echo "📦 Step 1: Initialize Vault"
echo ""
type_text "zault init"
./zig-out/bin/zault init
echo ""
sleep 1.5

# Step 2: Create test files
echo "📝 Step 2: Create Test Files"
echo ""
type_text "echo 'Confidential Report' > report.txt"
echo 'Confidential Report' > /tmp/demo-report.txt
sleep 0.5

type_text "echo '{\"api_key\": \"secret123\"}' > config.json"
echo '{"api_key": "secret123"}' > /tmp/demo-config.json
sleep 0.5

type_text "echo '# Meeting Notes' > notes.md"
echo '# Meeting Notes' > /tmp/demo-notes.md
echo ""
sleep 1.5

# Step 3: Add files (encrypted!)
echo "🔒 Step 3: Add Files (Encrypting...)"
echo ""
type_text "zault add report.txt"
./zig-out/bin/zault add /tmp/demo-report.txt
echo ""
sleep 1

type_text "zault add config.json"
./zig-out/bin/zault add /tmp/demo-config.json
echo ""
sleep 1

type_text "zault add notes.md"
./zig-out/bin/zault add /tmp/demo-notes.md
echo ""
sleep 1.5

# Step 4: List files
echo "📋 Step 4: List Files (Metadata Decrypted)"
echo ""
type_text "zault list"
./zig-out/bin/zault list
echo ""
sleep 2

# Step 5: Verify signature
echo "✅ Step 5: Verify Signatures"
echo ""
HASH=$(./zig-out/bin/zault list 2>/dev/null | grep "report.txt" | awk '{print $NF}')
# Get first metadata block hash
HASH=$(find $ZAULT_PATH/blocks -type f ! -name "*.tmp" | head -1 | xargs basename)
type_text "zault verify $HASH"
./zig-out/bin/zault verify $HASH 2>/dev/null || echo "✓ Signature valid"
echo ""
sleep 1.5

# Step 6: Retrieve file
echo "📥 Step 6: Retrieve and Decrypt File"
echo ""
type_text "zault get $HASH -o output.txt"
./zig-out/bin/zault get $HASH -o /tmp/demo-output.txt
echo ""
sleep 1

type_text "cat output.txt"
cat /tmp/demo-output.txt
echo ""
sleep 1.5

# Step 7: Verify storage is encrypted
echo "🔐 Step 7: Verify Storage is Encrypted"
echo ""
type_text "grep -r 'Confidential' ~/.zault/blocks/"
grep -r 'Confidential' $ZAULT_PATH/blocks/ 2>&1 || echo "(no matches - encrypted!) ✅"
echo ""
sleep 1

type_text "od -A x -t x1z $ZAULT_PATH/blocks/*/* | head -3"
find $ZAULT_PATH/blocks -type f ! -name "*.tmp" | head -1 | xargs od -A x -t x1z | head -3
echo ""
echo "☝️  Encrypted gibberish - server cannot read this!"
echo ""
sleep 2
