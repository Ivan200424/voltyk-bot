import { formatMainMenu } from '../utils/format.js';
import { mainMenuKeyboard } from '../keyboards/inline.js';
import { handleSchedule } from './schedule.js';
import { getUserData } from '../storage/index.js';

export async function showMainMenu(ctx) {
  // Always get fresh user data from storage
  const userData = await getUserData(ctx.from.id);
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

// Export schedule handler
export { handleSchedule };

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
