require('dotenv').config();

const express = require('express');
const twilioRouter = require('./routes/twilio');

// ─── Startup validation ───────────────────────────────────────────────────────

const REQUIRED_ENV = ['TWILIO_AUTH_TOKEN', 'WEBHOOK_BASE_URL', 'SLACK_BOT_TOKEN', 'SLACK_DEFAULT_CHANNEL'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('[startup] Missing required environment variables:', missing.join(', '));
  console.error('[startup] Copy .env.example to .env and fill in all values.');
  process.exit(1);
}

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

// Twilio sends webhooks as application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// Health check — useful for uptime monitors and load balancers
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// All Twilio numbers point to this single endpoint
app.use('/twilio-webhook', twilioRouter);

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[WalkieTalkie] Listening on port ${PORT}`);
  console.log(`[WalkieTalkie] Webhook URL: ${process.env.WEBHOOK_BASE_URL}/twilio-webhook`);
});
