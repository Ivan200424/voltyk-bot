const { REGIONS } = require('./constants/regions');
const { escapeHtml, formatNumber } = require('./utils');
const { formatDuration } = require('./parser');
const { formatDateUkrainian, isToday, isTomorrow } = require('./utils/dateHelpers');

/**
 * Format main menu message
 */
function formatMainMenu(user) {
  const regionName = user.region ? REGIONS[user.region]?.name || user.region : 'не вказано';
  const queue = user.queue || 'не вказано';
  
  // Channel status
  let channelStatus;
  if (user.channelId) {
    let channelName;
    if (user.channel_title) {
      // Don't add @ if it already starts with @
      channelName = user.channel_title.startsWith('@') ? user.channel_title : `@${user.channel_title}`;
    } else {
      channelName = `ID: ${user.channelId}`;
    }
    channelStatus = `${escapeHtml(channelName)} ✅`;
  } else {
    channelStatus = 'не підключено ❌';
  }
  
  // IP status
  let ipStatus;
  if (user.ipHost) {
    ipStatus = `${escapeHtml(user.ipHost)} ✅`;
  } else {
    ipStatus = 'не підключена ❌';
  }
  
  // Alerts status (default to enabled if not set)
  const alertsEnabled = user.alertsEnabled !== false;
  const alertsStatus = alertsEnabled ? 'увімкнено ✅' : 'вимкнено ❌';
  
  return `🚧 <b>Бот у розробці</b>
Деякі функції можуть працювати нестабільно.

💬 Маєте ідеї або знайшли помилку?
❓ Допомога → Обговорення / Підтримка

──────────────
🏠 <b>Головне меню</b>

📍 Регіон: <b>${escapeHtml(regionName)}</b> • <b>${queue}</b>
📺 Канал: ${channelStatus}
📡 IP-адреса: ${ipStatus}
🔔 Сповіщення: ${alertsStatus}`;
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
 * queueData: output from parseScheduleForQueue with events array
 */
function formatScheduleMessage(queueData, region, queue) {
  if (!queueData || !queueData.hasData || !queueData.events || queueData.events.length === 0) {
    return `✅ На даний момент відключень не заплановано.`;
  }
  
  // Separate events by day
  const todayEvents = queueData.events.filter(e => isToday(e.start));
  const tomorrowEvents = queueData.events.filter(e => isTomorrow(e.start));
  
  let message = '';
  
  // Format today's schedule
  if (todayEvents.length > 0) {
    const todayDate = new Date();
    const dateStr = formatDateUkrainian(todayDate);
    message += `💡 Графік відключень на сьогодні, ${escapeHtml(dateStr)}, для черги ${escapeHtml(queue)}:\n\n`;
    
    let totalMinutes = 0;
    todayEvents.forEach((event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      
      const startTime = start.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Kyiv',
      });
      
      const endTime = end.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Kyiv',
      });
      
      const durationMs = end.getTime() - start.getTime();
      const durationHours = Math.round(durationMs / (1000 * 60 * 60));
      totalMinutes += durationMs / (1000 * 60);
      
      message += `🪫 ${startTime} - ${endTime} (~${durationHours} год)\n`;
    });
    
    const totalHours = Math.round(totalMinutes / 60);
    message += `\nЗагалом без світла: ~${totalHours} год`;
  }
  
  // Format tomorrow's schedule
  if (tomorrowEvents.length > 0) {
    if (todayEvents.length > 0) {
      message += `\n\n`;
    }
    
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const dateStr = formatDateUkrainian(tomorrowDate);
    message += `💡 Графік відключень на завтра, ${escapeHtml(dateStr)}, для черги ${escapeHtml(queue)}:\n\n`;
    
    let totalMinutes = 0;
    tomorrowEvents.forEach((event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      
      const startTime = start.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Kyiv',
      });
      
      const endTime = end.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Kyiv',
      });
      
      const durationMs = end.getTime() - start.getTime();
      const durationHours = Math.round(durationMs / (1000 * 60 * 60));
      totalMinutes += durationMs / (1000 * 60);
      
      message += `🪫 ${startTime} - ${endTime} (~${durationHours} год)\n`;
    });
    
    const totalHours = Math.round(totalMinutes / 60);
    message += `\nЗагалом без світла: ~${totalHours} год`;
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
    const endTime = currentStatus.currentEvent.end.getTime();
    const timeLeft = endTime - Date.now();
    
    if (currentStatus.isPossible) {
      message += `⚠️ <b>Можливе відключення!</b>\n\n`;
    } else {
      message += `🔴 <b>Зараз відключення!</b>\n\n`;
    }
    message += `⏰ Закінчиться через: <b>${formatDuration(timeLeft)}</b>\n`;
    message += `🕐 Час завершення: ${formatTime(currentStatus.currentEvent.end)}`;
  } else if (currentStatus.nextEvent) {
    const startTime = currentStatus.nextEvent.start.getTime();
    const timeLeft = startTime - Date.now();
    
    message += `✅ <b>Зараз електроенергія є</b>\n\n`;
    if (currentStatus.nextEvent.isPossible) {
      message += `⏰ Можливе відключення через: <b>${formatDuration(timeLeft)}</b>\n`;
    } else {
      message += `⏰ Наступне відключення через: <b>${formatDuration(timeLeft)}</b>\n`;
    }
    message += `🕐 Початок: ${formatDateTime(currentStatus.nextEvent.start)}`;
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
    if (currentStatus.isPossible) {
      message += `⚠️ <b>Можливе відключення!</b>\n\n`;
    } else {
      message += `🔴 <b>Зараз відключення!</b>\n\n`;
    }
    message += `Закінчиться: ${formatDateTime(currentStatus.currentEvent.end)}`;
  } else if (currentStatus.nextEvent) {
    if (currentStatus.nextEvent.isPossible) {
      message += `Можливе відключення:\n`;
    }
    message += `Початок: ${formatDateTime(currentStatus.nextEvent.start)}\n`;
    message += `Кінець: ${formatTime(currentStatus.nextEvent.end)}`;
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
