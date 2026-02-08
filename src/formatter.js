/**
 * Formatter module for displaying messages
 */

/**
 * Escape special characters for MarkdownV2
 */
function escapeMarkdownV2(text) {
  const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  let escaped = text;
  // Using replaceAll for better performance
  for (const char of specialChars) {
    escaped = escaped.replaceAll(char, '\\' + char);
  }
  return escaped;
}

/**
 * Format schedule message for display
 * @param {Object} scheduleData - Schedule data object
 * @param {string} region - Region name
 * @param {string} queue - Queue
 * @returns {string} Formatted message
 */
export function formatScheduleMessage(scheduleData, region, queue) {
  if (!scheduleData || !scheduleData.today) {
    return '⚠️ Графік недоступний';
  }
  
  const today = scheduleData.today;
  
  let message = `📊 *Графік відключень*\n\n`;
  message += `📍 Регіон: *${escapeMarkdownV2(region)}*\n`;
  message += `🔢 Черга: *${escapeMarkdownV2(queue)}*\n\n`;
  message += `📅 *${escapeMarkdownV2(today.dayOfWeek)}, ${escapeMarkdownV2(today.date)}*\n\n`;
  
  if (today.intervals.length === 0) {
    message += `✅ Відключень немає\\!\n`;
  } else {
    message += `⚡️ Відключення:\n`;
    today.intervals.forEach(interval => {
      message += `• \`${interval}\`\n`;
    });
    message += `\n⏱ Всього: *${today.totalHours} год*\n`;
  }
  
  if (scheduleData.tomorrow) {
    const tomorrow = scheduleData.tomorrow;
    message += `\n📅 *${escapeMarkdownV2(tomorrow.dayOfWeek)}, ${escapeMarkdownV2(tomorrow.date)}*\n\n`;
    
    if (tomorrow.intervals.length === 0) {
      message += `✅ Відключень немає\\!\n`;
    } else {
      message += `⚡️ Відключення:\n`;
      tomorrow.intervals.forEach(interval => {
        message += `• \`${interval}\`\n`;
      });
      message += `\n⏱ Всього: *${tomorrow.totalHours} год*\n`;
    }
  }
  
  return message;
}

/**
 * Format timer message showing time until next outage
 * @param {Object} scheduleData - Schedule data object
 * @returns {string} Formatted message
 */
export function formatTimerMessage(scheduleData) {
  if (!scheduleData || !scheduleData.today || scheduleData.today.intervals.length === 0) {
    return '✅ Сьогодні відключень немає!';
  }
  
  // Calculate time until next outage (simplified for now)
  return '⏱ Таймер буде доступний у наступному оновленні';
}

/**
 * Format user statistics
 * @param {Object} userData - User data object
 * @returns {string} Formatted statistics
 */
export function formatUserStats(userData) {
  const userId = escapeMarkdownV2(String(userData.user_id || userData.id));
  const region = escapeMarkdownV2(userData.region || 'не вказано');
  const queue = escapeMarkdownV2(userData.queue || 'не вказано');
  
  let stats = `📈 *Ваша статистика*\n\n`;
  stats += `👤 ID: \`${userId}\`\n`;
  
  if (userData.created_at) {
    const date = new Date(userData.created_at).toLocaleDateString('uk-UA');
    stats += `📅 Зареєстровано: ${escapeMarkdownV2(date)}\n\n`;
  }
  
  stats += `📍 Регіон: *${region}*\n`;
  stats += `🔢 Черга: *${queue}*\n`;
  
  const notifStatus = (userData.notifications_enabled !== undefined ? userData.notifications_enabled : userData.notificationsEnabled) ? '✅' : '❌';
  stats += `🔔 Сповіщення: ${notifStatus}\n`;
  
  if (userData.channel_id) {
    stats += `📺 Канал: підключено ✅\n`;
  }
  
  if (userData.router_ip) {
    stats += `📡 IP моніторинг: активний ✅\n`;
  }
  
  return stats;
}

/**
 * Format channel message with HTML
 * @param {Object} scheduleData - Schedule data object
 * @param {string} region - Region name
 * @param {string} queue - Queue
 * @param {string} customDescription - Custom channel description (optional)
 * @returns {string} Formatted HTML message
 */
export function formatChannelMessage(scheduleData, region, queue, customDescription = '') {
  if (!scheduleData || !scheduleData.today) {
    return '<b>⚠️ Графік недоступний</b>';
  }
  
  const today = scheduleData.today;
  
  let message = `<b>📊 Графік відключень</b>\n\n`;
  message += `<b>📍 Регіон:</b> ${region}\n`;
  message += `<b>🔢 Черга:</b> ${queue}\n\n`;
  
  if (customDescription) {
    message += `${customDescription}\n\n`;
  }
  
  message += `<b>📅 ${today.dayOfWeek}, ${today.date}</b>\n\n`;
  
  if (today.intervals.length === 0) {
    message += `✅ Відключень немає!\n`;
  } else {
    message += `⚡️ Відключення:\n`;
    today.intervals.forEach(interval => {
      message += `• <code>${interval}</code>\n`;
    });
    message += `\n<b>⏱ Всього: ${today.totalHours} год</b>\n`;
  }
  
  if (scheduleData.tomorrow) {
    const tomorrow = scheduleData.tomorrow;
    message += `\n<b>📅 ${tomorrow.dayOfWeek}, ${tomorrow.date}</b>\n\n`;
    
    if (tomorrow.intervals.length === 0) {
      message += `✅ Відключень немає!\n`;
    } else {
      message += `⚡️ Відключення:\n`;
      tomorrow.intervals.forEach(interval => {
        message += `• <code>${interval}</code>\n`;
      });
      message += `\n<b>⏱ Всього: ${tomorrow.totalHours} год</b>\n`;
    }
  }
  
  return message;
}
