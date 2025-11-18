#!/bin/bash
# Quick status check for Zault development

echo "=== Zault Development Status ==="
echo ""
echo "Current Phase: 1.2 - CLI Implementation ✅ COMPLETE"
echo ""
echo "Git:"
git log --oneline -1
echo ""
echo "Zig Version:"
zig version
echo ""
echo "Build Status:"
zig build test --summary all 2>&1 | grep -E "Summary|pass"
echo ""
echo "Directory Structure:"
tree src -L 2 2>/dev/null || find src -type f -name "*.zig" | sort
echo ""
echo "Lines of Code:"
find src -name "*.zig" -exec wc -l {} \; | awk '{sum+=$1} END {print "Total: " sum " lines"}'
find src/core -name "*.zig" -exec wc -l {} \; | awk '{sum+=$1} END {print "Core:  " sum " lines"}'
find src/cli -name "*.zig" -exec wc -l {} \; | awk '{sum+=$1} END {print "CLI:   " sum " lines"}'
echo ""
echo "CLI Commands:"
echo "  ./zig-out/bin/zault init"
echo "  ./zig-out/bin/zault add <file>"
echo "  ./zig-out/bin/zault get <hash>"
echo "  ./zig-out/bin/zault list"
echo "  ./zig-out/bin/zault verify <hash>"
echo ""
echo "Run './demo.sh' for full demo"
echo "Run 'zig build test' to run all tests"
