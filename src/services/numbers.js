const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config/numbers.json');

/**
 * Reads config/numbers.json fresh on every call so edits take effect
 * without restarting the server.
 */
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    console.error('[numbers] Failed to load config/numbers.json:', err.message);
    return { numbers: {} };
  }
}

/**
 * Returns the friendly name for a Twilio "To" number.
 * Falls back to the raw E.164 number if unmapped.
 *
 * @param {string} phoneNumber  E.164 format, e.g. "+12025550101"
 * @returns {string}
 */
function getFriendlyName(phoneNumber) {
  const { numbers } = loadConfig();
  const entry = numbers[phoneNumber];
  if (!entry) return phoneNumber;
  return typeof entry === 'string' ? entry : (entry.name || phoneNumber);
}

/**
 * Returns the Slack channel ID for a Twilio "To" number.
 * Falls back to SLACK_DEFAULT_CHANNEL env var if no override is set.
 *
 * @param {string} phoneNumber  E.164 format
 * @returns {string}
 */
function getChannel(phoneNumber) {
  const { numbers } = loadConfig();
  const entry = numbers[phoneNumber];
  if (entry && typeof entry === 'object' && entry.channel) {
    return entry.channel;
  }
  return process.env.SLACK_DEFAULT_CHANNEL;
}

module.exports = { getFriendlyName, getChannel };
