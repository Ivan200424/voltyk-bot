const { cleanReply, cleanEdit } = require('./chatCleaner');

async function safeSendMessage(bot, chatId, text, options = {}) {
  try {
    return await bot.api.sendMessage(chatId, text, options);
  } catch (error) {
    console.error(`Error sending message to ${chatId}:`, error.message);
    return null;
  }
}

async function safeEditMessage(ctx, text, options = {}) {
  try {
    const result = await ctx.editMessageText(text, options);
    
    // Track this message as the last bot message
    if (ctx.callbackQuery && ctx.callbackQuery.message && ctx.from) {
      const { saveLastBotMessageId } = require('./chatCleaner');
      await saveLastBotMessageId(ctx.from.id, ctx.callbackQuery.message.message_id);
    }
    
    return result;
  } catch (error) {
    console.error(`Error editing message:`, error.message);
    return null;
  }
}

async function safeDeleteMessage(ctx) {
  try {
    return await ctx.deleteMessage();
  } catch (error) {
    console.error(`Error deleting message:`, error.message);
    return null;
  }
}

async function safeSendPhoto(bot, chatId, photo, options = {}) {
  try {
    return await bot.api.sendPhoto(chatId, photo, options);
  } catch (error) {
    console.error(`Error sending photo to ${chatId}:`, error.message);
    return null;
  }
}

async function safeAnswerCallback(ctx, text = '', options = {}) {
  try {
    return await ctx.answerCallbackQuery({ text, ...options });
  } catch (error) {
    console.error(`Error answering callback:`, error.message);
    return null;
  }
}

async function safeCleanReply(ctx, text, options = {}) {
  try {
    return await cleanReply(ctx, text, options);
  } catch (error) {
    console.error(`Error in safeCleanReply:`, error.message);
    return null;
  }
}

async function safeCleanEdit(ctx, text, options = {}) {
  try {
    return await cleanEdit(ctx, text, options);
  } catch (error) {
    console.error(`Error in safeCleanEdit:`, error.message);
    return null;
  }
}

module.exports = {
  safeSendMessage,
  safeEditMessage,
  safeDeleteMessage,
  safeSendPhoto,
  safeAnswerCallback,
  safeCleanReply,
  safeCleanEdit,
};
