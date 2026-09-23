# Running the Part E experiments — checklist

Do this on your own machine (needs Docker + internet access to pull
images — the sandbox that built this repo couldn't reach Docker Hub /
elastic.co, so this step genuinely has to happen on your side). Budget
~30-40 minutes including image pulls.

## 0. One-time setup (~10 min, mostly image downloads)

```bash
cd quickbite-observability
docker compose up --build -d
docker compose ps          # wait until all show "running" / "healthy"
```

Sanity-check before moving on:
- http://localhost:3000/health → `{"status":"ok"}`
- http://localhost:9090/targets → `app`, `node-exporter`, `prometheus` all **UP** (`cardinality-demo` will show down — that's expected, it's not started yet)
- http://localhost:3001 → Grafana loads, log in `admin`/`admin`, open the **"QuickBite - Observability"** dashboard — panels render (mostly empty until you send traffic)
- http://localhost:5601 → Kibana loads

Create the Kibana index pattern once (see README "Viewing logs in Kibana")
so log searches work later.

## 1. Fault injection experiment (Part E.1) — ~5 min

```bash
chmod +x experiments/*.sh
./experiments/fault_experiment.sh
```

While it runs, keep a browser tab open on Grafana's **"HTTP request
latency - p95/p99 (Histogram)"** panel, zoomed to the last 15-20 minutes,
and note wall-clock times as the script prints each stage:

| Capture this | When |
|---|---|
| Screenshot 1: latency panel, BEFORE window | right after stage 1 finishes |
| Screenshot 2: latency panel, DURING window | right after stage 2 finishes |
| Screenshot 3: latency panel, AFTER window | right after stage 3 finishes |
| Screenshot 4: Kibana search `message: "fault injection: delaying request"`, time range = the DURING window | after stage 2 |
| The script's own printed `sent/ok/failed/avgMs` lines for each stage | copy from terminal |

Then in `REPORT.md`, replace the `*(Run the script yourself...)*` note
under **E.1** with:
- the three screenshots (or the numbers read off them: approx p95/p99
  before, during, after)
- the avg/ok/failed numbers from the terminal output for each stage
- one sentence confirming recovery (AFTER ≈ BEFORE)

## 2. Cardinality explosion (Part E.2) — ~10 min

Terminal A:
```bash
docker compose run --rm -e LABELED=true -p 9091:9091 cardinality-demo
```
Terminal B (once Terminal A shows "listening on :9091"):
```bash
./experiments/cardinality_test.sh
```
Follow its prompts — it'll tell you when to Ctrl+C Terminal A, restart it
with `-e LABELED=false`, and press enter to continue to step 2.

Capture:
- The `count(demo_requests_total)` value the script prints after the
  labeled run (expect ~100)
- The same value after the unlabeled run (expect exactly 1)
- Optional but nice: a Grafana screenshot of the "Active Prometheus time
  series (cardinality demo)" panel showing the step up then the flat line

Then in `REPORT.md`, replace the placeholder numbers under **E.2**'s
"What we observed locally" with your actual 100-request results (the
10-request numbers already in there from local dev testing can stay as a
smaller worked example, or you can just replace them outright).

## 3. Clean up

```bash
docker compose down          # keep data
# or
docker compose down -v       # wipe everything, start fresh next time
```

## 4. Final check before submitting

- [ ] `REPORT.md` E.1 has real screenshots/numbers, not the placeholder note
- [ ] `REPORT.md` E.2 has real 100-request series counts
- [ ] Both `*(...)*` italic placeholder notes in `REPORT.md` are deleted or replaced
- [ ] `git add -A && git commit -m "Add experiment results"` and push
