# mailgun-inbound-email

A **production-ready** utility package for manual processing of Mailgun inbound email webhooks. Full manual control - you handle everything from webhook setup to email processing.

## 🚀 Quick Start

```bash
npm install mailgun-inbound-email
```

```javascript
const express = require('express');
const multer = require('multer');
const { processEmailData, verifyMailgunSignature } = require('mailgun-inbound-email');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/webhook/inbound', 
  express.urlencoded({ extended: true }), 
  upload.any(), 
  (req, res) => {
    try {
      // Process email data
      const { emailData, token, timestamp, signature } = processEmailData(req);
      
      // Verify signature
      if (!verifyMailgunSignature(token, timestamp, signature, process.env.MAILGUN_WEBHOOK_SIGNING_KEY)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      // Manual processing - you have full control
      console.log('Email from:', emailData.from);
      console.log('Subject:', emailData.subject);
      
      // Your custom logic here
      // - Save to database
      // - Process attachments
      // - Send notifications
      // - etc.
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error:', error);
      res.status(200).json({ received: true }); // Always return 200 to Mailgun
    }
  }
);

app.listen(3000);
```

**That's it!** Just configure your Mailgun webhook URL to point to `https://yourdomain.com/webhook/inbound`

## ✨ Features

- ✅ **Full Manual Control** - You handle everything, no magic
- ✅ **Production-ready utilities** - Battle-tested functions
- ✅ **Mailgun signature verification** - Secure by default
- ✅ **Replay attack prevention** - 15-minute timestamp window
- ✅ **Automatic email parsing** - Clean, structured email data
- ✅ **Attachment support** - Metadata + buffers for manual handling
- ✅ **Zero dependencies** - Only Node.js built-ins
- ✅ **Simple & lightweight** - Just utility functions

## 📦 Installation

```bash
npm install mailgun-inbound-email
```

## 🎯 Usage

### Basic Example

```javascript
const express = require('express');
const multer = require('multer');
const { processEmailData, verifyMailgunSignature } = require('mailgun-inbound-email');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/webhook/inbound', 
  express.urlencoded({ extended: true }), 
  upload.any(), 
  (req, res) => {
    try {
      // Process the email data
      const { emailData, token, timestamp, signature } = processEmailData(req);
      
      // Verify Mailgun signature
      const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
      if (!verifyMailgunSignature(token, timestamp, signature, signingKey)) {
        return res.status(401).json({ error: 'Invalid Mailgun signature' });
      }
      
      // Validate required fields
      if (!emailData.from || !emailData.to || emailData.to.length === 0) {
        return res.status(200).json({ 
          received: true, 
          error: 'Missing required fields' 
        });
      }
      
      // Manual processing - you control everything
      console.log('Processing email:', emailData.messageId);
      console.log('From:', emailData.from);
      console.log('To:', emailData.to);
      console.log('Subject:', emailData.subject);
      console.log('Attachments:', emailData.attachmentCount);
      
      // Your custom processing logic here
      // Example: Save to database
      // await db.emails.create(emailData);
      
      // Example: Process attachments
      // emailData.attachments.forEach(attachment => {
      //   if (attachment.buffer) {
      //     fs.writeFileSync(`./uploads/${attachment.filename}`, attachment.buffer);
      //   }
      // });
      
      // Always return 200 to Mailgun
      res.status(200).json({ 
        received: true,
        messageId: emailData.messageId 
      });
      
    } catch (error) {
      console.error('Error processing email:', error);
      // Always return 200 to prevent Mailgun retries
      res.status(200).json({ received: true });
    }
  }
);

app.listen(3000);
```

### Processing Attachments

```javascript
const { processEmailData } = require('mailgun-inbound-email');
const fs = require('fs');

app.post('/webhook/inbound', express.urlencoded({ extended: true }), upload.any(), (req, res) => {
  const { emailData } = processEmailData(req);
  
  // Process attachments manually
  emailData.attachments.forEach(attachment => {
    if (attachment.buffer) {
      // Save to file system
      fs.writeFileSync(`./uploads/${attachment.filename}`, attachment.buffer);
      
      // Or upload to S3, process image, etc.
      // await s3.upload({
      //   Key: attachment.filename,
      //   Body: attachment.buffer,
      //   ContentType: attachment.mimetype,
      // }).promise();
    }
  });
  
  res.status(200).json({ received: true });
});
```

### Async Processing

```javascript
app.post('/webhook/inbound', express.urlencoded({ extended: true }), upload.any(), async (req, res) => {
  try {
    const { emailData } = processEmailData(req);
    
    // Async operations
    await db.emails.create(emailData);
    await notifyTeam(emailData);
    await processAttachments(emailData);
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(200).json({ received: true });
  }
});
```

## 📧 Email Data Structure

The `emailData` object contains all parsed email information:

```javascript
{
  messageId: "string",                    // Cleaned message ID (without angle brackets)
  from: "sender@example.com",              // Sender email address (extracted from "Name <email>")
  to: ["recipient@example.com"],          // Array of recipient emails
  cc: ["cc@example.com"],                  // Array of CC emails
  subject: "Email Subject",                // Email subject line
  text: "Plain text body",                 // Plain text body content
  html: "<html>...</html>",                // HTML body content
  headers: {                               // Parsed headers object
    "Message-ID": "...",
    "From": "...",
    "To": "...",
    "Subject": "...",
    // ... all other email headers
  },
  attachments: [                           // Attachment metadata + buffers
    {
      filename: "document.pdf",
      originalname: "document.pdf",
      mimetype: "application/pdf",
      size: 12345,
      extension: "pdf",
      encoding: "base64",
      fieldname: "attachment-1",
      buffer: Buffer,                      // File buffer for manual processing
    }
  ],
  attachmentCount: 1,                     // Number of attachments
  receivedAt: "2024-01-01T00:00:00.000Z", // ISO timestamp when received
  timestamp: "2024-01-01T00:00:00.000Z"    // ISO timestamp (same as receivedAt)
}
```

## 🛠️ API Reference

### `processEmailData(req)`

Process raw Express request and return structured email data.

**Parameters:**
- `req` (Object): Express request object with `body` and `files` properties

**Returns:**
- `Object`: `{ emailData, token, timestamp, signature }`

**Throws:**
- `Error`: If request body is invalid

**Example:**
```javascript
const { emailData, token, timestamp, signature } = processEmailData(req);
```

### `verifyMailgunSignature(token, timestamp, signature, signingKey)`

Verify Mailgun webhook signature to ensure authenticity.

**Parameters:**
- `token` (string): Mailgun token from request
- `timestamp` (string): Request timestamp
- `signature` (string): Mailgun signature
- `signingKey` (string): Your Mailgun webhook signing key

**Returns:**
- `boolean`: `true` if signature is valid

**Example:**
```javascript
const isValid = verifyMailgunSignature(token, timestamp, signature, signingKey);
if (!isValid) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### Utility Functions

| Function | Description |
|----------|-------------|
| `extractEmail(value)` | Extract email from "Name <email@domain.com>" format |
| `extractEmails(value)` | Extract multiple emails from comma-separated string |
| `cleanMessageId(value)` | Remove angle brackets from message ID |
| `parseHeaders(headers)` | Safely parse email headers array to object |

## 🔐 Security

### Required Environment Variable

- `MAILGUN_WEBHOOK_SIGNING_KEY`: Your Mailgun webhook signing key (found in Mailgun dashboard → Settings → Webhooks)

### Security Features

- ✅ **Signature Verification**: Validates all webhook requests using HMAC SHA-256
- ✅ **Replay Attack Prevention**: Rejects requests older than 15 minutes
- ✅ **Timing-Safe Comparison**: Uses `crypto.timingSafeEqual` to prevent timing attacks
- ✅ **Input Validation**: Validates all required fields before processing

### Getting Your Signing Key

1. Log in to [Mailgun Dashboard](https://app.mailgun.com)
2. Go to **Settings** → **Webhooks**
3. Copy your **Webhook Signing Key**
4. Set it as environment variable: `export MAILGUN_WEBHOOK_SIGNING_KEY=your-key-here`

## 📝 Setting Up Mailgun Webhook

1. **Install the package:**
   ```bash
   npm install mailgun-inbound-email
   ```

2. **Set up your Express server** (see examples above)

3. **Install required dependencies:**
   ```bash
   npm install express multer
   ```

4. **Configure Mailgun webhook:**
   - Go to Mailgun Dashboard → **Sending** → **Domains** → Your Domain
   - Click **Receiving** → **Routes**
   - Add route: `catch_all()` → `forward("https://yourdomain.com/webhook/inbound")`
   - Or use Mailgun API to set webhook programmatically

5. **Set environment variable:**
   ```bash
   export MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key
   ```

6. **Deploy and test!** Send an email to your domain and check your logs.

## 🎯 Production Checklist

- ✅ Set `MAILGUN_WEBHOOK_SIGNING_KEY` environment variable
- ✅ Use HTTPS for webhook URL (Mailgun requires it)
- ✅ Implement your email processing logic
- ✅ Handle attachments if needed (buffers are included)
- ✅ Set up error monitoring/logging
- ✅ Test webhook signature verification
- ✅ Always return 200 status to Mailgun (prevents retries)

## ⚠️ Important Notes

- **Always return 200** to Mailgun (even on errors) to prevent retries
- **Use HTTPS** for webhook URLs (Mailgun requirement)
- **Full manual control** - this package only provides utilities, you handle everything
- **Attachments include buffers** - handle large files appropriately
- **Zero dependencies** - only uses Node.js built-in modules

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a pull request.
