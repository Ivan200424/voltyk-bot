const { getUser } = require('../database/redis');
const { fetchScheduleData } = require('../api');
const { parseScheduleForQueue, getCurrentStatus } = require('../parser');
const { formatScheduleMessage, formatTimerMessage, formatMainMenu } = require('../formatter');
const { getMainMenu, getMenuKeyboard } = require('../keyboards/inline');
const { safeAnswerCallback } = require('../utils/errorHandler');
const { cleanReply } = require('../utils/chatCleaner');

/**
 * Handle /schedule command - Show outage schedule
 */
async function handleSchedule(ctx) {
  if (ctx.callbackQuery) {
    await safeAnswerCallback(ctx, '📊 Завантажуємо графік...');
  }
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user || !user.region || !user.queue) {
    const message = '⚠️ Спочатку налаштуйте регіон та чергу через /start';
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, { parse_mode: 'HTML' });
    } else {
      await cleanReply(ctx, message, { parse_mode: 'HTML' });
    }
    return;
  }
  
  // Fetch schedule data
  const scheduleData = await fetchScheduleData(user.region);
  
  if (!scheduleData) {
    const message = '❌ Не вдалося завантажити графік. Спробуйте пізніше.';
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, { 
        parse_mode: 'HTML',
        reply_markup: getMenuKeyboard(),
      });
    } else {
      await cleanReply(ctx, message, { 
        parse_mode: 'HTML',
        reply_markup: getMenuKeyboard(),
      });
    }
    return;
  }
  
  const parsed = parseScheduleForQueue(scheduleData, user.queue);
  const message = formatScheduleMessage(parsed, user.region, user.queue);
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: getMenuKeyboard(),
    });
  } else {
    await cleanReply(ctx, message, {
      parse_mode: 'HTML',
      reply_markup: getMenuKeyboard(),
    });
  }
}

/**
 * Handle /timer command - Show timer to next event
 */
async function handleTimer(ctx) {
  if (ctx.callbackQuery) {
    await safeAnswerCallback(ctx, '⏱ Завантажуємо...');
  }
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user || !user.region || !user.queue) {
    const message = '⚠️ Спочатку налаштуйте регіон та чергу через /start';
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, { parse_mode: 'HTML' });
    } else {
      await cleanReply(ctx, message, { parse_mode: 'HTML' });
    }
    return;
  }
  
  // Fetch schedule data
  const scheduleData = await fetchScheduleData(user.region);
  
  if (!scheduleData) {
    const message = '❌ Не вдалося завантажити графік. Спробуйте пізніше.';
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: getMenuKeyboard(),
      });
    } else {
      await cleanReply(ctx, message, {
        parse_mode: 'HTML',
        reply_markup: getMenuKeyboard(),
      });
    }
    return;
  }
  
  const parsed = parseScheduleForQueue(scheduleData, user.queue);
  const currentStatus = getCurrentStatus(parsed);
  
  const message = formatTimerMessage(currentStatus, user.queue);
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: getMenuKeyboard(),
    });
  } else {
    await cleanReply(ctx, message, {
      parse_mode: 'HTML',
      reply_markup: getMenuKeyboard(),
    });
  }
}

/**
 * Handle menu button - Show main menu
 */
async function handleMenu(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user || !user.region || !user.queue) {
    await ctx.editMessageText('⚠️ Спочатку налаштуйте регіон та чергу через /start', {
      parse_mode: 'HTML',
    });
    return;
  }
  
  await ctx.editMessageText(formatMainMenu(user), {
    parse_mode: 'HTML',
    reply_markup: getMainMenu(user),
  });
}

/**
 * Handle /stats command - Show user statistics
 */
async function handleStats(ctx) {
  if (ctx.callbackQuery) {
    await safeAnswerCallback(ctx, '📈 Завантажуємо статистику...');
  }
  
  const chatId = ctx.from.id;
  const user = await getUser(chatId);
  
  if (!user) {
    const message = '⚠️ Спочатку налаштуйтеся через /start';
    
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, { parse_mode: 'HTML' });
    } else {
      await cleanReply(ctx, message, { parse_mode: 'HTML' });
    }
    return;
  }
  
  const { formatUserStats } = require('../formatter');
  const message = formatUserStats(user);
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: getMenuKeyboard(),
    });
  } else {
    await cleanReply(ctx, message, {
      parse_mode: 'HTML',
      reply_markup: getMenuKeyboard(),
    });
  }
}

/**
 * Handle /help command - Show help
 */
async function handleHelp(ctx) {
  if (ctx.callbackQuery) {
    await safeAnswerCallback(ctx);
  }
  
  const message = `❓ <b>Допомога</b>

<b>Команди бота:</b>

/start - Запустити бота та налаштувати регіон
/schedule - Показати графік відключень
/timer - Таймер до наступного відключення
/stats - Моя статистика
/settings - Налаштування
/channel - Керування каналом
/help - Ця довідка

<b>Про бота:</b>
Вольтик допомагає відстежувати графіки відключень електроенергії в Україні. Ви можете налаштувати регіон та чергу, щоб отримувати актуальну інформацію.

<b>Підтримка:</b>
Якщо виникли проблеми, напишіть адміністратору.`;
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: getMenuKeyboard(),
    });
  } else {
    await cleanReply(ctx, message, {
      parse_mode: 'HTML',
      reply_markup: getMenuKeyboard(),
    });
  }
}

module.exports = {
  handleSchedule,
  handleTimer,
  handleMenu,
  handleStats,
  handleHelp,
};
