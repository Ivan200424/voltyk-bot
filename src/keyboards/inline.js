import { InlineKeyboard } from 'grammy';
import { config } from '../config.js';

// Wizard Step 1: Region selection
export function regionKeyboard() {
  const keyboard = new InlineKeyboard();
  const regions = config.regions;
  
  // Display in 2 columns
  for (let i = 0; i < regions.length; i += 2) {
    keyboard.text(regions[i], `region:${regions[i]}`);
    if (i + 1 < regions.length) {
      keyboard.text(regions[i + 1], `region:${regions[i + 1]}`);
    }
    if (i + 2 < regions.length) {
      keyboard.row();
    }
  }
  
  return keyboard;
}

// Wizard Step 2: Queue selection
export function queueKeyboard(showBack = false) {
  const keyboard = new InlineKeyboard();
  const queues = config.queues;
  
  // Display in 2 columns
  for (let i = 0; i < queues.length; i += 2) {
    keyboard.text(queues[i], `queue:${queues[i]}`);
    if (i + 1 < queues.length) {
      keyboard.text(queues[i + 1], `queue:${queues[i + 1]}`);
    }
    if (i + 2 < queues.length) {
      keyboard.row();
    }
  }
  
  // Add back button for wizard step 2
  if (showBack) {
    keyboard.row().text('← Назад', 'wizard_back:1');
  }
  
  return keyboard;
}

// Wizard Step 3: Notification destination
export function notifyToKeyboard() {
  return new InlineKeyboard()
    .text('📱 У бота', 'notify_to:bot').row()
    .text('📺 У власний канал', 'notify_to:channel').row()
    .text('← Назад', 'wizard_back:2');
}

// Wizard Step 4: IP monitoring (optional)
export function ipMonitoringKeyboard() {
  return new InlineKeyboard()
    .text('➕ Додати адресу', 'ip:add').row()
    .text('⏭ Пропустити', 'ip:skip').row()
    .text('← Назад', 'wizard_back:3');
}

// Main menu keyboard
export function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text('📋 Подивитись графік', 'schedule').row()
    .text('📡 Моніторинг', 'monitoring').row()
    .text('📺 Канал', 'channel').row()
    .text('⚙️ Налаштування', 'settings').row()
    .text('❓ Допомога', 'help');
}

// Settings keyboard
export function settingsKeyboard() {
  return new InlineKeyboard()
    .text('📍 Змінити регіон', 'change_region').row()
    .text('🔢 Змінити чергу', 'change_queue').row()
    .text('🔔 Сповіщення', 'toggle_notifications').row()
    .text('← Назад', 'back').text('⤴ Меню', 'menu');
}

// Help keyboard
export function helpKeyboard() {
  return new InlineKeyboard()
    .url('💬 Обговорення / Підтримка', config.supportChatUrl).row()
    .text('← Назад', 'back').text('⤴ Меню', 'menu');
}

// Fallback keyboard
export function fallbackKeyboard() {
  return new InlineKeyboard()
    .text('⤴ Меню', 'menu').text('❓ Допомога', 'help');
}

// Navigation back keyboard
export function backMenuKeyboard() {
  return new InlineKeyboard()
    .text('← Назад', 'back').text('⤴ Меню', 'menu');
}

// Just menu keyboard
export function menuKeyboard() {
  return new InlineKeyboard()
    .text('⤴ Меню', 'menu');
}
