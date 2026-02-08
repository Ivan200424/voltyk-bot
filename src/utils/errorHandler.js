/**
 * Safe error handling wrappers for sending Telegram messages
 */

const ERROR_MESSAGES = {
  general: '😅 Щось пішло не так.\n\nЯкщо бачите, що щось не працює —\nнапишіть нам, будь ласка!',
  forbidden: '❌ Не можу надіслати повідомлення. Можливо, ви заблокували бота?',
  chatNotFound: '❌ Чат не знайдено. Можливо, канал було видалено?',
  messageNotModified: null, // Silently ignore
  messageTooLong: '❌ Повідомлення занадто довге для відправки.',
};

/**
 * Safe send message with error handling
 */
export async function safeSendMessage(ctx, text, options = {}) {
  try {
    return await ctx.reply(text, options);
  } catch (error) {
    return handleSendError(ctx, error, 'send');
  }
}

/**
 * Safe edit message with error handling
 */
export async function safeEditMessage(ctx, text, options = {}) {
  try {
    return await ctx.editMessageText(text, options);
  } catch (error) {
    return handleSendError(ctx, error, 'edit');
  }
}

/**
 * Safe delete message with error handling
 */
export async function safeDeleteMessage(ctx, chatId, messageId) {
  try {
    if (chatId && messageId) {
      await ctx.api.deleteMessage(chatId, messageId);
    } else if (ctx.message) {
      await ctx.deleteMessage();
    } else if (ctx.callbackQuery?.message) {
      await ctx.deleteMessage();
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to delete message:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Safe answer callback query
 */
export async function safeAnswerCallback(ctx, options = {}) {
  try {
    await ctx.answerCallbackQuery(options);
    return { success: true };
  } catch (error) {
    console.error('Failed to answer callback:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle send/edit errors
 */
function handleSendError(ctx, error, operation) {
  const errorCode = error.error_code;
  const description = error.description || '';
  
  console.error(`Failed to ${operation} message:`, error.message);
  
  // Message not modified - silently ignore
  if (description.includes('message is not modified')) {
    return { success: false, ignored: true };
  }
  
  // Try to send error message to user (if possible)
  if (errorCode === 403) {
    console.error('Bot blocked by user');
    return { success: false, error: 'forbidden' };
  }
  
  if (errorCode === 400 && description.includes('chat not found')) {
    console.error('Chat not found');
    return { success: false, error: 'chat_not_found' };
  }
  
  if (description.includes('message is too long')) {
    console.error('Message too long');
    return { success: false, error: 'message_too_long' };
  }
  
  return { success: false, error: 'unknown' };
}

/**
 * Wrap callback handler with error handling
 */
export function wrapCallback(handler) {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      console.error('Error in callback handler:', error);
      
      try {
        await ctx.answerCallbackQuery({
          text: ERROR_MESSAGES.general,
          show_alert: true,
        });
      } catch (answerError) {
        console.error('Failed to answer callback with error:', answerError);
      }
    }
  };
}

/**
 * Wrap command handler with error handling
 */
export function wrapCommand(handler) {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      console.error('Error in command handler:', error);
      
      try {
        await safeSendMessage(ctx, ERROR_MESSAGES.general);
      } catch (sendError) {
        console.error('Failed to send error message:', sendError);
      }
    }
  };
}

/**
 * Log error with context
 */
export function logError(context, error, additionalInfo = {}) {
  console.error(`[${context}] Error:`, error.message);
  if (Object.keys(additionalInfo).length > 0) {
    console.error('Additional info:', additionalInfo);
  }
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
}
