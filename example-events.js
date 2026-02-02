/**
 * Example usage of production-ready Mailgun event webhook handler
 * 
 * This example shows how to use mailgunWebhook to receive event data
 * and save it manually to your database.
 */

const express = require('express');
const { mailgunWebhook } = require('./index');

const app = express();

// Example database functions (replace with your actual DB)
const db = {
  events: {
    async create(eventData) {
      // Save event to database
      console.log('💾 Saving event to database:', {
        event: eventData.event,
        eventId: eventData.eventId,
        recipient: eventData.recipient,
        messageId: eventData.messageId,
      });
      // await yourDatabase.events.insert(eventData);
      return eventData;
    }
  }
};

// Mailgun event webhook endpoint - Save event data manually
app.post('/webhook/mailgun-events', 
  express.json({ limit: '10mb' }), // Mailgun sends JSON for event webhooks
  async (req, res) => {
    // Call mailgunWebhook - it handles signature verification and returns event data
    const eventData = await mailgunWebhook(req, res);
    
    // Save event data manually if webhook was successful
    if (eventData && eventData.received && eventData.event) {
      try {
        await db.events.create(eventData);
        console.log('✅ Event saved to database:', eventData.event);
      } catch (error) {
        console.error('❌ Failed to save event to database:', error);
        // Event was already acknowledged to Mailgun, so we just log the error
      }
    }
  }
);

// Alternative: Handle event data manually after webhook processes it
// You can modify mailgunWebhook to accept a callback, or handle it like this:
app.post('/webhook/mailgun-events-v2', 
  express.json({ limit: '10mb' }),
  async (req, res) => {
    // Create a custom response handler
    const originalJson = res.json.bind(res);
    let eventData = null;
    
    res.json = function(data) {
      eventData = data;
      return originalJson(data);
    };
    
    // Process webhook
    await mailgunWebhook(req, res);
    
    // Save to database if event was successfully processed
    if (eventData && eventData.received && eventData.event) {
      try {
        await db.events.create(eventData);
        console.log('✅ Event saved to database');
      } catch (error) {
        console.error('❌ Failed to save event:', error);
      }
    }
  }
);

// Recommended: Use middleware pattern to save events
const saveEventMiddleware = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    // Save event data if webhook was successful
    if (data && data.received && data.event) {
      // Don't await - save asynchronously to not block response
      db.events.create(data).catch(err => {
        console.error('Failed to save event:', err);
      });
    }
    return originalJson(data);
  };
  
  next();
};

app.post('/webhook/mailgun-events-v3', 
  express.json({ limit: '10mb' }),
  saveEventMiddleware,
  async (req, res) => {
    await mailgunWebhook(req, res);
  }
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'mailgun-event-webhook',
    timestamp: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📬 Mailgun event webhook URL: http://localhost:${PORT}/webhook/mailgun-events`);
  console.log(`⚠️  Make sure to set MAILGUN_WEBHOOK_SIGNING_KEY environment variable`);
  console.log(`📦 Install dependencies: npm install express`);
});
