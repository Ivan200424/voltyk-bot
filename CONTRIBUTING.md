# 🤝 Contributing to Voltyk Bot

Thank you for your interest in contributing to the Voltyk bot project!

## Code of Conduct

- Be respectful and professional
- Use Ukrainian language for all user-facing text
- Follow the existing code style
- Write clean, maintainable code

## Development Workflow

### 1. Setup Development Environment

```bash
# Clone repository
git clone https://github.com/Ivan200424/voltyk-bot.git
cd voltyk-bot

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your bot token
```

### 2. Make Changes

- Create a new branch for your feature/fix
- Follow the project structure in `src/`
- Keep changes focused and minimal
- Test your changes thoroughly

### 3. Code Style Guidelines

#### JavaScript/Node.js

- Use ES6+ features (async/await, arrow functions, etc.)
- Use `const` and `let`, avoid `var`
- Use meaningful variable names
- Add comments for complex logic only

#### Text and Messages

- **Language**: Only Ukrainian
- **Formality**: Always use "Ви" (formal), never "ти"
- **Emojis**: Use consistently with existing patterns
- **Unicode**: Use correct symbols (← U+2190, ⤴ U+2934)

#### Navigation

- **Only inline keyboards**: Never use `ReplyKeyboardMarkup`
- **Consistent buttons**: "← Назад" and "⤴ Меню" everywhere
- **Clean Chat**: Always delete previous bot messages

### 4. Testing

Before submitting:

- [ ] Test all changed features manually
- [ ] Verify no syntax errors: `node --check src/file.js`
- [ ] Check storage works with and without Redis
- [ ] Ensure Clean Chat UX works (no message spam)
- [ ] Verify all text is in Ukrainian with "Ви"
- [ ] Test navigation flow is logical

See `TESTING.md` for comprehensive testing checklist.

### 5. Commit Guidelines

Use clear, descriptive commit messages:

```
✅ Good:
- "Add IP monitoring feature"
- "Fix region selection in settings"
- "Improve error handling in storage layer"

❌ Bad:
- "update code"
- "fix bug"
- "changes"
```

## Project Structure

```
src/
├── index.js          # Entry point, webhook server
├── bot.js            # Bot instance, handler registration
├── config.js         # Configuration and constants
├── storage/          # Data storage layer
│   ├── index.js      # Storage abstraction
│   ├── redis.js      # Redis implementation
│   └── memory.js     # In-memory fallback
├── handlers/         # Command and callback handlers
│   ├── start.js      # Wizard and /start command
│   ├── menu.js       # Main menu
│   ├── settings.js   # Settings screen
│   ├── help.js       # Help screen
│   └── fallback.js   # Unknown commands/messages
├── keyboards/        # Inline keyboard builders
│   └── inline.js     # All inline keyboards
├── middleware/       # Bot middleware
│   ├── cleanChat.js  # Message cleanup logic
│   └── rateLimit.js  # Rate limiting
└── utils/            # Utility functions
    └── format.js     # Text formatting
```

## Adding New Features

### Adding a New Handler

1. Create file in `src/handlers/`
2. Implement handler function
3. Export handler
4. Register in `src/bot.js`

Example:

```javascript
// src/handlers/newfeature.js
export async function handleNewFeature(ctx) {
  const text = `🆕 New Feature`;
  
  await ctx.cleanAndEdit(text, {
    reply_markup: backMenuKeyboard(),
  });
  
  await ctx.answerCallbackQuery();
}
```

```javascript
// src/bot.js
import { handleNewFeature } from './handlers/newfeature.js';

bot.callbackQuery('new_feature', handleNewFeature);
```

### Adding a New Keyboard

1. Add function to `src/keyboards/inline.js`
2. Use `InlineKeyboard` from grammY
3. Follow existing patterns

Example:

```javascript
export function newFeatureKeyboard() {
  return new InlineKeyboard()
    .text('Option 1', 'option1')
    .text('Option 2', 'option2').row()
    .text('← Назад', 'back')
    .text('⤴ Меню', 'menu');
}
```

### Adding Storage Fields

1. Update default user data in `src/storage/index.js`
2. Update `getUserData()` return value
3. Document the new field

## Important Rules

### Must Follow

✅ **Clean Chat UX**: Always delete previous bot messages
✅ **Inline Only**: Never use reply keyboards
✅ **Ukrainian**: All user-facing text in Ukrainian
✅ **Formal "Ви"**: Never use "ти"
✅ **Storage Fallback**: Support Redis + in-memory
✅ **Error Handling**: Always catch and log errors
✅ **Rate Limiting**: Prevent abuse
✅ **No Secrets in Code**: Use environment variables

### Never Do

❌ Delete user messages
❌ Use reply keyboards
❌ Mix Ukrainian and English in user text
❌ Use "ти" form
❌ Hard-code bot token or credentials
❌ Block Redis connection failures
❌ Use wrong Unicode symbols (◀️ instead of ←)

## Questions?

- Check existing code for examples
- Read the specification in issue/PR description
- Ask in development chat: https://t.me/voltyk_chat

## Pull Request Process

1. Ensure your code follows all guidelines
2. Test thoroughly (see TESTING.md)
3. Update documentation if needed
4. Submit PR with clear description
5. Address review feedback promptly

Thank you for contributing! 🚀
