# WalkieTalkie

Node.js/Express service that receives SMS messages from 100+ Twilio phone lines and forwards them to Slack using Block Kit formatting with per-line threading.

## Stack
- **Runtime**: Node.js 18+
- **Framework**: Express 4
- **Twilio SDK**: `twilio` (request validation + TwiML responses)
- **Slack SDK**: `@slack/web-api` (Web API, not Incoming Webhooks — needed for threading)

## Project Structure
```
src/
  index.js                  # Entry point, env validation, server bootstrap
  routes/twilio.js          # POST /twilio-webhook handler
  middleware/twilioValidate.js  # HMAC-SHA1 signature check
  services/numbers.js       # config/numbers.json lookup (friendly name + channel)
  services/slack.js         # OTP parsing, Block Kit builder, thread management
config/
  numbers.json              # Number directory (edit without restart)
data/
  threads.json              # Auto-generated; persists Slack thread_ts across restarts
```

## Key Behaviors
- All 100+ Twilio numbers point to the single `POST /twilio-webhook` endpoint
- Requests without a valid Twilio signature are rejected with 403
- `config/numbers.json` is read on every request — edits are live with no restart needed
- Threads are keyed by `channel:toNumber:YYYY-MM-DD` — one thread per line per day
- OTPs (4–8 digit codes) are auto-detected and `reply_broadcast: true` is set so codes appear in the channel without opening the thread
- Numbers not in `config/numbers.json` fall back to raw E.164 display and `SLACK_DEFAULT_CHANNEL`

## Dev Commands
```bash
npm install
cp .env.example .env   # fill in values
npm run dev            # nodemon hot-reload
npm start              # production
```
