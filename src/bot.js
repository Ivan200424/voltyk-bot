import { Bot } from 'grammy';
import { config } from './config.js';
import { cleanChatMiddleware } from './middleware/cleanChat.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { 
  handleStart, 
  handleWizardRegion, 
  handleWizardQueue, 
  handleWizardNotifyTo, 
  handleWizardIpAdd, 
  handleWizardIpSkip,
  handleWizardBack
} from './handlers/start.js';
import { 
  handleMenu, 
  handleSchedule, 
  handleMonitoring, 
  handleChannel 
} from './handlers/menu.js';
import { handleHelp } from './handlers/help.js';
import { 
  handleSettings, 
  handleChangeRegion, 
  handleToggleNotifications, 
  handleBack,
  handleRegionChangeFromSettings,
  handleQueueChangeFromSettings,
  handleChannelSettings
} from './handlers/settings.js';
import { handleFallbackMessage, handleUnknownCallback } from './handlers/fallback.js';
import { getUserData, getWizardState, getChannelSetupState } from './storage/index.js';
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
bot.command('monitoring', handleMonitoring);
bot.command('settings', handleSettings);
bot.command('help', handleHelp);
bot.command('feedback', handleHelp); // Redirect to help
bot.command('cancel', async (ctx) => {
  // Check if user is in channel setup
  const handled = await handleChannelSetupCancel(ctx);
  if (!handled) {
    await ctx.reply('Наразі немає операцій, які можна скасувати.');
  }
});

// Wizard callbacks - need to check wizard state
bot.callbackQuery(/^region:/, async (ctx) => {
  const wizardState = await getWizardState(ctx.from.id);
  if (wizardState && wizardState.step === 1) {
    return await handleWizardRegion(ctx);
  } else {
    // Called from settings
    return await handleRegionChangeFromSettings(ctx);
  }
});

bot.callbackQuery(/^queue:/, async (ctx) => {
  const wizardState = await getWizardState(ctx.from.id);
  if (wizardState && wizardState.step === 2) {
    return await handleWizardQueue(ctx);
  } else {
    // Called from settings
    return await handleQueueChangeFromSettings(ctx);
  }
});

bot.callbackQuery('notify_to:bot', handleWizardNotifyTo);
bot.callbackQuery('notify_to:channel', handleWizardNotifyTo);
bot.callbackQuery('ip:add', handleWizardIpAdd);
bot.callbackQuery('ip:skip', handleWizardIpSkip);
bot.callbackQuery('wizard_back', handleWizardBack);

// Main menu callbacks
bot.callbackQuery('menu', handleMenu);
bot.callbackQuery('schedule', handleSchedule);
bot.callbackQuery('monitoring', handleMonitoring);
bot.callbackQuery('channel', handleChannel);

// Settings callbacks
bot.callbackQuery('settings', handleSettings);
bot.callbackQuery('change_region', handleChangeRegion);
bot.callbackQuery('toggle_notifications', handleToggleNotifications);
bot.callbackQuery('channel_settings', handleChannelSettings);
bot.callbackQuery('back', handleBack);

// Channel callbacks
bot.callbackQuery('channel_setup', handleChannelSetup);
bot.callbackQuery('channel_info', handleChannelInfo);
bot.callbackQuery('channel_disconnect', handleChannelDisconnect);
bot.callbackQuery('channel_add_description', handleChannelAddDescription);
bot.callbackQuery('channel_skip_description', (ctx) => handleChannelSkipDescription(ctx, bot));

// Help callback
bot.callbackQuery('help', handleHelp);

// Unknown callback query handler (fallback)
bot.on('callback_query:data', handleUnknownCallback);

// Fallback for all other text messages (non-command messages)
bot.on('message:text', async (ctx) => {
  // Check if user is in channel setup flow
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
