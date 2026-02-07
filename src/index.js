import { webhookCallback } from 'grammy';
import { createServer } from 'http';
import bot from './bot.js';
import { config } from './config.js';
import { initStorage, closeStorage } from './storage/index.js';

// Track processed update IDs to prevent duplicate processing (LRU-style)
const processedUpdates = new Map();
const MAX_PROCESSED_UPDATES = 1000;

// Track server for graceful shutdown
let httpServer = null;

async function main() {
  console.log('🚀 Starting Voltyk Bot...');
  
  // Initialize storage
  await initStorage();
  
  // Get bot info
  const botInfo = await bot.api.getMe();
  console.log(`✅ Bot @${botInfo.username} is ready`);
  
  // Setup webhook
  if (config.webhookDomain) {
    // Remove trailing slash from domain to prevent double slashes
    const domain = config.webhookDomain.replace(/\/+$/, '');
    const webhookUrl = `${domain}/webhook`;
    await bot.api.setWebhook(webhookUrl);
    console.log(`✅ Webhook set to: ${webhookUrl}`);
    
    // Create webhook handler with duplicate protection
    const handleUpdate = webhookCallback(bot, 'http');
    
    const server = createServer(async (req, res) => {
      // Health check endpoint
      if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', bot: botInfo.username }));
        return;
      }
      
      // Webhook endpoint
      if (req.url === '/webhook' && req.method === 'POST') {
        let body = '';
        
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        
        req.on('end', async () => {
          try {
            const update = JSON.parse(body);
            
            // Check for duplicate updates
            if (processedUpdates.has(update.update_id)) {
              console.log(`⚠️  Duplicate update ${update.update_id}, skipping`);
              res.writeHead(200);
              res.end('ok');
              return;
            }
            
            // Add to processed map (Map maintains insertion order)
            processedUpdates.set(update.update_id, Date.now());
            
            // Limit map size (remove oldest entries)
            if (processedUpdates.size > MAX_PROCESSED_UPDATES) {
              const firstKey = processedUpdates.keys().next().value;
              processedUpdates.delete(firstKey);
            }
            
            // Create a mock request/response for grammY
            const mockReq = {
              method: 'POST',
              url: '/webhook',
              headers: req.headers,
            };
            
            const mockRes = {
              writeHead: res.writeHead.bind(res),
              end: res.end.bind(res),
            };
            
            // Pass the update body directly
            mockReq.body = update;
            
            await handleUpdate(mockReq, mockRes);
          } catch (error) {
            console.error('❌ Error processing update:', error);
            res.writeHead(500);
            res.end('Error');
          }
        });
        
        return;
      }
      
      // 404 for other routes
      res.writeHead(404);
      res.end('Not Found');
    });
    
    const port = config.port;
    httpServer = server.listen(port, () => {
      console.log(`✅ Server listening on port ${port}`);
    });
  } else {
    console.log('⚠️  WEBHOOK_DOMAIN not set, bot will not receive updates');
    console.log('ℹ️  Set WEBHOOK_DOMAIN in .env to enable webhook mode');
  }
}

// Handle graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n👋 Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new requests
  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close((err) => {
        if (err) {
          console.error('⚠️  Error closing HTTP server:', err.message);
        } else {
          console.log('✅ HTTP server closed');
        }
        resolve(); // Always resolve to continue shutdown
      });
    });
  }
  
  // Stop bot
  try {
    await bot.stop();
    console.log('✅ Bot stopped');
  } catch (error) {
    console.error('⚠️  Error stopping bot:', error.message);
  }
  
  // Close storage connections
  await closeStorage();
  
  console.log('✅ Shutdown complete');
  process.exit(0);
}

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the bot
main().catch((error) => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});
