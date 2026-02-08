import { Bot } from 'grammy';
import { config } from './config.js';
import { cleanChatMiddleware } from './middleware/cleanChat.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { 
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
} from './handlers/start.js';
import { 
  handleMenu, 
  handleSchedule,
  handleTimer,
  handleStats,
  handleMonitoring, 
  handleChannel 
} from './handlers/menu.js';
import { handleHelp } from './handlers/help.js';
import { 
  handleSettings,
  handleSettingsRegion,
  handleSettingsChannel,
  handleSettingsIp,
  handleSettingsAlerts,
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
} from './handlers/settings.js';
import { handleFallbackMessage, handleUnknownCallback } from './handlers/fallback.js';
import { getWizardState } from './state/stateManager.js';
import { handleAdminPanel } from './handlers/admin.js';
import {
  handleChannelInput,
  handleChannelNameInput,
  handleChannelDescriptionInput,
  handleChannelSetupCancel,
  handleChannelAddDescription,
  handleChannelSkipDescription,
  handleChannelSetup,
  handleChannelInfo,
  handleChannelDisconnect,
} from './handlers/channel.js';

if (!config.botToken) {
  throw new Error('BOT_TOKEN is required');
}

const bot = new Bot(config.botToken);

// Middleware
bot.use(rateLimitMiddleware);
bot.use(cleanChatMiddleware);

// Commands
bot.command('start', handleStart);
bot.command('schedule', handleSchedule);
bot.command('next', handleTimer);
bot.command('timer', handleTimer);
bot.command('settings', handleSettings);
bot.command('channel', handleChannel);
bot.command('stats', handleStats);
bot.command('help', handleHelp);
bot.command('cancel', async (ctx) => {
  // Check if user is in channel setup
  const handled = await handleChannelSetupCancel(ctx);
  if (!handled) {
    await ctx.reply('Наразі немає операцій, які можна скасувати.');
  }
});
bot.command('admin', handleAdminPanel);

// my_chat_member event for automatic channel detection
bot.on('my_chat_member', handleMyChatMember);

// Wizard callbacks - check wizard state
bot.callbackQuery(/^region_/, async (ctx) => {
  const wizardState = await getWizardState(ctx.from.id);
  if (wizardState && (wizardState.step === 1 || wizardState.step === 2)) {
    return await handleWizardRegion(ctx);
  } else {
    // Called from settings
    return await handleRegionChangeFromSettings(ctx);
  }
});

bot.callbackQuery(/^queue_/, async (ctx) => {
  const wizardState = await getWizardState(ctx.from.id);
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
bot.callbackQuery('channel_add_description', handleChannelAddDescription);
bot.callbackQuery('channel_skip_description', (ctx) => handleChannelSkipDescription(ctx, bot));

// Admin panel callbacks
bot.callbackQuery('admin_panel', handleAdminPanel);
bot.callbackQuery(/^admin_/, handleAdminPanel); // All admin callbacks handled by admin panel

// Help callback
bot.callbackQuery('help', handleHelp);

// Unknown callback query handler (fallback)
bot.on('callback_query:data', handleUnknownCallback);

// Fallback for all other text messages (non-command messages)
bot.on('message:text', async (ctx) => {
  // Check if user is in channel setup flow
  const { getChannelSetupState } = await import('./state/stateManager.js');
  const channelSetupState = await getChannelSetupState(ctx.from.id);
  
  if (channelSetupState) {
    // Handle different channel setup steps
    if (channelSetupState.step === 'waiting_channel') {
      const handled = await handleChannelInput(ctx, bot);
      if (handled) return;
    } else if (channelSetupState.step === 'waiting_channel_name') {
      const handled = await handleChannelNameInput(ctx);
      if (handled) return;
    } else if (channelSetupState.step === 'waiting_channel_description') {
      const handled = await handleChannelDescriptionInput(ctx, bot);
      if (handled) return;
    }
  }
  
  // Default fallback
  return await handleFallbackMessage(ctx);
});

// Fallback for other message types (media, stickers, etc.)
bot.on('message', async (ctx) => {
  // Check if it's a forwarded message during channel setup
  const { getChannelSetupState } = await import('./state/stateManager.js');
  const channelSetupState = await getChannelSetupState(ctx.from.id);
  
  if (channelSetupState && channelSetupState.step === 'waiting_channel' && ctx.message.forward_origin) {
    const handled = await handleChannelInput(ctx, bot);
    if (handled) return;
  }
  
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

export default bot;
