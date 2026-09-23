// logger.js
// Structured JSON logging so that Filebeat -> Elasticsearch can parse fields
// directly without a Logstash grok stage.
//
// Every log line looks like:
// {"timestamp":"2026-09-20T10:00:00.123Z","level":"info","service":"quickbite-api",
//  "message":"order placed","requestId":"a1b2c3","orderId":"o_9","amount":12.5}
//
// We deliberately never log secrets (API keys, tokens) or personal data
// (customer names, addresses, card numbers) - only order ids, amounts,
// item counts, timings and status.

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { app_name: 'quickbite-api' },
  transports: [
    // Console output (visible via `docker logs`, also useful for local dev)
    new winston.transports.Console(),
    // File output - this is the file Filebeat tails inside the container.
    new winston.transports.File({
      filename: process.env.LOG_FILE || '/app/logs/quickbite.log',
    }),
  ],
});

module.exports = logger;
