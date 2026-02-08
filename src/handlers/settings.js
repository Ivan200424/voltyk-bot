const { getUser, updateUser, deleteUser } = require('../database/redis');
const { clearState, setState, getState } = require('../state/stateManager');
const {
  getSettingsKeyboard,
  getRegionChangeKeyboard,
  getQueueChangeKeyboard,
  getQueueChangeKeyboardExtra,
  getChannelSettingsKeyboard,
  getNotifyTargetKeyboard,
  getAlertToggleKeyboard,
  getDeleteDataConfirmKeyboard,
  getDeleteDataFinalKeyboard,
} = require('../keyboards/inline');
const { REGIONS } = require('../constants/regions');
const { isAdmin } = require('../utils');
const { safeAnswerCallback, safeEditMessage } = require('../utils/errorHandler');

/**
 * Handle /settings command
 */
async function handleSettings(ctx) {
  if (ctx.callbackQuery) {
    await safeAnswerCallback(ctx);
  }
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user) {
    const message = '⚠️ Спочатку налаштуйтеся через /start';
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(message, { parse_mode: 'HTML' });
    }
    return;
  }
  
  const regionName = user.region ? REGIONS[user.region]?.name || user.region : 'не вказано';
  const message = `⚙️ <b>Налаштування</b>

🌍 Регіон: <b>${regionName}</b>
⚡️ Черга: <b>${user.queue || 'не вказано'}</b>
📺 Канал: ${user.channelId ? '✅ Підключено' : '❌ Не підключено'}

Оберіть дію:`;
  
  const keyboard = getSettingsKeyboard(isAdmin(chatId));
  
  if (ctx.callbackQuery) {
    await safeEditMessage(ctx, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
}

/**
 * Handle settings region button
 */
async function handleSettingsRegion(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ Користувача не знайдено', show_alert: true });
    return;
  }
  
  const currentRegion = user.region ? REGIONS[user.region]?.name || user.region : 'не вказано';
  
  const message = `🌍 <b>Зміна регіону</b>

Поточний регіон: <b>${currentRegion}</b>

Оберіть новий регіон:`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getRegionChangeKeyboard(),
  });
}

/**
 * Handle region change from settings
 */
async function handleRegionChangeFromSettings(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const region = ctx.callbackQuery.data.replace('region_', '');
  
  if (!REGIONS[region]) {
    await ctx.answerCallbackQuery({ text: '❌ Невірний регіон', show_alert: true });
    return;
  }
  
  // Set state to remember we're changing region
  await setState('conversation', chatId, {
    action: 'change_region',
    region,
  });
  
  const message = `✅ Регіон обрано: <b>${REGIONS[region].name}</b>

Тепер оберіть чергу:`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getQueueChangeKeyboard(),
  });
}

/**
 * Handle queue change from settings
 */
async function handleQueueChangeFromSettings(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const queue = ctx.callbackQuery.data.replace('queue_', '');
  
  const conversation = await getState('conversation', chatId);
  
  if (!conversation || conversation.action !== 'change_region') {
    await ctx.answerCallbackQuery({ text: '❌ Помилка: невірний стан', show_alert: true });
    return;
  }
  
  // Update user
  await updateUser(chatId, {
    region: conversation.region,
    queue,
  });
  
  await clearState('conversation', chatId);
  
  const message = `✅ <b>Налаштування оновлено!</b>

🌍 Новий регіон: <b>${REGIONS[conversation.region].name}</b>
⚡️ Нова черга: <b>${queue}</b>`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getSettingsKeyboard(isAdmin(chatId)),
  });
}

/**
 * Handle settings channel button
 */
async function handleSettingsChannel(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ Користувача не знайдено', show_alert: true });
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
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getChannelSettingsKeyboard(user),
  });
}

/**
 * Handle settings alerts button
 */
async function handleSettingsAlerts(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ Користувача не знайдено', show_alert: true });
    return;
  }
  
  const alertsEnabled = user.alertsEnabled !== false;
  
  const message = `🔔 <b>Сповіщення про відключення</b>

Статус: ${alertsEnabled ? '✅ Увімкнено' : '❌ Вимкнено'}

Коли увімкнено, ви отримуватимете сповіщення про заплановані відключення.`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getAlertToggleKeyboard(alertsEnabled),
  });
}

/**
 * Handle alert toggle
 */
async function handleAlertToggle(ctx) {
  await safeAnswerCallback(ctx, '🔄 Оновлюємо...');
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ Користувача не знайдено', show_alert: true });
    return;
  }
  
  const newStatus = !(user.alertsEnabled !== false);
  
  await updateUser(chatId, {
    alertsEnabled: newStatus,
  });
  
  const message = `🔔 <b>Сповіщення про відключення</b>

Статус: ${newStatus ? '✅ Увімкнено' : '❌ Вимкнено'}

Коли увімкнено, ви отримуватимете сповіщення про заплановані відключення.`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getAlertToggleKeyboard(newStatus),
  });
}

/**
 * Handle settings IP monitoring button
 */
async function handleSettingsIp(ctx) {
  await safeAnswerCallback(ctx);
  
  const message = `🌐 <b>IP-моніторинг</b>

⚠️ Функція в розробці.

IP-моніторинг дозволить відстежувати доступність вашого роутера та отримувати сповіщення про зміни статусу мережі.`;
  
  const { getBackSettingsKeyboard } = require('../keyboards/inline');
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getBackSettingsKeyboard(),
  });
}

/**
 * Handle notification target selection
 */
async function handleNotifyTargetBot(ctx) {
  await handleNotifyTargetChange(ctx, 'bot');
}

async function handleNotifyTargetChannel(ctx) {
  await handleNotifyTargetChange(ctx, 'channel');
}

async function handleNotifyTargetBoth(ctx) {
  await handleNotifyTargetChange(ctx, 'both');
}

async function handleNotifyTargetChange(ctx, target) {
  await safeAnswerCallback(ctx, '🔄 Оновлюємо...');
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ Користувача не знайдено', show_alert: true });
    return;
  }
  
  await updateUser(chatId, {
    notifyTarget: target,
  });
  
  const targetNames = {
    bot: '💬 Бот',
    channel: '📺 Канал',
    both: '📱 Обидва',
  };
  
  const message = `✅ Налаштування оновлено!\n\nСповіщення тепер надходитимуть: <b>${targetNames[target]}</b>`;
  
  await ctx.answerCallbackQuery({ text: message });
  
  await safeEditMessage(ctx, `🔔 <b>Куди надсилати сповіщення</b>\n\n${message}`, {
    parse_mode: 'HTML',
    reply_markup: getNotifyTargetKeyboard(target),
  });
}

/**
 * Handle delete data confirmation (step 1)
 */
async function handleConfirmDeleteData(ctx) {
  await safeAnswerCallback(ctx);
  
  const message = `⚠️ <b>УВАГА!</b>

Ви впевнені, що хочете видалити всі свої дані?

Буде видалено:
• Налаштування регіону та черги
• Підключені канали
• Історію та статистику

<b>Цю дію неможливо скасувати!</b>

Якщо ви впевнені, натисніть кнопку нижче:`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getDeleteDataFinalKeyboard(),
  });
}

/**
 * Handle delete data confirmation (step 2)
 */
async function handleDeleteDataStep2(ctx) {
  await safeAnswerCallback(ctx);
  
  const message = `🗑 <b>ОСТАТОЧНЕ ПІДТВЕРДЖЕННЯ</b>

Це ваш останній шанс відмінити операцію!

Після видалення всі ваші дані будуть втрачені назавжди.

Підтвердити видалення?`;
  
  const { InlineKeyboard } = require('grammy');
  const keyboard = new InlineKeyboard()
    .text('❌❌ ТАК, ВИДАЛИТИ ❌❌', 'confirm_deactivate').row()
    .text('← Назад', 'back_to_settings');
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

/**
 * Handle final deactivation confirmation
 */
async function handleConfirmDeactivate(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  
  // Delete all user data
  await deleteUser(chatId);
  await clearState('wizard', chatId);
  await clearState('conversation', chatId);
  await clearState('pending_channel', chatId);
  
  const message = `✅ <b>Дані видалено</b>

Всі ваші дані успішно видалено з системи.

Якщо захочете користуватися ботом знову, просто відправте /start`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
  });
}

/**
 * Handle back to settings button
 */
async function handleBackToSettings(ctx) {
  await handleSettings(ctx);
}

/**
 * Handle back to main menu button
 */
async function handleBackToMain(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user || !user.region || !user.queue) {
    await ctx.editMessageText('⚠️ Спочатку налаштуйте регіон та чергу через /start', {
      parse_mode: 'HTML',
    });
    return;
  }
  
  const { formatMainMenu } = require('../formatter');
  const { getMainMenu } = require('../keyboards/inline');
  
  await safeEditMessage(ctx, formatMainMenu(user), {
    parse_mode: 'HTML',
    reply_markup: getMainMenu(user),
  });
}

/**
 * Handle queue change page extra (settings second page)
 */
async function handleQueueChangePageExtra(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const conversation = await getState('conversation', chatId);
  
  if (!conversation || conversation.action !== 'change_region') {
    await ctx.answerCallbackQuery({ text: '❌ Помилка: невірний стан', show_alert: true });
    return;
  }
  
  const message = `✅ Регіон обрано: <b>${REGIONS[conversation.region].name}</b>\n\nТепер оберіть чергу:\n(Черги 7–60)`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getQueueChangeKeyboardExtra(),
  });
}

/**
 * Handle queue change page main (settings return to first page)
 */
async function handleQueueChangePageMain(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const conversation = await getState('conversation', chatId);
  
  if (!conversation || conversation.action !== 'change_region') {
    await ctx.answerCallbackQuery({ text: '❌ Помилка: невірний стан', show_alert: true });
    return;
  }
  
  const message = `✅ Регіон обрано: <b>${REGIONS[conversation.region].name}</b>\n\nТепер оберіть чергу:`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getQueueChangeKeyboard(),
  });
}

module.exports = {
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
  handleQueueChangePageExtra,
  handleQueueChangePageMain,
};
