const twilio = require('twilio');

/**
 * Middleware that validates every inbound request is genuinely from Twilio
 * using their HMAC-SHA1 signature scheme.
 *
 * Twilio signs each request with your Auth Token. Any request that fails
 * validation is rejected with 403 — preventing spoofed webhook abuse.
 *
 * Docs: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function twilioValidate(req, res, next) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers['x-twilio-signature'];

  if (!signature) {
    console.warn('[twilioValidate] Missing X-Twilio-Signature header — rejected');
    return res.status(403).type('text').send('Forbidden');
  }

  // The URL must exactly match what is configured in the Twilio console.
  // WEBHOOK_BASE_URL must have no trailing slash.
  const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/twilio-webhook`;

  const isValid = twilio.validateRequest(authToken, signature, webhookUrl, req.body);

  if (!isValid) {
    console.warn('[twilioValidate] Invalid Twilio signature — rejected from', req.ip);
    return res.status(403).type('text').send('Forbidden');
  }

  next();
}

module.exports = twilioValidate;
