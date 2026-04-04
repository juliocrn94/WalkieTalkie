require('dotenv').config();

const { receiver, boltApp } = require('./bolt/app');
const twilioRouter = require('./routes/twilio');
const voiceRouter = require('./routes/voice');
const { loadLogs } = require('./services/logger');
const { getCapabilities, initCapabilitiesSync } = require('./services/capabilities');

// ─── Startup validation ───────────────────────────────────────────────────────

const REQUIRED_ENV = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'WEBHOOK_BASE_URL',
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SLACK_DEFAULT_CHANNEL',
];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('[startup] Missing required environment variables:', missing.join(', '));
  console.error('[startup] Copy .env.example to .env and fill in all values.');
  process.exit(1);
}

// ─── Mount routes on Bolt's Express receiver ──────────────────────────────────

const app = receiver.app;

// Twilio sends webhooks as application/x-www-form-urlencoded
app.use(require('express').urlencoded({ extended: false }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Transaction log viewer
// ?limit=N   — max entries to return (default 50, max 1000)
// ?type=sms|voice-recording|voice-transcription
app.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
  const { type } = req.query;
  const validTypes = ['sms', 'voice-recording', 'voice-transcription'];

  let logs = loadLogs();
  if (type && validTypes.includes(type)) {
    logs = logs.filter((entry) => entry.type === type);
  }
  logs = logs.slice(0, limit);
  res.json({ count: logs.length, logs });
});

// Capabilities viewer
// ?type=sms|voice|mms|fax
app.get('/capabilities', (req, res) => {
  const store = getCapabilities();
  const { type } = req.query;
  const validTypes = ['sms', 'voice', 'mms', 'fax'];

  if (type && validTypes.includes(type)) {
    const filtered = Object.fromEntries(
      Object.entries(store.numbers).filter(([, v]) => v.capabilities[type] === true)
    );
    return res.json({ lastSyncedAt: store.lastSyncedAt, count: Object.keys(filtered).length, numbers: filtered });
  }

  res.json({ lastSyncedAt: store.lastSyncedAt, count: Object.keys(store.numbers).length, numbers: store.numbers });
});

// Twilio webhooks
app.use('/twilio-webhook', twilioRouter);
app.use('/twilio-voice', voiceRouter);

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
boltApp.start(PORT).then(() => {
  console.log(`[WalkieTalkie] Listening on port ${PORT}`);
  console.log(`[WalkieTalkie] Webhook URL: ${process.env.WEBHOOK_BASE_URL}/twilio-webhook`);
  console.log(`[WalkieTalkie] Slack Events: ${process.env.WEBHOOK_BASE_URL}/slack/events`);
  initCapabilitiesSync();
});
