# HWSW Project — Benchmark Optimization, Analysis, and Hardware Acceleration

**Course:** Hardware/Software Co-Design (00460882), Technion
**Submitters:** Ahmad Abd Alhaleem (322457763), Osama Abd Alhaleem (212604102)

Profiling two [pyperformance](https://pyperformance.readthedocs.io/) benchmarks with `perf`
and flame graphs, optimizing them, and proposing a hardware accelerator for the dominant
bottleneck in each.

> Status: work in progress. Benchmarks under selection.

## Repository layout

| Path | Contents |
|---|---|
| `benchmarks/` | Original and optimized benchmark sources |
| `results/`    | perf output, flame graphs, before/after measurements |
| `hw/`         | Hardware accelerator sources (Verilog/SystemVerilog) + block diagrams |
| `docs/`       | Working notes |
| `report_<bench>.txt` | Per-benchmark report (overview, analysis, optimization, comparison, HW proposal) |
| `script_<bench>.sh`  | Per-benchmark run script (setup, benchmark, flame graph, comparison) |
| `prompt.txt`  | Prompts used with AI tools (required deliverable) |

## Environment

All measurements are taken **inside the course QEMU VM**, never on the host:

```bash
ssh ece882-033@naranja7.cslcs.technion.ac.il
cd /scratch/ece882-033
qemu-system-x86_64 -m 4096m -smp 8 -nographic -cpu host -accel kvm \
  -nic user,model=virtio-net-pci \
  -drive file=jammy-server-cloudimg-amd64-disk-kvm.img,format=qcow2
# guest login: root / ubuntu
```

Profiling uses the **debug build of Python** so that `perf` resolves interpreter frames:

```bash
perf record -F 999 -g -- python3-dbg -m pyperformance run --bench <name>
perf report --stdio > report_<name>.txt
perf script report flamegraph          # -> flamegraph.html
```

## How to reproduce

To be completed once the benchmarks are selected.
