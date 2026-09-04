#!/usr/bin/env bash
# =============================================================================
# setup_vm.sh -- prepare the QEMU guest for HWSW project profiling.
# Run INSIDE the guest (root@ubuntu), NOT on naranja7.
#
#   bash scripts/setup_vm.sh
#
# Installs python3-dbg (required so perf resolves CPython frames), pyperf /
# pyperformance, and verifies that the PMU actually counts inside the guest.
# =============================================================================
set -uo pipefail

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()  { printf '   [ok] %s\n' "$*"; }
bad() { printf '   [!!] %s\n' "$*"; }

say "0. Environment"
uname -a
. /etc/os-release 2>/dev/null && echo "distro : $PRETTY_NAME"
echo "cores  : $(nproc)"
grep -m1 'model name' /proc/cpuinfo || true

say "1. Disk space (need ~2.5 GB: python3-dbg pulls in gcc/g++/gdb/build-essential)"
df -h /
FREE_MB=$(df -Pm / | awk 'NR==2 {print $4}')
echo "free: ${FREE_MB} MB"
if [ "$FREE_MB" -lt 2500 ]; then
    bad "Not enough free space. Fix this BEFORE installing, or apt will fail half-way."
    echo "   To grow the disk:"
    echo "     1) shut the guest down:   poweroff"
    echo "     2) on naranja7:           cd /scratch/ece882-033"
    echo "                               qemu-img resize jammy-server-cloudimg-amd64-disk-kvm.img +8G"
    echo "     3) boot again; cloud-init usually auto-grows. If not, inside the guest:"
    echo "                               growpart /dev/sda 1 && resize2fs /dev/sda1"
    echo "   Quick win if you only need a little room:"
    echo "     apt-get clean && rm -rf /var/lib/apt/lists/* && journalctl --vacuum-size=20M"
    exit 1
fi
ok "disk space sufficient"

say "2. Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get -y -qq --fix-broken install 2>/dev/null || true
apt-get install -y -qq python3-dbg python3-pip python3-venv linux-tools-common \
    "linux-tools-$(uname -r)" 2>/dev/null \
    || apt-get install -y -qq python3-dbg python3-pip python3-venv linux-tools-common linux-tools-generic
apt-get clean

if command -v perf >/dev/null; then ok "perf $(perf --version 2>&1)"; else bad "perf missing"; fi
if command -v python3-dbg >/dev/null; then ok "python3-dbg present"; else bad "python3-dbg missing"; fi

say "3. perf permissions"
echo "perf_event_paranoid = $(cat /proc/sys/kernel/perf_event_paranoid)"
sysctl -w kernel.perf_event_paranoid=-1 >/dev/null 2>&1 && ok "paranoid set to -1"
sysctl -w kernel.kptr_restrict=0 >/dev/null 2>&1 || true

say "4. PMU sanity check -- do HARDWARE counters actually work in this guest?"
# The tutorials warn a KVM guest may expose no vPMU, silently yielding zeros.
PMU_OUT=$(perf stat -e cycles,instructions true 2>&1)
echo "$PMU_OUT"
if echo "$PMU_OUT" | grep -qiE 'not supported|not counted'; then
    bad "PMU is NOT fully virtualised here; hardware counters are unreliable."
    bad "Fall back to software events (task-clock, page-faults) and say so in the report."
else
    ok "hardware PMU events appear to be counting"
fi

say "5. Python profiling stack"
python3-dbg -m pip install --quiet --upgrade pip 2>/dev/null
python3-dbg -m pip install --quiet pyperf pyperformance && ok "pyperf + pyperformance for python3-dbg"
python3 -m pip install --quiet pyperf pyperformance && ok "pyperf + pyperformance for python3"
python3-dbg -c "import pyperf; print('   pyperf', pyperf.VERSION)" 2>/dev/null \
    || bad "pyperf not importable under python3-dbg"

say "6. Flame graph support"
if perf script report flamegraph --help >/dev/null 2>&1; then
    ok "perf's built-in flamegraph generator is available"
else
    bad "perf has no built-in flamegraph generator on this kernel's linux-tools"
    echo "   Falling back to Brendan Gregg's FlameGraph scripts (the ones Lecture 4 credits)."
    if [ ! -x /opt/FlameGraph/flamegraph.pl ]; then
        mkdir -p /opt/FlameGraph
        BASE=https://raw.githubusercontent.com/brendangregg/FlameGraph/master
        ( cd /opt/FlameGraph           && wget -q "$BASE/stackcollapse-perf.pl" "$BASE/flamegraph.pl"           && chmod +x ./*.pl )
    fi
    if [ -x /opt/FlameGraph/flamegraph.pl ]; then
        ok "FlameGraph scripts installed in /opt/FlameGraph"
    else
        bad "could not fetch FlameGraph scripts -- check guest network"
    fi
fi

say "Setup complete."
echo "Next:  bash scripts/run_experiment.sh"
