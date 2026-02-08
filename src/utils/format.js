export function formatMainMenu(userData) {
  const regionDisplay = userData.region && userData.queue 
    ? `${userData.region} • ${userData.queue}`
    : 'не налаштовано';
    
  const channelDisplay = (userData.channel_name || userData.channelName)
    ? `@${userData.channel_name || userData.channelName} ✅`
    : 'не підключено ❌';
    
  const ipDisplay = (userData.router_ip || userData.ipAddress)
    ? 'підключена ✅'
    : 'не підключена ❌';
    
  const notifyDisplay = userData.notifications_enabled !== undefined 
    ? (userData.notifications_enabled ? 'увімкнено ✅' : 'вимкнено ❌')
    : (userData.notificationsEnabled ? 'увімкнено ✅' : 'вимкнено ❌');

  return `🚧 Бот у розробці
Деякі функції можуть працювати нестабільно.

💬 Маєте ідеї або знайшли помилку?
❓ Допомога → Обговорення / Підтримка

──────────────
🏠 Головне меню

📍 Регіон: ${regionDisplay}
📺 Канал: ${channelDisplay}
📡 IP-адреса: ${ipDisplay}
🔔 Сповіщення: ${notifyDisplay}`;
}
