/**
 * One-time script to point all Twilio numbers at the webhook.
 *
 * Usage:
 *   node scripts/configure-twilio.js
 *
 * Reads TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and WEBHOOK_BASE_URL from .env
 */
require('dotenv').config();

const twilio = require('twilio');

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WEBHOOK_BASE_URL } = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !WEBHOOK_BASE_URL) {
  console.error('Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or WEBHOOK_BASE_URL in .env');
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const webhookUrl = `${WEBHOOK_BASE_URL}/twilio-webhook`;

async function run() {
  const numbers = await client.incomingPhoneNumbers.list();
  console.log(`Found ${numbers.length} numbers. Updating all to: ${webhookUrl}\n`);

  for (const num of numbers) {
    await client.incomingPhoneNumbers(num.sid).update({
      smsUrl: webhookUrl,
      smsMethod: 'POST',
    });
    console.log(`✓  ${num.phoneNumber}  (${num.friendlyName})`);
  }

  console.log('\nAll numbers updated.');
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
