import { fallbackKeyboard } from '../keyboards/inline.js';

export async function handleFallbackMessage(ctx) {
  const text = `🤔 Я не зовсім зрозумів це повідомлення.

ℹ️ Ви можете скористатися меню нижче
або перейти в допомогу, якщо виникли питання.

🏠 Оберіть дію:`;

  return await ctx.cleanAndSend(text, {
    reply_markup: fallbackKeyboard(),
  });
}

export async function handleUnknownCallback(ctx) {
  await ctx.answerCallbackQuery({
    text: '⚠️ Ця кнопка більше не активна. Будь ласка, використайте меню.',
  });
  
  const text = `🤔 Я не зовсім зрозумів це повідомлення.

ℹ️ Ви можете скористатися меню нижче
або перейти в допомогу, якщо виникли питання.

🏠 Оберіть дію:`;

  return await ctx.cleanAndEdit(text, {
    reply_markup: fallbackKeyboard(),
  });
}
