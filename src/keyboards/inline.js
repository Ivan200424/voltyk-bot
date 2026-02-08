import { InlineKeyboard } from 'grammy';
import { config } from '../config.js';
import { REGIONS, QUEUES, REGION_NAME_TO_CODE } from '../constants/regions.js';

// Wizard Step 1: Region selection (2 per row as per spec)
export function regionKeyboard() {
  const keyboard = new InlineKeyboard();
  const regions = config.regions; // ['Київ', 'Київщина', 'Одещина', 'Дніпропетровщина']
  
  // Display in 2 per row
  for (let i = 0; i < regions.length; i += 2) {
    regions.slice(i, i + 2).forEach((regionName) => {
      const regionCode = REGION_NAME_TO_CODE[regionName] || regionName;
      keyboard.text(regionName, `region_${regionCode}`);
    });
    keyboard.row();
  }
  
  return keyboard;
}

// Wizard Step 2: Queue selection (3 per row as per spec)
export function queueKeyboard() {
  const keyboard = new InlineKeyboard();
  const queues = QUEUES; // ['1.1', '1.2', '2.1', '2.2', ...]
  
  // Display in 3 per row: [1.1] [1.2] [2.1], [2.2] [3.1] [3.2], etc.
  for (let i = 0; i < queues.length; i += 3) {
    queues.slice(i, i + 3).forEach((queue) => {
      keyboard.text(queue, `queue_${queue}`);
    });
    keyboard.row();
  }
  
  // Add back button
  keyboard.text('← Назад', 'back_to_region').row();
  
  return keyboard;
}

// Wizard Step 3: Notification target selection
export function wizardNotifyTargetKeyboard() {
  return new InlineKeyboard()
    .text('📱 У цьому боті', 'wizard_notify_bot').row()
    .text('📺 У Telegram-каналі', 'wizard_notify_channel').row()
    .text('← Назад', 'wizard_back');
}

// Wizard Step 4: Channel connection check
export function channelCheckKeyboard() {
  return new InlineKeyboard()
    .text('🔄 Перевірити', 'channel_check').row()
    .text('← Назад', 'wizard_back');
}

// Channel confirmation keyboard
export function channelConfirmKeyboard() {
  return new InlineKeyboard()
    .text('✅ Так, підключити', 'channel_confirm').row()
    .text('❌ Ні', 'channel_reject');
}

// Main menu keyboard
export function mainMenuKeyboard(userData = null) {
  const keyboard = new InlineKeyboard()
    .text('📊 Графік', 'menu_schedule').text('⏱ Таймер', 'menu_timer').row()
    .text('📈 Статистика', 'menu_stats').text('❓ Допомога', 'menu_help').row()
    .text('⚙️ Налаштування', 'menu_settings').row();
  
  // Add channel pause/resume button if user has channel
  if (userData && userData.channel_id && userData.channel_status === 'active') {
    if (userData.channel_paused) {
      keyboard.text('✅ Відновити роботу каналу', 'channel_resume').row();
    } else {
      keyboard.text('🛑 Тимчасово зупинити канал', 'channel_pause').row();
    }
  }
  
  return keyboard;
}

// Settings keyboard
export function settingsKeyboard(isAdmin = false) {
  const keyboard = new InlineKeyboard()
    .text('📍 Регіон', 'settings_region').text('📡 IP', 'settings_ip').row()
    .text('📺 Канал', 'settings_channel').text('🔔 Сповіщення', 'settings_alerts').row();
  
  // Add admin panel button if user is admin
  if (isAdmin) {
    keyboard.text('👑 Адмін-панель', 'admin_panel').row();
  }
  
  keyboard.text('🗑 Видалити всі дані', 'confirm_delete_data').row()
    .text('← Назад', 'back_to_main').text('⤴ Меню', 'back_to_main');
  
  return keyboard;
}

// Help keyboard
export function helpKeyboard() {
  return new InlineKeyboard()
    .url('💬 Обговорення / Підтримка', config.supportChatUrl).row()
    .text('← Назад', 'back_to_main').text('⤴ Меню', 'back_to_main');
}

// Fallback keyboard
export function fallbackKeyboard() {
  return new InlineKeyboard()
    .text('⤴ Меню', 'back_to_main')
    .text('❓ Допомога', 'menu_help');
}

// Navigation back keyboard
export function backMenuKeyboard() {
  return new InlineKeyboard()
    .text('← Назад', 'back_to_settings')
    .text('⤴ Меню', 'back_to_main');
}

// Just menu keyboard
export function menuKeyboard() {
  return new InlineKeyboard()
    .text('⤴ Меню', 'back_to_main');
}

// Channel setup description choice keyboard
export function channelSetupDescriptionKeyboard() {
  return new InlineKeyboard()
    .text('✍️ Додати опис', 'channel_add_description').row()
    .text('⏭️ Пропустити', 'channel_skip_description');
}

// Channel settings keyboard
export function channelSettingsKeyboard(userData = null) {
  const keyboard = new InlineKeyboard();
  
  if (userData && userData.channel_id && userData.channel_status === 'active') {
    keyboard
      .text('ℹ️ Інформація', 'channel_info').row()
      .text('📝 Формат', 'channel_format').row()
      .text('🔄 Перепідключити канал', 'channel_reconnect').row()
      .text('🔴 Відключити канал', 'channel_disconnect').row();
  } else {
    keyboard.text('📺 Підключити канал', 'channel_setup').row();
  }
  
  keyboard.text('← Назад', 'back_to_settings').text('⤴ Меню', 'back_to_main');
  
  return keyboard;
}

// Notification target keyboard (bot/channel/both)
export function notifyTargetKeyboard() {
  return new InlineKeyboard()
    .text('📱 Тільки в боті', 'notify_target_bot').row()
    .text('📺 Тільки в каналі', 'notify_target_channel').row()
    .text('📱📺 В обох', 'notify_target_both').row()
    .text('← Назад', 'back_to_settings').text('⤴ Меню', 'back_to_main');
}

// Admin panel keyboard
export function adminPanelKeyboard() {
  return new InlineKeyboard()
    .text('📊 Статистика', 'admin_stats').text('👥 Користувачі', 'admin_users').row()
    .text('📢 Розсилка', 'admin_broadcast').text('💻 Система', 'admin_system').row()
    .text('📈 Ріст', 'admin_growth').text('⏱ Інтервали', 'admin_intervals').row()
    .text('⏸ Debounce', 'admin_debounce').text('⏸️ Режим паузи', 'admin_pause').row()
    .text('🗑 Очистити базу', 'admin_clear_db').row()
    .text('← Назад', 'back_to_settings').text('⤴ Меню', 'back_to_main');
}

// Delete data confirmation keyboard
export function deleteDataConfirmKeyboard() {
  return new InlineKeyboard()
    .text('✅ Так, видалити', 'delete_data_step2').row()
    .text('❌ Скасувати', 'back_to_settings');
}

// Final delete confirmation
export function deleteDataFinalKeyboard() {
  return new InlineKeyboard()
    .text('⚠️ Так, видалити ВСЕ!', 'confirm_deactivate').row()
    .text('❌ Скасувати', 'back_to_settings');
}

// Toggle alerts keyboard
export function alertToggleKeyboard(enabled) {
  const text = enabled ? '🔕 Вимкнути сповіщення' : '🔔 Увімкнути сповіщення';
  return new InlineKeyboard()
    .text(text, 'alert_toggle').row()
    .text('← Назад', 'back_to_settings').text('⤴ Меню', 'back_to_main');
}
