# ⚡ Вольтик — Telegram бот для відстежування графіків відключень

Telegram бот для відстежування графіків відключень електроенергії в Україні.

## 📚 Documentation

- **[🚀 Deployment Guide](DEPLOYMENT.md)** - How to deploy to Railway
- **[🧪 Testing Guide](TESTING.md)** - How to test all features
- **[🏗️ Architecture](ARCHITECTURE.md)** - System architecture and data flow
- **[🤝 Contributing](CONTRIBUTING.md)** - Contribution guidelines

## 🚀 Швидкий старт

### Встановлення

```bash
npm install
```

### Налаштування

1. Створіть файл `.env` на основі `.env.example`:
```bash
cp .env.example .env
```

2. Заповніть змінні оточення:
```env
BOT_TOKEN=your_bot_token_from_botfather
REDIS_URL=redis://localhost:6379  # Опціонально
ADMIN_CHAT_ID=your_telegram_id
WEBHOOK_DOMAIN=https://your-domain.com
```

### Запуск

**Розробка (з автоперезавантаженням):**
```bash
npm run dev
```

**Продакшн:**
```bash
npm start
```

## 📦 Технології

- **Node.js** (>=18.0.0)
- **grammY** - Telegram Bot Framework
- **Redis** - Зберігання даних (з fallback на in-memory)
- **Railway** - Хостинг

## 🏗️ Структура проєкту

```
voltyk-bot/
├── src/
│   ├── index.js          # Entry point, webhook server
│   ├── bot.js            # grammY bot instance, handlers
│   ├── config.js         # Configuration
│   ├── storage/          # Storage layer (Redis + in-memory)
│   │   ├── redis.js
│   │   ├── memory.js
│   │   └── index.js
│   ├── handlers/         # Command and callback handlers
│   │   ├── start.js      # /start + wizard
│   │   ├── menu.js       # Main menu
│   │   ├── settings.js   # Settings
│   │   ├── help.js       # Help
│   │   └── fallback.js   # Unknown commands
│   ├── keyboards/        # Inline keyboards
│   │   └── inline.js
│   ├── middleware/       # Bot middleware
│   │   ├── cleanChat.js  # Clean chat UX
│   │   └── rateLimit.js  # Rate limiting
│   └── utils/            # Utilities
│       └── format.js     # Text formatting
├── package.json
└── .env.example
```

## 🔐 Змінні оточення

| Змінна | Опис | Обов'язкова |
|--------|------|-------------|
| `BOT_TOKEN` | Токен від @BotFather | ✅ |
| `REDIS_URL` | URL Redis (fallback на in-memory) | ❌ |
| `ADMIN_CHAT_ID` | ID адміністратора | ❌ |
| `WEBHOOK_DOMAIN` | Домен для webhook | ✅ |
| `PORT` | Порт сервера (за замовчуванням 3000) | ❌ |

## ✨ Особливості

- **Clean Chat UX**: Бот видаляє попередні повідомлення, щоб не захламлювати чат
- **Wizard**: Покроковий майстер налаштування при першому запуску
- **Inline Navigation**: Вся навігація через inline-кнопки
- **Redis Fallback**: Якщо Redis недоступний, використовується in-memory зберігання
- **Rate Limiting**: Захист від зловживань
- **Webhook Protection**: Перевірка дублікатів update_id

## 🤝 Підтримка

Маєте питання або ідеї? Приєднуйтесь до обговорення: https://t.me/voltyk_chat

## 📄 Ліцензія

ISC