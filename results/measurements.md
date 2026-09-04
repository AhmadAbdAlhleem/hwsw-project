# Measured results

All numbers measured **inside the course QEMU/KVM guest**, never on the host.

**Environment**
```
kernel : 5.15.0-1080-kvm  (Ubuntu 22.04.5 LTS guest)
python : Python 3.10.12 debug build (python3-dbg), GCC 11.4.0
perf   : 5.15.179
cpu    : Intel Xeon E5-2630 v3 @ 2.40GHz (Haswell), 8 vCPU under QEMU/KVM
pyperf : 2.10.0
```

## Headline result — `pyperf compare_to`

| Benchmark | Original | Optimized | Speedup | Improvement |
|---|---|---|---|---|
| raytrace | 2.15 s ± 0.02 s | 719 ms ± 9 ms | **2.98x faster** | **66.6 %** |
| pyflate  | 3.12 s ± 0.02 s | 2.18 s ± 0.02 s | **1.44x faster** | **30.1 %** |

Both clear the project's >= 7 % bar by a wide margin. Standard deviations are
~1 % of the mean, so both differences are far outside measurement noise.

## Correctness (checked before any performance number was recorded)

| Benchmark | Check | Result |
|---|---|---|
| raytrace | sha256 of rendered PPM, original vs optimized | identical (`520b45b95e22ba0c...`) |
| pyflate  | benchmark's built-in md5 of decompressed output | matches reference digest |

## Hardware counters

`cycles` and `instructions` come from a dedicated two-event `perf stat` run; see
"threats to validity" below for why they cannot be read from the nine-event run.

### raytrace

| Metric | Original | Optimized | Change |
|---|---|---|---|
| Elapsed (5 loops) | 10.85 s | 3.79 s | **2.86x faster** |
| Task-clock | 10 846 ms | 3 787 ms | 2.86x less |
| Cycles | 25.98 B | 9.02 B | **2.88x fewer** |
| Instructions | 53.33 B | 19.71 B | **2.71x fewer** |
| IPC | 2.07 | 2.18 | +5.3 % |
| Branches | 12.93 B | 4.71 B | 2.74x fewer |
| Branch-miss rate | 0.89 % | 0.73 % | lower |
| Cache references | 38.0 M | 15.3 M | 2.49x fewer |
| Cache misses (abs) | 171 475 | 158 894 | slightly fewer |
| Cache-miss rate | 0.45 % | 1.04 % | *higher* (see below) |
| Page faults | 3 391 | 3 391 | **identical** |
| Context switches | 10 | 4 | negligible either way |

### pyflate

| Metric | Original | Optimized | Change |
|---|---|---|---|
| Elapsed (5 loops) | 16.13 s | 11.18 s | **1.44x faster** |
| Task-clock | 16 124 ms | 11 167 ms | 1.44x less |
| Cycles | 37.92 B | 26.48 B | **1.43x fewer** |
| Instructions | 84.21 B | 59.63 B | **1.41x fewer** |
| IPC | 2.20 | 2.25 | +2.3 % |
| Branches | 20.73 B | 14.53 B | 1.43x fewer |
| Branch-miss rate | 0.48 % | 0.41 % | lower |
| Cache references | 49.6 M | 26.5 M | **1.87x fewer** |
| Cache misses (abs) | 3.236 M | 3.257 M | essentially unchanged |
| Cache-miss rate | 6.53 % | 12.30 % | *higher* (see below) |
| Page faults | 45 957 | 44 930 | ~unchanged |
| Context switches | 23 | 18 | negligible either way |

## Reading the counters

**The speedup is removed work, not better execution efficiency.** In both
benchmarks cycles and instructions fall by almost exactly the same factor
(raytrace 2.88x / 2.71x, pyflate 1.43x / 1.41x) while IPC barely moves
(2.07 -> 2.18 and 2.20 -> 2.25). The processor is executing about as efficiently
per cycle as before; it simply has far less to execute. The small IPC gains are
a secondary effect of touching less memory.

**Page faults are unchanged** (raytrace 3 391 vs 3 391 — identical to the fault;
pyflate 45 957 vs 44 930). Neither benchmark's memory footprint moved, so the
measurement is not contaminated by allocation or I/O behaviour: the difference
is pure user-space compute. This is the same style of invariant used in HW1,
where matching instruction counts proved that only data layout had changed.

**The cache-miss *rate* rises while performance improves** — raytrace 0.45 % ->
1.04 %, pyflate 6.53 % -> 12.30 %. This is precisely the trap Tutorial 2 sets
with its 2D-array demo, where the faster row-major version had a 9x *worse* miss
rate. A rate is a quotient, and here the denominator collapsed: pyflate's cache
*references* fell 1.87x (49.6 M -> 26.5 M) because removing `sorted()` and the
256 `find()` scans eliminated a large volume of streaming reads that were nearly
all hits. The absolute miss count barely changed (3.236 M -> 3.257 M) — those are
the compulsory misses, which no amount of restructuring removes. Report absolute
counts, not just rates.

## Threats to validity

- **PEBS is not virtualized in this guest.** `perf record`'s default event is
  `cycles:ppp`, a precise event; with no PEBS it collected almost no samples
  (14 KB `perf.data`, empty reports, 579-byte flame graphs). Re-running with
  `-e cpu-clock` — a software, time-based event, which is what a flame graph
  measures anyway — produced real profiles (110-146 KB flame graphs).
- **Counter multiplexing.** The guest vPMU exposes only 4 generic counters. A
  `perf stat` requesting six hardware events time-shares them and extrapolates;
  in our nine-event runs this reported `cycles = 0` outright. All cycle and IPC
  figures above therefore come from a separate run requesting only two events.
- **Virtualization overhead.** Everything runs under KVM, where a vmexit costs
  roughly 1000-4000 cycles and a TLB miss requires a two-dimensional page walk.
  Both variants of each benchmark pay this equally, so the *comparison* is
  sound, but the absolute times are not bare-metal numbers.
- **`perf` cannot fully unwind CPython's stacks.** Many callers resolve to raw
  addresses (`0xfdfdfdfdfd000053`) because the interpreter is built without
  frame pointers. Leaf attribution (self time) is reliable; deep call-graph
  attribution is not, so we rely on self time plus the counters.

## Where the time goes

`perf report` self time, top frame in all four profiles:

| Profile | Top symbol | Self |
|---|---|---|
| raytrace original | `_PyEval_EvalFrameDefault` | 28.11 % |
| raytrace optimized | `_PyEval_EvalFrameDefault` | 34.10 % |
| pyflate original | `_PyEval_EvalFrameDefault` | 23.51 % |
| pyflate optimized | `_PyEval_EvalFrameDefault` | 23.97 % |

`_PyEval_EvalFrameDefault` is CPython's bytecode dispatch loop. That it
dominates every profile is the central fact behind the hardware-acceleration
argument: for these workloads the machine spends most of its time *interpreting*
rather than computing the answer.

Note it *rises* to 34.10 % of raytrace after optimization. Its absolute cost fell
with everything else; what changed is the mix. We removed the surrounding call
and allocation overhead, so of the work that remains, a larger fraction is raw
interpreter dispatch — the floor that software optimization cannot remove, and
therefore exactly the part that motivates hardware.

Artifacts in this directory: `*_flame.svg` (flame graphs), `*_report.txt`
(perf report), `*_stat.txt` (nine-event perf stat), `*_ipc.txt`
(cycles/instructions), `*_base.json` / `*_opt.json` (raw pyperf samples),
`*_compare.txt` (compare_to tables).
