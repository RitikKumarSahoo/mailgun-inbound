/**
 * Example usage of mailgun-inbound-email package
 * 
 * This example shows full manual control - you handle everything
 * from webhook setup to email processing.
 */

const express = require('express');
const multer = require('multer');
const { processEmailData, verifyRequestSignature } = require('./index');

const app = express();

// Configure multer for file uploads (attachments)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max (Mailgun limit)
  }
});

// Mailgun webhook endpoint - full manual control
app.post('/webhook/inbound', 
  express.urlencoded({ extended: true }), 
  upload.any(), 
  async (req, res) => {
    try {
      // Step 1: Verify Mailgun signature automatically (only need signing key!)
      const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
      if (!signingKey) {
        console.error('MAILGUN_WEBHOOK_SIGNING_KEY not set');
        return res.status(500).json({ error: 'Server configuration error' });
      }
      
      if (!verifyRequestSignature(req, signingKey)) {
        console.warn('Invalid signature attempt', {
          ip: req.ip || req.connection.remoteAddress,
          timestamp: new Date().toISOString(),
        });
        return res.status(401).json({ 
          error: 'Invalid Mailgun signature',
          message: 'Webhook signature verification failed'
        });
      }
      
      // Step 2: Process email data from request
      const { emailData } = processEmailData(req);
      
      // Step 3: Validate required fields
      if (!emailData.from || !emailData.to || emailData.to.length === 0) {
        console.error('Missing required email fields:', { 
          from: emailData.from, 
          to: emailData.to 
        });
        // Still return 200 to prevent Mailgun retries
        return res.status(200).json({ 
          received: true, 
          error: 'Missing required fields' 
        });
      }
      
      // Step 4: Manual processing - you have full control
      console.log('📧 New email received!');
      console.log('Message ID:', emailData.messageId);
      console.log('From:', emailData.from);
      console.log('To:', emailData.to);
      console.log('Subject:', emailData.subject);
      console.log('Attachments:', emailData.attachmentCount);
      
      // Example: Save to database
      // const db = require('./db');
      // await db.emails.create({
      //   messageId: emailData.messageId,
      //   from: emailData.from,
      //   to: emailData.to,
      //   subject: emailData.subject,
      //   text: emailData.text,
      //   html: emailData.html,
      //   receivedAt: emailData.receivedAt,
      // });
      
      // Example: Process attachments
      // const fs = require('fs');
      // emailData.attachments.forEach(async (attachment) => {
      //   if (attachment.buffer) {
      //     // Save to file system
      //     fs.writeFileSync(`./uploads/${attachment.filename}`, attachment.buffer);
      //     
      //     // Or upload to S3
      //     // const AWS = require('aws-sdk');
      //     // const s3 = new AWS.S3();
      //     // await s3.upload({
      //     //   Bucket: 'your-bucket',
      //     //   Key: attachment.filename,
      //     //   Body: attachment.buffer,
      //     //   ContentType: attachment.mimetype,
      //     // }).promise();
      //   }
      // });
      
      // Example: Send notification
      // const axios = require('axios');
      // await axios.post('https://your-notification-service.com/api/notify', {
      //   message: `New email from ${emailData.from}: ${emailData.subject}`,
      //   emailData: emailData,
      // });
      
      // Step 5: Always return 200 to Mailgun (prevents retries)
      res.status(200).json({ 
        received: true,
        messageId: emailData.messageId,
        timestamp: emailData.timestamp 
      });
      
    } catch (error) {
      // Error handling - always return 200 to prevent Mailgun retries
      console.error('Error processing email:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      
      res.status(200).json({ 
        received: true,
        error: 'Processing failed but webhook acknowledged'
      });
    }
  }
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'mailgun-inbound-email',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📬 Mailgun webhook URL: http://localhost:${PORT}/webhook/inbound`);
  console.log(`⚠️  Make sure to set MAILGUN_WEBHOOK_SIGNING_KEY environment variable`);
  console.log(`📦 Install dependencies: npm install express multer`);
});
