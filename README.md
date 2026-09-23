# QuickBite — Observability Assignment

A tiny food-ordering API (Node.js/Express) fully instrumented with
Prometheus + Grafana metrics and an Elasticsearch/Kibana logging pipeline
via Filebeat, plus scripted experiments for fault injection and Prometheus
cardinality explosion.

See [`REPORT.pdf`](REPORT.pdf) for the full write-up (Parts A–E) and
[`docs/architecture.md`](docs/architecture.md) for the system diagram.
Before submitting, run [`docs/running-experiments-checklist.md`](docs/running-experiments-checklist.md)
to capture real Part E results — the report currently has placeholders there.

## Stack

| Purpose | Tool | Port |
|---|---|---|
| App under observation | QuickBite API (Node/Express) | `3000` |
| Metrics scraping/storage | Prometheus | `9090` |
| Dashboards | Grafana (admin/admin) | `3001` |
| Host metrics | Node Exporter | `9100` |
| Log storage/search | Elasticsearch | `9200` |
| Log storage/search | Kibana | `5601` |
| Log shipping | Filebeat | — (no exposed port) |
| Part E.2 helper | cardinality-demo app | `9091` (only when run explicitly) |

## Prerequisites

- Docker + Docker Compose v2 (`docker compose version`)
- ~4GB RAM free for Elasticsearch + the rest of the stack
- Node.js 18+ only if you want to run `app/` or `experiments/*.js` outside
  Docker

## Start everything

```bash
docker compose up --build
```

First boot takes a minute or two (Elasticsearch is the slow one). Once
it's up:

- QuickBite API: http://localhost:3000/health
- Prometheus: http://localhost:9090 (check **Status → Targets**, all
  should show `state: UP` except `cardinality-demo`, which is only started
  during the Part E.2 experiment)
- Grafana: http://localhost:3001 — login `admin` / `admin`, dashboard
  **"QuickBite - Observability"** is auto-provisioned, no manual setup
  needed
- Kibana: http://localhost:5601 — create an index pattern once (see
  "Viewing logs in Kibana" below)

## Using the app

```bash
# Place an order
curl -X POST localhost:3000/orders -H "Content-Type: application/json" \
  -d '{"customerRef":"cust_42","items":[{"name":"Zinger Burger","price":5.5,"qty":2}]}'

# Mark it ready (replace ORDER_ID with the id from the response above)
curl -X POST localhost:3000/orders/ORDER_ID/ready

# Cancel an order instead
curl -X POST localhost:3000/orders/ORDER_ID/cancel

# List / fetch orders
curl localhost:3000/orders
curl localhost:3000/orders/ORDER_ID

# Raw Prometheus metrics
curl localhost:3000/metrics
```

Generate ongoing traffic so the dashboards have something to show:
```bash
node experiments/load_generator.js 120 5   # 120 seconds at 5 requests/sec
```

## Viewing logs in Kibana

1. Open http://localhost:5601
2. **Stack Management → Index Patterns → Create index pattern**
3. Pattern: `quickbite-logs-*`, time field: `@timestamp`
4. Go to **Discover**, pick that pattern, and search e.g.
   `message: "order placed"` or `requestId: "<some id>"`

## Running the experiments (Part E)

**Fault injection** (needs the stack running + traffic flowing):
```bash
chmod +x experiments/*.sh   # if not already executable
./experiments/fault_experiment.sh
```
This runs a before/during/after sequence and tells you which Grafana panel
and time ranges to screenshot for the report.

**Cardinality explosion**:
```bash
# Terminal 1: labeled mode
docker compose run --rm -e LABELED=true -p 9091:9091 cardinality-demo

# Terminal 2, once terminal 1 is up:
./experiments/cardinality_test.sh
```
Follow the prompts — it'll tell you when to switch the demo app to
`LABELED=false` and re-run.

## Running the app without Docker (quick local dev)

```bash
cd app
npm install
LOG_FILE=./logs/quickbite.log node server.js
```
You'll still need Prometheus/Grafana/ELK running separately (via
`docker compose up prometheus grafana node-exporter elasticsearch kibana
filebeat`) and pointed at your local app for the full pipeline to work —
or just use `/metrics` and the log file directly for quick iteration.

## Log retention / cleanup

Elasticsearch indices are daily (`quickbite-logs-YYYY.MM.DD`) with no ILM
policy configured (kept simple for the assignment). To delete old logs
manually:
```bash
curl -X DELETE localhost:9200/quickbite-logs-2026.09.01
```

## Safely cleaning up

```bash
# Stop everything, keep data volumes (Prometheus/ES/Grafana data persists)
docker compose down

# Stop everything AND wipe all stored metrics/logs/dashboards state
docker compose down -v
```


