const { REGIONS } = require('./constants/regions');
const { escapeHtml, formatNumber } = require('./utils');
const { formatDuration } = require('./parser');

/**
 * Format main menu message
 */
function formatMainMenu(user) {
  const regionName = user.region ? REGIONS[user.region]?.name || user.region : 'не вказано';
  const queue = user.queue || 'не вказано';
  
  return `🏠 <b>Головне меню</b>

👤 Ваш регіон: <b>${escapeHtml(regionName)}</b>
⚡️ Ваша черга: <b>${queue}</b>

Оберіть дію:`;
}

/**
 * Format welcome message for wizard
 */
function formatWelcomeMessage() {
  return `👋 <b>Вітаємо у Вольтику!</b>

⚡️ Я допоможу вам відстежувати графіки відключень електроенергії в Україні.

<b>Крок 1:</b> Оберіть ваш регіон`;
}

/**
 * Format schedule message
 */
function formatScheduleMessage(scheduleData, region, queue) {
  if (!scheduleData || !scheduleData.schedules) {
    return `❌ Не вдалося завантажити графік для регіону <b>${escapeHtml(REGIONS[region]?.name || region)}</b>`;
  }
  
  const regionName = REGIONS[region]?.name || region;
  let message = `📊 <b>Графік відключень</b>\n\n`;
  message += `🌍 Регіон: <b>${escapeHtml(regionName)}</b>\n`;
  message += `⚡️ Черга: <b>${queue}</b>\n\n`;
  
  const queueSchedule = scheduleData.schedules.find(s => s.queue === queue);
  
  if (!queueSchedule || !queueSchedule.events || queueSchedule.events.length === 0) {
    message += `✅ На даний момент відключень не заплановано.`;
    return message;
  }
  
  message += `<b>Заплановані відключення:</b>\n\n`;
  
  queueSchedule.events.forEach((event, index) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    message += `${index + 1}. 🔴 ${formatDateTime(start)} - ${formatTime(end)}\n`;
  });
  
  if (scheduleData.updated) {
    const updated = new Date(scheduleData.updated);
    message += `\n\n📅 Оновлено: ${formatDateTime(updated)}`;
  }
  
  return message;
}

/**
 * Format timer message
 */
function formatTimerMessage(currentStatus, queue) {
  let message = `⏱ <b>Таймер до наступної події</b>\n\n`;
  message += `⚡️ Черга: <b>${queue}</b>\n\n`;
  
  if (currentStatus.isOutage && currentStatus.currentEvent) {
    const endTime = new Date(currentStatus.currentEvent.end).getTime();
    const timeLeft = endTime - Date.now();
    
    message += `🔴 <b>Зараз відключення!</b>\n\n`;
    message += `⏰ Закінчиться через: <b>${formatDuration(timeLeft)}</b>\n`;
    message += `🕐 Час завершення: ${formatTime(new Date(currentStatus.currentEvent.end))}`;
  } else if (currentStatus.nextEvent) {
    const startTime = new Date(currentStatus.nextEvent.start).getTime();
    const timeLeft = startTime - Date.now();
    
    message += `✅ <b>Зараз електроенергія є</b>\n\n`;
    message += `⏰ Наступне відключення через: <b>${formatDuration(timeLeft)}</b>\n`;
    message += `🕐 Початок: ${formatDateTime(new Date(currentStatus.nextEvent.start))}`;
  } else {
    message += `✅ <b>Відключень не заплановано</b>`;
  }
  
  return message;
}

/**
 * Format next event message
 */
function formatNextEventMessage(currentStatus, queue) {
  let message = `⏱ <b>Наступне відключення</b>\n\n`;
  message += `⚡️ Черга: <b>${queue}</b>\n\n`;
  
  if (currentStatus.isOutage && currentStatus.currentEvent) {
    message += `🔴 <b>Зараз відключення!</b>\n\n`;
    message += `Закінчиться: ${formatDateTime(new Date(currentStatus.currentEvent.end))}`;
  } else if (currentStatus.nextEvent) {
    message += `Початок: ${formatDateTime(new Date(currentStatus.nextEvent.start))}\n`;
    message += `Кінець: ${formatTime(new Date(currentStatus.nextEvent.end))}`;
  } else {
    message += `✅ Відключень не заплановано`;
  }
  
  return message;
}

/**
 * Format user statistics
 */
function formatUserStats(user) {
  const regionName = user.region ? REGIONS[user.region]?.name || user.region : 'не вказано';
  const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
  
  let message = `📈 <b>Моя статистика</b>\n\n`;
  message += `👤 Користувач ID: <code>${user.chatId}</code>\n`;
  message += `🌍 Регіон: <b>${escapeHtml(regionName)}</b>\n`;
  message += `⚡️ Черга: <b>${user.queue || 'не вказано'}</b>\n`;
  message += `📅 Дата реєстрації: ${formatDate(createdDate)}\n`;
  
  if (user.channelId) {
    message += `\n📺 Підключений канал: ✅\n`;
    if (user.channel_title) {
      message += `   Назва: ${escapeHtml(user.channel_title)}\n`;
    }
  }
  
  return message;
}

/**
 * Format admin statistics
 */
function formatAdminStats(stats) {
  let message = `📊 <b>Статистика бота</b>\n\n`;
  message += `👥 Всього користувачів: <b>${formatNumber(stats.totalUsers || 0)}</b>\n`;
  message += `📺 Всього каналів: <b>${formatNumber(stats.totalChannels || 0)}</b>\n`;
  message += `✅ Активних користувачів: <b>${formatNumber(stats.activeUsers || 0)}</b>\n\n`;
  
  if (stats.usersByRegion) {
    message += `<b>По регіонах:</b>\n`;
    for (const [region, count] of Object.entries(stats.usersByRegion)) {
      const regionName = REGIONS[region]?.name || region;
      message += `  ${escapeHtml(regionName)}: ${formatNumber(count)}\n`;
    }
  }
  
  return message;
}

/**
 * Format system information
 */
function formatSystemInfo(info) {
  const { formatBytes, formatUptime } = require('./utils');
  
  let message = `💻 <b>Системна інформація</b>\n\n`;
  message += `⏱ Час роботи: <b>${formatUptime(info.uptime)}</b>\n`;
  message += `💾 Використано пам'яті: <b>${formatBytes(info.memoryUsage.heapUsed)}</b> / ${formatBytes(info.memoryUsage.heapTotal)}\n`;
  message += `🗄 Redis: <b>${info.redisStatus}</b>\n`;
  message += `📦 Node.js: <b>${info.nodeVersion}</b>\n`;
  
  return message;
}

/**
 * Format power on message
 */
function formatPowerOnMessage(host) {
  return `✅ <b>Електроенергія з'явилась!</b>\n\n🌐 IP: <code>${escapeHtml(host)}</code>\n⏰ Час: ${formatTime(new Date())}`;
}

/**
 * Format power off message
 */
function formatPowerOffMessage(host) {
  return `🔴 <b>Електроенергія відключена!</b>\n\n🌐 IP: <code>${escapeHtml(host)}</code>\n⏰ Час: ${formatTime(new Date())}`;
}

/**
 * Helper: Format date and time
 */
function formatDateTime(date) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(date);
}

/**
 * Helper: Format time only
 */
function formatTime(date) {
  return new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(date);
}

/**
 * Helper: Format date only
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  }).format(date);
}

module.exports = {
  formatMainMenu,
  formatWelcomeMessage,
  formatScheduleMessage,
  formatTimerMessage,
  formatNextEventMessage,
  formatUserStats,
  formatAdminStats,
  formatSystemInfo,
  formatPowerOnMessage,
  formatPowerOffMessage,
  formatDateTime,
  formatTime,
  formatDate,
};
