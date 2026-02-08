import { getScheduleData } from '../services/schedule.js';
import { backMenuKeyboard } from '../keyboards/inline.js';
import { getUserData, setUserData } from '../storage/index.js';

/**
 * Escape special characters for MarkdownV2
 * Backslashes must be escaped first to avoid double-escaping
 */
function escapeMarkdownV2(text) {
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');  // Then escape other special chars
}

/**
 * Format duration in hours and minutes
 * @param {number} totalMinutes - Total minutes
 * @returns {string} Formatted duration (e.g., "2 год", "30 хв", "2 год 30 хв")
 */
function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (minutes === 0) {
    return `${hours} год`;
  } else if (hours === 0) {
    return `${minutes} хв`;
  } else {
    return `${hours} год ${minutes} хв`;
  }
}

/**
 * Calculate hours for a single interval
 * Returns hours with half-hour precision (e.g., "2.5 год" or "2 год 30 хв")
 */
function calculateIntervalHours(interval) {
  const [startTime, endTime] = interval.split(' - ');
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  // Handle crossing midnight (end time is 00:00 meaning next day)
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  
  const totalMinutes = endMinutes - startMinutes;
  return formatDuration(totalMinutes);
}

/**
 * Format total hours with half-hour precision
 * Takes a number like 2.5 and returns "2 год 30 хв" or "2.5 год"
 */
function formatTotalHours(totalHours) {
  const totalMinutes = Math.round(totalHours * 60);
  return formatDuration(totalMinutes);
}

/**
 * Format time intervals with bold styling
 */
function formatIntervals(intervals) {
  return intervals.map(interval => {
    const hours = calculateIntervalHours(interval);
    const escapedInterval = escapeMarkdownV2(interval);
    return `🪫 *${escapedInterval} \\(\\~${escapeMarkdownV2(hours)}\\)*`;
  }).join('\n');
}

/**
 * Format schedule message for user request (button click)
 */
function formatScheduleMessage(scheduleData, queue, isManualRequest = true) {
  const { today, tomorrow } = scheduleData;
  
  let message = '';
  
  // Today's schedule
  const todayDate = escapeMarkdownV2(today.date);
  const todayDay = escapeMarkdownV2(today.dayOfWeek);
  const queueEscaped = escapeMarkdownV2(queue);
  
  message += `💡 _Графік відключень *на сьогодні, ${todayDate} \\(${todayDay}\\)*, для черги ${queueEscaped}:_\n\n`;
  message += formatIntervals(today.intervals) + '\n\n';
  message += `Загалом без світла: *\\~${escapeMarkdownV2(formatTotalHours(today.totalHours))}*\n\n`;
  
  // Tomorrow's schedule
  if (tomorrow) {
    const tomorrowDate = escapeMarkdownV2(tomorrow.date);
    const tomorrowDay = escapeMarkdownV2(tomorrow.dayOfWeek);
    
    message += `💡 _Графік відключень *на завтра, ${tomorrowDate} \\(${tomorrowDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(tomorrow.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${escapeMarkdownV2(formatTotalHours(tomorrow.totalHours))}*`;
  }
  // If no tomorrow data, simply don't mention it at all
  
  return message;
}

/**
 * Format auto-publication message based on change type
 */
export function formatAutoPublishMessage(scheduleData, queue, changes) {
  const { today, tomorrow } = scheduleData;
  let message = '';
  
  const todayDate = escapeMarkdownV2(today.date);
  const todayDay = escapeMarkdownV2(today.dayOfWeek);
  const queueEscaped = escapeMarkdownV2(queue);
  
  // Випадок 1: Перша публікація на сьогодні
  if (changes.todayIsNew && !tomorrow) {
    message += `💡 _Графік відключень *на сьогодні, ${todayDate} \\(${todayDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(today.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${escapeMarkdownV2(formatTotalHours(today.totalHours))}*`;
  }
  // Випадок 2: Графік на сьогодні оновився
  else if (changes.todayChanged && !changes.tomorrowIsNew && !changes.tomorrowChanged) {
    message += `💡 _Оновлено графік відключень *на сьогодні, ${todayDate} \\(${todayDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(today.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${escapeMarkdownV2(formatTotalHours(today.totalHours))}*`;
  }
  // Випадок 3: З'явився графік на завтра + сьогодні без змін
  else if (changes.tomorrowIsNew && !changes.todayChanged && tomorrow) {
    const tomorrowDate = escapeMarkdownV2(tomorrow.date);
    const tomorrowDay = escapeMarkdownV2(tomorrow.dayOfWeek);
    
    message += `💡 _З'явився графік відключень *на завтра, ${tomorrowDate} \\(${tomorrowDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(tomorrow.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${escapeMarkdownV2(formatTotalHours(tomorrow.totalHours))}*\n\n`;
    message += `💡 _Графік на сьогодні *без змін:*_\n\n`;
    message += formatIntervals(today.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${escapeMarkdownV2(formatTotalHours(today.totalHours))}*`;
  }
  // Випадок 4: З'явився графік на завтра + сьогодні теж оновився
  else if (changes.tomorrowIsNew && changes.todayChanged && tomorrow) {
    const tomorrowDate = escapeMarkdownV2(tomorrow.date);
    const tomorrowDay = escapeMarkdownV2(tomorrow.dayOfWeek);
    
    message += `💡 _З'явився графік відключень *на завтра, ${tomorrowDate} \\(${tomorrowDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(tomorrow.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${escapeMarkdownV2(formatTotalHours(tomorrow.totalHours))}*\n\n`;
    message += `💡 _Оновлено графік *на сьогодні:*_\n\n`;
    message += formatIntervals(today.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${escapeMarkdownV2(formatTotalHours(today.totalHours))}*`;
  }
  // Випадок 5: Графік на завтра оновився
  else if (changes.tomorrowChanged && !changes.todayChanged && tomorrow) {
    const tomorrowDate = escapeMarkdownV2(tomorrow.date);
    const tomorrowDay = escapeMarkdownV2(tomorrow.dayOfWeek);
    
    message += `💡 _Оновлено графік відключень *на завтра, ${tomorrowDate} \\(${tomorrowDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(tomorrow.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${escapeMarkdownV2(formatTotalHours(tomorrow.totalHours))}*\n\n`;
    message += `💡 _Графік на сьогодні *без змін:*_\n\n`;
    message += formatIntervals(today.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${escapeMarkdownV2(formatTotalHours(today.totalHours))}*`;
  }
  
  return message;
}

/**
 * Handle schedule button click (manual request)
 */
export async function handleSchedule(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  // Check if user has configured region and queue
  if (!userData.region || !userData.queue) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Спочатку налаштуйте регіон та чергу в налаштуваннях',
      show_alert: true,
    });
    return;
  }
  
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }
    
    // Fetch schedule data
    const scheduleData = await getScheduleData(userData.region, userData.queue);
    
    if (!scheduleData) {
      const errorMessage = '⚠️ Графік тимчасово недоступний. Спробуйте пізніше.';
      
      if (ctx.callbackQuery) {
        return await ctx.cleanAndEdit(errorMessage, {
          reply_markup: backMenuKeyboard(),
        });
      } else {
        return await ctx.cleanAndSend(errorMessage, {
          reply_markup: backMenuKeyboard(),
        });
      }
    }
    
    // Format message
    const message = formatScheduleMessage(scheduleData, userData.queue);
    
    // For manual request, we send photo with caption
    // Delete previous bot message (clean chat)
    if (userData.lastBotMessageId) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, userData.lastBotMessageId);
      } catch (error) {
        console.log('Could not delete message:', error.message);
      }
    }
    
    // Send photo with schedule
    // Note: Using placeholder until actual outage-data-ua integration is complete
    // In production, use: scheduleData.today.imageUrl
    const baseImageUrl = scheduleData.today.imageUrl || 'https://via.placeholder.com/800x600.png?text=Schedule+Graph';
    // Add cache-busting parameter to force Telegram to fetch fresh image
    const imageUrl = baseImageUrl.includes('?') ? `${baseImageUrl}&t=${Date.now()}` : `${baseImageUrl}?t=${Date.now()}`;
    
    const sentMessage = await ctx.replyWithPhoto(
      imageUrl,
      {
        caption: message,
        parse_mode: 'MarkdownV2',
        reply_markup: backMenuKeyboard(),
      }
    );
    
    // Update lastBotMessageId
    userData.lastBotMessageId = sentMessage.message_id;
    await setUserData(userId, userData);
    ctx.userData = userData;
    
  } catch (error) {
    console.error('Error handling schedule:', error);
    
    const errorMessage = '⚠️ Виникла помилка при отриманні графіка. Спробуйте пізніше.';
    
    if (ctx.callbackQuery) {
      return await ctx.cleanAndEdit(errorMessage, {
        reply_markup: backMenuKeyboard(),
      });
    } else {
      return await ctx.cleanAndSend(errorMessage, {
        reply_markup: backMenuKeyboard(),
      });
    }
  }
}
