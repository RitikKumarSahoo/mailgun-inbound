const crypto = require("crypto");

// Lazy load email-templates (only needed for email sending feature)
let Email;
function getEmailTemplates() {
  if (!Email) {
    try {
      Email = require("email-templates");
    } catch (error) {
      throw new Error(
        "email-templates package is required for email sending. " +
        "Please install it: npm install email-templates"
      );
    }
  }
  return Email;
}

/**
 * Verify Mailgun webhook signature
 * @param {string} token - Mailgun token
 * @param {string} timestamp - Request timestamp
 * @param {string} signature - Mailgun signature
 * @param {string} signingKey - Mailgun webhook signing key
 * @returns {boolean} True if signature is valid
 */
function verifyMailgunSignature(token, timestamp, signature, signingKey) {
  if (!signingKey || !token || !timestamp || !signature) {
    return false;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = Number(timestamp);

  if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > 900) {
    return false;
  }

  try {
    const hmac = crypto
      .createHmac("sha256", signingKey)
      .update(timestamp + token)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(signature)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Parse headers safely
 * @param {string|Array} headers - Email headers as string or array
 * @returns {Array} Parsed headers array
 */
function parseHeaders(headers) {
  if (Array.isArray(headers)) return headers;

  try {
    return JSON.parse(headers || "[]");
  } catch {
    return [];
  }
}

/**
 * Extract email from "Name <email@domain.com>" or plain email
 * @param {string} value - Email string
 * @returns {string} Extracted email address
 */
function extractEmail(value = "") {
  if (!value || typeof value !== 'string') return "";
  const match = value.match(/<(.+?)>/);
  return match ? match[1].trim() : value.trim();
}

/**
 * Extract multiple emails from comma-separated string
 * @param {string} value - Comma-separated email string
 * @returns {Array<string>} Array of email addresses
 */
function extractEmails(value = "") {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map(email => extractEmail(email.trim())).filter(Boolean);
}

/**
 * Remove angle brackets from message ID
 * @param {string} value - Message ID string
 * @returns {string|null} Cleaned message ID
 */
function cleanMessageId(value) {
  if (!value || typeof value !== 'string') return null;
  return value.replace(/^<|>$/g, '').trim() || null;
}

/**
 * Verify Mailgun webhook signature automatically from request
 * 
 * This function automatically extracts token, timestamp, and signature
 * from the request body and verifies the signature. Supports both:
 * - Inbound email webhooks: token, timestamp, signature at top level
 * - Event webhooks: signature object with token, timestamp, signature fields
 * 
 * @param {Object} req - Express request object with body
 * @param {Object} req.body - Request body containing signature data
 * @param {Object} req.body.signature - Signature object (for event webhooks) with token, timestamp, signature
 * @param {string} req.body.token - Token (for inbound email webhooks, at top level)
 * @param {string} req.body.timestamp - Timestamp (for inbound email webhooks, at top level)
 * @param {string} req.body.signature - Signature (for inbound email webhooks, at top level)
 * @param {string} signingKey - Mailgun webhook signing key (or use MAILGUN_WEBHOOK_SIGNING_KEY env var)
 * @returns {boolean} True if signature is valid
 * 
 * @example
 * const { verifyRequestSignature } = require('node-inbound-email');
 * const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
 * if (!verifyRequestSignature(req, signingKey)) {
 *   return res.status(401).json({ error: 'Invalid signature' });
 * }
 */
function verifyRequestSignature(req, signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
  if (!req || !req.body) {
    return false;
  }

  // Mailgun event webhooks: signature data in req.body.signature object
  // Inbound email webhooks: signature data at top level
  const sig = req.body.signature;
  const token = sig?.token || req.body.token;
  const timestamp = sig?.timestamp || req.body.timestamp;
  const signature = sig?.signature || req.body.signature;

  return verifyMailgunSignature(token, timestamp, signature, signingKey);
}

/**
 * Process email data from Mailgun webhook request
 * 
 * This function processes the raw Express request body and files
 * to extract and structure email data for manual processing.
 * 
 * @param {Object} req - Express request object with body and files
 * @param {Object} req.body - Request body containing email fields
 * @param {Array} req.files - Array of uploaded files (attachments)
 * @returns {Object} Processed email data with token, timestamp, signature
 * @returns {Object} return.emailData - Structured email data
 * @returns {string} return.token - Mailgun token
 * @returns {string} return.timestamp - Request timestamp
 * @returns {string} return.signature - Mailgun signature
 * @throws {Error} If request body is invalid
 * 
 * @example
 * const { processEmailData } = require('node-inbound-email');
 * const { emailData } = processEmailData(req);
 * console.log(emailData.from, emailData.subject);
 */
function processEmailData(req) {
  if (!req || !req.body) {
    throw new Error("Invalid request: missing body");
  }

  const {
    token,
    timestamp,
    signature,
    sender,
    from,
    subject,
    recipient,
    cc,
    "body-plain": bodyPlain,
    "body-html": bodyHtml,
    "stripped-text": strippedText,
    "stripped-html": strippedHtml,
    "message-headers": messageHeaders,
    "attachment-count": attachmentCount,
  } = req.body;

  // Process attachments metadata with buffers for manual processing
  const processedAttachments = (req.files || []).map((file, index) => ({
    filename: file.originalname || `attachment-${Date.now()}-${index}`,
    originalname: file.originalname || null,
    mimetype: file.mimetype || "application/octet-stream",
    size: file.size || 0,
    extension: file.originalname 
      ? file.originalname.split('.').pop().toLowerCase() 
      : null,
    encoding: file.encoding || null,
    fieldname: file.fieldname || null,
    buffer: file.buffer || null, // Include buffer for manual processing
  }));

  // Convert headers array to object for easier access
  const headersObj = {};
  const parsedHeaders = parseHeaders(messageHeaders);
  if (parsedHeaders && parsedHeaders.length > 0) {
    parsedHeaders.forEach(header => {
      if (Array.isArray(header) && header.length >= 2) {
        const [key, value] = header;
        headersObj[key] = value;
      }
    });
  }

  // Extract CC from body or headers
  const ccValue = cc || headersObj['Cc'] || headersObj['CC'] || "";
  // Extract TO from body or headers (can be multiple recipients)
  const toValue = recipient || headersObj['To'] || headersObj['TO'] || "";

  const emailData = {
    messageId: cleanMessageId(headersObj['Message-ID'] || headersObj['Message-Id'] || null),
    from: extractEmail(sender || from),
    to: extractEmails(toValue),
    cc: extractEmails(ccValue),
    subject: subject || "",
    text: bodyPlain || strippedText || "",
    html: bodyHtml || strippedHtml || "",
    headers: headersObj,
    attachments: processedAttachments,
    attachmentCount: Number(attachmentCount || 0),
    receivedAt: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  };

  return {
    emailData,
    token,
    timestamp,
    signature,
  };
}

/**
 * Production-ready Mailgun event webhook handler
 * 
 * Handles Mailgun event webhooks (delivered, opened, clicked, bounced, etc.)
 * with proper error handling, validation, and logging. Returns event data
 * for manual processing and saving to database.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} signingKey - Mailgun webhook signing key (optional, defaults to MAILGUN_WEBHOOK_SIGNING_KEY env var)
 * @returns {Promise<Object|null>} Returns event data if successfully processed, null otherwise
 * 
 * @example
 * const { mailgunWebhook } = require('node-inbound-email');
 * 
 * app.post('/webhook/mailgun-events', express.json(), async (req, res) => {
 *   const eventData = await mailgunWebhook(req, res);
 *   // eventData contains the processed event data for manual saving
 *   if (eventData && eventData.received && eventData.event) {
 *     await db.events.create(eventData);
 *   }
 * });
 */
async function mailgunWebhook(req, res, signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
  const startTime = Date.now();
  const correlationId = req.headers['x-request-id'] || 
                       req.headers['x-correlation-id'] || 
                       `mg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Validate request body
    if (!req || !req.body) {
      console.error(`[MailgunWebhook:${correlationId}] Invalid request: missing body`, {
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
      res.status(400).json({ 
        received: false, 
        error: 'Invalid request',
        correlationId 
      });
      return null;
    }

    // 🔐 Verify Mailgun request signature
    // Extract signature data from request body (supports both event and inbound webhooks)
    const sig = req.body.signature;
    const token = sig?.token || req.body.token;
    const sigTimestamp = sig?.timestamp || req.body.timestamp;
    const signature = sig?.signature || req.body.signature;
    
    const isValid = verifyMailgunSignature(token, sigTimestamp, signature, signingKey);
    if (!isValid) {
      console.warn(`[MailgunWebhook:${correlationId}] Invalid Mailgun webhook signature`);
      res.status(401).json({ 
        received: false, 
        error: 'Invalid signature',
        correlationId 
      });
      return null;
    }

    // Extract event data from request body
    const eventData = req.body['event-data'] || {};
    const event = eventData.event;
    const eventId = eventData.id || eventData['event-id'] || null;
    const recipient = eventData.recipient;
    const messageId = eventData.message?.headers?.['message-id'] || 
                     eventData['message-id'] || 
                     eventData.messageId || 
                     null;
    const url = eventData.url;
    const timestamp = eventData.timestamp || Date.now() / 1000;
    const domain = eventData.domain?.name || eventData.domain;
    const reason = eventData['delivery-status']?.description || 
                  eventData.reason || 
                  eventData['failure-reason'] || 
                  null;

    // Validate required fields
    if (!event) {
      console.warn(`[MailgunWebhook:${correlationId}] Missing event type`, { 
        body: req.body 
      });
      const errorResponse = { 
        received: true, 
        error: 'Missing event type',
        correlationId 
      };
      res.status(200).json(errorResponse);
      return null;
    }

    // Prepare response data with correlation ID for tracking
    let responseData = {
      received: true,
      event,
      eventId,
      recipient,
      messageId,
      timestamp: typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : timestamp,
      domain,
      correlationId,
      processedAt: new Date().toISOString(),
    };

    // Handle different event types and add event-specific data
    switch (event) {
      case "delivered":
        console.log(`[MailgunWebhook:${correlationId}] ✅ Email delivered to:`, recipient);
        console.log(`[MailgunWebhook:${correlationId}]    Message ID:`, messageId);
        responseData.status = "delivered";
        responseData.deliveredAt = typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : timestamp;
        if (eventData['delivery-status']) {
          responseData.deliveryStatus = {
            code: eventData['delivery-status'].code,
            message: eventData['delivery-status'].message,
            description: eventData['delivery-status'].description,
            tls: eventData['delivery-status'].tls,
            certificateVerified: eventData['delivery-status']['certificate-verified'],
          };
        }
        break;

      case "opened":
        console.log(`[MailgunWebhook:${correlationId}] 👀 Email opened by:`, recipient);
        console.log(`[MailgunWebhook:${correlationId}]    Message ID:`, messageId);
        responseData.status = "opened";
        responseData.openedAt = typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : timestamp;
        responseData.clientInfo = eventData['client-info'] || null;
        responseData.geolocation = eventData.geolocation || null;
        responseData.userAgent = eventData['client-info']?.clientName || null;
        break;

      case "clicked":
        console.log(`[MailgunWebhook:${correlationId}] 🔗 Link clicked:`, url);
        console.log(`[MailgunWebhook:${correlationId}]    Recipient:`, recipient);
        console.log(`[MailgunWebhook:${correlationId}]    Message ID:`, messageId);
        responseData.status = "clicked";
        responseData.url = url;
        responseData.clickedAt = typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : timestamp;
        responseData.clientInfo = eventData['client-info'] || null;
        responseData.geolocation = eventData.geolocation || null;
        break;

      case "bounced":
        console.log(`[MailgunWebhook:${correlationId}] ❌ Email bounced:`, recipient);
        console.log(`[MailgunWebhook:${correlationId}]    Message ID:`, messageId);
        responseData.status = "bounced";
        responseData.reason = reason;
        responseData.bouncedAt = typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : timestamp;
        if (eventData['delivery-status']) {
          responseData.deliveryStatus = {
            code: eventData['delivery-status'].code,
            message: eventData['delivery-status'].message,
            description: eventData['delivery-status'].description,
            attemptNo: eventData['delivery-status']['attempt-no'],
            sessionSeconds: eventData['delivery-status']['session-seconds'],
          };
        }
        responseData.severity = eventData.severity || 'permanent';
        break;

      case "complained":
        console.log(`[MailgunWebhook:${correlationId}] 🚨 Spam complaint:`, recipient);
        console.log(`[MailgunWebhook:${correlationId}]    Message ID:`, messageId);
        responseData.status = "complained";
        responseData.complainedAt = typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : timestamp;
        break;

      case "failed":
        console.log(`[MailgunWebhook:${correlationId}] ⚠️ Email failed:`, recipient);
        console.log(`[MailgunWebhook:${correlationId}]    Message ID:`, messageId);
        responseData.status = "failed";
        responseData.reason = reason;
        responseData.failedAt = typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : timestamp;
        if (eventData['delivery-status']) {
          responseData.deliveryStatus = {
            code: eventData['delivery-status'].code,
            message: eventData['delivery-status'].message,
            description: eventData['delivery-status'].description,
            attemptNo: eventData['delivery-status']['attempt-no'],
            sessionSeconds: eventData['delivery-status']['session-seconds'],
          };
        }
        break;

      case "unsubscribed":
        console.log(`[MailgunWebhook:${correlationId}] 📤 User unsubscribed:`, recipient);
        console.log(`[MailgunWebhook:${correlationId}]    Message ID:`, messageId);
        responseData.status = "unsubscribed";
        responseData.unsubscribedAt = typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : timestamp;
        break;

      case "stored":
        console.log(`[MailgunWebhook:${correlationId}] 💾 Email stored:`, recipient);
        console.log(`[MailgunWebhook:${correlationId}]    Message ID:`, messageId);
        responseData.status = "stored";
        responseData.storedAt = typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : timestamp;
        break;

      default:
        console.log(`[MailgunWebhook:${correlationId}] ℹ️ Other event:`, event);
        console.log(`[MailgunWebhook:${correlationId}]    Message ID:`, messageId);
        responseData.status = "unknown";
        responseData.fullEventData = eventData;
    }

    // Log successful processing
    const duration = Date.now() - startTime;
    console.log(`[MailgunWebhook:${correlationId}] ✅ Webhook processed successfully`, {
      event,
      eventId,
      duration: `${duration}ms`,
    });

    // ✅ MUST return 200 OK with event data for manual saving
    res.status(200).json(responseData);
    
    // Return event data so caller can save it manually
    return responseData;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[MailgunWebhook:${correlationId}] ❌ Webhook Error:`, {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`,
    });

    // ⚠️ Still return 200 so Mailgun doesn't retry forever
    const errorResponse = { 
      received: true, 
      error: 'Processing failed but webhook acknowledged',
      correlationId,
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(errorResponse);
    return null;
  }
}

/**
 * Create an email sender function with configurable provider (AWS SES or Mailgun) using SMTP
 * 
 * Both AWS SES and Mailgun support SMTP, so this function uses SMTP transport
 * with credentials from environment variables. Uses the same structure as production code.
 * 
 * @param {string} provider - Email provider: 'aws-ses' or 'mailgun' (optional, defaults to 'mailgun')
 * @returns {Function} Email sending function
 * 
 * @example
 * // Using AWS SES SMTP
 * const { createEmailSender } = require('node-inbound-email');
 * const sendEmail = createEmailSender('aws-ses');
 * await sendEmail('welcome', {
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   locals: { name: 'John' }
 * });
 * 
 * @example
 * // Using Mailgun SMTP
 * const { createEmailSender } = require('node-inbound-email');
 * const sendEmail = createEmailSender('mailgun');
 * await sendEmail('welcome', {
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   locals: { name: 'John' }
 * });
 */
function createEmailSender(provider = 'mailgun') {
  if (!['aws-ses', 'mailgun'].includes(provider)) {
    throw new Error("Provider must be either 'aws-ses' or 'mailgun'");
  }

  // Load email-templates when function is called
  const Email = getEmailTemplates();

  /**
   * Send email using the configured SMTP provider
   * 
   * Uses environment variables:
   * - SMTP_HOST: SMTP server hostname
   * - SMTP_PORT: SMTP server port (465 for SSL, 587 for TLS)
   * - SMTP_FROM_ADDRESS: Default from email address
   * - SMTP_AUTH_USER: SMTP authentication username
   * - SMTP_AUTH_PASSWORD: SMTP authentication password
   * 
   * @param {string} template - Template name (directory name in templates folder)
   * @param {Object} options - Email options
   * @param {string|Array} options.to - Recipient email address(es)
   * @param {string} options.subject - Email subject
   * @param {Object} options.locals - Template variables
   * @param {Array} options.attachments - Email attachments (optional)
   * @param {string} options.from - From email address (optional, uses SMTP_FROM_ADDRESS)
   * @param {string} options.replyTo - Reply-to email address (optional)
   * @param {boolean} options.send - Whether to actually send (default: true, set to false for dry-runs)
   * @returns {Promise<Object>} Email sending result
   */
  return (template, {
    to,
    subject,
    locals,
    attachments = [],
    from = null,
    replyTo = null,
    send = true
  }) => new Email({
    message: {
      from: from || process.env.SMTP_FROM_ADDRESS,
      replyTo: replyTo || from || process.env.SMTP_FROM_ADDRESS
    },
    send, // set to false for dry-runs
    transport: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true, // use SSL
      auth: {
        user: process.env.SMTP_AUTH_USER,
        pass: process.env.SMTP_AUTH_PASSWORD
      }
    },
    views: {
      options: {
        extension: "ejs"
      }
    }
  }).send({
    template,
    message: {
      to,
      subject,
      attachments
    },
    locals
  });
}

// Export utility functions for manual processing
module.exports = {
  processEmailData,
  verifyRequestSignature, // Automatic signature verification (recommended)
  verifyMailgunSignature, // Manual signature verification (advanced)
  mailgunWebhook, // Production-ready event webhook handler
  createEmailSender, // Email sender with AWS SES and Mailgun support
  extractEmail,
  extractEmails,
  cleanMessageId,
  parseHeaders,
};
