const { getUserCount, getAllChannelIds, getStats } = require('../database/redis');
const { isAdmin } = require('../utils');
const { getAdminKeyboard, getAdminStatsKeyboard, getAdminSystemKeyboard } = require('../keyboards/inline');
const { formatAdminStats, formatSystemInfo } = require('../formatter');
const { safeAnswerCallback, safeEditMessage } = require('../utils/errorHandler');

/**
 * Handle /admin command
 */
async function handleAdminPanel(ctx) {
  if (ctx.callbackQuery) {
    await safeAnswerCallback(ctx);
  }
  
  const chatId = ctx.from.id;
  
  if (!isAdmin(chatId)) {
    await ctx.answerCallbackQuery?.({ text: '❌ Доступ заборонено', show_alert: true });
    return;
  }
  
  const message = `👨‍💼 <b>Адмін-панель</b>

Оберіть дію:`;
  
  if (ctx.callbackQuery) {
    await safeEditMessage(ctx, message, {
      parse_mode: 'HTML',
      reply_markup: getAdminKeyboard(),
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getAdminKeyboard(),
    });
  }
}

/**
 * Handle admin stats
 */
async function handleAdminStats(ctx) {
  await safeAnswerCallback(ctx, '📊 Завантажуємо статистику...');
  
  const chatId = ctx.from.id;
  
  if (!isAdmin(chatId)) {
    await ctx.answerCallbackQuery({ text: '❌ Доступ заборонено', show_alert: true });
    return;
  }
  
  const totalUsers = await getUserCount();
  const totalChannels = (await getAllChannelIds()).length;
  
  const stats = {
    totalUsers,
    totalChannels,
    activeUsers: totalUsers, // Simplified
  };
  
  const message = formatAdminStats(stats);
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getAdminStatsKeyboard(),
  });
}

/**
 * Handle admin system info
 */
async function handleAdminSystem(ctx) {
  await safeAnswerCallback(ctx, '💻 Завантажуємо системну інформацію...');
  
  const chatId = ctx.from.id;
  
  if (!isAdmin(chatId)) {
    await ctx.answerCallbackQuery({ text: '❌ Доступ заборонено', show_alert: true });
    return;
  }
  
  const { getRedisClient } = require('../database/redis');
  const redis = getRedisClient();
  
  let redisStatus = 'connected';
  try {
    await redis.ping();
  } catch (error) {
    redisStatus = 'error';
  }
  
  const info = {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    redisStatus,
    nodeVersion: process.version,
  };
  
  const message = formatSystemInfo(info);
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getAdminSystemKeyboard(),
  });
}

/**
 * Handle admin intervals
 */
async function handleAdminIntervals(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  
  if (!isAdmin(chatId)) {
    await ctx.answerCallbackQuery({ text: '❌ Доступ заборонено', show_alert: true });
    return;
  }
  
  const message = `⏱ <b>Налаштування інтервалів</b>

⚠️ Функція в розробці

Тут можна буде налаштувати інтервали перевірки графіків та каналів.`;
  
  const { getBackMenuKeyboard } = require('../keyboards/inline');
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getBackMenuKeyboard(),
  });
}

/**
 * Handle admin debounce
 */
async function handleAdminDebounce(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  
  if (!isAdmin(chatId)) {
    await ctx.answerCallbackQuery({ text: '❌ Доступ заборонено', show_alert: true });
    return;
  }
  
  const message = `⏳ <b>Налаштування Debounce</b>

⚠️ Функція в розробці

Тут можна буде налаштувати затримку перед відправкою повідомлень.`;
  
  const { getBackMenuKeyboard } = require('../keyboards/inline');
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getBackMenuKeyboard(),
  });
}

/**
 * Handle admin pause
 */
async function handleAdminPause(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  
  if (!isAdmin(chatId)) {
    await ctx.answerCallbackQuery({ text: '❌ Доступ заборонено', show_alert: true });
    return;
  }
  
  const message = `⏸ <b>Режим паузи</b>

⚠️ Функція в розробці

Тут можна буде призупинити роботу бота для обслуговування.`;
  
  const { getBackMenuKeyboard } = require('../keyboards/inline');
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getBackMenuKeyboard(),
  });
}

/**
 * Placeholder handlers for interval/debounce/pause changes
 */
async function handleIntervalChange(ctx) {
  await ctx.answerCallbackQuery({ text: '⚠️ Функція в розробці', show_alert: true });
}

async function handleDebounceChange(ctx) {
  await ctx.answerCallbackQuery({ text: '⚠️ Функція в розробці', show_alert: true });
}

async function handlePauseChange(ctx) {
  await ctx.answerCallbackQuery({ text: '⚠️ Функція в розробці', show_alert: true });
}

module.exports = {
  handleAdminPanel,
  handleAdminStats,
  handleAdminSystem,
  handleAdminIntervals,
  handleAdminDebounce,
  handleAdminPause,
  handleIntervalChange,
  handleDebounceChange,
  handlePauseChange,
};
