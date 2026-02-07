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
  handleWizardIpSkip 
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
  handleChangeQueue, 
  handleToggleNotifications, 
  handleBack,
  handleRegionChangeFromSettings,
  handleQueueChangeFromSettings
} from './handlers/settings.js';
import { handleFallbackMessage, handleUnknownCallback } from './handlers/fallback.js';
import { getUserData, getWizardState } from './storage/index.js';

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

// Main menu callbacks
bot.callbackQuery('menu', handleMenu);
bot.callbackQuery('schedule', handleSchedule);
bot.callbackQuery('monitoring', handleMonitoring);
bot.callbackQuery('channel', handleChannel);

// Settings callbacks
bot.callbackQuery('settings', handleSettings);
bot.callbackQuery('change_region', handleChangeRegion);
bot.callbackQuery('change_queue', handleChangeQueue);
bot.callbackQuery('toggle_notifications', handleToggleNotifications);
bot.callbackQuery('back', handleBack);

// Help callback
bot.callbackQuery('help', handleHelp);

// Unknown callback query handler (fallback)
bot.on('callback_query:data', handleUnknownCallback);

// Fallback for all other text messages (non-command messages)
bot.on('message:text', handleFallbackMessage);

// Fallback for other message types (media, stickers, etc.)
bot.on('message', (ctx) => {
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
