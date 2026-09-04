#!/usr/bin/env bash
# =============================================================================
# run_hw_sim.sh -- regenerate the RSIU test vectors and simulate the accelerator.
# Run INSIDE the QEMU guest.
#
#   bash scripts/run_hw_sim.sh
#
# The project does not require synthesis or physical testing, but simulating the
# design against the benchmark's own scene is what demonstrates it is, in the
# spec's words, "a complete and logically consistent hardware design".
# =============================================================================
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/results"
mkdir -p "$OUT"

if ! command -v iverilog >/dev/null 2>&1; then
    echo "== installing Icarus Verilog"
    export DEBIAN_FRONTEND=noninteractive
    apt-get install -y -qq iverilog >/dev/null 2>&1 || {
        echo "could not install iverilog -- check guest network"; exit 1; }
fi
echo "iverilog: $(iverilog -V 2>&1 | head -1)"

echo ""
echo "== regenerating test vectors from the real raytrace scene"
python3 "$ROOT/hw/tb/gen_vectors.py" | tee "$OUT/hw_vectors.txt"

echo ""
echo "== compiling RTL"
iverilog -g2005 -Wall -I"$ROOT/hw/tb" -o "$OUT/rsiu_tb" \
    "$ROOT/hw/rtl/fxp_sqrt.v" \
    "$ROOT/hw/rtl/ray_sphere_unit.v" \
    "$ROOT/hw/tb/tb_ray_sphere_unit.v" || { echo "COMPILE FAILED"; exit 1; }
echo "   compiled OK -> results/rsiu_tb"

echo ""
echo "== running simulation"
vvp "$OUT/rsiu_tb" 2>&1 | tee "$OUT/hw_sim.txt"

echo ""
if grep -q "RESULT: PASS" "$OUT/hw_sim.txt"; then
    echo "Hardware simulation PASSED. Log: results/hw_sim.txt"
else
    echo "Hardware simulation FAILED. Log: results/hw_sim.txt"
    exit 1
fi
