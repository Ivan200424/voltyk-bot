import { 
  getUserData, 
  setUserData, 
  getChannelSetupState, 
  setChannelSetupState, 
  delChannelSetupState,
  getAllUserIds,
} from '../storage/index.js';
import {
  applyChannelBranding,
  verifyChannelPermissions,
  isChannelOccupied,
  sendChannelWelcomeMessage,
} from '../services/channel.js';
import { 
  channelSetupDescriptionKeyboard,
  backMenuKeyboard,
} from '../keyboards/inline.js';
import { showMainMenu } from './menu.js';

/**
 * Start channel setup wizard
 */
export async function handleChannelSetup(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);

  // Check if user has completed the initial wizard
  if (!userData.wizardCompleted) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Спочатку завершіть початкове налаштування',
      show_alert: true,
    });
    return;
  }

  // Check if user has region and queue
  if (!userData.region || !userData.queue) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Спочатку налаштуйте регіон та чергу',
      show_alert: true,
    });
    return;
  }

  // Check if channel is currently blocked
  if (userData.channel_status === 'blocked') {
    const text = `⚠️ <b>Попередження</b>

Ваш канал було заблоковано через порушення правил використання (зміна назви/опису/фото).

Ви можете підключити його заново, але дотримуйтесь правил:
❌ Не змінюйте назву каналу
❌ Не змінюйте опис каналу  
❌ Не змінюйте фото каналу

Продовжити налаштування?`;

    await ctx.cleanAndEdit(text, {
      parse_mode: 'HTML',
      reply_markup: backMenuKeyboard(),
    });
    
    await ctx.answerCallbackQuery();
    return;
  }

  // Start channel setup
  await setChannelSetupState(userId, { step: 'waiting_channel' });

  const text = `📺 <b>Підключення каналу</b>

Щоб підключити канал:

1. Додайте бота до вашого каналу як адміністратора
2. Надайте боту права:
   • Публікувати повідомлення
   • Змінювати інформацію про канал
3. Надішліть @username вашого каналу або перешліть будь-яке повідомлення з каналу

<i>Приклад: @my_channel</i>`;

  if (ctx.callbackQuery) {
    await ctx.cleanAndEdit(text, {
      parse_mode: 'HTML',
      reply_markup: backMenuKeyboard(),
    });
    await ctx.answerCallbackQuery();
  } else {
    await ctx.cleanAndSend(text, {
      parse_mode: 'HTML',
      reply_markup: backMenuKeyboard(),
    });
  }
}

/**
 * Handle channel input (username or forwarded message)
 */
export async function handleChannelInput(ctx, bot) {
  const userId = ctx.from.id;
  const setupState = await getChannelSetupState(userId);

  if (!setupState || setupState.step !== 'waiting_channel') {
    return false; // Not in channel setup
  }

  let channelId = null;
  let channelUsername = null;

  // Check if message is forwarded from a channel
  if (ctx.message.forward_origin?.type === 'channel') {
    channelId = ctx.message.forward_origin.chat.id;
    channelUsername = ctx.message.forward_origin.chat.username;
  } 
  // Check if message contains channel username
  else if (ctx.message.text) {
    const text = ctx.message.text.trim();
    
    // Extract username (with or without @)
    const match = text.match(/^@?([a-zA-Z0-9_]{5,})$/);
    if (match) {
      channelUsername = match[1];
      
      // Try to get channel info
      try {
        const chat = await bot.api.getChat(`@${channelUsername}`);
        if (chat.type === 'channel') {
          channelId = chat.id;
        } else {
          await ctx.reply('❌ Це не канал. Надішліть @username каналу.', {
            parse_mode: 'HTML',
          });
          return true;
        }
      } catch (error) {
        await ctx.reply('❌ Канал не знайдено. Перевірте правильність @username.', {
          parse_mode: 'HTML',
        });
        return true;
      }
    } else {
      await ctx.reply('❌ Невірний формат. Надішліть @username каналу або перешліть повідомлення з каналу.', {
        parse_mode: 'HTML',
      });
      return true;
    }
  }

  if (!channelId) {
    await ctx.reply('❌ Не вдалося отримати інформацію про канал.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  // Verify bot permissions
  const permCheck = await verifyChannelPermissions(bot, channelId);
  if (!permCheck.valid) {
    await ctx.reply(`❌ ${permCheck.error}

Переконайтеся, що:
• Бот доданий до каналу як адміністратор
• Бот має права на публікацію повідомлень
• Бот має права на зміну інформації про канал`, {
      parse_mode: 'HTML',
    });
    return true;
  }

  // Check if channel is occupied by another user
  const allUserIds = await getAllUserIds();
  const occupiedCheck = await isChannelOccupied(channelId, userId, allUserIds, getUserData);
  
  if (occupiedCheck.occupied) {
    await ctx.reply('❌ Цей канал вже підключено до іншого користувача.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  // Store channel info and move to next step
  await setChannelSetupState(userId, {
    step: 'waiting_channel_name',
    channelId: channelId.toString(),
    channelUsername: channelUsername || null,
  });

  const text = `✅ Канал підтверджено!

📝 <b>Введіть назву для каналу</b>

Ви вводите тільки вашу частину, префікс "Вольтик ⚡️ " додасться автоматично.

<i>Приклад: якщо ви введете "Київ Черга 3.1", 
назва каналу стане "Вольтик ⚡️ Київ Черга 3.1"</i>`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
  });

  return true;
}

/**
 * Handle channel name input
 */
export async function handleChannelNameInput(ctx) {
  const userId = ctx.from.id;
  const setupState = await getChannelSetupState(userId);

  if (!setupState || setupState.step !== 'waiting_channel_name') {
    return false;
  }

  const userTitle = ctx.message.text.trim();

  if (!userTitle || userTitle.length < 1) {
    await ctx.reply('❌ Назва не може бути порожньою. Спробуйте ще раз.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  if (userTitle.length > 200) {
    await ctx.reply('❌ Назва занадто довга (максимум 200 символів). Спробуйте ще раз.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  // Update state
  setupState.step = 'waiting_description_choice';
  setupState.userTitle = userTitle;
  await setChannelSetupState(userId, setupState);

  const text = `✅ Назва збережена!

Повна назва каналу: <b>Вольтик ⚡️ ${userTitle}</b>

📝 <b>Бажаєте додати опис каналу?</b>

Опис буде показаний під назвою каналу.
Обов'язкова частина з інформацією про Вольтик додасться автоматично.`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: channelSetupDescriptionKeyboard(),
  });

  return true;
}

/**
 * Handle "add description" button
 */
export async function handleChannelAddDescription(ctx) {
  const userId = ctx.from.id;
  const setupState = await getChannelSetupState(userId);

  if (!setupState || setupState.step !== 'waiting_description_choice') {
    await ctx.answerCallbackQuery({
      text: '⚠️ Сесія завершилася. Почніть заново.',
    });
    return;
  }

  setupState.step = 'waiting_channel_description';
  await setChannelSetupState(userId, setupState);

  const text = `📝 <b>Введіть опис каналу</b>

Ваш опис буде показаний на початку.
В кінці автоматично додасться інформація про Вольтик.

<i>Приклад: "ЖК Сонячний, під'їзд 2"</i>`;

  await ctx.cleanAndEdit(text, {
    parse_mode: 'HTML',
  });

  await ctx.answerCallbackQuery();
}

/**
 * Handle "skip description" button
 */
export async function handleChannelSkipDescription(ctx, bot) {
  const userId = ctx.from.id;
  const setupState = await getChannelSetupState(userId);

  if (!setupState || setupState.step !== 'waiting_description_choice') {
    await ctx.answerCallbackQuery({
      text: '⚠️ Сесія завершилася. Почніть заново.',
    });
    return;
  }

  await ctx.answerCallbackQuery({
    text: '⏳ Застосовуємо налаштування...',
  });

  // Apply branding without user description
  await finishChannelSetup(ctx, bot, setupState, null);
}

/**
 * Handle channel description input
 */
export async function handleChannelDescriptionInput(ctx, bot) {
  const userId = ctx.from.id;
  const setupState = await getChannelSetupState(userId);

  if (!setupState || setupState.step !== 'waiting_channel_description') {
    return false;
  }

  const userDescription = ctx.message.text.trim();

  if (!userDescription || userDescription.length < 1) {
    await ctx.reply('❌ Опис не може бути порожнім. Спробуйте ще раз або поверніться та пропустіть цей крок.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  if (userDescription.length > 200) {
    await ctx.reply('❌ Опис занадто довгий (максимум 200 символів). Спробуйте ще раз.', {
      parse_mode: 'HTML',
    });
    return true;
  }

  // Finish setup with user description
  await finishChannelSetup(ctx, bot, setupState, userDescription);
  return true;
}

/**
 * Finish channel setup - apply branding and save
 */
async function finishChannelSetup(ctx, bot, setupState, userDescription) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);

  const statusMessage = await ctx.reply('⏳ Застосовуємо налаштування...', {
    parse_mode: 'HTML',
  });

  try {
    // Apply branding
    const results = await applyChannelBranding(
      bot,
      setupState.channelId,
      setupState.userTitle,
      userDescription
    );

    // Check critical operations (title and description)
    if (!results.title.success) {
      await bot.api.editMessageText(
        userId,
        statusMessage.message_id,
        `❌ Не вдалося встановити назву каналу: ${results.title.error}

Перевірте права бота та спробуйте ще раз.`,
        { parse_mode: 'HTML' }
      );
      await delChannelSetupState(userId);
      return;
    }

    if (!results.description.success) {
      await bot.api.editMessageText(
        userId,
        statusMessage.message_id,
        `❌ Не вдалося встановити опис каналу: ${results.description.error}

Перевірте права бота та спробуйте ще раз.`,
        { parse_mode: 'HTML' }
      );
      await delChannelSetupState(userId);
      return;
    }

    // Photo is non-critical
    const photoWarning = !results.photo.success 
      ? `\n\n⚠️ Фото каналу не встановлено: ${results.photo.error}`
      : '';

    // Save to storage
    const fullTitle = 'Вольтик ⚡️ ' + setupState.userTitle;
    const botUsername = bot.botInfo.username;
    const botLink = `🤖 @${botUsername}`;
    const fullDescription = userDescription 
      ? `${userDescription}\n\n⚡️ Вольтик — слідкує, щоб ти не слідкував\n${botLink}`
      : `⚡️ Вольтик — слідкує, щоб ти не слідкував\n${botLink}`;

    userData.channel_id = setupState.channelId;
    userData.channel_title = fullTitle;
    userData.channel_description = fullDescription;
    userData.channel_photo_file_id = results.photo.fileId;
    userData.channel_user_title = setupState.userTitle;
    userData.channel_user_description = userDescription;
    userData.channel_status = 'active';
    userData.channel_branding_updated_at = Date.now();
    
    // Also update old fields for backward compatibility
    userData.channelId = setupState.channelId;
    userData.channelName = setupState.channelUsername;
    
    await setUserData(userId, userData);

    // Send welcome message to channel
    await sendChannelWelcomeMessage(
      bot,
      setupState.channelId,
      userData.queue,
      !!userData.ipAddress
    );

    // Delete setup state
    await delChannelSetupState(userId);

    // Success message
    const channelLink = setupState.channelUsername 
      ? `@${setupState.channelUsername}`
      : 'ваш канал';

    const successText = `✅ <b>Канал успішно налаштовано!</b>

📺 Канал: ${channelLink}
📝 Назва: ${fullTitle}

⚠️ <b>УВАГА: Не змінюйте назву, опис або фото каналу!</b>
Якщо ви їх зміните — бот перестане працювати і
потрібно буде налаштовувати канал заново.${photoWarning}`;

    await bot.api.editMessageText(
      userId,
      statusMessage.message_id,
      successText,
      { parse_mode: 'HTML' }
    );

    // Show main menu after a delay
    setTimeout(async () => {
      await showMainMenu(ctx);
    }, 2000);

  } catch (error) {
    console.error('Error finishing channel setup:', error);
    await bot.api.editMessageText(
      userId,
      statusMessage.message_id,
      `❌ Помилка при налаштуванні каналу: ${error.message}`,
      { parse_mode: 'HTML' }
    );
    await delChannelSetupState(userId);
  }
}

/**
 * Handle /cancel command during channel setup
 */
export async function handleChannelSetupCancel(ctx) {
  const userId = ctx.from.id;
  const setupState = await getChannelSetupState(userId);

  if (!setupState) {
    return false; // Not in channel setup
  }

  await delChannelSetupState(userId);
  
  await ctx.reply('❌ Налаштування каналу скасовано.', {
    parse_mode: 'HTML',
  });
  
  await showMainMenu(ctx);
  return true;
}

/**
 * Show channel info/settings
 */
export async function handleChannelInfo(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);

  if (!userData.channel_id || userData.channel_status !== 'active') {
    await ctx.answerCallbackQuery({
      text: '📺 У вас немає підключеного каналу',
    });
    return await handleChannelSetup(ctx);
  }

  const channelLink = userData.channelName ? `@${userData.channelName}` : userData.channel_id;
  
  const text = `📺 <b>Інформація про канал</b>

Канал: ${channelLink}
Назва: ${userData.channel_title}
Статус: ✅ Активний

<i>Графіки публікуються автоматично при змінах</i>`;

  await ctx.cleanAndEdit(text, {
    parse_mode: 'HTML',
    reply_markup: backMenuKeyboard(),
  });

  await ctx.answerCallbackQuery();
}

/**
 * Disconnect channel
 */
export async function handleChannelDisconnect(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);

  // Reset all channel fields
  userData.channel_id = null;
  userData.channel_title = null;
  userData.channel_description = null;
  userData.channel_photo_file_id = null;
  userData.channel_user_title = null;
  userData.channel_user_description = null;
  userData.channel_status = null;
  userData.channel_branding_updated_at = null;
  userData.channelId = null;
  userData.channelName = null;

  await setUserData(userId, userData);

  await ctx.answerCallbackQuery({
    text: '✅ Канал відключено',
  });

  await showMainMenu(ctx);
}
