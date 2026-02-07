import { formatMainMenu } from '../utils/format.js';
import { mainMenuKeyboard } from '../keyboards/inline.js';

export async function showMainMenu(ctx) {
  const userData = ctx.userData;
  const text = formatMainMenu(userData);
  
  if (ctx.callbackQuery) {
    return await ctx.cleanAndEdit(text, {
      reply_markup: mainMenuKeyboard(),
    });
  } else {
    return await ctx.cleanAndSend(text, {
      reply_markup: mainMenuKeyboard(),
    });
  }
}

export async function handleMenu(ctx) {
  await ctx.answerCallbackQuery();
  return await showMainMenu(ctx);
}

// Placeholder handlers for menu items
export async function handleSchedule(ctx) {
  await ctx.answerCallbackQuery({
    text: '📋 Функція буде доступна в наступному оновленні',
    show_alert: true,
  });
}

export async function handleMonitoring(ctx) {
  await ctx.answerCallbackQuery({
    text: '📡 Функція буде доступна в наступному оновленні',
    show_alert: true,
  });
}

export async function handleChannel(ctx) {
  await ctx.answerCallbackQuery({
    text: '📺 Функція буде доступна в наступному оновленні',
    show_alert: true,
  });
}
