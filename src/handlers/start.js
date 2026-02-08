const { getUser, saveUser, updateUser } = require('../database/redis');
const { setState, getState, clearState } = require('../state/stateManager');
const { 
  getRegionKeyboard, 
  getQueueKeyboard,
  getQueueKeyboardExtra,
  getWizardNotifyTargetKeyboard,
  getChannelCheckKeyboard,
  getChannelConfirmKeyboard,
} = require('../keyboards/inline');
const { formatWelcomeMessage } = require('../formatter');
const { REGIONS } = require('../constants/regions');
const { safeEditMessage, safeAnswerCallback } = require('../utils/errorHandler');

/**
 * Handle /start command - Entry point for new and existing users
 */
async function handleStart(ctx) {
  const chatId = ctx.from.id;
  
  // Check if user exists
  const user = await getUser(chatId);
  
  if (user && user.region && user.queue) {
    // Existing user - show main menu
    const { formatMainMenu } = require('../formatter');
    const { getMainMenu } = require('../keyboards/inline');
    
    await ctx.reply(formatMainMenu(user), {
      parse_mode: 'HTML',
      reply_markup: getMainMenu(user),
    });
    return;
  }
  
  // New user or incomplete setup - start wizard
  await startWizard(ctx);
}

/**
 * Start the setup wizard
 */
async function startWizard(ctx) {
  const chatId = ctx.from.id;
  
  // Initialize wizard state
  await setState('wizard', chatId, {
    step: 1,
    startedAt: Date.now(),
  });
  
  // Send welcome message with region selection
  await ctx.reply(formatWelcomeMessage(), {
    parse_mode: 'HTML',
    reply_markup: getRegionKeyboard(),
  });
}

/**
 * Handle region selection in wizard
 */
async function handleWizardRegion(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const region = ctx.callbackQuery.data.replace('region_', '');
  
  // Validate region
  if (!REGIONS[region]) {
    await ctx.answerCallbackQuery({ text: '❌ Невірний регіон', show_alert: true });
    return;
  }
  
  // Check wizard state
  const wizardState = await getState('wizard', chatId);
  if (!wizardState) {
    // Wizard expired or not started - restart
    return await startWizard(ctx);
  }
  
  // Update wizard state
  await setState('wizard', chatId, {
    ...wizardState,
    step: 2,
    region,
  });
  
  // Show queue selection
  const message = `✅ Регіон обрано: <b>${REGIONS[region].name}</b>\n\n<b>Крок 2:</b> Оберіть вашу чергу відключень`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getQueueKeyboard(),
  });
}

/**
 * Handle queue selection in wizard
 */
async function handleWizardQueue(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const queue = ctx.callbackQuery.data.replace('queue_', '');
  
  // Get wizard state
  const wizardState = await getState('wizard', chatId);
  if (!wizardState || !wizardState.region) {
    return await startWizard(ctx);
  }
  
  // Update wizard state
  await setState('wizard', chatId, {
    ...wizardState,
    step: 3,
    queue,
  });
  
  // Check if user already exists (existing user changing settings)
  const existingUser = await getUser(chatId);
  
  if (existingUser) {
    // Existing user - just update region and queue
    await updateUser(chatId, {
      region: wizardState.region,
      queue,
    });
    
    await clearState('wizard', chatId);
    
    const { formatMainMenu } = require('../formatter');
    const { getMainMenu } = require('../keyboards/inline');
    
    await safeEditMessage(ctx, `✅ Налаштування оновлено!\n\n${formatMainMenu(existingUser)}`, {
      parse_mode: 'HTML',
      reply_markup: getMainMenu(existingUser),
    });
    return;
  }
  
  // New user - ask about notification target
  const message = `✅ Чергу обрано: <b>${queue}</b>\n\n<b>Крок 3:</b> Куди надсилати сповіщення?`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getWizardNotifyTargetKeyboard(),
  });
}

/**
 * Handle "Bot" notification target selection
 */
async function handleWizardNotifyBot(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const wizardState = await getState('wizard', chatId);
  
  if (!wizardState || !wizardState.region || !wizardState.queue) {
    return await startWizard(ctx);
  }
  
  // Create user with bot notifications
  await saveUser(chatId, {
    chatId,
    region: wizardState.region,
    queue: wizardState.queue,
    notifyTarget: 'bot',
    username: ctx.from.username || null,
    firstName: ctx.from.first_name || null,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  
  await clearState('wizard', chatId);
  
  const { formatMainMenu } = require('../formatter');
  const { getMainMenu } = require('../keyboards/inline');
  const user = await getUser(chatId);
  
  await safeEditMessage(ctx, `✅ <b>Налаштування завершено!</b>\n\n${formatMainMenu(user)}`, {
    parse_mode: 'HTML',
    reply_markup: getMainMenu(user),
  });
}

/**
 * Handle "Channel" notification target selection
 */
async function handleWizardNotifyChannel(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const wizardState = await getState('wizard', chatId);
  
  if (!wizardState || !wizardState.region || !wizardState.queue) {
    return await startWizard(ctx);
  }
  
  // Update wizard state
  await setState('wizard', chatId, {
    ...wizardState,
    step: 4,
    notifyTarget: 'channel',
  });
  
  // Set channel setup state
  await setState('pending_channel', chatId, {
    fromWizard: true,
  });
  
  const message = `📺 <b>Підключення каналу</b>

Щоб підключити канал:

1. Додайте бота <b>@${ctx.me.username}</b> до вашого каналу як адміністратора
2. Надайте боту права на публікацію повідомлень
3. Натисніть кнопку "Перевірити" нижче

⚠️ Важливо: бот повинен мати права адміністратора!`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getChannelCheckKeyboard(),
  });
}

/**
 * Handle channel check button
 */
async function handleChannelCheck(ctx) {
  await ctx.answerCallbackQuery({ text: '🔍 Перевіряємо канал...', show_alert: false });
  
  const chatId = ctx.from.id;
  const pendingChannel = await getState('pending_channel', chatId);
  
  if (!pendingChannel) {
    await ctx.answerCallbackQuery({
      text: '❌ Час очікування вичерпано. Розпочніть налаштування заново.',
      show_alert: true,
    });
    return;
  }
  
  // Check if channel was detected
  if (!pendingChannel.channelId) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Канал ще не виявлено. Переконайтеся, що ви додали бота як адміністратора.',
      show_alert: true,
    });
    return;
  }
  
  // Channel detected - ask for confirmation
  const message = `✅ <b>Канал знайдено!</b>

📺 Назва: ${pendingChannel.title || 'Без назви'}
🆔 ID: <code>${pendingChannel.channelId}</code>

Підключити цей канал?`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getChannelConfirmKeyboard(),
  });
}

/**
 * Handle channel confirmation
 */
async function handleChannelConfirm(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const wizardState = await getState('wizard', chatId);
  const pendingChannel = await getState('pending_channel', chatId);
  
  if (!wizardState || !pendingChannel || !pendingChannel.channelId) {
    await ctx.answerCallbackQuery({ text: '❌ Помилка: дані не знайдено', show_alert: true });
    return;
  }
  
  // Save user with channel
  const { saveChannel } = require('../database/redis');
  
  await saveUser(chatId, {
    chatId,
    region: wizardState.region,
    queue: wizardState.queue,
    notifyTarget: 'channel',
    channelId: pendingChannel.channelId,
    username: ctx.from.username || null,
    firstName: ctx.from.first_name || null,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  
  // Save channel data
  await saveChannel(pendingChannel.channelId, {
    channelId: pendingChannel.channelId,
    chatId,
    region: wizardState.region,
    queue: wizardState.queue,
    title: pendingChannel.title,
    username: pendingChannel.username,
    status: 'active',
    createdAt: Date.now(),
  });
  
  await clearState('wizard', chatId);
  await clearState('pending_channel', chatId);
  
  const { formatMainMenu } = require('../formatter');
  const { getMainMenu } = require('../keyboards/inline');
  const user = await getUser(chatId);
  
  await safeEditMessage(ctx, `✅ <b>Канал підключено!</b>\n\n${formatMainMenu(user)}`, {
    parse_mode: 'HTML',
    reply_markup: getMainMenu(user),
  });
}

/**
 * Handle channel rejection
 */
async function handleChannelReject(ctx) {
  await safeAnswerCallback(ctx);
  
  await clearState('pending_channel', ctx.from.id);
  
  await safeEditMessage(ctx, '❌ Підключення каналу скасовано.\n\nВи можете спробувати ще раз через Налаштування → Канал.', {
    parse_mode: 'HTML',
  });
}

/**
 * Handle wizard back button
 */
async function handleWizardBack(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const wizardState = await getState('wizard', chatId);
  
  if (!wizardState) {
    return await startWizard(ctx);
  }
  
  // Go back to previous step
  if (wizardState.step === 2) {
    // Go back to region selection
    await setState('wizard', chatId, {
      ...wizardState,
      step: 1,
      region: null,
    });
    
    await safeEditMessage(ctx, formatWelcomeMessage(), {
      parse_mode: 'HTML',
      reply_markup: getRegionKeyboard(),
    });
  } else if (wizardState.step === 3) {
    // Go back to queue selection
    await setState('wizard', chatId, {
      ...wizardState,
      step: 2,
      queue: null,
    });
    
    const message = `✅ Регіон обрано: <b>${REGIONS[wizardState.region].name}</b>\n\n<b>Крок 2:</b> Оберіть вашу чергу відключень`;
    
    await safeEditMessage(ctx, message, {
      parse_mode: 'HTML',
      reply_markup: getQueueKeyboard(),
    });
  }
}

/**
 * Handle my_chat_member event for automatic channel detection
 */
async function handleMyChatMember(ctx) {
  const chatId = ctx.from.id;
  const chat = ctx.myChatMember.chat;
  
  // Only handle channel additions
  if (chat.type !== 'channel') {
    return;
  }
  
  const newStatus = ctx.myChatMember.new_chat_member.status;
  
  // Bot was added as administrator
  if (newStatus === 'administrator') {
    const pendingChannel = await getState('pending_channel', chatId);
    
    if (pendingChannel) {
      // User is in channel setup flow
      await setState('pending_channel', chatId, {
        ...pendingChannel,
        channelId: chat.id,
        title: chat.title,
        username: chat.username || null,
      });
      
      console.log(`✅ Channel detected for user ${chatId}: ${chat.title} (${chat.id})`);
    }
  }
}

/**
 * Handle queue page extra (wizard second page)
 */
async function handleQueuePageExtra(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const wizardState = await getState('wizard', chatId);
  
  if (!wizardState || !wizardState.region) {
    return await startWizard(ctx);
  }
  
  const message = `✅ Регіон обрано: <b>${REGIONS[wizardState.region].name}</b>\n\n<b>Крок 2:</b> Оберіть вашу чергу відключень\n(Черги 7–60)`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getQueueKeyboardExtra(),
  });
}

/**
 * Handle queue page main (wizard return to first page)
 */
async function handleQueuePageMain(ctx) {
  await safeAnswerCallback(ctx);
  
  const chatId = ctx.from.id;
  const wizardState = await getState('wizard', chatId);
  
  if (!wizardState || !wizardState.region) {
    return await startWizard(ctx);
  }
  
  const message = `✅ Регіон обрано: <b>${REGIONS[wizardState.region].name}</b>\n\n<b>Крок 2:</b> Оберіть вашу чергу відключень`;
  
  await safeEditMessage(ctx, message, {
    parse_mode: 'HTML',
    reply_markup: getQueueKeyboard(),
  });
}

module.exports = {
  handleStart,
  handleWizardRegion,
  handleWizardQueue,
  handleWizardNotifyBot,
  handleWizardNotifyChannel,
  handleChannelCheck,
  handleChannelConfirm,
  handleChannelReject,
  handleWizardBack,
  handleMyChatMember,
  handleQueuePageExtra,
  handleQueuePageMain,
};
