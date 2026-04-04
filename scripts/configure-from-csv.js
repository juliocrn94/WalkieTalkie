/**
 * Bulk-configure Twilio numbers from a CSV file.
 *
 * Usage:
 *   node scripts/configure-from-csv.js path/to/numbers.csv
 *
 * CSV format (header row required):
 *   phone_number,friendly_name,channel_id
 *   +15103137237,Darwin OPS,C0AQN4ELYTF
 *   +5519933007190,Brazil Line 1,C0AQN4ELYTF
 *   +525595494294,,                          ← Twilio config only, no name/channel
 *
 * What this script does per row:
 *   1. Updates config/numbers.json with name + channel (if provided)
 *   2. Fetches the number's SID from Twilio
 *   3. Sets smsUrl and/or voiceUrl based on capabilities (skips Vapi numbers)
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const twilio = require('twilio');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/configure-from-csv.js path/to/numbers.csv');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WEBHOOK_BASE_URL } = process.env;
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !WEBHOOK_BASE_URL) {
  console.error('Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or WEBHOOK_BASE_URL in .env');
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const smsWebhookUrl = `${WEBHOOK_BASE_URL}/twilio-webhook`;
const voiceWebhookUrl = `${WEBHOOK_BASE_URL}/twilio-voice`;
const NUMBERS_CONFIG_PATH = path.join(__dirname, '../config/numbers.json');

function loadNumbersConfig() {
  try {
    return JSON.parse(fs.readFileSync(NUMBERS_CONFIG_PATH, 'utf8'));
  } catch {
    return { numbers: {} };
  }
}

function saveNumbersConfig(config) {
  fs.writeFileSync(NUMBERS_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const [header, ...rows] = lines;
  const headers = header.split(',').map((h) => h.trim());

  return rows.map((row) => {
    const values = row.split(',').map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
  }).filter((r) => r.phone_number);
}

async function run() {
  const rows = parseCSV(csvPath);
  console.log(`\nProcessing ${rows.length} numbers from ${csvPath}\n`);

  const config = loadNumbersConfig();

  for (const row of rows) {
    const phone = row.phone_number;
    const name = row.friendly_name || '';
    const channel = row.channel_id || '';

    process.stdout.write(`  ${phone}`);

    // 1. Update numbers.json
    if (name && channel) {
      config.numbers[phone] = { name, channel };
    } else if (name) {
      config.numbers[phone] = name;
    } else if (channel) {
      config.numbers[phone] = { name: '', channel };
    }
    // If neither, skip numbers.json update but still configure Twilio

    // 2. Fetch from Twilio
    try {
      const results = await client.incomingPhoneNumbers.list({ phoneNumber: phone });

      if (!results.length) {
        console.log(`  ⚠️  Not found in Twilio account — skipped`);
        continue;
      }

      const num = results[0];
      const hasSms = !!(num.capabilities && num.capabilities.sms);
      const hasVoice = !!(num.capabilities && num.capabilities.voice);
      const isVapiVoice = (num.voiceUrl || '').toLowerCase().includes('vapi');
      const isVapiSms = (num.smsUrl || '').toLowerCase().includes('vapi');

      const update = {};
      if (hasSms && !isVapiSms) {
        update.smsUrl = smsWebhookUrl;
        update.smsMethod = 'POST';
      }
      if (hasVoice && !isVapiVoice) {
        update.voiceUrl = voiceWebhookUrl;
        update.voiceMethod = 'POST';
      }

      if (Object.keys(update).length > 0) {
        await client.incomingPhoneNumbers(num.sid).update(update);
      }

      const caps = [
        hasSms ? (isVapiSms ? 'SMS(vapi-skip)' : 'SMS') : null,
        hasVoice ? (isVapiVoice ? 'VOICE(vapi-skip)' : 'VOICE') : null,
      ].filter(Boolean).join('+') || 'NONE';

      const label = name ? `  "${name}"` : '';
      console.log(`  ✓  ${phone}${label}  [${caps}]`);
    } catch (err) {
      console.log(`  ✗  ${phone}  Error: ${err.message}`);
    }
  }

  saveNumbersConfig(config);
  console.log(`\nDone. config/numbers.json updated.\n`);
}

run().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
