const Email = require("email-templates");

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
 * const sendEmail = require('./sendEmail')('aws-ses');
 * await sendEmail('welcome', {
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   locals: { name: 'John' }
 * });
 * 
 * @example
 * // Using Mailgun SMTP
 * const sendEmail = require('./sendEmail')('mailgun');
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

module.exports = createEmailSender;
