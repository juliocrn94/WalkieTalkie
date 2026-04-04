const { App, ExpressReceiver } = require('@slack/bolt');
const { setSetting } = require('../services/settings');
const { setNumber, removeNumber, loadConfig } = require('../services/numbers');
const { syncAllCapabilities } = require('../services/capabilities');
const {
  buildAppHomeView,
  buildCredentialsModal,
  buildDefaultChannelModal,
  buildNumberModal,
} = require('./views');

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  endpoints: '/slack/events',
});

const boltApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function publishAppHome(client, userId) {
  await client.views.publish({
    user_id: userId,
    view: buildAppHomeView(),
  });
}

// ─── App Home ─────────────────────────────────────────────────────────────────

boltApp.event('app_home_opened', async ({ event, client }) => {
  await publishAppHome(client, event.user);
});

// ─── Block Actions ────────────────────────────────────────────────────────────

boltApp.action('action_edit_credentials', async ({ ack, client, body }) => {
  await ack();
  await client.views.open({
    trigger_id: body.trigger_id,
    view: buildCredentialsModal(),
  });
});

boltApp.action('action_edit_default_channel', async ({ ack, client, body }) => {
  await ack();
  await client.views.open({
    trigger_id: body.trigger_id,
    view: buildDefaultChannelModal(),
  });
});

boltApp.action('action_sync_twilio', async ({ ack, client, body }) => {
  await ack();
  // Fire sync without awaiting — show immediate feedback via home refresh
  syncAllCapabilities()
    .then(() => publishAppHome(client, body.user.id))
    .catch((err) => console.error('[bolt] Sync failed:', err.message));
  // Optimistically re-publish home immediately
  await publishAppHome(client, body.user.id);
});

boltApp.action('action_add_number', async ({ ack, client, body }) => {
  await ack();
  await client.views.open({
    trigger_id: body.trigger_id,
    view: buildNumberModal(),
  });
});

// Overflow menu for edit/remove on each number row
boltApp.action(/^action_number_menu__/, async ({ ack, client, body, action }) => {
  await ack();
  const selected = action.selected_option.value; // "edit__+1..." or "remove__+1..."
  const [op, phone] = selected.split(/__(.+)/); // split on first __ only

  if (op === 'remove') {
    removeNumber(phone);
    await publishAppHome(client, body.user.id);
  } else if (op === 'edit') {
    const { numbers } = loadConfig();
    const entry = numbers[phone] || null;
    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildNumberModal(phone, entry),
    });
  }
});

// ─── Modal Submissions ────────────────────────────────────────────────────────

boltApp.view('modal_credentials', async ({ ack, view, client, body }) => {
  await ack();
  const values = view.state.values;
  const accountSid = values.block_account_sid.input_account_sid.value?.trim();
  const authToken = values.block_auth_token.input_auth_token.value?.trim();

  if (accountSid) setSetting('twilio.accountSid', accountSid);
  if (authToken) setSetting('twilio.authToken', authToken);

  await publishAppHome(client, body.user.id);
});

boltApp.view('modal_default_channel', async ({ ack, view, client, body }) => {
  await ack();
  const channel = view.state.values.block_default_channel.input_default_channel.selected_channel;
  if (channel) setSetting('slack.defaultChannel', channel);
  await publishAppHome(client, body.user.id);
});

boltApp.view('modal_number', async ({ ack, view, client, body }) => {
  await ack();
  const values = view.state.values;
  const phone = values.block_phone.input_phone.value?.trim();
  const name = values.block_name.input_name.value?.trim() || '';
  const channel = values.block_channel.input_channel?.selected_channel || '';

  if (!phone) return;

  setNumber(phone, { name, channel });
  await publishAppHome(client, body.user.id);
});

module.exports = { boltApp, receiver };
