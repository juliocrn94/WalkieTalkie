const express = require('express');
const twilioValidate = require('../middleware/twilioValidate');
const { getFriendlyName, getChannel } = require('../services/numbers');
const { sendToSlack } = require('../services/slack');

const router = express.Router();

/**
 * POST /twilio-webhook
 *
 * Single endpoint for all 100+ Twilio numbers. Configure every number in the
 * Twilio console to POST to: <WEBHOOK_BASE_URL>/twilio-webhook
 *
 * Twilio sends application/x-www-form-urlencoded with (at minimum):
 *   From  — sender's E.164 number
 *   To    — your Twilio number that received the SMS
 *   Body  — the SMS text
 */
router.post('/', twilioValidate, async (req, res) => {
  const { From, To, Body } = req.body;

  if (!From || !To || Body === undefined) {
    console.warn('[twilio] Malformed payload — missing From/To/Body');
    return res.status(400).type('text').send('Bad Request');
  }

  console.log(`[twilio] SMS received  To=${To}  From=${From}  Body="${Body}"`);

  try {
    const friendlyName = getFriendlyName(To);
    const channel = getChannel(To);

    await sendToSlack({ channel, friendlyName, toNumber: To, fromNumber: From, body: Body });

    // Respond with empty TwiML — no auto-reply to sender
    res.type('text/xml').send('<Response></Response>');
  } catch (err) {
    console.error('[twilio] Error processing webhook:', err);
    // Still return 200 so Twilio does not retry — the error is ours, not Twilio's
    res.type('text/xml').send('<Response></Response>');
  }
});

module.exports = router;
