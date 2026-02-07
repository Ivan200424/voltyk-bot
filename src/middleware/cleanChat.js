import { getUserData, setUserData } from '../storage/index.js';

export async function cleanChatMiddleware(ctx, next) {
  // Store user info for easy access
  const userId = ctx.from?.id;
  
  if (!userId) {
    return await next();
  }
  
  // Get user data
  const userData = await getUserData(userId);
  
  // Attach helper function to context
  ctx.userData = userData;
  ctx.cleanAndSend = async (text, options = {}) => {
    // Delete previous bot message if exists
    if (userData.lastBotMessageId) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, userData.lastBotMessageId);
      } catch (error) {
        // Message might be already deleted or too old
        console.log('Could not delete message:', error.message);
      }
    }
    
    // Send new message
    const sentMessage = await ctx.reply(text, options);
    
    // Save new message ID
    userData.lastBotMessageId = sentMessage.message_id;
    await setUserData(userId, userData);
    
    return sentMessage;
  };
  
  ctx.cleanAndEdit = async (text, options = {}) => {
    // For callback queries, try to edit the message
    if (ctx.callbackQuery?.message?.message_id) {
      try {
        const editedMessage = await ctx.editMessageText(text, options);
        // Update the lastBotMessageId
        userData.lastBotMessageId = ctx.callbackQuery.message.message_id;
        await setUserData(userId, userData);
        return editedMessage;
      } catch (error) {
        // If edit fails, fall back to delete and send
        console.log('Could not edit message, falling back to delete+send:', error.message);
        return await ctx.cleanAndSend(text, options);
      }
    } else {
      // No message to edit, just send
      return await ctx.cleanAndSend(text, options);
    }
  };
  
  await next();
}
