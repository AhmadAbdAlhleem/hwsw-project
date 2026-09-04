# HWSW Project — Benchmark Optimization, Analysis, and Hardware Acceleration

**Course:** Hardware/Software Co-Design (00460882), Technion
**Submitters:** Ahmad Abd Alhaleem (322457763), Osama Abd Alhaleem (212604102)

Two [pyperformance](https://pyperformance.readthedocs.io/) benchmarks profiled with
`perf` and flame graphs, optimized, and — for the dominant remaining hotspot — accelerated
with a hardware unit implemented in Verilog and verified in simulation.

## Results

| Benchmark | Baseline | Optimized | Speedup | Improvement | Output verified |
|---|---|---|---|---|---|
| **raytrace** | 2.15 s ± 0.02 | 719 ms ± 9 ms | **2.98× faster** | **66.6 %** | byte-identical image (sha256) |
| **pyflate** | 3.12 s ± 0.02 | 2.18 s ± 0.02 | **1.44× faster** | **30.1 %** | benchmark's own md5 assertion |

Both clear the project's ≥ 7 % requirement. Standard deviations are ~1 % of the mean.

**Hardware:** a Ray–Sphere Intersection Unit (RSIU) for raytrace's dominant function,
simulated with Icarus Verilog against the benchmark's real scene — **9/9 correct, one
result per cycle, 30-cycle latency, worst error 9.0e-4**.

## Repository layout

| Path | Contents |
|---|---|
| `report_raytrace.txt` | Full analysis: profiling, optimizations, comparison, **hardware proposal** |
| `report_pyflate.txt` | Full analysis, plus why pyflate resists the same accelerator pattern |
| `script_raytrace.sh` | Run + profile + compare raytrace (spec-required entry point) |
| `script_pyflate.sh` | Run + profile + compare pyflate (spec-required entry point) |
| `prompt.txt` | Prompts used with AI tools (spec-required) |
| `benchmarks/original/` | Unmodified pyperformance 1.14.0 sources, vendored for a clean diff |
| `benchmarks/optimized/` | Our optimized variants |
| `hw/rtl/` | Accelerator RTL: `fxp_sqrt.v`, `ray_sphere_unit.v` |
| `hw/tb/` | Testbench + vector generator (vectors derived from the real scene) |
| `scripts/` | Setup, profiling drivers, correctness checker, simulation runner |
| `results/` | perf output, flame graphs, cProfile, simulation logs, `measurements.md` |

## Environment

**All measurements were taken inside the course QEMU/KVM guest, never on the host.**

```
Ubuntu 22.04.5 LTS guest, kernel 5.15.0-1080-kvm
Python 3.10.12 debug build (python3-dbg), GCC 11.4.0
perf 5.15.179, pyperf 2.10.0, Icarus Verilog 11.0
Intel Xeon E5-2630 v3 @ 2.40 GHz (Haswell), 8 vCPU
```

Starting the guest from the course server:

```bash
ssh ece882-033@naranja7.cslcs.technion.ac.il
cd /scratch/ece882-033
qemu-system-x86_64 -m 4096m -smp 8 -nographic -cpu host -accel kvm \
  -nic user,model=virtio-net-pci \
  -drive file=jammy-server-cloudimg-amd64-disk-kvm.img,format=qcow2
# guest login: root / ubuntu
```

The stock 2 GB guest image is too small: `python3-dbg` pulls in gcc/g++/gdb/build-essential.
Grow it before starting (`qemu-img resize <img> +12G`, then `growpart /dev/sda 1 && resize2fs /dev/sda1`).
`scripts/setup_vm.sh` checks this and refuses to start rather than failing half-way through `apt`.

## How to reproduce

Inside the guest, from the repository root:

```bash
bash scripts/setup_vm.sh        # python3-dbg, pyperf, perf, FlameGraph
bash script_raytrace.sh         # run + profile + compare raytrace
bash script_pyflate.sh          # run + profile + compare pyflate
bash scripts/run_hw_sim.sh      # compile and simulate the accelerator
```

Or run everything for both benchmarks in one pass:

```bash
bash scripts/run_experiment.sh
```

Every script refuses to report a performance number if the correctness check fails —
an optimization that changes the output is a bug, not a speedup.

## Three profiling pitfalls we hit (and how they are handled)

Recorded here because each silently produces wrong or empty data rather than an error:

1. **PEBS is not virtualized in a KVM guest.** `perf record` defaults to `cycles:ppp`, a
   precise event. With no PEBS it captured almost nothing — 14 KB `perf.data`, empty
   reports, 579-byte flame graphs. Sampling on **`cpu-clock`** (a software, time-based
   event — which is what a flame graph measures anyway) produces real 110–146 KB profiles.
2. **Counter multiplexing.** The guest vPMU exposes only **4 generic counters**. Requesting
   six hardware events time-shares them and reported `cycles` as **0**, making IPC
   uncomputable. All cycle/IPC figures come from a separate two-event run.
3. **pyperf refuses to overwrite an existing result file.** On a re-run this silently
   skipped the measurement and `compare_to` reported the *previous* run's numbers. The
   scripts delete the target JSON first.

## `perf` cannot profile Python alone

`perf` samples the interpreter, so every profile bottoms out in
`_PyEval_EvalFrameDefault` — proving the workloads are interpreter-bound, but never
saying *which Python function* is responsible, since all Python frames execute inside that
one C function. `scripts/profile_python.py` adds cProfile attribution. Using both is the
flame-graph-plus-second-view pairing Lecture 4 recommends: one shows *where in the code*,
the other *why in the machine*.

## Hardware accelerator

`hw/` contains the Ray–Sphere Intersection Unit, targeting `Sphere.intersectionTime` —
**28.1 % of optimized raytrace runtime**, called 179,457 times per frame.

The render loop tests **one ray against many spheres**, so the ray is held stationary in
registers while spheres stream through one per cycle — the weight-stationary dataflow the
TPU uses. The datapath has **no data-dependent control**: a miss is a flag on the result,
not a branch, so it never stalls.

```bash
bash scripts/run_hw_sim.sh
```

Honest bound: even an infinitely fast accelerator is capped by Amdahl at
**1/(1 − 0.281) = 1.39×**. Section 5.9 of `report_raytrace.txt` works through why building
a *wider* unit would change nothing, and what a larger offload would be worth instead.
