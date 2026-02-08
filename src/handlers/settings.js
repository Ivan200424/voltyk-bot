import { getUserData, setUserData, delUserData } from '../storage/index.js';
import { 
  settingsKeyboard, 
  regionKeyboard, 
  queueKeyboard, 
  channelSettingsKeyboard,
  notifyTargetKeyboard,
  alertToggleKeyboard,
  deleteDataConfirmKeyboard,
  deleteDataFinalKeyboard,
  backMenuKeyboard,
} from '../keyboards/inline.js';
import { showMainMenu } from './menu.js';
import { setWizardState } from '../state/stateManager.js';
import { isAdmin } from '../utils.js';
import { REGION_CODE_TO_NAME } from '../constants/regions.js';

export async function handleSettings(ctx) {
  const userId = ctx.from.id;
  const text = `⚙️ Налаштування`;
  const keyboard = settingsKeyboard(isAdmin(userId));

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    return await ctx.cleanAndEdit(text, {
      reply_markup: keyboard,
    });
  } else {
    return await ctx.cleanAndSend(text, {
      reply_markup: keyboard,
    });
  }
}

export async function handleSettingsRegion(ctx) {
  await ctx.answerCallbackQuery();
  
  // Set wizard state to track region/queue change from settings
  await setWizardState(ctx.from.id, { step: 1, mode: 'settings' });
  
  const text = `📍 Оберіть новий регіон:`;
  
  return await ctx.cleanAndEdit(text, {
    reply_markup: regionKeyboard(),
  });
}

export async function handleSettingsChannel(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);

  await ctx.answerCallbackQuery();

  // Show different UI based on whether channel is connected
  if (userData.channel_id && userData.channel_status === 'active') {
    const channelLink = userData.channel_name ? `@${userData.channel_name}` : userData.channel_id;
    
    const text = `📺 <b>Налаштування каналу</b>

Канал: ${channelLink}
Статус: ✅ Активний

Оберіть дію:`;

    return await ctx.cleanAndEdit(text, {
      parse_mode: 'HTML',
      reply_markup: channelSettingsKeyboard(userData),
    });
  } else {
    // No channel connected or blocked
    const text = `📺 <b>Налаштування каналу</b>

У вас немає підключеного активного каналу.

Оберіть дію:`;

    return await ctx.cleanAndEdit(text, {
      parse_mode: 'HTML',
      reply_markup: channelSettingsKeyboard(userData),
    });
  }
}

export async function handleSettingsIp(ctx) {
  await ctx.answerCallbackQuery({
    text: '📡 IP моніторинг буде доступний в наступному оновленні',
    show_alert: true,
  });
}

export async function handleSettingsAlerts(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  await ctx.answerCallbackQuery();
  
  const status = userData.notifications_enabled ? 'увімкнено ✅' : 'вимкнено ❌';
  const text = `🔔 <b>Налаштування сповіщень</b>

Поточний стан: ${status}

Натисніть кнопку нижче, щоб змінити:`;
  
  return await ctx.cleanAndEdit(text, {
    parse_mode: 'HTML',
    reply_markup: alertToggleKeyboard(userData.notifications_enabled),
  });
}

export async function handleAlertToggle(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  userData.notifications_enabled = !userData.notifications_enabled;
  await setUserData(userId, userData);
  ctx.userData = userData;
  
  const status = userData.notifications_enabled ? 'увімкнено ✅' : 'вимкнено ❌';
  
  await ctx.answerCallbackQuery({
    text: `🔔 Сповіщення ${status}`,
  });
  
  return await handleSettingsAlerts(ctx);
}

export async function handleNotifyTargetBot(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  userData.power_notify_target = 'bot';
  await setUserData(userId, userData);
  ctx.userData = userData;
  
  await ctx.answerCallbackQuery({
    text: '✅ Сповіщення будуть надходити у бот',
  });
  
  return await handleSettings(ctx);
}

export async function handleNotifyTargetChannel(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  if (!userData.channel_id || userData.channel_status !== 'active') {
    await ctx.answerCallbackQuery({
      text: '⚠️ Спочатку підключіть канал',
      show_alert: true,
    });
    return;
  }
  
  userData.power_notify_target = 'channel';
  await setUserData(userId, userData);
  ctx.userData = userData;
  
  await ctx.answerCallbackQuery({
    text: '✅ Сповіщення будуть надходити у канал',
  });
  
  return await handleSettings(ctx);
}

export async function handleNotifyTargetBoth(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  if (!userData.channel_id || userData.channel_status !== 'active') {
    await ctx.answerCallbackQuery({
      text: '⚠️ Спочатку підключіть канал',
      show_alert: true,
    });
    return;
  }
  
  userData.power_notify_target = 'both';
  await setUserData(userId, userData);
  ctx.userData = userData;
  
  await ctx.answerCallbackQuery({
    text: '✅ Сповіщення будуть надходити у бот і канал',
  });
  
  return await handleSettings(ctx);
}

export async function handleConfirmDeleteData(ctx) {
  await ctx.answerCallbackQuery();
  
  const text = `⚠️ <b>Видалення даних</b>

Ви впевнені, що хочете видалити всі свої дані?

Це видалить:
• Налаштування регіону та черги
• Підключені канали
• IP моніторинг
• Всю статистику

<b>Цю дію не можна скасувати!</b>`;
  
  return await ctx.cleanAndEdit(text, {
    parse_mode: 'HTML',
    reply_markup: deleteDataConfirmKeyboard(),
  });
}

export async function handleDeleteDataStep2(ctx) {
  await ctx.answerCallbackQuery();
  
  const text = `🚨 <b>ОСТАННЯ ПОПЕРЕДЖЕННЯ</b>

Ви дійсно хочете видалити ВСІ свої дані?

Після видалення вам доведеться:
• Заново пройти налаштування
• Підключити канал (якщо потрібно)
• Налаштувати IP моніторинг (якщо потрібно)

<b>Це остаточне видалення!</b>`;
  
  return await ctx.cleanAndEdit(text, {
    parse_mode: 'HTML',
    reply_markup: deleteDataFinalKeyboard(),
  });
}

export async function handleConfirmDeactivate(ctx) {
  const userId = ctx.from.id;
  
  // Delete all user data
  await delUserData(userId);
  
  await ctx.answerCallbackQuery({
    text: '✅ Всі дані видалено',
  });
  
  const text = `✅ Ваші дані успішно видалено.

Натисніть /start, щоб почати заново.`;
  
  return await ctx.cleanAndEdit(text, {
    reply_markup: null,
  });
}

export async function handleBackToSettings(ctx) {
  await ctx.answerCallbackQuery();
  return await handleSettings(ctx);
}

export async function handleBackToMain(ctx) {
  await ctx.answerCallbackQuery();
  return await showMainMenu(ctx);
}

// Handle region change from settings
export async function handleRegionChangeFromSettings(ctx) {
  const userId = ctx.from.id;
  const regionCode = ctx.callbackQuery.data.replace('region_', '');
  const regionName = REGION_CODE_TO_NAME[regionCode] || regionCode;
  
  const userData = await getUserData(userId);
  userData.region = regionName;
  await setUserData(userId, userData);
  ctx.userData = userData;
  
  await ctx.answerCallbackQuery({
    text: `📍 Регіон змінено на ${regionName}`,
  });
  
  // Після вибору регіону → показати вибір черги
  await setWizardState(userId, { step: 2, mode: 'settings', region: regionName });
  
  const text = `🔢 Оберіть нову чергу:`;
  
  return await ctx.cleanAndEdit(text, {
    reply_markup: queueKeyboard(),
  });
}

// Handle queue change from settings
export async function handleQueueChangeFromSettings(ctx) {
  const userId = ctx.from.id;
  const queue = ctx.callbackQuery.data.replace('queue_', '');
  
  const userData = await getUserData(userId);
  userData.queue = queue;
  await setUserData(userId, userData);
  ctx.userData = userData;
  
  await ctx.answerCallbackQuery({
    text: `🔢 Черга змінена на ${queue}`,
  });
  
  return await showMainMenu(ctx);
}

// Legacy handlers for backward compatibility
export const handleChangeRegion = handleSettingsRegion;
export const handleToggleNotifications = handleAlertToggle;
export const handleChannelSettings = handleSettingsChannel;
export const handleBack = handleBackToMain;
