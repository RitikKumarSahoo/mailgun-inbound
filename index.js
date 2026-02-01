const express = require("express");
const crypto = require("crypto");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Verify Mailgun webhook signature
 */
function verifyMailgunSignature(token, timestamp, signature, signingKey) {
  if (!signingKey) {
    console.error("MAILGUN_WEBHOOK_SIGNING_KEY missing");
    return false;
  }

  const currentTime = Math.floor(Date.now() / 1000);

  // Prevent replay attack (15 min)
  if (Math.abs(currentTime - Number(timestamp)) > 900) {
    console.error("Expired timestamp");
    return false;
  }

  const hmac = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex");

  return hmac === signature;
}

/**
 * Parse headers safely
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
 */
function extractEmail(value = "") {
  if (!value || typeof value !== 'string') return "";
  const match = value.match(/<(.+?)>/);
  return match ? match[1].trim() : value.trim();
}

/**
 * Extract multiple emails from comma-separated string
 */
function extractEmails(value = "") {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map(email => extractEmail(email.trim())).filter(Boolean);
}

/**
 * Remove angle brackets from message ID
 */
function cleanMessageId(value) {
  if (!value || typeof value !== 'string') return null;
  return value.replace(/^<|>$/g, '').trim() || null;
}

/**
 * Process email data from Mailgun webhook
 */
function processEmailData(req) {
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

  // Process attachments metadata (without buffer for clean JSON)
  const processedAttachments = (req.files || []).map((file) => ({
    filename: file.originalname || `attachment-${Date.now()}`,
    originalname: file.originalname || null,
    mimetype: file.mimetype || null,
    size: file.size || 0,
    extension: file.originalname ? file.originalname.split('.').pop() : null,
    encoding: file.encoding || null,
    fieldname: file.fieldname || null,
  }));

  // Convert headers array to object for easier storage
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
  const ccValue = cc || headersObj['Cc'] || headersObj['CC'] || ""
  // Extract TO from body or headers (can be multiple recipients)
  const toValue = recipient || headersObj['To'] || headersObj['TO'] || ""

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
 * Create Express router for Mailgun inbound email webhook
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.signingKey - Mailgun webhook signing key (or use MAILGUN_WEBHOOK_SIGNING_KEY env var)
 * @param {Function} options.onEmailReceived - Callback function called when email is received (emailData) => {}
 * @param {string} options.path - Route path (default: '/inbound')
 * @param {boolean} options.requireSignature - Whether to require signature verification (default: true)
 * @returns {express.Router} Express router
 */
function createMailgunInboundRouter(options = {}) {
  const router = express.Router();
  const {
    signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY,
    onEmailReceived,
    path = '/inbound',
    requireSignature = true,
  } = options;

  router.post(path, express.urlencoded({ extended: true }), upload.any(), (req, res) => {
    try {
      const { emailData, token, timestamp, signature } = processEmailData(req);

      // 🔐 Verify Mailgun authenticity
      if (requireSignature && !verifyMailgunSignature(token, timestamp, signature, signingKey)) {
        return res.status(401).json({ error: "Invalid Mailgun signature" });
      }

      // Validate required fields
      if (!emailData.from || !emailData.to || emailData.to.length === 0) {
        console.error("Missing required email fields:", { from: emailData.from, to: emailData.to });
        // Still return 200 to prevent Mailgun retries
        return res.status(200).json({ received: true, error: "Missing required fields" });
      }

      // Call user-provided callback if provided
      if (onEmailReceived && typeof onEmailReceived === 'function') {
        try {
          onEmailReceived(emailData);
        } catch (callbackError) {
          console.error("Error in onEmailReceived callback:", callbackError);
        }
      } else {
        // Default: log clean JSON data ready to save
        console.log(JSON.stringify(emailData, null, 2));
      }

      res.status(200).json({ received: true });

    } catch (error) {
      console.error("Inbound email processing error:", {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      // Mailgun MUST receive 200 or it will retry
      res.status(200).json({ received: true });
    }
  });

  return router;
}

/**
 * Create Express middleware for Mailgun inbound email webhook
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.signingKey - Mailgun webhook signing key (or use MAILGUN_WEBHOOK_SIGNING_KEY env var)
 * @param {Function} options.onEmailReceived - Callback function called when email is received (emailData) => {}
 * @param {boolean} options.requireSignature - Whether to require signature verification (default: true)
 * @returns {Array} Express middleware array
 */
function createMailgunInboundMiddleware(options = {}) {
  const {
    signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY,
    onEmailReceived,
    requireSignature = true,
  } = options;

  return [
    express.urlencoded({ extended: true }),
    upload.any(),
    (req, res, next) => {
      try {
        const { emailData, token, timestamp, signature } = processEmailData(req);

        // 🔐 Verify Mailgun authenticity
        if (requireSignature && !verifyMailgunSignature(token, timestamp, signature, signingKey)) {
          return res.status(401).json({ error: "Invalid Mailgun signature" });
        }

        // Validate required fields
        if (!emailData.from || !emailData.to || emailData.to.length === 0) {
          console.error("Missing required email fields:", { from: emailData.from, to: emailData.to });
          return res.status(200).json({ received: true, error: "Missing required fields" });
        }

        // Attach emailData to request object
        req.emailData = emailData;

        // Call user-provided callback if provided
        if (onEmailReceived && typeof onEmailReceived === 'function') {
          try {
            onEmailReceived(emailData);
          } catch (callbackError) {
            console.error("Error in onEmailReceived callback:", callbackError);
          }
        } else {
          // Default: log clean JSON data ready to save
          console.log(JSON.stringify(emailData, null, 2));
        }

        res.status(200).json({ received: true });

      } catch (error) {
        console.error("Inbound email processing error:", {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });

        // Mailgun MUST receive 200 or it will retry
        res.status(200).json({ received: true });
      }
    }
  ];
}

// Export utilities and main functions
module.exports = {
  createMailgunInboundRouter,
  createMailgunInboundMiddleware,
  processEmailData,
  verifyMailgunSignature,
  extractEmail,
  extractEmails,
  cleanMessageId,
  parseHeaders,
};

