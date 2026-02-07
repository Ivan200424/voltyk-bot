import { helpKeyboard } from '../keyboards/inline.js';

export async function handleHelp(ctx) {
  const text = `❓ Допомога

Якщо у Вас виникли труднощі з ботом
або є ідеї для покращення — ми будемо раді зворотному зв'язку.`;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    return await ctx.cleanAndEdit(text, {
      reply_markup: helpKeyboard(),
    });
  } else {
    return await ctx.cleanAndSend(text, {
      reply_markup: helpKeyboard(),
    });
  }
}
