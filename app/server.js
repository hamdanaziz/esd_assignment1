// server.js
// QuickBite - a tiny food-ordering API.
//
// Endpoints:
//   POST   /orders            place a new order
//   POST   /orders/:id/ready  mark an order ready (kitchen finished)
//   POST   /orders/:id/cancel cancel a pending order
//   GET    /orders/:id        fetch one order
//   GET    /orders            list all orders
//   GET    /health            liveness check
//   GET    /metrics           Prometheus scrape endpoint
//   POST   /admin/fault       toggle artificial latency fault (Part E.1)
//
// Business logic is intentionally simple - the point of this assignment is
// observability, not a real food-ordering system.

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const {
  register,
  ordersTotal,
  ordersPending,
  orderProcessingSummary,
  httpRequestDuration,
  httpRequestsTotal,
} = require('./metrics');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// In-memory "database" of orders. Good enough for a class assignment.
const orders = new Map();

// ---- Fault injection state (Part E.1: reproduce a problem) ----
// When enabled, every Nth request to /orders sleeps for `delayMs` before
// responding, simulating a slow downstream dependency (e.g. a slow
// payment gateway or kitchen-display system).
const fault = {
  enabled: false,
  everyNth: 5,
  delayMs: 500,
  counter: 0,
};

// ---------- Middleware: request id + structured request logging ----------
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route ? req.baseUrl + req.route.path : req.path;

    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      durationSec
    );
    httpRequestsTotal.inc({ method: req.method, route, status_code: res.statusCode });

    logger.info('request completed', {
      requestId: req.requestId,
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs: Math.round(durationSec * 1000),
    });
  });

  next();
});

// ---------- Routes ----------

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.post('/orders', async (req, res) => {
  // Simulated fault: delay every Nth order to mimic a slow dependency.
  if (fault.enabled) {
    fault.counter += 1;
    if (fault.counter % fault.everyNth === 0) {
      logger.warn('fault injection: delaying request', {
        requestId: req.requestId,
        delayMs: fault.delayMs,
      });
      await sleep(fault.delayMs);
    }
  }

  const { customerRef, items } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    logger.warn('order rejected: no items', { requestId: req.requestId });
    return res.status(400).json({ error: 'items is required and must be a non-empty array' });
  }

  const id = `o_${uuidv4().slice(0, 8)}`;
  const amount = items.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0);

  const order = {
    id,
    customerRef: customerRef || 'anonymous', // pseudonymous reference only, never a real name
    items,
    amount,
    status: 'placed',
    placedAt: Date.now(),
    readyAt: null,
  };
  orders.set(id, order);

  ordersTotal.inc({ status: 'placed' });
  ordersPending.inc();

  logger.info('order placed', {
    requestId: req.requestId,
    orderId: id,
    itemCount: items.length,
    amount,
  });

  res.status(201).json(order);
});

app.get('/orders', (req, res) => {
  res.json(Array.from(orders.values()));
});

app.get('/orders/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'order not found' });
  res.json(order);
});

app.post('/orders/:id/ready', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) {
    logger.warn('mark-ready failed: order not found', {
      requestId: req.requestId,
      orderId: req.params.id,
    });
    return res.status(404).json({ error: 'order not found' });
  }
  if (order.status !== 'placed') {
    return res.status(409).json({ error: `order is ${order.status}, cannot mark ready` });
  }

  order.status = 'ready';
  order.readyAt = Date.now();
  const processingSeconds = (order.readyAt - order.placedAt) / 1000;
  orderProcessingSummary.observe(processingSeconds);
  ordersPending.dec();

  logger.info('order ready', {
    requestId: req.requestId,
    orderId: order.id,
    processingSeconds,
  });

  res.json(order);
});

app.post('/orders/:id/cancel', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'order not found' });
  if (order.status !== 'placed') {
    return res.status(409).json({ error: `order is ${order.status}, cannot cancel` });
  }

  order.status = 'cancelled';
  ordersTotal.inc({ status: 'cancelled' });
  ordersPending.dec();

  logger.info('order cancelled', { requestId: req.requestId, orderId: order.id });

  res.json(order);
});

// ---------- Admin: fault injection toggle (used by experiments/) ----------
app.post('/admin/fault', (req, res) => {
  const { enabled, everyNth, delayMs } = req.body || {};
  if (typeof enabled === 'boolean') fault.enabled = enabled;
  if (Number.isInteger(everyNth) && everyNth > 0) fault.everyNth = everyNth;
  if (Number.isInteger(delayMs) && delayMs >= 0) fault.delayMs = delayMs;
  fault.counter = 0;

  logger.info('fault config updated', { requestId: req.requestId, fault });
  res.json({ fault });
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.listen(PORT, () => {
  logger.info('quickbite-api started', { port: PORT });
  // eslint-disable-next-line no-console
  console.log(`QuickBite API listening on :${PORT}`);
});
