import { getUserData, setUserData, getWizardState, setWizardState, delWizardState } from '../storage/index.js';
import { regionKeyboard, queueKeyboard, notifyToKeyboard, ipMonitoringKeyboard } from '../keyboards/inline.js';
import { showMainMenu } from './menu.js';

export async function handleStart(ctx) {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  
  // Check if wizard is already completed
  if (userData.wizardCompleted) {
    return await showMainMenu(ctx);
  }
  
  // Start wizard
  await setWizardState(userId, { step: 1 });
  
  const text = `👋 Вітаємо у Вольтику!

Оберіть свій регіон:`;
  
  await ctx.cleanAndSend(text, {
    reply_markup: regionKeyboard(),
  });
}

export async function handleWizardRegion(ctx) {
  const userId = ctx.from.id;
  const region = ctx.callbackQuery.data.replace('region:', '');
  
  const userData = await getUserData(userId);
  userData.region = region;
  await setUserData(userId, userData);
  
  await setWizardState(userId, { step: 2, region });
  
  const text = `Оберіть свою чергу:`;
  
  await ctx.cleanAndEdit(text, {
    reply_markup: queueKeyboard(),
  });
  
  await ctx.answerCallbackQuery();
}

export async function handleWizardQueue(ctx) {
  const userId = ctx.from.id;
  const queue = ctx.callbackQuery.data.replace('queue:', '');
  
  const userData = await getUserData(userId);
  userData.queue = queue;
  await setUserData(userId, userData);
  
  await setWizardState(userId, { step: 3, queue });
  
  const text = `Куди надсилати сповіщення?`;
  
  await ctx.cleanAndEdit(text, {
    reply_markup: notifyToKeyboard(),
  });
  
  await ctx.answerCallbackQuery();
}

export async function handleWizardNotifyTo(ctx) {
  const userId = ctx.from.id;
  const notifyTo = ctx.callbackQuery.data.replace('notify_to:', '');
  
  const userData = await getUserData(userId);
  userData.notifyTo = notifyTo;
  await setUserData(userId, userData);
  
  await setWizardState(userId, { step: 4, notifyTo });
  
  const text = `Бажаєте додати IP-адресу роутера для моніторингу світла?`;
  
  await ctx.cleanAndEdit(text, {
    reply_markup: ipMonitoringKeyboard(),
  });
  
  await ctx.answerCallbackQuery();
}

export async function handleWizardIpAdd(ctx) {
  const userId = ctx.from.id;
  
  // For now, we'll skip the IP input implementation (can be added in next blocks)
  // Just mark as completed
  const userData = await getUserData(userId);
  userData.wizardCompleted = true;
  await setUserData(userId, userData);
  
  await delWizardState(userId);
  
  await ctx.answerCallbackQuery({
    text: 'Функція буде доступна в наступному оновленні',
  });
  
  return await showMainMenu(ctx);
}

export async function handleWizardIpSkip(ctx) {
  const userId = ctx.from.id;
  
  const userData = await getUserData(userId);
  userData.wizardCompleted = true;
  await setUserData(userId, userData);
  
  await delWizardState(userId);
  await ctx.answerCallbackQuery();
  
  return await showMainMenu(ctx);
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
    await setWizardState(userId, { step: 1 });
    
    const text = `👋 Вітаємо у Вольтику!

Оберіть свій регіон:`;
    
    await ctx.cleanAndEdit(text, {
      reply_markup: regionKeyboard(),
    });
  } else if (currentStep === 3) {
    // Step 3 (notification) -> back to Step 2 (queue)
    const userData = await getUserData(userId);
    await setWizardState(userId, { step: 2, region: userData.region });
    
    const text = `Оберіть свою чергу:`;
    
    await ctx.cleanAndEdit(text, {
      reply_markup: queueKeyboard(),
    });
  } else if (currentStep === 4) {
    // Step 4 (IP) -> back to Step 3 (notification)
    const userData = await getUserData(userId);
    await setWizardState(userId, { step: 3, queue: userData.queue });
    
    const text = `Куди надсилати сповіщення?`;
    
    await ctx.cleanAndEdit(text, {
      reply_markup: notifyToKeyboard(),
    });
  }
  
  await ctx.answerCallbackQuery();
}
