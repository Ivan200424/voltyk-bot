import { formatMainMenu } from '../utils/format.js';
import { mainMenuKeyboard, menuKeyboard } from '../keyboards/inline.js';
import { getUserData } from '../storage/index.js';
import { getScheduleData } from '../services/schedule.js';
import { formatScheduleMessage, formatTimerMessage, formatUserStats } from '../formatter.js';
import { REGION_NAME_TO_CODE } from '../constants/regions.js';

export async function showMainMenu(ctx) {
  // Always get fresh user data from storage
  const userData = await getUserData(ctx.from.id);
  const text = formatMainMenu(userData);
  
  if (ctx.callbackQuery) {
    return await ctx.cleanAndEdit(text, {
      reply_markup: mainMenuKeyboard(userData),
    });
  } else {
    return await ctx.cleanAndSend(text, {
      reply_markup: mainMenuKeyboard(userData),
    });
  }
}

export async function handleMenu(ctx) {
  await ctx.answerCallbackQuery();
  return await showMainMenu(ctx);
}

export async function handleSchedule(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  if (!userData.region || !userData.queue) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Спочатку налаштуйте регіон і чергу в меню',
      show_alert: true,
    });
    return;
  }
  
  await ctx.answerCallbackQuery({ text: '⏳ Завантаження графіка...' });
  
  // Get region code for API
  const regionCode = REGION_NAME_TO_CODE[userData.region] || userData.region;
  
  // Fetch schedule
  const scheduleData = await getScheduleData(regionCode, userData.queue);
  
  if (!scheduleData) {
    const text = `⚠️ Графік недоступний

Спробуйте пізніше або перевірте налаштування регіону та черги.`;
    
    if (ctx.callbackQuery) {
      return await ctx.cleanAndEdit(text, {
        reply_markup: menuKeyboard(),
      });
    } else {
      return await ctx.cleanAndSend(text, {
        reply_markup: menuKeyboard(),
      });
    }
  }
  
  // Format and send schedule
  const text = formatScheduleMessage(scheduleData, userData.region, userData.queue);
  
  if (ctx.callbackQuery) {
    return await ctx.cleanAndEdit(text, {
      parse_mode: 'MarkdownV2',
      reply_markup: menuKeyboard(),
    });
  } else {
    return await ctx.cleanAndSend(text, {
      parse_mode: 'MarkdownV2',
      reply_markup: menuKeyboard(),
    });
  }
}

export async function handleTimer(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  if (!userData.region || !userData.queue) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Спочатку налаштуйте регіон і чергу в меню',
      show_alert: true,
    });
    return;
  }
  
  await ctx.answerCallbackQuery({ text: '⏳ Розрахунок...' });
  
  // Get region code for API
  const regionCode = REGION_NAME_TO_CODE[userData.region] || userData.region;
  
  // Fetch schedule
  const scheduleData = await getScheduleData(regionCode, userData.queue);
  
  const text = formatTimerMessage(scheduleData);
  
  if (ctx.callbackQuery) {
    return await ctx.cleanAndEdit(text, {
      reply_markup: menuKeyboard(),
    });
  } else {
    return await ctx.cleanAndSend(text, {
      reply_markup: menuKeyboard(),
    });
  }
}

export async function handleStats(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  const text = formatUserStats(userData);
  
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    return await ctx.cleanAndEdit(text, {
      parse_mode: 'MarkdownV2',
      reply_markup: menuKeyboard(),
    });
  } else {
    return await ctx.cleanAndSend(text, {
      parse_mode: 'MarkdownV2',
      reply_markup: menuKeyboard(),
    });
  }
}

export async function handleMonitoring(ctx) {
  await ctx.answerCallbackQuery({
    text: '📡 Функція буде доступна в наступному оновленні',
    show_alert: true,
  });
}

export async function handleChannel(ctx) {
  // Import dynamically to avoid circular dependencies
  const { handleChannelSetup } = await import('./channel.js');
  return await handleChannelSetup(ctx);
}
