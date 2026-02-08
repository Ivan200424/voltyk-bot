import { getUserData, setUserData } from '../storage/index.js';
import { getWizardState, setWizardState, delWizardState } from '../state/stateManager.js';
import { regionKeyboard, queueKeyboard, wizardNotifyTargetKeyboard, channelCheckKeyboard, channelConfirmKeyboard } from '../keyboards/inline.js';
import { showMainMenu } from './menu.js';
import { REGION_CODE_TO_NAME } from '../constants/regions.js';

// Pending channels map: userId -> { channelId, channelTitle, channelName, timestamp }
const pendingChannels = new Map();

// 30 minutes TTL for pending channels (enough time for user to complete setup)
const PENDING_CHANNEL_TTL = 30 * 60 * 1000;

// Hourly cleanup of expired pending channels (prevents memory leaks)
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of pendingChannels.entries()) {
    if (now - data.timestamp > PENDING_CHANNEL_TTL) {
      pendingChannels.delete(userId);
    }
  }
}, 60 * 60 * 1000); // Run every hour

export async function handleStart(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  // Check if wizard is already completed
  if (userData.wizard_completed) {
    return await showMainMenu(ctx);
  }
  
  // Start wizard - Step 1: Region selection
  await setWizardState(userId, { step: 1, mode: 'new' });
  
  const text = `👋 Вітаємо у Вольтику!

Оберіть свій регіон:`;
  
  await ctx.cleanAndSend(text, {
    reply_markup: regionKeyboard(),
  });
}

export async function handleWizardRegion(ctx) {
  const userId = ctx.from.id;
  const regionCode = ctx.callbackQuery.data.replace('region_', '');
  const regionName = REGION_CODE_TO_NAME[regionCode] || regionCode;
  
  const userData = await getUserData(userId);
  userData.region = regionName;
  await setUserData(userId, userData);
  ctx.userData = userData;
  
  await setWizardState(userId, { step: 2, region: regionName, mode: 'new' });
  
  const text = `Оберіть свою чергу:`;
  
  await ctx.cleanAndEdit(text, {
    reply_markup: queueKeyboard(),
  });
  
  await ctx.answerCallbackQuery();
}

export async function handleWizardQueue(ctx) {
  const userId = ctx.from.id;
  const queue = ctx.callbackQuery.data.replace('queue_', '');
  
  const userData = await getUserData(userId);
  userData.queue = queue;
  await setUserData(userId, userData);
  ctx.userData = userData;
  
  const wizardState = await getWizardState(userId);
  
  // Step 3: Notification target (only for new users)
  if (wizardState?.mode === 'new') {
    await setWizardState(userId, { step: 3, region: userData.region, queue, mode: 'new' });
    
    const text = `Куди надсилати сповіщення про зміни графіка?`;
    
    await ctx.cleanAndEdit(text, {
      reply_markup: wizardNotifyTargetKeyboard(),
    });
  } else {
    // From settings - complete and return to main menu
    userData.wizard_completed = true;
    await setUserData(userId, userData);
    await delWizardState(userId);
    await ctx.answerCallbackQuery({ text: '✅ Регіон і черга оновлено' });
    return await showMainMenu(ctx);
  }
  
  await ctx.answerCallbackQuery();
}

export async function handleWizardNotifyBot(ctx) {
  const userId = ctx.from.id;
  
  // User chose bot notifications - complete wizard
  const userData = await getUserData(userId);
  userData.power_notify_target = 'bot';
  userData.wizard_completed = true;
  userData.notifications_enabled = true;
  await setUserData(userId, userData);
  ctx.userData = userData;
  
  await delWizardState(userId);
  await ctx.answerCallbackQuery({ text: '✅ Налаштування збережено!' });
  
  return await showMainMenu(ctx);
}

export async function handleWizardNotifyChannel(ctx) {
  const userId = ctx.from.id;
  
  // User chose channel - start channel setup flow (Steps 4-8)
  await setWizardState(userId, { step: 4, mode: 'channel_setup' });
  
  const text = `📺 <b>Крок 1/5: Додайте бота до каналу</b>

1️⃣ Додайте @voltyk_bot до адміністраторів вашого каналу
2️⃣ Надайте боту права на публікацію повідомлень

Після цього натисніть "Перевірити"`;
  
  await ctx.cleanAndEdit(text, {
    parse_mode: 'HTML',
    reply_markup: channelCheckKeyboard(),
  });
  
  await ctx.answerCallbackQuery();
}

export async function handleChannelCheck(ctx) {
  const userId = ctx.from.id;
  const wizardState = await getWizardState(userId);
  
  if (!wizardState || wizardState.step !== 4) {
    await ctx.answerCallbackQuery({ text: '⚠️ Невідома помилка' });
    return;
  }
  
  // Check if we have a pending channel for this user
  const pending = pendingChannels.get(userId);
  
  if (!pending) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Канал не знайдено. Переконайтеся, що ви додали бота до адміністраторів каналу.',
      show_alert: true,
    });
    return;
  }
  
  // Show confirmation
  await setWizardState(userId, { step: 5, channelData: pending, mode: 'channel_setup' });
  
  const channelName = pending.channelName ? `@${pending.channelName}` : pending.channelTitle;
  const text = `📺 <b>Крок 2/5: Підтвердження</b>

Знайдено канал: <b>${channelName}</b>

Це правильний канал?`;
  
  await ctx.cleanAndEdit(text, {
    parse_mode: 'HTML',
    reply_markup: channelConfirmKeyboard(),
  });
  
  await ctx.answerCallbackQuery();
}

export async function handleChannelConfirm(ctx) {
  const userId = ctx.from.id;
  const wizardState = await getWizardState(userId);
  
  if (!wizardState || wizardState.step !== 5) {
    await ctx.answerCallbackQuery({ text: '⚠️ Невідома помилка' });
    return;
  }
  
  const channelData = wizardState.channelData;
  
  // Save channel to user data
  const userData = await getUserData(userId);
  userData.channel_id = channelData.channelId;
  userData.channel_title = channelData.channelTitle;
  userData.channel_name = channelData.channelName;
  userData.channel_status = 'active';
  userData.power_notify_target = 'channel';
  userData.wizard_completed = true;
  userData.notifications_enabled = true;
  await setUserData(userId, userData);
  ctx.userData = userData;
  
  // Clear pending channel
  pendingChannels.delete(userId);
  
  // Complete wizard
  await delWizardState(userId);
  
  const text = `✅ Канал успішно підключено!

Тепер ви будете отримувати сповіщення про зміни графіка у вашому каналі.`;
  
  await ctx.cleanAndEdit(text, {
    reply_markup: null,
  });
  
  await ctx.answerCallbackQuery();
  
  // Show main menu after 2 seconds
  setTimeout(async () => {
    try {
      await showMainMenu(ctx);
    } catch (error) {
      console.error('Error showing main menu:', error);
    }
  }, 2000);
}

export async function handleChannelReject(ctx) {
  const userId = ctx.from.id;
  
  // Go back to step 4
  await setWizardState(userId, { step: 4, mode: 'channel_setup' });
  
  const text = `📺 <b>Крок 1/5: Додайте бота до каналу</b>

1️⃣ Додайте @voltyk_bot до адміністраторів вашого каналу
2️⃣ Надайте боту права на публікацію повідомлень

Після цього натисніть "Перевірити"`;
  
  await ctx.cleanAndEdit(text, {
    parse_mode: 'HTML',
    reply_markup: channelCheckKeyboard(),
  });
  
  await ctx.answerCallbackQuery();
}

// Handler for my_chat_member event (automatic channel detection)
export async function handleMyChatMember(ctx) {
  const update = ctx.myChatMember;
  const chat = update.chat;
  const newStatus = update.new_chat_member.status;
  const userId = update.from.id;
  
  // Check if bot was added as administrator to a channel
  if (chat.type === 'channel' && newStatus === 'administrator') {
    // Store pending channel
    pendingChannels.set(userId, {
      channelId: String(chat.id),
      channelTitle: chat.title,
      channelName: chat.username || null,
      timestamp: Date.now(),
    });
    
    console.log(`Pending channel added for user ${userId}: ${chat.title} (${chat.id})`);
  }
}

export async function handleWizardBack(ctx) {
  const userId = ctx.from.id;
  const wizardState = await getWizardState(userId);
  
  if (!wizardState) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Wizard state not found',
    });
    return;
  }
  
  const currentStep = wizardState.step;
  
  // Go back to previous step
  if (currentStep === 2) {
    // Step 2 (queue) -> back to Step 1 (region)
    await setWizardState(userId, { step: 1, mode: wizardState.mode });
    
    const text = `👋 Вітаємо у Вольтику!

Оберіть свій регіон:`;
    
    await ctx.cleanAndEdit(text, {
      reply_markup: regionKeyboard(),
    });
  } else if (currentStep === 3) {
    // Step 3 (notification) -> back to Step 2 (queue)
    const userData = await getUserData(userId);
    await setWizardState(userId, { step: 2, region: userData.region, mode: wizardState.mode });
    
    const text = `Оберіть свою чергу:`;
    
    await ctx.cleanAndEdit(text, {
      reply_markup: queueKeyboard(),
    });
  } else if (currentStep === 4) {
    // Step 4 (channel setup) -> back to Step 3 (notification)
    await setWizardState(userId, { step: 3, mode: 'new' });
    
    const text = `Куди надсилати сповіщення про зміни графіка?`;
    
    await ctx.cleanAndEdit(text, {
      reply_markup: wizardNotifyTargetKeyboard(),
    });
  }
  
  await ctx.answerCallbackQuery();
}
