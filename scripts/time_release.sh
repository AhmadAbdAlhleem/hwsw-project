#!/usr/bin/env bash
# =============================================================================
# time_release.sh -- measure the speedup on the RELEASE interpreter.
# Run INSIDE the QEMU guest.
#
#   bash scripts/time_release.sh
#
# Why this exists. The profiling guide requires python3-dbg so that perf can
# resolve CPython's internal symbols, and our flame graphs and perf counters
# correctly use it. But we then also TIMED the benchmarks on python3-dbg, and a
# speedup should be measured on the interpreter people actually run.
#
# The debug build is not a uniformly slower copy of the release build. It adds
# reference-count checks and object validation to every allocation and
# attribute access -- precisely the operations our optimizations remove -- so
# it penalises them disproportionately and INFLATES the measured speedup.
#
# This script times both benchmarks under /usr/bin/python3 (release) and keeps
# the existing python3-dbg results, so the report can show both side by side.
# =============================================================================
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/results"
mkdir -p "$OUT"
REL=/usr/bin/python3

if ! $REL -c "import pyperf" 2>/dev/null; then
    echo "installing pyperf for the release interpreter..."
    $REL -m pip install --quiet pyperf || { echo "pyperf install failed"; exit 1; }
fi

echo "release interpreter: $($REL -VV 2>&1 | head -1)"
$REL -c "import sys; print('debug build?        :', hasattr(sys, 'gettotalrefcount'))"
echo ""

for B in raytrace pyflate; do
    for V in original optimized; do
        case $V in original) T=base ;; optimized) T=opt ;; esac
        echo "== $B / $V  (release python3) =="
        rm -f "$OUT/${B}_${T}_rel.json"    # pyperf refuses to overwrite
        ( cd "$ROOT/benchmarks/$V/bm_$B" && \
          $REL run_benchmark.py -o "$OUT/${B}_${T}_rel.json" ) 2>&1 | tail -2
    done
done

echo ""
echo "============================================================"
echo "  SPEEDUP BY INTERPRETER"
echo "============================================================"
for B in raytrace pyflate; do
    echo ""
    echo "### $B -- release python3 (the number to report)"
    $REL -m pyperf compare_to "$OUT/${B}_base_rel.json" "$OUT/${B}_opt_rel.json" \
        --table 2>&1 | tee "$OUT/${B}_compare_rel.txt"
    if [ -f "$OUT/${B}_base.json" ]; then
        echo "### $B -- python3-dbg (for comparison)"
        $REL -m pyperf compare_to "$OUT/${B}_base.json" "$OUT/${B}_opt.json" \
            --table 2>&1
    fi
done
