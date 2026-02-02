# mailgun-inbound-email

A **production-ready** utility package for manual processing of Mailgun webhooks. Supports both **inbound email webhooks** and **event webhooks** (delivered, opened, clicked, bounced, etc.). Full manual control - you handle everything from webhook setup to data processing.

## 🚀 Quick Start

```bash
npm install mailgun-inbound-email
```

> ⚠️ **REQUIRED**: Set `MAILGUN_WEBHOOK_SIGNING_KEY` environment variable before using webhooks. See [Security](#-security) section for details.

```javascript
const express = require('express');
const multer = require('multer');
const { processEmailData, verifyRequestSignature } = require('mailgun-inbound-email');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/webhook/inbound', 
  express.urlencoded({ extended: true }), 
  upload.any(), 
  (req, res) => {
    try {
      // Verify signature automatically (only need signing key)
      if (!verifyRequestSignature(req, process.env.MAILGUN_WEBHOOK_SIGNING_KEY)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      // Process email data
      const { emailData } = processEmailData(req);
      
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

> ⚠️ **IMPORTANT**: Make sure to set `MAILGUN_WEBHOOK_SIGNING_KEY` environment variable before running the server. Without it, webhook signature verification will fail.

> 📖 **Need help setting up the webhook?** See the detailed guide: [Setting Up Mailgun Inbound Webhook](#-setting-up-mailgun-inbound-webhook)

### Event Webhooks Quick Start

For handling Mailgun event webhooks (delivered, opened, clicked, bounced, etc.):

```javascript
const express = require('express');
const { mailgunWebhook } = require('mailgun-inbound-email');

const app = express();

app.post('/webhook/mailgun-events', express.json(), async (req, res) => {
  const eventData = await mailgunWebhook(req, res);
  
  // Save event data manually
  if (eventData && eventData.received && eventData.event) {
    await db.events.create(eventData);
  }
});

app.listen(3000);
```

**That's it!** Configure your Mailgun event webhook URL in Mailgun Dashboard → Settings → Webhooks → Add webhook → Select events → Enter URL: `https://yourdomain.com/webhook/mailgun-events`

> ⚠️ **IMPORTANT**: Make sure to set `MAILGUN_WEBHOOK_SIGNING_KEY` environment variable before running the server. Without it, webhook signature verification will fail.

## ✨ Features

- ✅ **Full Manual Control** - You handle everything, no magic
- ✅ **Automatic Signature Verification** - Just provide signing key, package handles the rest
- ✅ **Production-ready utilities** - Battle-tested functions
- ✅ **Mailgun signature verification** - Secure by default
- ✅ **Replay attack prevention** - 15-minute timestamp window
- ✅ **Automatic email parsing** - Clean, structured email data
- ✅ **Attachment support** - Metadata + buffers for manual handling
- ✅ **Event webhook handler** - Production-ready handler for Mailgun event webhooks (delivered, opened, clicked, bounced, etc.)
- ✅ **Returns event data** - Get processed event data for manual saving to database
- ✅ **Structured logging** - Built-in logging with correlation IDs for tracking
- ✅ **Zero dependencies** - Only Node.js built-ins
- ✅ **Simple & lightweight** - Just utility functions

## 📦 Installation

```bash
npm install mailgun-inbound-email
```

> ⚠️ **REQUIRED**: After installation, you must set the `MAILGUN_WEBHOOK_SIGNING_KEY` environment variable. See [Security](#-security) section for instructions.

## 🎯 Usage

### Inbound Email Webhooks

For receiving and processing inbound emails sent to your domain.

### Basic Example

```javascript
const express = require('express');
const multer = require('multer');
const { processEmailData, verifyRequestSignature } = require('mailgun-inbound-email');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/webhook/inbound', 
  express.urlencoded({ extended: true }), 
  upload.any(), 
  (req, res) => {
    try {
      // Verify signature automatically - only need signing key!
      const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
      if (!verifyRequestSignature(req, signingKey)) {
        return res.status(401).json({ error: 'Invalid Mailgun signature' });
      }
      
      // Process the email data
      const { emailData } = processEmailData(req);
      
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

### Event Webhooks (delivered, opened, clicked, bounced, etc.)

For handling Mailgun event webhooks that track email delivery, opens, clicks, and other events.

#### Simple Example

```javascript
const express = require('express');
const { mailgunWebhook } = require('mailgun-inbound-email');

const app = express();

// Example database
const db = {
  events: {
    async create(eventData) {
      // Save event to your database
      console.log('Saving event:', eventData.event);
    }
  }
};

app.post('/webhook/mailgun-events', express.json(), async (req, res) => {
  // Call mailgunWebhook - it handles signature verification and returns event data
  const eventData = await mailgunWebhook(req, res);
  
  // Save event data manually if event was successfully processed
  if (eventData && eventData.received && eventData.event) {
    try {
      await db.events.create(eventData);
      console.log('✅ Event saved successfully');
    } catch (error) {
      console.error('❌ Error saving event:', error);
    }
  }
});

app.listen(3000);
```

#### Advanced Example with Event Handling

```javascript
const express = require('express');
const { mailgunWebhook } = require('mailgun-inbound-email');

const app = express();

app.post('/webhook/mailgun-events', express.json(), async (req, res) => {
  const eventData = await mailgunWebhook(req, res);
  
  if (eventData && eventData.received && eventData.event) {
    // Handle different event types
    switch (eventData.event) {
      case 'delivered':
        await updateEmailStatus(eventData.messageId, 'delivered');
        break;
      case 'opened':
        await trackEmailOpen(eventData.messageId, eventData.recipient);
        break;
      case 'clicked':
        await trackLinkClick(eventData.messageId, eventData.url);
        break;
      case 'bounced':
        await markRecipientAsBounced(eventData.recipient, eventData.reason);
        break;
      case 'complained':
        await markRecipientAsComplained(eventData.recipient);
        break;
      case 'failed':
        await handleEmailFailure(eventData);
        break;
      case 'unsubscribed':
        await unsubscribeRecipient(eventData.recipient);
        break;
    }
    
    // Save event to database
    await db.events.create(eventData);
  }
});

app.listen(3000);
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

### `verifyRequestSignature(req, signingKey)`

Verify Mailgun webhook signature automatically from request. This is the **recommended** method as it automatically extracts token, timestamp, and signature from the request.

**Parameters:**
- `req` (Object): Express request object with body
- `signingKey` (string, optional): Mailgun webhook signing key. Defaults to `process.env.MAILGUN_WEBHOOK_SIGNING_KEY`

**Returns:**
- `boolean`: `true` if signature is valid

**Example:**
```javascript
const { verifyRequestSignature } = require('mailgun-inbound-email');

// Simple usage - automatically extracts token, timestamp, signature from req.body
// Uses MAILGUN_WEBHOOK_SIGNING_KEY from environment automatically
if (!verifyRequestSignature(req)) {
  return res.status(401).json({ error: 'Invalid signature' });
}

// Or explicitly pass signing key
if (!verifyRequestSignature(req, process.env.MAILGUN_WEBHOOK_SIGNING_KEY)) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### `verifyMailgunSignature(token, timestamp, signature, signingKey)`

Verify Mailgun webhook signature manually (advanced usage). Use `verifyRequestSignature()` instead for simpler usage.

**Parameters:**
- `token` (string): Mailgun token from request
- `timestamp` (string): Request timestamp
- `signature` (string): Mailgun signature
- `signingKey` (string): Your Mailgun webhook signing key

**Returns:**
- `boolean`: `true` if signature is valid

**Example:**
```javascript
// Advanced usage - manually extract and verify
const { token, timestamp, signature } = req.body;
const isValid = verifyMailgunSignature(token, timestamp, signature, signingKey);
if (!isValid) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### `mailgunWebhook(req, res, signingKey)`

Production-ready handler for Mailgun event webhooks (delivered, opened, clicked, bounced, complained, failed, unsubscribed, stored, etc.). Handles signature verification, event parsing, and returns processed event data for manual saving.

**Parameters:**
- `req` (Object): Express request object
- `res` (Object): Express response object
- `signingKey` (string, optional): Mailgun webhook signing key. Defaults to `process.env.MAILGUN_WEBHOOK_SIGNING_KEY`

**Returns:**
- `Promise<Object|null>`: Returns processed event data if successful, `null` if error or invalid request

**Example:**
```javascript
const { mailgunWebhook } = require('mailgun-inbound-email');

app.post('/webhook/mailgun-events', express.json(), async (req, res) => {
  const eventData = await mailgunWebhook(req, res);
  
  // Save event data manually if webhook was successful
  if (eventData && eventData.received && eventData.event) {
    await db.events.create(eventData);
  }
});
```

**Event Data Structure:**
```javascript
{
  received: true,
  event: "delivered" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "unsubscribed" | "stored" | "unknown",
  eventId: "string",              // Unique event ID (for idempotency)
  recipient: "user@example.com",   // Email recipient
  messageId: "string",             // Email message ID
  timestamp: "2024-01-01T00:00:00.000Z", // ISO timestamp
  domain: "example.com",           // Mailgun domain
  correlationId: "string",         // Request correlation ID for tracking
  processedAt: "2024-01-01T00:00:00.000Z", // When webhook was processed
  status: "delivered" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "unsubscribed" | "stored" | "unknown",
  
  // Event-specific fields:
  url: "string",                   // For 'clicked' events
  reason: "string",                 // For 'bounced'/'failed' events
  deliveryStatus: {                // For 'delivered'/'bounced'/'failed' events
    code: number,
    message: string,
    description: string,
    tls: boolean,
    certificateVerified: boolean,
    attemptNo: number,
    sessionSeconds: number,
  },
  clientInfo: {                    // For 'opened'/'clicked' events
    clientName: string,
    clientType: string,
    deviceType: string,
    userAgent: string,
  },
  geolocation: {                   // For 'opened'/'clicked' events
    country: string,
    region: string,
    city: string,
  },
  severity: "permanent" | "temporary", // For 'bounced' events
  deliveredAt: "ISO string",      // For 'delivered' events
  openedAt: "ISO string",          // For 'opened' events
  clickedAt: "ISO string",         // For 'clicked' events
  bouncedAt: "ISO string",         // For 'bounced' events
  complainedAt: "ISO string",     // For 'complained' events
  failedAt: "ISO string",          // For 'failed' events
  unsubscribedAt: "ISO string",    // For 'unsubscribed' events
  storedAt: "ISO string",         // For 'stored' events
  fullEventData: {},               // For 'unknown' events - contains raw event data
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

> ⚠️ **REQUIRED**: `MAILGUN_WEBHOOK_SIGNING_KEY` must be set for webhook signature verification to work.

- **`MAILGUN_WEBHOOK_SIGNING_KEY`** (REQUIRED): Your Mailgun webhook signing key (found in Mailgun dashboard → Settings → Webhooks)
  - This is **required** for both inbound email webhooks and event webhooks
  - Without this key, all webhook requests will be rejected with 401 Unauthorized
  - Get your key from: Mailgun Dashboard → Settings → Webhooks → Webhook Signing Key

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

## 📝 Setting Up Mailgun Inbound Webhook

### Step 1: Install Package and Dependencies

```bash
# Install the package
npm install mailgun-inbound-email

# Install required dependencies
npm install express multer
```

### Step 2: Set Up Environment Variable (REQUIRED)

> ⚠️ **REQUIRED**: You must set `MAILGUN_WEBHOOK_SIGNING_KEY` before setting up your server.

1. Get your webhook signing key from Mailgun Dashboard → Settings → Webhooks
2. Set it as an environment variable:

```bash
export MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key-here
```

Or add to your `.env` file:
```
MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key-here
```

### Step 3: Set Up Your Express Server

Set up your Express server with the webhook endpoint (see examples above).

### Step 4: Configure Mailgun Inbound Route (Dashboard Method)

Follow these steps to configure the inbound webhook URL in Mailgun Dashboard:

#### Option A: Using Mailgun Dashboard (Recommended for beginners)

1. **Log in to Mailgun Dashboard**
   - Go to [https://app.mailgun.com](https://app.mailgun.com)
   - Log in with your Mailgun account

2. **Navigate to Your Domain**
   - Click on **Sending** in the left sidebar
   - Click on **Domains**
   - Select your verified domain (or add a new domain if needed)

3. **Go to Receiving Settings**
   - In your domain settings, click on the **Receiving** tab
   - You'll see options for handling inbound emails

4. **Create Inbound Route**
   - Click on **Routes** (or **Add Route**)
   - Click **Create Route** button

5. **Configure Route Settings**
   - **Route Description**: Give it a name like "Inbound Email Webhook"
   - **Filter Expression**: 
     - For all emails: Select `catch_all()` or leave default
     - For specific emails: Use `match_recipient("your-email@yourdomain.com")`
   - **Actions**: 
     - Select **Forward** or **Store and notify**
     - Enter your webhook URL: `https://yourdomain.com/webhook/inbound`
     - **Important**: Must use HTTPS (Mailgun requires it)

6. **Save the Route**
   - Click **Create Route** or **Save**
   - Your route is now active

#### Option B: Using Mailgun API (Recommended for automation)

You can also create routes programmatically using the Mailgun API:

```bash
curl -X POST "https://api.mailgun.net/v3/routes" \
  -u "api:YOUR_API_KEY" \
  -F "priority=0" \
  -F "description=Inbound Email Webhook" \
  -F "expression=catch_all()" \
  -F "action=forward('https://yourdomain.com/webhook/inbound')"
```

Or using Node.js:

```javascript
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);

const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY
});

// Create inbound route
mg.routes.create({
  priority: 0,
  description: 'Inbound Email Webhook',
  expression: 'catch_all()',
  action: ['forward("https://yourdomain.com/webhook/inbound")']
})
.then(msg => console.log('Route created:', msg))
.catch(err => console.error('Error:', err));
```

> **Note**: If you already set `MAILGUN_WEBHOOK_SIGNING_KEY` in Step 2, you can skip this step.

1. **Navigate to Webhooks Settings**
   - In Mailgun Dashboard, go to **Settings** → **Webhooks**
   - Or go to: [https://app.mailgun.com/app/webhooks](https://app.mailgun.com/app/webhooks)

2. **Copy Your Signing Key**
   - Find **Webhook Signing Key** section
   - Click **Show** or **Reveal** to see your key
   - Copy the signing key (it looks like: `key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

3. **Set Environment Variable** (if not already set in Step 2)
   ```bash
   export MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key-here
   ```
   
   Or add to your `.env` file:
   ```
   MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key-here
   ```

### Step 5: Test Your Webhook

1. **Deploy Your Server**
   - Make sure your Express server is running and accessible via HTTPS
   - Your webhook URL should be publicly accessible

2. **Send a Test Email**
   - Send an email to any address at your domain (e.g., `test@yourdomain.com`)
   - Mailgun will forward it to your webhook URL

3. **Check Your Logs**
   - Check your server logs to see if the webhook was received
   - Verify the email data is being processed correctly

4. **Verify in Mailgun Dashboard**
   - Go to **Logs** → **Webhooks** in Mailgun Dashboard
   - You should see webhook delivery attempts and their status

### Step 6: Verify Domain DNS Settings (If Needed)

If you haven't set up your domain yet, make sure to:

1. **Add MX Records** (for receiving emails)
   - Go to **Sending** → **Domains** → Your Domain → **DNS Records**
   - Add MX record pointing to Mailgun:
     - Priority: `10`
     - Value: `mxa.mailgun.org`
   - Add second MX record:
     - Priority: `10`
     - Value: `mxb.mailgun.org`

2. **Verify Domain**
   - Mailgun will provide DNS records to verify domain ownership
   - Add the TXT record to your domain's DNS settings
   - Wait for DNS propagation (can take up to 48 hours)

### Troubleshooting

**Webhook not receiving emails?**
- ✅ Verify your webhook URL is accessible (test with curl or browser)
- ✅ Ensure you're using HTTPS (Mailgun requires it)
- ✅ Check Mailgun logs for delivery errors
- ✅ Verify your route is active in Mailgun Dashboard
- ✅ Check your server logs for incoming requests

**Signature verification failing?**
- ✅ **REQUIRED**: Verify `MAILGUN_WEBHOOK_SIGNING_KEY` environment variable is set (this is required!)
- ✅ Check that you copied the full signing key
- ✅ Ensure the key matches the one in Mailgun Dashboard
- ✅ Verify the environment variable is loaded in your application (check with `console.log(process.env.MAILGUN_WEBHOOK_SIGNING_KEY)`)

**Emails not being forwarded?**
- ✅ Verify MX records are set correctly
- ✅ Check domain verification status
- ✅ Ensure route filter expression matches your test email
- ✅ Check Mailgun logs for any errors

### Example Webhook URL Formats

- Production: `https://api.yourdomain.com/webhook/inbound`
- Staging: `https://staging-api.yourdomain.com/webhook/inbound`
- Local testing (using ngrok): `https://abc123.ngrok.io/webhook/inbound`

**Note**: For local development, use a tool like [ngrok](https://ngrok.com/) to expose your local server:
```bash
ngrok http 3000
# Use the HTTPS URL provided by ngrok
```

## 📝 Setting Up Mailgun Event Webhooks

Event webhooks track email events like delivered, opened, clicked, bounced, etc. These are different from inbound email webhooks.

### Step 1: Install Package and Dependencies

```bash
# Install the package
npm install mailgun-inbound-email

# Install required dependencies (only express needed for event webhooks)
npm install express
```

### Step 2: Set Up Environment Variable (REQUIRED)

> ⚠️ **REQUIRED**: You must set `MAILGUN_WEBHOOK_SIGNING_KEY` before setting up your server.

1. Get your webhook signing key from Mailgun Dashboard → Settings → Webhooks
2. Set it as an environment variable:

```bash
export MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key-here
```

Or add to your `.env` file:
```
MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key-here
```

### Step 3: Set Up Your Express Server

Set up your Express server with the event webhook endpoint (see examples above in the Event Webhooks section).

### Step 4: Configure Event Webhook in Mailgun Dashboard

1. **Log in to Mailgun Dashboard**
   - Go to [https://app.mailgun.com](https://app.mailgun.com)
   - Log in with your Mailgun account

2. **Navigate to Webhooks Settings**
   - Click on **Settings** in the left sidebar
   - Click on **Webhooks**
   - Or go directly to: [https://app.mailgun.com/app/webhooks](https://app.mailgun.com/app/webhooks)

3. **Add New Webhook**
   - Click **Add webhook** button
   - Select the events you want to track:
     - ✅ **Delivered** - Email successfully delivered
     - ✅ **Opened** - Email was opened by recipient
     - ✅ **Clicked** - Link in email was clicked
     - ✅ **Bounced** - Email bounced (permanent or temporary)
     - ✅ **Complained** - Recipient marked email as spam
     - ✅ **Failed** - Email delivery failed
     - ✅ **Unsubscribed** - Recipient unsubscribed
     - ✅ **Stored** - Email was stored

4. **Enter Webhook URL**
   - Enter your webhook URL: `https://yourdomain.com/webhook/mailgun-events`
   - **Important**: Must use HTTPS (Mailgun requires it)
   - The webhook will receive JSON payloads (not form-data like inbound emails)

5. **Save the Webhook**
   - Click **Save** or **Add webhook**
   - Your webhook is now active and will receive events

> **Note**: If you already set `MAILGUN_WEBHOOK_SIGNING_KEY` in Step 2, you can skip this step. The same signing key is used for both inbound and event webhooks.

1. **Navigate to Webhooks Settings**
   - In Mailgun Dashboard, go to **Settings** → **Webhooks**
   - Find **Webhook Signing Key** section

2. **Copy Your Signing Key**
   - Click **Show** or **Reveal** to see your key
   - Copy the signing key (it looks like: `key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

3. **Set Environment Variable** (if not already set in Step 2)
   ```bash
   export MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key-here
   ```
   
   Or add to your `.env` file:
   ```
   MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key-here
   ```

### Step 5: Test Your Event Webhook

1. **Send a Test Email**
   - Send an email using Mailgun API or dashboard
   - The email should trigger events (delivered, opened, clicked, etc.)

2. **Check Your Logs**
   - Check your server logs to see if events are being received
   - Verify the event data is being processed correctly

3. **Verify in Mailgun Dashboard**
   - Go to **Logs** → **Webhooks** in Mailgun Dashboard
   - You should see webhook delivery attempts and their status
   - Check that events are being sent to your webhook URL

### Troubleshooting Event Webhooks

**Events not being received?**
- ✅ Verify your webhook URL is accessible (test with curl or browser)
- ✅ Ensure you're using HTTPS (Mailgun requires it)
- ✅ Check that you selected the correct events in Mailgun Dashboard
- ✅ Verify your webhook is active in Mailgun Dashboard
- ✅ Check Mailgun logs for delivery errors
- ✅ Check your server logs for incoming requests

**Event data not saving?**
- ✅ Verify `mailgunWebhook()` is returning event data
- ✅ Check that you're checking `eventData.received && eventData.event` before saving
- ✅ Ensure your database connection is working
- ✅ Check for errors in your event saving logic

**Signature verification failing?**
- ✅ **REQUIRED**: Verify `MAILGUN_WEBHOOK_SIGNING_KEY` environment variable is set (this is required!)
- ✅ Check that you copied the full signing key
- ✅ Ensure the key matches the one in Mailgun Dashboard
- ✅ Verify the environment variable is loaded in your application (check with `console.log(process.env.MAILGUN_WEBHOOK_SIGNING_KEY)`)

## 🎯 Production Checklist

### Inbound Email Webhooks
- ✅ **REQUIRED**: Set `MAILGUN_WEBHOOK_SIGNING_KEY` environment variable
- ✅ Use HTTPS for webhook URL (Mailgun requires it)
- ✅ Implement your email processing logic
- ✅ Handle attachments if needed (buffers are included)
- ✅ Set up error monitoring/logging
- ✅ Test webhook signature verification
- ✅ Always return 200 status to Mailgun (prevents retries)

### Event Webhooks (delivered, opened, clicked, etc.)
- ✅ **REQUIRED**: Set `MAILGUN_WEBHOOK_SIGNING_KEY` environment variable
- ✅ Use HTTPS for webhook URL (Mailgun requires it)
- ✅ Implement event data saving logic (use returned event data)
- ✅ Handle different event types appropriately
- ✅ Set up error monitoring/logging
- ✅ Test webhook signature verification
- ✅ Always return 200 status to Mailgun (prevents retries)
- ✅ Consider implementing idempotency checks using `eventId`

## ⚠️ Important Notes

- **Always return 200** to Mailgun (even on errors) to prevent retries
- **Use HTTPS** for webhook URLs (Mailgun requirement)
- **Full manual control** - this package only provides utilities, you handle everything
- **Attachments include buffers** - handle large files appropriately
- **Event webhooks return data** - `mailgunWebhook()` returns event data for manual saving
- **Zero dependencies** - only uses Node.js built-in modules
- **Two webhook types** - Inbound email webhooks (form-data) vs Event webhooks (JSON)

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a pull request.
