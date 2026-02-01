# mailgun-inbound-email

A reusable npm package for handling Mailgun inbound email webhooks with Express.js. This package provides a clean, tested solution for receiving and processing inbound emails from Mailgun without rewriting the same code in every project.

## Features

- ✅ Mailgun webhook signature verification
- ✅ Replay attack prevention (15-minute window)
- ✅ Automatic email parsing (from, to, cc, subject, body, attachments)
- ✅ Header extraction and normalization
- ✅ Attachment metadata processing
- ✅ Express.js router and middleware support
- ✅ Customizable callback functions
- ✅ Error handling that prevents Mailgun retries

## Installation

```bash
npm install mailgun-inbound-email
```

## Quick Start

### Option 1: Using Router (Recommended)

```javascript
const express = require('express');
const { createMailgunInboundRouter } = require('mailgun-inbound-email');

const app = express();

// Create router with callback
const mailgunRouter = createMailgunInboundRouter({
  signingKey: process.env.MAILGUN_WEBHOOK_SIGNING_KEY, // or use env var
  onEmailReceived: (emailData) => {
    // Handle the email data
    console.log('Received email:', emailData);
    // Save to database, send notifications, etc.
  },
  path: '/inbound', // optional, defaults to '/inbound'
  requireSignature: true, // optional, defaults to true
});

app.use('/email', mailgunRouter);
```

### Option 2: Using Middleware

```javascript
const express = require('express');
const { createMailgunInboundMiddleware } = require('mailgun-inbound-email');

const app = express();

const mailgunMiddleware = createMailgunInboundMiddleware({
  signingKey: process.env.MAILGUN_WEBHOOK_SIGNING_KEY,
  onEmailReceived: (emailData) => {
    // Handle the email data
    console.log('Received email:', emailData);
  },
});

app.post('/email/inbound', ...mailgunMiddleware);
```

### Option 3: Manual Processing

```javascript
const express = require('express');
const { processEmailData, verifyMailgunSignature } = require('mailgun-inbound-email');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.post('/email/inbound', express.urlencoded({ extended: true }), upload.any(), (req, res) => {
  const { emailData, token, timestamp, signature } = processEmailData(req);
  
  if (!verifyMailgunSignature(token, timestamp, signature, process.env.MAILGUN_WEBHOOK_SIGNING_KEY)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Your custom logic here
  console.log(emailData);
  res.status(200).json({ received: true });
});
```

## Email Data Structure

The `emailData` object contains:

```javascript
{
  messageId: "string",           // Cleaned message ID
  from: "sender@example.com",     // Sender email address
  to: ["recipient@example.com"],  // Array of recipient emails
  cc: ["cc@example.com"],         // Array of CC emails
  subject: "Email Subject",       // Email subject
  text: "Plain text body",        // Plain text body
  html: "<html>...</html>",       // HTML body
  headers: {                      // Parsed headers object
    "Message-ID": "...",
    "From": "...",
    // ... other headers
  },
  attachments: [                 // Attachment metadata
    {
      filename: "document.pdf",
      originalname: "document.pdf",
      mimetype: "application/pdf",
      size: 12345,
      extension: "pdf",
      encoding: "base64",
      fieldname: "attachment-1"
    }
  ],
  attachmentCount: 1,
  receivedAt: "2024-01-01T00:00:00.000Z",
  timestamp: "2024-01-01T00:00:00.000Z"
}
```

## Configuration Options

### `createMailgunInboundRouter(options)`

- `signingKey` (string, optional): Mailgun webhook signing key. Defaults to `process.env.MAILGUN_WEBHOOK_SIGNING_KEY`
- `onEmailReceived` (function, optional): Callback function called when email is received. Receives `emailData` as parameter
- `path` (string, optional): Route path. Defaults to `'/inbound'`
- `requireSignature` (boolean, optional): Whether to require signature verification. Defaults to `true`

### `createMailgunInboundMiddleware(options)`

- `signingKey` (string, optional): Mailgun webhook signing key. Defaults to `process.env.MAILGUN_WEBHOOK_SIGNING_KEY`
- `onEmailReceived` (function, optional): Callback function called when email is received. Receives `emailData` as parameter
- `requireSignature` (boolean, optional): Whether to require signature verification. Defaults to `true`

## Environment Variables

- `MAILGUN_WEBHOOK_SIGNING_KEY`: Your Mailgun webhook signing key (if not provided in options)

## Utilities

The package also exports utility functions:

- `processEmailData(req)`: Process raw request and return email data
- `verifyMailgunSignature(token, timestamp, signature, signingKey)`: Verify webhook signature
- `extractEmail(value)`: Extract email from "Name <email@domain.com>" format
- `extractEmails(value)`: Extract multiple emails from comma-separated string
- `cleanMessageId(value)`: Remove angle brackets from message ID
- `parseHeaders(headers)`: Safely parse email headers

## Error Handling

The package automatically handles errors and always returns `200` status to Mailgun to prevent retries. Errors are logged to the console.

## License

MIT

