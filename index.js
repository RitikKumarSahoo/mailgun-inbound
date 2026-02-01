const crypto = require("crypto");

/**
 * Verify Mailgun webhook signature
 * @param {string} token - Mailgun token
 * @param {string} timestamp - Request timestamp
 * @param {string} signature - Mailgun signature
 * @param {string} signingKey - Mailgun webhook signing key
 * @returns {boolean} True if signature is valid
 */
function verifyMailgunSignature(token, timestamp, signature, signingKey) {
  if (!signingKey) {
    console.error("[MailgunInbound] MAILGUN_WEBHOOK_SIGNING_KEY missing");
    return false;
  }

  if (!token || !timestamp || !signature) {
    console.error("[MailgunInbound] Missing required signature parameters");
    return false;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = Number(timestamp);

  // Validate timestamp is a number
  if (isNaN(requestTime)) {
    console.error("[MailgunInbound] Invalid timestamp format");
    return false;
  }

  // Prevent replay attack (15 min window)
  if (Math.abs(currentTime - requestTime) > 900) {
    console.error("[MailgunInbound] Expired timestamp", { 
      currentTime, 
      requestTime, 
      difference: Math.abs(currentTime - requestTime) 
    });
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
    console.error("[MailgunInbound] Signature verification error:", error.message);
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
 * from the request body and verifies the signature. You only need to
 * provide the signing key.
 * 
 * @param {Object} req - Express request object with body
 * @param {Object} req.body - Request body containing token, timestamp, signature
 * @param {string} signingKey - Mailgun webhook signing key (or use MAILGUN_WEBHOOK_SIGNING_KEY env var)
 * @returns {boolean} True if signature is valid
 * 
 * @example
 * const { verifyRequestSignature } = require('mailgun-inbound-email');
 * const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
 * if (!verifyRequestSignature(req, signingKey)) {
 *   return res.status(401).json({ error: 'Invalid signature' });
 * }
 */
function verifyRequestSignature(req, signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
  if (!req || !req.body) {
    console.error("[MailgunInbound] Invalid request: missing body");
    return false;
  }

  const { token, timestamp, signature } = req.body;
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
 * const { processEmailData } = require('mailgun-inbound-email');
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

// Export utility functions for manual processing
module.exports = {
  processEmailData,
  verifyRequestSignature, // Automatic signature verification (recommended)
  verifyMailgunSignature, // Manual signature verification (advanced)
  extractEmail,
  extractEmails,
  cleanMessageId,
  parseHeaders,
};
