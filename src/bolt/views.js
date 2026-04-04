const { getSetting } = require('../services/settings');
const { loadConfig } = require('../services/numbers');

/**
 * Builds the full App Home Block Kit view.
 * Called on every home_opened event and after any config change.
 */
function buildAppHomeView() {
  const accountSid = getSetting('twilio.accountSid') || '';
  const authToken = getSetting('twilio.authToken') || '';
  const defaultChannel = getSetting('slack.defaultChannel') || '';
  const { numbers } = loadConfig();
  const numberEntries = Object.entries(numbers);

  const maskedToken = authToken ? '••••••••' + authToken.slice(-4) : '(not set)';
  const maskedSid = accountSid ? accountSid.slice(0, 8) + '••••••••' : '(not set)';

  const blocks = [
    // ─── Header ───────────────────────────────────────────────────────────────
    {
      type: 'header',
      text: { type: 'plain_text', text: '📱 WalkieTalkie', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'SMS & voice relay for your Twilio lines' }],
    },
    { type: 'divider' },

    // ─── Twilio Credentials ───────────────────────────────────────────────────
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Twilio Credentials*\nAccount SID: \`${maskedSid}\`\nAuth Token: \`${maskedToken}\``,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: '✏️ Edit', emoji: true },
        action_id: 'action_edit_credentials',
      },
    },
    { type: 'divider' },

    // ─── Default Channel ──────────────────────────────────────────────────────
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Default Channel*\n${defaultChannel ? `<#${defaultChannel}>` : '_(not set)_'}`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: '✏️ Edit', emoji: true },
        action_id: 'action_edit_default_channel',
      },
    },
    { type: 'divider' },

    // ─── Sync Button ──────────────────────────────────────────────────────────
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🔄 Sync Twilio Numbers', emoji: true },
          action_id: 'action_sync_twilio',
          style: 'primary',
        },
      ],
    },
    { type: 'divider' },

    // ─── Number Directory header ──────────────────────────────────────────────
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Number Directory* — ${numberEntries.length} line${numberEntries.length !== 1 ? 's' : ''}` },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: '➕ Add Line', emoji: true },
        action_id: 'action_add_number',
        style: 'primary',
      },
    },
  ];

  // ─── Number rows ────────────────────────────────────────────────────────────
  if (numberEntries.length === 0) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_No lines configured yet. Click ➕ Add Line to get started._' }],
    });
  } else {
    for (const [phone, entry] of numberEntries) {
      const name = typeof entry === 'string' ? entry : (entry.name || '');
      const channel = typeof entry === 'object' ? entry.channel : null;
      const channelDisplay = channel ? `<#${channel}>` : `<#${defaultChannel}> _(default)_`;

      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${name || '_(no name)_'}*  \`${phone}\`\n→ ${channelDisplay}`,
        },
        accessory: {
          type: 'overflow',
          action_id: `action_number_menu__${phone}`,
          options: [
            { text: { type: 'plain_text', text: '✏️ Edit', emoji: true }, value: `edit__${phone}` },
            { text: { type: 'plain_text', text: '🗑 Remove', emoji: true }, value: `remove__${phone}` },
          ],
        },
      });
    }
  }

  return { type: 'home', blocks };
}

// ─── Modal builders ───────────────────────────────────────────────────────────

function buildCredentialsModal() {
  const accountSid = getSetting('twilio.accountSid') || '';
  const authToken = getSetting('twilio.authToken') || '';

  return {
    type: 'modal',
    callback_id: 'modal_credentials',
    title: { type: 'plain_text', text: 'Twilio Credentials' },
    submit: { type: 'plain_text', text: 'Save' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'block_account_sid',
        label: { type: 'plain_text', text: 'Account SID' },
        element: {
          type: 'plain_text_input',
          action_id: 'input_account_sid',
          initial_value: accountSid,
          placeholder: { type: 'plain_text', text: 'AC...' },
        },
      },
      {
        type: 'input',
        block_id: 'block_auth_token',
        label: { type: 'plain_text', text: 'Auth Token' },
        element: {
          type: 'plain_text_input',
          action_id: 'input_auth_token',
          initial_value: authToken,
          placeholder: { type: 'plain_text', text: 'Your Twilio Auth Token' },
        },
      },
    ],
  };
}

function buildDefaultChannelModal() {
  const defaultChannel = getSetting('slack.defaultChannel') || '';

  return {
    type: 'modal',
    callback_id: 'modal_default_channel',
    title: { type: 'plain_text', text: 'Default Channel' },
    submit: { type: 'plain_text', text: 'Save' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'block_default_channel',
        label: { type: 'plain_text', text: 'Default Slack Channel' },
        hint: { type: 'plain_text', text: 'Messages from unmapped numbers go here.' },
        element: {
          type: 'channels_select',
          action_id: 'input_default_channel',
          ...(defaultChannel ? { initial_channel: defaultChannel } : {}),
          placeholder: { type: 'plain_text', text: 'Select a channel' },
        },
      },
    ],
  };
}

function buildNumberModal(phone = '', entry = null) {
  const isEdit = !!phone;
  const name = entry ? (typeof entry === 'string' ? entry : entry.name || '') : '';
  const channel = entry && typeof entry === 'object' ? entry.channel || '' : '';

  return {
    type: 'modal',
    callback_id: 'modal_number',
    private_metadata: phone,
    title: { type: 'plain_text', text: isEdit ? 'Edit Line' : 'Add Line' },
    submit: { type: 'plain_text', text: 'Save' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'block_phone',
        label: { type: 'plain_text', text: 'Phone Number (E.164)' },
        hint: { type: 'plain_text', text: 'e.g. +15103137237' },
        element: {
          type: 'plain_text_input',
          action_id: 'input_phone',
          initial_value: phone,
          placeholder: { type: 'plain_text', text: '+1...' },
        },
      },
      {
        type: 'input',
        block_id: 'block_name',
        label: { type: 'plain_text', text: 'Friendly Name' },
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'input_name',
          initial_value: name,
          placeholder: { type: 'plain_text', text: 'e.g. Marketing Line 1' },
        },
      },
      {
        type: 'input',
        block_id: 'block_channel',
        label: { type: 'plain_text', text: 'Slack Channel Override' },
        optional: true,
        hint: { type: 'plain_text', text: 'Leave blank to use the default channel.' },
        element: {
          type: 'channels_select',
          action_id: 'input_channel',
          ...(channel ? { initial_channel: channel } : {}),
          placeholder: { type: 'plain_text', text: 'Select a channel (optional)' },
        },
      },
    ],
  };
}

module.exports = { buildAppHomeView, buildCredentialsModal, buildDefaultChannelModal, buildNumberModal };
