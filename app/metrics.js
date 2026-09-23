// metrics.js
// All Prometheus metrics for QuickBite live here. We use all four
// client types required by the assignment:
//
//   Counter   - orders_total, http_requests_total, cardinality_demo_requests_total
//   Gauge     - orders_pending
//   Histogram - http_request_duration_seconds (used for p95/p99 via histogram_quantile)
//   Summary   - order_processing_seconds (client-side quantiles + average)
//
// Business metrics (orders placed/cancelled/pending) are separated from
// pure application metrics (http latency, failed requests) as the
// assignment asks for both categories.

const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register }); // process cpu/mem/eventloop etc.

// ---------- Business metrics ----------

// Counter: total orders, labeled by outcome (placed / cancelled)
const ordersTotal = new client.Counter({
  name: 'orders_total',
  help: 'Total number of orders processed, labeled by outcome',
  labelNames: ['status'], // placed | cancelled | ready
  registers: [register],
});

// Gauge: orders currently waiting to be prepared (goes up on placement,
// down when marked ready or cancelled)
const ordersPending = new client.Gauge({
  name: 'orders_pending',
  help: 'Number of orders currently waiting to be prepared',
  registers: [register],
});

// Summary: how long an order stays in the kitchen (placed -> ready), with
// client-computed quantiles + average. (Node's prom-client CAN compute
// percentiles for summaries, unlike Python's client - see report Part B.)
const orderProcessingSummary = new client.Summary({
  name: 'order_processing_seconds',
  help: 'Time an order spends being prepared, from placement to ready',
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register],
});

// ---------- Application metrics ----------

// Histogram: HTTP request duration - this is what backs our p95/p99 chart
// in Grafana via histogram_quantile(), and is also used for the fault
// injection experiment (Part E.1).
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Counter: every HTTP request, labeled so we can derive a failed-request
// rate (status_code =~ "5..") - the "application metric" the assignment
// asks for alongside business metrics.
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests received',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ---------- Cardinality-explosion demo metric (Part E.2) ----------
// A separate counter, deliberately labeled by request_id, used ONLY in the
// experiments/cardinality_test.js script to demonstrate series growth.
// It is intentionally isolated from the real business/app metrics above so
// that running the demo doesn't pollute the real dashboards.
const cardinalityDemoRequests = new client.Counter({
  name: 'demo_requests_total',
  help: 'Demo counter used to illustrate cardinality explosion when labeled by request_id',
  labelNames: ['request_id'],
  registers: [register],
});

module.exports = {
  register,
  ordersTotal,
  ordersPending,
  orderProcessingSummary,
  httpRequestDuration,
  httpRequestsTotal,
  cardinalityDemoRequests,
};
