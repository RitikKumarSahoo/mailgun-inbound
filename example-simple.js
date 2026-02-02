/**
 * Simple example matching your original code structure
 * 
 * Shows how to use mailgunWebhook and save event data manually
 */

const express = require('express');
const { mailgunWebhook } = require('./index');

const app = express();

// Example database (replace with your actual DB)
const db = {
  events: {
    async create(eventData) {
      console.log('💾 Saving event:', eventData.event, eventData.eventId);
      // await yourDatabase.events.insert(eventData);
    }
  }
};

// Your webhook endpoint
app.post('/webhook/mailgun-events', express.json(), async (req, res) => {
  // Call mailgunWebhook - it returns event data if successful
  const eventData = await mailgunWebhook(req, res);
  
  // Save event data manually if event matches and was successfully processed
  if (eventData && eventData.received && eventData.event) {
    try {
      await db.events.create(eventData);
      console.log('✅ Event saved successfully');
    } catch (error) {
      console.error('❌ Error saving event:', error);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📬 Webhook URL: http://localhost:${PORT}/webhook/mailgun-events`);
});

