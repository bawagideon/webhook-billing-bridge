import http from 'http';
import { SignatureVerifier } from './signature';
import { IdempotencyStore } from './idempotency';
import { EventRouter } from './router';

const PORT = parseInt(process.env.PORT || '4105', 10);
const STRIPE_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret_for_staging';
const INTERNAL_METRICS_TOKEN = process.env.INTERNAL_METRICS_TOKEN || 'sec_internal_metrics_token_99';

let eventsProcessed = 0;
let duplicatesBlocked = 0;

export const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // 1. Health check (minimal public liveness)
  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  // 2. Metrics (strictly internal authenticated)
  if (req.method === 'GET' && url === '/metrics') {
    const authHeader = req.headers['x-internal-auth'];
    if (authHeader !== INTERNAL_METRICS_TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UNAUTHORIZED: Internal metrics endpoint requires x-internal-auth header' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ eventsProcessed, duplicatesBlocked }));
    return;
  }

  // 3. Stripe Webhook Ingestion
  if (req.method === 'POST' && url === '/webhook/stripe') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const sigHeader = (req.headers['stripe-signature'] as string) || '';
      const isValid = SignatureVerifier.verifyStripeSignature(body, sigHeader, STRIPE_SECRET);

      if (!isValid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_SIGNATURE: Cryptographic signature verification failed' }));
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'MALFORMED_JSON' }));
        return;
      }

      if (IdempotencyStore.isDuplicate(parsed.id)) {
        duplicatesBlocked++;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true, duplicate: true }));
        return;
      }

      eventsProcessed++;
      const alert = EventRouter.formatAlert(parsed);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true, duplicate: false, alert }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND' }));
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[WebhookBridge] Server listening on http://127.0.0.1:${PORT}`);
  });
}
