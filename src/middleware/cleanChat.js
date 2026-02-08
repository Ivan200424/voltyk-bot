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
    // Read FRESH data to get current lastBotMessageId
    const freshData = await getUserData(userId);
    
    // Delete previous bot message if exists
    if (freshData.lastBotMessageId) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, freshData.lastBotMessageId);
      } catch (error) {
        // Message might be already deleted or too old
        console.log('Could not delete message:', error.message);
      }
    }
    
    // Send new message
    const sentMessage = await ctx.reply(text, options);
    
    // Read fresh data AGAIN (in case handler saved between delete and send)
    const latestData = await getUserData(userId);
    latestData.lastBotMessageId = sentMessage.message_id;
    await setUserData(userId, latestData);
    
    // Update ctx.userData reference too
    ctx.userData = latestData;
    
    return sentMessage;
  };
  
  ctx.cleanAndEdit = async (text, options = {}) => {
    // For callback queries, try to edit the message
    if (ctx.callbackQuery?.message?.message_id) {
      try {
        const editedMessage = await ctx.editMessageText(text, options);
        
        // Read FRESH data before saving lastBotMessageId
        const freshData = await getUserData(userId);
        freshData.lastBotMessageId = ctx.callbackQuery.message.message_id;
        await setUserData(userId, freshData);
        
        // Update ctx.userData reference too
        ctx.userData = freshData;
        
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
