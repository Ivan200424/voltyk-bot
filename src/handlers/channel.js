const { getUser, updateUser, getChannel, deleteChannel } = require('../database/redis');
const { setState, getState, clearState } = require('../state/stateManager');
const { getChannelSettingsKeyboard } = require('../keyboards/inline');
const { safeAnswerCallback, safeEditMessage } = require('../utils/errorHandler');
const { cleanReply } = require('../utils/chatCleaner');
const { publishToChannel } = require('../publisher');
const { REGIONS } = require('../constants/regions');

/**
 * Handle /channel command
 */
async function handleChannelCommand(ctx) {
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user) {
    await cleanReply(ctx, '⚠️ Спочатку налаштуйтеся через /start', { parse_mode: 'HTML' });
    return;
  }
  
  let message = `📺 <b>Керування каналом</b>\n\n`;
  
  if (user.channelId) {
    message += `✅ Канал підключено\n`;
    if (user.channel_title) {
      message += `📝 Назва: ${user.channel_title}\n`;
    }
    message += `🆔 ID: <code>${user.channelId}</code>\n\n`;
    message += `Оберіть дію:`;
  } else {
    message += `❌ Канал не підключено\n\n`;
    message += `Ви можете підключити канал для автоматичної публікації графіків.`;
  }
  
  await cleanReply(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getChannelSettingsKeyboard(user),
  });
}

/**
 * Handle channel setup button
 */
async function handleChannelSetup(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  
  // Set channel setup state
  await setState('pending_channel', chatId, {
    fromWizard: false,
  });
  
  const message = `📺 <b>Підключення каналу</b>

Щоб підключити канал:

1. Додайте бота <b>@${ctx.me.username}</b> до вашого каналу як адміністратора
2. Надайте боту права на публікацію повідомлень
3. Канал буде виявлено автоматично

⚠️ Важливо: бот повинен мати права адміністратора!

Після додавання бота до каналу, він буде виявлено протягом кількох секунд.`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
  });
}

/**
 * Handle channel info button
 */
async function handleChannelInfo(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user || !user.channelId) {
    await ctx.answerCallbackQuery({ text: '❌ Канал не підключено', show_alert: true });
    return;
  }
  
  const channel = await getChannel(user.channelId);
  
  let message = `📺 <b>Інформація про канал</b>\n\n`;
  
  if (channel) {
    message += `📝 Назва: ${channel.title || 'Не вказано'}\n`;
    message += `🆔 ID: <code>${channel.channelId}</code>\n`;
    if (channel.username) {
      message += `🔗 Username: @${channel.username}\n`;
    }
    message += `⚡️ Регіон: ${channel.region || 'не вказано'}\n`;
    message += `🔢 Черга: ${channel.queue || 'не вказано'}\n`;
    message += `📊 Статус: ${channel.status === 'active' ? '✅ Активний' : '❌ Неактивний'}\n`;
  } else {
    message += `❌ Інформація про канал недоступна`;
  }
  
  const { getBackMenuKeyboard } = require('../keyboards/inline');
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getBackMenuKeyboard(),
  });
}

/**
 * Handle channel disconnect button
 */
async function handleChannelDisconnect(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user || !user.channelId) {
    await ctx.answerCallbackQuery({ text: '❌ Канал не підключено', show_alert: true });
    return;
  }
  
  const { InlineKeyboard } = require('grammy');
  const keyboard = new InlineKeyboard()
    .text('⚠️ Так, від\'єднати', 'confirm_channel_disconnect').row()
    .text('← Назад', 'settings_channel');
  
  const message = `⚠️ <b>Від'єднання каналу</b>

Ви впевнені, що хочете від'єднати канал?

Після від'єднання публікації в канал припиняться.`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

/**
 * Handle confirm channel disconnect
 */
async function handleConfirmChannelDisconnect(ctx) {
  await safeAnswerCallback(ctx, '🔄 Від\'єднуємо канал...');
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user || !user.channelId) {
    await ctx.answerCallbackQuery({ text: '❌ Канал не підключено', show_alert: true });
    return;
  }
  
  const channelId = user.channelId;
  
  // Delete channel from database
  await deleteChannel(channelId);
  
  // Update user
  await updateUser(chatId, {
    channelId: null,
    notifyTarget: 'bot',
  });
  
  const message = `✅ <b>Канал від'єднано</b>

Канал успішно від'єднано. Сповіщення тепер надходитимуть в бот.`;
  
  const { getMenuKeyboard } = require('../keyboards/inline');
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getMenuKeyboard(),
  });
}

/**
 * Handle test publish button
 */
async function handleTestPublish(ctx) {
  await safeAnswerCallback(ctx, '📤 Публікуємо тест...');
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user || !user.channelId) {
    await ctx.answerCallbackQuery({ text: '❌ Канал не підключено', show_alert: true });
    return;
  }
  
  if (!user.region || !user.queue) {
    await ctx.answerCallbackQuery({ text: '❌ Регіон або черга не налаштовані', show_alert: true });
    return;
  }
  
  const regionName = REGIONS[user.region]?.name || user.region;
  const testMessage = `🧪 <b>Тестове повідомлення</b>\n\n📍 Регіон: <b>${regionName}</b>\n⚡️ Черга: <b>${user.queue}</b>\n\nЯкщо ви бачите це повідомлення з фото, канал налаштовано правильно!`;
  
  // Get bot instance from context
  const bot = ctx.api;
  
  // Publish test message
  const success = await publishToChannel(
    { api: bot },
    user.channelId,
    testMessage,
    user.region,
    user.queue
  );
  
  if (success) {
    await ctx.answerCallbackQuery({ text: '✅ Тест успішно опубліковано!', show_alert: true });
  } else {
    await ctx.answerCallbackQuery({ text: '❌ Помилка публікації. Перевірте права бота в каналі.', show_alert: true });
  }
}

module.exports = {
  handleChannelCommand,
  handleChannelSetup,
  handleChannelInfo,
  handleChannelDisconnect,
  handleConfirmChannelDisconnect,
  handleTestPublish,
};
