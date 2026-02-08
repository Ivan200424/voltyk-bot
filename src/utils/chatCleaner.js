const { getState, setState } = require('../state/stateManager');

/**
 * Get the last bot message ID for a chat
 */
async function getLastBotMessageId(chatId) {
  const state = await getState('lastBotMessage', chatId);
  return state ? state.messageId : null;
}

/**
 * Save the last bot message ID for a chat
 */
async function saveLastBotMessageId(chatId, messageId) {
  await setState('lastBotMessage', chatId, { messageId });
}

/**
 * Delete the previous bot message from chat (safe, never throws)
 */
async function deletePreviousBotMessage(bot, chatId) {
  try {
    const lastMessageId = await getLastBotMessageId(chatId);
    if (lastMessageId) {
      await bot.api.deleteMessage(chatId, lastMessageId);
    }
  } catch (error) {
    // Message might already be deleted or too old - that's fine
    console.log(`Could not delete previous bot message for ${chatId}: ${error.message}`);
  }
}

/**
 * Send a reply and track the message ID, deleting the previous bot message first.
 * Use this instead of ctx.reply() in command handlers.
 */
async function cleanReply(ctx, text, options = {}) {
  const chatId = ctx.from.id;
  const bot = ctx.api;
  
  // Delete previous bot message
  await deletePreviousBotMessage({ api: bot }, chatId);
  
  // Send new message
  try {
    const sentMessage = await ctx.reply(text, options);
    
    // Save this message ID as the last bot message
    if (sentMessage && sentMessage.message_id) {
      await saveLastBotMessageId(chatId, sentMessage.message_id);
    }
    
    return sentMessage;
  } catch (error) {
    console.error(`Error sending clean reply to ${chatId}:`, error.message);
    return null;
  }
}

/**
 * Edit the current message AND update the tracked message ID.
 * Use this for callback query handlers that use editMessageText.
 */
async function cleanEdit(ctx, text, options = {}) {
  const chatId = ctx.from.id;
  
  try {
    const result = await ctx.editMessageText(text, options);
    
    // The edited message keeps the same message_id, so track it
    if (ctx.callbackQuery && ctx.callbackQuery.message) {
      await saveLastBotMessageId(chatId, ctx.callbackQuery.message.message_id);
    }
    
    return result;
  } catch (error) {
    console.error(`Error editing message for ${chatId}:`, error.message);
    // If edit fails (message deleted, etc.), fall back to clean reply
    return await cleanReply(ctx, text, options);
  }
}

module.exports = {
  getLastBotMessageId,
  saveLastBotMessageId,
  deletePreviousBotMessage,
  cleanReply,
  cleanEdit,
};
