import { InlineKeyboard } from 'grammy';
import { config } from '../config.js';

// Wizard Step 1: Region selection
export function regionKeyboard() {
  const keyboard = new InlineKeyboard();
  const regions = config.regions;
  
  // Display in 2x2 grid
  for (let i = 0; i < regions.length; i += 2) {
    regions.slice(i, i + 2).forEach((region) => {
      keyboard.text(region, `region:${region}`);
    });
    keyboard.row();
  }
  
  return keyboard;
}

// Wizard Step 2: Queue selection
export function queueKeyboard() {
  const keyboard = new InlineKeyboard();
  const queues = config.queues;
  
  // Display in 2x6 grid
  for (let i = 0; i < queues.length; i += 2) {
    queues.slice(i, i + 2).forEach((queue) => {
      keyboard.text(queue, `queue:${queue}`);
    });
    keyboard.row();
  }
  
  // Add back button
  keyboard.text('← Назад', 'wizard_back').row();
  
  return keyboard;
}

// Wizard Step 3: Notification destination
export function notifyToKeyboard() {
  return new InlineKeyboard()
    .text('📱 У бота', 'notify_to:bot').row()
    .text('📺 У власний канал', 'notify_to:channel').row()
    .text('← Назад', 'wizard_back');
}

// Wizard Step 4: IP monitoring (optional)
export function ipMonitoringKeyboard() {
  return new InlineKeyboard()
    .text('➕ Додати адресу', 'ip:add').row()
    .text('⏭ Пропустити', 'ip:skip').row()
    .text('← Назад', 'wizard_back');
}

// Main menu keyboard
export function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text('📋 Графік', 'schedule').text('📡 Моніторинг', 'monitoring').row()
    .text('📺 Канал', 'channel').text('⚙️ Налаштування', 'settings').row()
    .text('❓ Допомога', 'help');
}

// Settings keyboard
export function settingsKeyboard() {
  return new InlineKeyboard()
    .text('📍 Змінити регіон', 'change_region').row()
    .text('📺 Канал', 'channel_settings').row()
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
    .text('⤴ Меню', 'menu')
    .text('❓ Допомога', 'help');
}

// Navigation back keyboard
export function backMenuKeyboard() {
  return new InlineKeyboard()
    .text('← Назад', 'back')
    .text('⤴ Меню', 'menu');
}

// Just menu keyboard
export function menuKeyboard() {
  return new InlineKeyboard()
    .text('⤴ Меню', 'menu');
}

// Channel setup description choice keyboard
export function channelSetupDescriptionKeyboard() {
  return new InlineKeyboard()
    .text('✍️ Додати опис', 'channel_add_description').row()
    .text('⏭️ Пропустити', 'channel_skip_description');
}

// Channel settings keyboard
export function channelSettingsKeyboard() {
  return new InlineKeyboard()
    .text('📺 Підключити канал', 'channel_setup').row()
    .text('ℹ️ Інформація', 'channel_info').row()
    .text('🔴 Відключити канал', 'channel_disconnect').row()
    .text('← Назад', 'back').text('⤴ Меню', 'menu');
}
