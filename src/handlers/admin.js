/**
 * Admin panel handler
 */

import { isAdmin } from '../utils.js';
import { 
  getAllUserIds, 
  getUserData,
  getGlobalSetting,
  setGlobalSetting,
  getBotPaused,
  setBotPaused,
  getPauseMessage,
  setPauseMessage,
  getScheduleCheckInterval,
  setScheduleCheckInterval,
  getIpCheckInterval,
  setIpCheckInterval,
  getDebounceMinutes,
  setDebounceMinutes,
} from '../storage/index.js';
import { adminPanelKeyboard } from '../keyboards/inline.js';
import { InlineKeyboard } from 'grammy';

/**
 * Show admin panel
 */
export async function handleAdminPanel(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ У вас немає доступу до адмін-панелі',
      show_alert: true,
    });
    return;
  }
  
  const text = '🔧 Адмін-панель\n\nОберіть дію:';
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      reply_markup: adminPanelKeyboard(),
    });
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(text, {
      reply_markup: adminPanelKeyboard(),
    });
  }
}

/**
 * Show admin statistics
 */
export async function handleAdminStats(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  const userIds = await getAllUserIds();
  let totalUsers = 0;
  let activeUsers = 0;
  let withChannels = 0;
  let withIp = 0;
  const regionCounts = {};
  
  for (const uid of userIds) {
    const userData = await getUserData(uid);
    totalUsers++;
    
    if (userData.is_active) {
      activeUsers++;
    }
    
    if (userData.channel_id && userData.channel_status === 'active') {
      withChannels++;
    }
    
    if (userData.router_ip) {
      withIp++;
    }
    
    if (userData.region) {
      regionCounts[userData.region] = (regionCounts[userData.region] || 0) + 1;
    }
  }
  
  let text = `📊 <b>Статистика</b>\n\n`;
  text += `👥 Всього користувачів: <b>${totalUsers}</b>\n`;
  text += `✅ Активних: <b>${activeUsers}</b>\n`;
  text += `📺 З каналами: <b>${withChannels}</b>\n`;
  text += `📡 З IP моніторингом: <b>${withIp}</b>\n\n`;
  
  text += `<b>По регіонах:</b>\n`;
  for (const [region, count] of Object.entries(regionCounts)) {
    text += `• ${region}: <b>${count}</b>\n`;
  }
  
  const keyboard = new InlineKeyboard()
    .text('🔄 Оновити', 'admin_stats').row()
    .text('← Назад', 'admin_panel');
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  await ctx.answerCallbackQuery();
}

/**
 * Show system information
 */
export async function handleAdminSystem(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  const uptime = process.uptime();
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);
  
  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  let text = `💻 <b>Система</b>\n\n`;
  text += `⏱ Uptime: <b>${uptimeHours}г ${uptimeMinutes}хв</b>\n`;
  text += `💾 Пам'ять: <b>${memUsedMB}MB / ${memTotalMB}MB</b>\n`;
  text += `🔢 Node.js: <b>${process.version}</b>\n`;
  text += `🖥 Платформа: <b>${process.platform}</b>\n`;
  
  const keyboard = new InlineKeyboard()
    .text('🔄 Оновити', 'admin_system').row()
    .text('← Назад', 'admin_panel');
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  await ctx.answerCallbackQuery();
}

/**
 * Show intervals configuration
 */
export async function handleAdminIntervals(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  const scheduleInterval = await getScheduleCheckInterval();
  const ipInterval = await getIpCheckInterval();
  
  let text = `⏱ <b>Інтервали перевірок</b>\n\n`;
  text += `📊 Графік: <b>${scheduleInterval / 1000}с</b>\n`;
  text += `📡 IP: <b>${ipInterval / 1000}с</b>\n`;
  
  const keyboard = new InlineKeyboard()
    .text('📊 1 хв', 'interval_schedule_60000').text('📊 5 хв', 'interval_schedule_300000').row()
    .text('📊 10 хв', 'interval_schedule_600000').text('📊 15 хв', 'interval_schedule_900000').row()
    .text('📡 10с', 'interval_ip_10000').text('📡 30с', 'interval_ip_30000').row()
    .text('📡 1хв', 'interval_ip_60000').text('📡 2хв', 'interval_ip_120000').row()
    .text('← Назад', 'admin_panel');
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  await ctx.answerCallbackQuery();
}

/**
 * Handle interval change
 */
export async function handleIntervalChange(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  const data = ctx.callbackQuery.data;
  const [, type, value] = data.split('_');
  
  if (type === 'schedule') {
    await setScheduleCheckInterval(parseInt(value));
  } else if (type === 'ip') {
    await setIpCheckInterval(parseInt(value));
  }
  
  await ctx.answerCallbackQuery({
    text: '✅ Інтервал оновлено',
  });
  
  // Refresh the view
  await handleAdminIntervals(ctx);
}

/**
 * Show debounce configuration
 */
export async function handleAdminDebounce(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  const debounce = await getDebounceMinutes();
  
  let text = `⏸ <b>Debounce для сповіщень про світло</b>\n\n`;
  text += `Поточне значення: <b>${debounce} хв</b>\n\n`;
  text += `Це час, протягом якого стан світла повинен\nбути стабільним перед відправкою сповіщення.`;
  
  const keyboard = new InlineKeyboard()
    .text('1 хв', 'debounce_1').text('2 хв', 'debounce_2').text('3 хв', 'debounce_3').row()
    .text('5 хв', 'debounce_5').text('10 хв', 'debounce_10').text('15 хв', 'debounce_15').row()
    .text('← Назад', 'admin_panel');
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  await ctx.answerCallbackQuery();
}

/**
 * Handle debounce change
 */
export async function handleDebounceChange(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  const data = ctx.callbackQuery.data;
  const minutes = parseInt(data.split('_')[1]);
  
  await setDebounceMinutes(minutes);
  
  await ctx.answerCallbackQuery({
    text: `✅ Debounce встановлено: ${minutes} хв`,
  });
  
  // Refresh the view
  await handleAdminDebounce(ctx);
}

/**
 * Show pause mode configuration
 */
export async function handleAdminPause(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  const isPaused = await getBotPaused();
  const pauseMessage = await getPauseMessage();
  
  let text = `⏸️ <b>Режим паузи</b>\n\n`;
  text += `Статус: ${isPaused ? '🔴 <b>Активний</b>' : '🟢 <b>Неактивний</b>'}\n\n`;
  
  if (pauseMessage) {
    text += `Повідомлення:\n${pauseMessage}\n\n`;
  }
  
  text += `Коли активний, всі користувачі бачать\nповідомлення паузи замість функцій бота.`;
  
  const keyboard = new InlineKeyboard();
  
  if (isPaused) {
    keyboard.text('✅ Зняти паузу', 'pause_off').row();
  } else {
    keyboard
      .text('⏸️ Пауза 1', 'pause_preset_1').row()
      .text('⏸️ Пауза 2', 'pause_preset_2').row()
      .text('⏸️ Пауза 3', 'pause_preset_3').row()
      .text('⏸️ Пауза 4', 'pause_preset_4').row()
      .text('⏸️ Пауза 5', 'pause_preset_5').row();
  }
  
  keyboard.text('← Назад', 'admin_panel');
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  await ctx.answerCallbackQuery();
}

/**
 * Handle pause mode change
 */
export async function handlePauseChange(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  const data = ctx.callbackQuery.data;
  
  if (data === 'pause_off') {
    await setBotPaused(false);
    await setPauseMessage(null);
    await ctx.answerCallbackQuery({
      text: '✅ Паузу знято',
    });
  } else {
    const presetNum = parseInt(data.split('_')[2]);
    const pauseMessages = [
      '🔧 Бот тимчасово на технічному обслуговуванні.\nНезабаром повернемось!',
      '⚡️ Проводимо оновлення системи.\nБудь ласка, зачекайте кілька хвилин.',
      '🛠 Технічні роботи.\nОчікуваний час: 15-30 хвилин.',
      '📡 Оновлюємо сервери.\nВибачте за незручності!',
      '🔄 Встановлюємо нові функції.\nСкоро все запрацює!',
    ];
    
    await setBotPaused(true);
    await setPauseMessage(pauseMessages[presetNum - 1]);
    await ctx.answerCallbackQuery({
      text: '✅ Режим паузи активовано',
    });
  }
  
  // Refresh the view
  await handleAdminPause(ctx);
}

/**
 * Show broadcast interface
 */
export async function handleAdminBroadcast(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  let text = `📢 <b>Розсилка</b>\n\n`;
  text += `Для відправки розсилки використовуйте команду:\n\n`;
  text += `<code>/broadcast Текст повідомлення</code>\n\n`;
  text += `Повідомлення буде надіслано всім активним користувачам.`;
  
  const keyboard = new InlineKeyboard()
    .text('← Назад', 'admin_panel');
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  await ctx.answerCallbackQuery();
}

/**
 * Handle broadcast command
 */
export async function handleBroadcastCommand(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.reply('❌ У вас немає доступу до цієї команди.');
    return;
  }
  
  const message = ctx.message.text.replace('/broadcast', '').trim();
  
  if (!message) {
    await ctx.reply('❌ Введіть текст для розсилки.\nПриклад: /broadcast Привіт всім!');
    return;
  }
  
  const userIds = await getAllUserIds();
  let successCount = 0;
  let errorCount = 0;
  
  const statusMsg = await ctx.reply(`📢 Розсилка розпочата...\n0 / ${userIds.length}`);
  
  for (let i = 0; i < userIds.length; i++) {
    const uid = userIds[i];
    
    try {
      await ctx.api.sendMessage(uid, message, { parse_mode: 'HTML' });
      successCount++;
    } catch (error) {
      errorCount++;
      console.error(`Failed to send broadcast to ${uid}:`, error.message);
    }
    
    // Update status every 10 users
    if ((i + 1) % 10 === 0 || i === userIds.length - 1) {
      try {
        await ctx.api.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          `📢 Розсилка...\n${i + 1} / ${userIds.length}\n\n✅ Успішно: ${successCount}\n❌ Помилок: ${errorCount}`
        );
      } catch (e) {
        // Ignore edit errors
      }
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  await ctx.api.editMessageText(
    ctx.chat.id,
    statusMsg.message_id,
    `✅ Розсилка завершена!\n\n📊 Всього: ${userIds.length}\n✅ Успішно: ${successCount}\n❌ Помилок: ${errorCount}`
  );
}

/**
 * Show user growth statistics
 */
export async function handleAdminGrowth(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  const userIds = await getAllUserIds();
  
  // Count users by creation date (if we have that data)
  const today = new Date();
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  
  for (const uid of userIds) {
    const userData = await getUserData(uid);
    if (userData.created_at) {
      const createdDate = new Date(userData.created_at);
      if (createdDate >= today.setHours(0, 0, 0, 0)) {
        todayCount++;
      }
      if (createdDate >= thisWeek) {
        weekCount++;
      }
      if (createdDate >= thisMonth) {
        monthCount++;
      }
    }
  }
  
  let text = `📈 <b>Ріст користувачів</b>\n\n`;
  text += `👥 Всього: <b>${userIds.length}</b>\n\n`;
  text += `📅 Сьогодні: <b>${todayCount}</b>\n`;
  text += `📅 За тиждень: <b>${weekCount}</b>\n`;
  text += `📅 За місяць: <b>${monthCount}</b>\n`;
  
  const keyboard = new InlineKeyboard()
    .text('🔄 Оновити', 'admin_growth').row()
    .text('← Назад', 'admin_panel');
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  await ctx.answerCallbackQuery();
}

/**
 * Show users list (paginated)
 */
export async function handleAdminUsers(ctx) {
  const userId = ctx.from.id;
  
  if (!isAdmin(userId)) {
    await ctx.answerCallbackQuery({
      text: '❌ Доступ заборонено',
      show_alert: true,
    });
    return;
  }
  
  const userIds = await getAllUserIds();
  
  let text = `👥 <b>Користувачі</b>\n\n`;
  text += `Всього користувачів: <b>${userIds.length}</b>\n\n`;
  text += `Детальну інформацію можна отримати\nчерез інші розділи статистики.`;
  
  const keyboard = new InlineKeyboard()
    .text('← Назад', 'admin_panel');
  
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
  await ctx.answerCallbackQuery();
}

/**
 * Route admin callbacks
 */
export async function handleAdminCallback(ctx) {
  const data = ctx.callbackQuery.data;
  
  if (data === 'admin_panel') {
    return await handleAdminPanel(ctx);
  }
  
  if (data === 'admin_stats') {
    return await handleAdminStats(ctx);
  }
  
  if (data === 'admin_system') {
    return await handleAdminSystem(ctx);
  }
  
  if (data === 'admin_intervals') {
    return await handleAdminIntervals(ctx);
  }
  
  if (data.startsWith('interval_')) {
    return await handleIntervalChange(ctx);
  }
  
  if (data === 'admin_debounce') {
    return await handleAdminDebounce(ctx);
  }
  
  if (data.startsWith('debounce_')) {
    return await handleDebounceChange(ctx);
  }
  
  if (data === 'admin_pause') {
    return await handleAdminPause(ctx);
  }
  
  if (data.startsWith('pause_')) {
    return await handlePauseChange(ctx);
  }
  
  if (data === 'admin_broadcast') {
    return await handleAdminBroadcast(ctx);
  }
  
  if (data === 'admin_growth') {
    return await handleAdminGrowth(ctx);
  }
  
  if (data === 'admin_users') {
    return await handleAdminUsers(ctx);
  }
}
