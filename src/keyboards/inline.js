const { InlineKeyboard } = require('grammy');
const { REGIONS, REGION_CODES, QUEUES, KYIV_EXTRA_QUEUES } = require('../constants/regions');

function getMainMenu(user) {
  const keyboard = new InlineKeyboard()
    .text('📊 Графік відключень', 'menu_schedule').row()
    .text('⏱ Наступне відключення', 'menu_timer').row()
    .text('📈 Моя статистика', 'menu_stats')
    .text('❓ Допомога', 'menu_help').row()
    .text('⚙️ Налаштування', 'settings');
  
  return keyboard;
}

function getRegionKeyboard() {
  const keyboard = new InlineKeyboard();
  
  // Add regions 2 per row
  let count = 0;
  for (const code of REGION_CODES) {
    keyboard.text(REGIONS[code].name, `region_${code}`);
    count++;
    if (count % 2 === 0) {
      keyboard.row();
    }
  }
  
  // If odd number of regions, add row
  if (count % 2 !== 0) {
    keyboard.row();
  }
  
  return keyboard;
}

function getQueueKeyboard(region) {
  const keyboard = new InlineKeyboard();
  
  // Add queues 3 per row
  let count = 0;
  for (const queue of QUEUES) {
    keyboard.text(queue, `queue_${queue}`);
    count++;
    if (count % 3 === 0) {
      keyboard.row();
    }
  }
  
  // Add back button
  if (count % 3 !== 0) {
    keyboard.row();
  }
  
  // Кнопка "Інші черги →" тільки для Києва
  if (region === 'kyiv') {
    keyboard.text('Інші черги →', 'queues_page_extra').row();
  }
  
  keyboard.text('← Назад', 'back_to_region');
  
  return keyboard;
}

function getQueueKeyboardExtra() {
  const keyboard = new InlineKeyboard();
  
  // Додаткові черги 7.1-60.1, по 5 в рядку
  let count = 0;
  for (const queue of KYIV_EXTRA_QUEUES) {
    keyboard.text(queue, `queue_${queue}`);
    count++;
    if (count % 5 === 0) {
      keyboard.row();
    }
  }
  
  if (count % 5 !== 0) {
    keyboard.row();
  }
  
  keyboard.text('← Назад', 'queues_page_main');
  
  return keyboard;
}

function getWizardNotifyTargetKeyboard() {
  return new InlineKeyboard()
    .text('💬 В особисті повідомлення', 'wizard_notify_bot').row()
    .text('📺 В канал', 'wizard_notify_channel').row()
    .text('← Назад', 'wizard_back');
}

function getChannelCheckKeyboard() {
  return new InlineKeyboard()
    .text('✅ Перевірити', 'channel_check').row()
    .text('← Назад', 'wizard_back');
}

function getChannelConfirmKeyboard() {
  return new InlineKeyboard()
    .text('✅ Так, підключити', 'channel_confirm')
    .text('❌ Ні, скасувати', 'channel_reject');
}

function getSettingsKeyboard(isAdmin) {
  const keyboard = new InlineKeyboard()
    .text('🌍 Змінити регіон', 'settings_region').row()
    .text('📺 Керування каналом', 'settings_channel').row()
    .text('🔔 Сповіщення про відключення', 'settings_alerts').row()
    .text('🌐 IP-моніторинг', 'settings_ip').row()
    .text('🗑 Видалити всі дані', 'confirm_delete_data').row();
  
  if (isAdmin) {
    keyboard.text('👨‍💼 Адмін-панель', 'admin_panel').row();
  }
  
  keyboard.text('⤴ Головне меню', 'back_to_main');
  
  return keyboard;
}

function getChannelSettingsKeyboard(user) {
  const keyboard = new InlineKeyboard();
  
  if (user.channelId) {
    keyboard
      .text('ℹ️ Інформація про канал', 'channel_info').row()
      .text('📤 Тестова публікація', 'test_publish').row()
      .text('🎨 Формат повідомлень', 'format_settings').row()
      .text('🔌 Від\'єднати канал', 'channel_disconnect').row();
  } else {
    keyboard.text('➕ Підключити канал', 'channel_setup').row();
  }
  
  keyboard
    .text('← Назад', 'back_to_settings')
    .text('⤴ Меню', 'back_to_main');
  
  return keyboard;
}

function getNotifyTargetKeyboard(currentTarget) {
  const keyboard = new InlineKeyboard();
  
  const targets = [
    { text: '💬 Бот', value: 'bot' },
    { text: '📺 Канал', value: 'channel' },
    { text: '📱 Обидва', value: 'both' },
  ];
  
  targets.forEach(target => {
    const prefix = currentTarget === target.value ? '✅ ' : '';
    keyboard.text(`${prefix}${target.text}`, `notify_target_${target.value}`).row();
  });
  
  keyboard
    .text('← Назад', 'back_to_settings')
    .text('⤴ Меню', 'back_to_main');
  
  return keyboard;
}

function getAlertToggleKeyboard(enabled) {
  const status = enabled ? '✅ Увімкнено' : '❌ Вимкнено';
  const action = enabled ? 'Вимкнути' : 'Увімкнути';
  
  return new InlineKeyboard()
    .text(`${status}`, 'alert_status').row()
    .text(action, 'alert_toggle').row()
    .text('← Назад', 'back_to_settings')
    .text('⤴ Меню', 'back_to_main');
}

function getDeleteDataConfirmKeyboard() {
  return new InlineKeyboard()
    .text('⚠️ Так, видалити мої дані', 'delete_data_step2').row()
    .text('← Назад', 'back_to_settings');
}

function getDeleteDataFinalKeyboard() {
  return new InlineKeyboard()
    .text('❌ ПІДТВЕРДЖУЮ ВИДАЛЕННЯ', 'confirm_deactivate').row()
    .text('← Назад', 'back_to_settings');
}

function getAdminKeyboard() {
  return new InlineKeyboard()
    .text('📊 Статистика', 'admin_stats').row()
    .text('👥 Користувачі', 'admin_users')
    .text('📢 Розсилка', 'admin_broadcast').row()
    .text('💻 Система', 'admin_system')
    .text('📈 Зростання', 'admin_growth').row()
    .text('⏱ Інтервали', 'admin_intervals')
    .text('⏳ Debounce', 'admin_debounce').row()
    .text('⏸ Пауза режим', 'admin_pause')
    .text('🗑 Очистити БД', 'admin_clear').row()
    .text('← Назад', 'back_to_settings');
}

function getBackMenuKeyboard() {
  return new InlineKeyboard()
    .text('← Назад', 'back_to_settings')
    .text('⤴ Меню', 'back_to_main');
}

function getBackSettingsKeyboard() {
  return new InlineKeyboard()
    .text('← Налаштування', 'back_to_settings')
    .text('⤴ Меню', 'back_to_main');
}

function getMenuKeyboard() {
  return new InlineKeyboard()
    .text('⤴ Головне меню', 'back_to_main');
}

function getBackToMainKeyboard() {
  return new InlineKeyboard()
    .text('⤴ Головне меню', 'back_to_main');
}

function getCancelKeyboard() {
  return new InlineKeyboard()
    .text('🚫 Скасувати', 'cancel');
}

function getAdminStatsKeyboard() {
  return new InlineKeyboard()
    .text('🔄 Оновити', 'admin_stats').row()
    .text('← Назад', 'admin_panel')
    .text('⤴ Меню', 'back_to_main');
}

function getAdminSystemKeyboard() {
  return new InlineKeyboard()
    .text('🔄 Оновити', 'admin_system').row()
    .text('🗑 Очистити кеш', 'admin_clear_cache').row()
    .text('← Назад', 'admin_panel')
    .text('⤴ Меню', 'back_to_main');
}

function getAdminIntervalsKeyboard() {
  return new InlineKeyboard()
    .text('⏱ Графік: 5хв', 'interval_schedule_5')
    .text('10хв', 'interval_schedule_10')
    .text('15хв', 'interval_schedule_15').row()
    .text('🛡 Перевірка каналів: 30хв', 'interval_channel_30')
    .text('1г', 'interval_channel_60').row()
    .text('← Назад', 'admin_panel')
    .text('⤴ Меню', 'back_to_main');
}

function getAdminDebounceKeyboard(currentValue) {
  return new InlineKeyboard()
    .text(`⏳ Поточне: ${currentValue}с`, 'debounce_info').row()
    .text('10с', 'debounce_10')
    .text('30с', 'debounce_30')
    .text('60с', 'debounce_60').row()
    .text('← Назад', 'admin_panel')
    .text('⤴ Меню', 'back_to_main');
}

function getAdminPauseKeyboard(isPaused) {
  const status = isPaused ? '✅ Активний' : '❌ Неактивний';
  const action = isPaused ? 'Відновити' : 'Призупинити';
  
  return new InlineKeyboard()
    .text(`Статус: ${status}`, 'pause_status').row()
    .text(action, isPaused ? 'pause_resume' : 'pause_enable').row()
    .text('← Назад', 'admin_panel')
    .text('⤴ Меню', 'back_to_main');
}

function getRegionChangeKeyboard() {
  const keyboard = new InlineKeyboard();
  
  // Add regions 2 per row
  let count = 0;
  for (const code of REGION_CODES) {
    keyboard.text(REGIONS[code].name, `region_${code}`);
    count++;
    if (count % 2 === 0) {
      keyboard.row();
    }
  }
  
  if (count % 2 !== 0) {
    keyboard.row();
  }
  
  keyboard
    .text('← Назад', 'back_to_settings')
    .text('⤴ Меню', 'back_to_main');
  
  return keyboard;
}

function getQueueChangeKeyboard(region) {
  const keyboard = new InlineKeyboard();
  
  // Add queues 3 per row
  let count = 0;
  for (const queue of QUEUES) {
    keyboard.text(queue, `queue_${queue}`);
    count++;
    if (count % 3 === 0) {
      keyboard.row();
    }
  }
  
  if (count % 3 !== 0) {
    keyboard.row();
  }
  
  // Кнопка "Інші черги →" тільки для Києва
  if (region === 'kyiv') {
    keyboard.text('Інші черги →', 'queues_change_page_extra').row();
  }
  
  keyboard
    .text('← Назад', 'settings_region')
    .text('⤴ Меню', 'back_to_main');
  
  return keyboard;
}

function getQueueChangeKeyboardExtra() {
  const keyboard = new InlineKeyboard();
  
  let count = 0;
  for (const queue of KYIV_EXTRA_QUEUES) {
    keyboard.text(queue, `queue_${queue}`);
    count++;
    if (count % 5 === 0) {
      keyboard.row();
    }
  }
  
  if (count % 5 !== 0) {
    keyboard.row();
  }
  
  keyboard
    .text('← Назад', 'queues_change_page_main')
    .text('⤴ Меню', 'back_to_main');
  
  return keyboard;
}

function getChannelDisconnectConfirmKeyboard() {
  return new InlineKeyboard()
    .text('⚠️ Так, від\'єднати', 'confirm_channel_disconnect').row()
    .text('← Назад', 'settings_channel');
}

module.exports = {
  getMainMenu,
  getRegionKeyboard,
  getQueueKeyboard,
  getQueueKeyboardExtra,
  getWizardNotifyTargetKeyboard,
  getChannelCheckKeyboard,
  getChannelConfirmKeyboard,
  getSettingsKeyboard,
  getChannelSettingsKeyboard,
  getNotifyTargetKeyboard,
  getAlertToggleKeyboard,
  getDeleteDataConfirmKeyboard,
  getDeleteDataFinalKeyboard,
  getAdminKeyboard,
  getBackMenuKeyboard,
  getBackSettingsKeyboard,
  getMenuKeyboard,
  getBackToMainKeyboard,
  getCancelKeyboard,
  getAdminStatsKeyboard,
  getAdminSystemKeyboard,
  getAdminIntervalsKeyboard,
  getAdminDebounceKeyboard,
  getAdminPauseKeyboard,
  getRegionChangeKeyboard,
  getQueueChangeKeyboard,
  getQueueChangeKeyboardExtra,
  getChannelDisconnectConfirmKeyboard,
};
