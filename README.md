# HWSW Project — Benchmark Optimization, Analysis, and Hardware Acceleration

**Course:** Hardware/Software Co-Design (00460882), Technion
**Submitters:** Ahmad Abd Alhaleem (322457763), Osama Abd Alhaleem (212604102)

Two [pyperformance](https://pyperformance.readthedocs.io/) benchmarks profiled with
`perf` and flame graphs, optimized, and — for the dominant remaining hotspot — accelerated
with a hardware unit implemented in Verilog and verified in simulation.

## Results

Measured on the **release** interpreter (`/usr/bin/python3`) — the one people actually run:

| Benchmark | Baseline | Optimized | Speedup | Less time | Output verified |
|---|---|---|---|---|---|
| **raytrace** | 804 ms ± 7 | 314 ms ± 2 | **2.56× faster** | **60.9 %** | byte-identical image (sha256) |
| **pyflate** | 1.12 s ± 0.01 | 754 ms ± 7 | **1.48× faster** | **32.4 %** | benchmark's own md5 assertion |

Both clear the project's ≥ 7 % requirement. Standard deviations are ~1 % of the mean.

Flame graphs and `perf` counters use the **debug** interpreter (`python3-dbg`), which the project
guide requires so `perf` can resolve CPython's internal symbols. Timed on the debug build the
speedups come out as 2.98× and 1.44× — one higher, one lower. See
[Which interpreter you measure changes the answer](#which-interpreter-you-measure-changes-the-answer).

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
Python 3.10.12: release /usr/bin/python3 for timing, debug python3-dbg for profiling
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
bash scripts/time_release.sh    # headline timings on the release interpreter
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

## Which interpreter you measure changes the answer

We first timed everything on `python3-dbg`, because profiling requires it. An external review
pointed out that a speedup belongs on the release interpreter. Re-timing there:

| Benchmark | Release `python3` | Debug `python3-dbg` | Debug build… |
|---|---|---|---|
| raytrace | **2.56×** | 2.98× | **inflated** it |
| pyflate | **1.48×** | 1.44× | **understated** it |

A debug build is not a uniformly slower copy of the release build, and it does not bias a speedup
in a fixed direction:

- **raytrace** gained by *removing object allocations and method calls*. In a debug build every
  allocation goes through a guard-byte allocator and extra reference-count checks, so each removed
  allocation saves more there — the speedup looks bigger than it is.
- **pyflate** gained by *replacing interpreted loops with C primitives* (`dict.get`, `Counter`,
  `list.pop`). The debug build compiles that C with assertions and little optimisation, so the code
  we switched *to* is slower there — the speedup looks smaller. (Our best explanation of a 3 %
  gap, not something we isolated.)

The debug allocator was visible in our profiles all along: unresolved frames such as
`0xfdfdfdfdfd000053` are built from `0xFD` — `FORBIDDENBYTE`, the guard value it writes around every
block. **Rule: profile with symbols, measure with the interpreter you ship.**

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
