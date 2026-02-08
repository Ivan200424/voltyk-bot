import { getUserData, setUserData } from '../storage/index.js';
import { settingsKeyboard, regionKeyboard, queueKeyboard } from '../keyboards/inline.js';
import { showMainMenu } from './menu.js';

export async function handleSettings(ctx) {
  const text = `⚙️ Налаштування`;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    return await ctx.cleanAndEdit(text, {
      reply_markup: settingsKeyboard(),
    });
  } else {
    return await ctx.cleanAndSend(text, {
      reply_markup: settingsKeyboard(),
    });
  }
}

export async function handleChangeRegion(ctx) {
  await ctx.answerCallbackQuery();
  
  const text = `📍 Оберіть новий регіон:`;
  
  return await ctx.cleanAndEdit(text, {
    reply_markup: regionKeyboard(),
  });
}

export async function handleChangeQueue(ctx) {
  await ctx.answerCallbackQuery();
  
  const text = `🔢 Оберіть нову чергу:`;
  
  return await ctx.cleanAndEdit(text, {
    reply_markup: queueKeyboard(),
  });
}

export async function handleToggleNotifications(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  userData.notificationsEnabled = !userData.notificationsEnabled;
  await setUserData(userId, userData);
  
  const status = userData.notificationsEnabled ? 'увімкнено' : 'вимкнено';
  
  await ctx.answerCallbackQuery({
    text: `🔔 Сповіщення ${status}`,
  });
  
  return await handleSettings(ctx);
}

export async function handleBack(ctx) {
  await ctx.answerCallbackQuery();
  
  // For now, back goes to main menu
  // In future blocks, this might need more context-aware logic
  return await showMainMenu(ctx);
}

// Handle region change from settings
export async function handleRegionChangeFromSettings(ctx) {
  const userId = ctx.from.id;
  const region = ctx.callbackQuery.data.replace('region:', '');
  
  const userData = await getUserData(userId);
  userData.region = region;
  await setUserData(userId, userData);
  
  await ctx.answerCallbackQuery({
    text: `📍 Регіон змінено на ${region}`,
  });
  
  // Після вибору регіону → показати вибір черги
  const text = `🔢 Оберіть нову чергу:`;
  
  return await ctx.cleanAndEdit(text, {
    reply_markup: queueKeyboard(),
  });
}

// Handle queue change from settings
export async function handleQueueChangeFromSettings(ctx) {
  const userId = ctx.from.id;
  const queue = ctx.callbackQuery.data.replace('queue:', '');
  
  const userData = await getUserData(userId);
  userData.queue = queue;
  await setUserData(userId, userData);
  
  await ctx.answerCallbackQuery({
    text: `🔢 Черга змінена на ${queue}`,
  });
  
  return await showMainMenu(ctx);
}
