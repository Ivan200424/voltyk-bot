const { Bot } = require('grammy');
const { config } = require('./config');

// Import all handlers
const {
  handleStart,
  handleWizardRegion,
  handleWizardQueue,
  handleWizardNotifyBot,
  handleWizardNotifyChannel,
  handleChannelCheck,
  handleChannelConfirm,
  handleChannelReject,
  handleWizardBack,
  handleMyChatMember,
} = require('./handlers/start');

const {
  handleSchedule,
  handleTimer,
  handleMenu,
  handleStats,
  handleHelp,
} = require('./handlers/schedule');

const {
  handleSettings,
  handleSettingsRegion,
  handleSettingsChannel,
  handleSettingsAlerts,
  handleSettingsIp,
  handleAlertToggle,
  handleNotifyTargetBot,
  handleNotifyTargetChannel,
  handleNotifyTargetBoth,
  handleConfirmDeleteData,
  handleDeleteDataStep2,
  handleConfirmDeactivate,
  handleBackToSettings,
  handleBackToMain,
  handleRegionChangeFromSettings,
  handleQueueChangeFromSettings,
} = require('./handlers/settings');

const {
  handleAdminPanel,
  handleAdminStats,
  handleAdminSystem,
  handleAdminIntervals,
  handleAdminDebounce,
  handleAdminPause,
  handleIntervalChange,
  handleDebounceChange,
  handlePauseChange,
} = require('./handlers/admin');

const {
  handleChannelCommand,
  handleChannelSetup,
  handleChannelInfo,
  handleChannelDisconnect,
  handleConfirmChannelDisconnect,
} = require('./handlers/channel');

const { getState } = require('./state/stateManager');

/**
 * Setup bot with all handlers
 */
function setupBot(bot) {
  // === COMMANDS ===
  bot.command('start', handleStart);
  bot.command('schedule', handleSchedule);
  bot.command('next', handleTimer);
  bot.command('timer', handleTimer);
  bot.command('settings', handleSettings);
  bot.command('channel', handleChannelCommand);
  bot.command('stats', handleStats);
  bot.command('help', handleHelp);
  bot.command('admin', handleAdminPanel);
  bot.command('cancel', async (ctx) => {
    await ctx.reply('Операцію скасовано.');
  });

  // === MY_CHAT_MEMBER EVENT ===
  bot.on('my_chat_member', handleMyChatMember);

  // === CALLBACK QUERIES ===
  
  // Wizard callbacks - check wizard state
  bot.callbackQuery(/^region_/, async (ctx) => {
    const wizardState = await getState('wizard', ctx.from.id);
    if (wizardState && (wizardState.step === 1 || wizardState.step === 2)) {
      return await handleWizardRegion(ctx);
    } else {
      // Called from settings
      return await handleRegionChangeFromSettings(ctx);
    }
  });

  bot.callbackQuery(/^queue_/, async (ctx) => {
    const wizardState = await getState('wizard', ctx.from.id);
    if (wizardState && wizardState.step === 2) {
      return await handleWizardQueue(ctx);
    } else {
      // Called from settings
      return await handleQueueChangeFromSettings(ctx);
    }
  });

  bot.callbackQuery('wizard_notify_bot', handleWizardNotifyBot);
  bot.callbackQuery('wizard_notify_channel', handleWizardNotifyChannel);
  bot.callbackQuery('channel_check', handleChannelCheck);
  bot.callbackQuery('channel_confirm', handleChannelConfirm);
  bot.callbackQuery('channel_reject', handleChannelReject);
  bot.callbackQuery('wizard_back', handleWizardBack);
  bot.callbackQuery('back_to_region', handleWizardBack);

  // Main menu callbacks
  bot.callbackQuery('menu', handleMenu);
  bot.callbackQuery('back_to_main', handleBackToMain);
  bot.callbackQuery('menu_schedule', handleSchedule);
  bot.callbackQuery('menu_timer', handleTimer);
  bot.callbackQuery('menu_stats', handleStats);
  bot.callbackQuery('menu_help', handleHelp);
  bot.callbackQuery('menu_settings', handleSettings);

  // Settings callbacks
  bot.callbackQuery('settings', handleSettings);
  bot.callbackQuery('settings_region', handleSettingsRegion);
  bot.callbackQuery('settings_channel', handleSettingsChannel);
  bot.callbackQuery('settings_ip', handleSettingsIp);
  bot.callbackQuery('settings_alerts', handleSettingsAlerts);
  bot.callbackQuery('back_to_settings', handleBackToSettings);

  // Alert toggle
  bot.callbackQuery('alert_toggle', handleAlertToggle);

  // Notification target
  bot.callbackQuery('notify_target_bot', handleNotifyTargetBot);
  bot.callbackQuery('notify_target_channel', handleNotifyTargetChannel);
  bot.callbackQuery('notify_target_both', handleNotifyTargetBoth);

  // Delete data
  bot.callbackQuery('confirm_delete_data', handleConfirmDeleteData);
  bot.callbackQuery('delete_data_step2', handleDeleteDataStep2);
  bot.callbackQuery('confirm_deactivate', handleConfirmDeactivate);

  // Channel callbacks
  bot.callbackQuery('channel_setup', handleChannelSetup);
  bot.callbackQuery('channel_info', handleChannelInfo);
  bot.callbackQuery('channel_disconnect', handleChannelDisconnect);
  bot.callbackQuery('confirm_channel_disconnect', handleConfirmChannelDisconnect);

  // Admin panel callbacks
  bot.callbackQuery('admin_panel', handleAdminPanel);
  bot.callbackQuery('admin_stats', handleAdminStats);
  bot.callbackQuery('admin_system', handleAdminSystem);
  bot.callbackQuery('admin_intervals', handleAdminIntervals);
  bot.callbackQuery('admin_debounce', handleAdminDebounce);
  bot.callbackQuery('admin_pause', handleAdminPause);
  bot.callbackQuery(/^interval_/, handleIntervalChange);
  bot.callbackQuery(/^debounce_\d+$/, handleDebounceChange);
  bot.callbackQuery(/^pause_/, handlePauseChange);

  // Catch remaining admin_ callbacks as placeholders
  bot.callbackQuery(/^admin_/, async (ctx) => {
    await ctx.answerCallbackQuery({
      text: '🚧 Ця функція ще в розробці',
      show_alert: true,
    });
  });

  // Help callback
  bot.callbackQuery('help', handleHelp);

  // Unknown callback query handler (fallback)
  bot.on('callback_query:data', async (ctx) => {
    console.log('Unknown callback query:', ctx.callbackQuery.data);
    await ctx.answerCallbackQuery({
      text: '⚠️ Невідома команда',
      show_alert: false,
    });
  });

  // Fallback for text messages (ignore non-command messages)
  bot.on('message:text', async (ctx) => {
    // Silently ignore non-command text messages
    console.log('Received text message, ignoring');
  });

  // Fallback for other message types (media, stickers, etc.)
  bot.on('message', async (ctx) => {
    // Silently ignore non-text messages
    console.log('Received non-text message, ignoring');
  });

  // Error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    console.error('Error:', e);
  });
}

/**
 * Create bot instance
 */
function createBot() {
  if (!config.botToken) {
    throw new Error('BOT_TOKEN is required');
  }

  const bot = new Bot(config.botToken);
  
  setupBot(bot);
  
  return bot;
}

module.exports = { createBot, setupBot };
