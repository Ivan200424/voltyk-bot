import { getScheduleData } from '../services/schedule.js';
import { backMenuKeyboard } from '../keyboards/inline.js';
import { setUserData } from '../storage/index.js';

/**
 * Escape special characters for MarkdownV2
 */
function escapeMarkdownV2(text) {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Calculate hours for a single interval
 */
function calculateIntervalHours(interval) {
  const [startTime, endTime] = interval.split(' - ');
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  // Handle crossing midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  
  return Math.round((endMinutes - startMinutes) / 60);
}

/**
 * Format time intervals with bold styling
 */
function formatIntervals(intervals) {
  return intervals.map(interval => {
    const hours = calculateIntervalHours(interval);
    const escapedInterval = escapeMarkdownV2(interval);
    return `🪫 *${escapedInterval} \\(\\~${hours} год\\)*`;
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
  message += `Загалом без світла: *\\~${today.totalHours} год*\n\n`;
  
  // Tomorrow's schedule
  if (tomorrow) {
    const tomorrowDate = escapeMarkdownV2(tomorrow.date);
    const tomorrowDay = escapeMarkdownV2(tomorrow.dayOfWeek);
    
    message += `💡 _Графік відключень *на завтра, ${tomorrowDate} \\(${tomorrowDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(tomorrow.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${tomorrow.totalHours} год*`;
  } else {
    message += `💡 Графік на завтра ще не опубліковано`;
  }
  
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
    message += `Загалом без світла: *\\~${today.totalHours} год*`;
  }
  // Випадок 2: Графік на сьогодні оновився
  else if (changes.todayChanged && !changes.tomorrowIsNew && !changes.tomorrowChanged) {
    message += `💡 _Оновлено графік відключень *на сьогодні, ${todayDate} \\(${todayDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(today.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${today.totalHours} год*`;
  }
  // Випадок 3: З'явився графік на завтра + сьогодні без змін
  else if (changes.tomorrowIsNew && !changes.todayChanged && tomorrow) {
    const tomorrowDate = escapeMarkdownV2(tomorrow.date);
    const tomorrowDay = escapeMarkdownV2(tomorrow.dayOfWeek);
    
    message += `💡 _З'явився графік відключень *на завтра, ${tomorrowDate} \\(${tomorrowDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(tomorrow.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${tomorrow.totalHours} год*\n\n`;
    message += `💡 _Графік на сьогодні *без змін:*_\n\n`;
    message += formatIntervals(today.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${today.totalHours} год*`;
  }
  // Випадок 4: З'явився графік на завтра + сьогодні теж оновився
  else if (changes.tomorrowIsNew && changes.todayChanged && tomorrow) {
    const tomorrowDate = escapeMarkdownV2(tomorrow.date);
    const tomorrowDay = escapeMarkdownV2(tomorrow.dayOfWeek);
    
    message += `💡 _З'явився графік відключень *на завтра, ${tomorrowDate} \\(${tomorrowDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(tomorrow.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${tomorrow.totalHours} год*\n\n`;
    message += `💡 _Оновлено графік *на сьогодні:*_\n\n`;
    message += formatIntervals(today.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${today.totalHours} год*`;
  }
  // Випадок 5: Графік на завтра оновився
  else if (changes.tomorrowChanged && !changes.todayChanged && tomorrow) {
    const tomorrowDate = escapeMarkdownV2(tomorrow.date);
    const tomorrowDay = escapeMarkdownV2(tomorrow.dayOfWeek);
    
    message += `💡 _Оновлено графік відключень *на завтра, ${tomorrowDate} \\(${tomorrowDay}\\)*, для черги ${queueEscaped}:_\n\n`;
    message += formatIntervals(tomorrow.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${tomorrow.totalHours} год*\n\n`;
    message += `💡 _Графік на сьогодні *без змін:*_\n\n`;
    message += formatIntervals(today.intervals) + '\n\n';
    message += `Загалом без світла: *\\~${today.totalHours} год*`;
  }
  
  return message;
}

/**
 * Handle schedule button click (manual request)
 */
export async function handleSchedule(ctx) {
  const userData = ctx.userData;
  
  // Check if user has configured region and queue
  if (!userData.region || !userData.queue) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Спочатку налаштуйте регіон та чергу в налаштуваннях',
      show_alert: true,
    });
    return;
  }
  
  try {
    await ctx.answerCallbackQuery();
    
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
    const imageUrl = scheduleData.today.imageUrl || 'https://via.placeholder.com/800x600.png?text=Schedule+Graph';
    
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
    await setUserData(userData.id, userData);
    
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
