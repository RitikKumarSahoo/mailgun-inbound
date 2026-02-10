# Email Sending with AWS SES and Mailgun (SMTP)

A flexible email sending function that supports both **AWS SES** and **Mailgun** via SMTP. Uses `email-templates` for template rendering and follows the same structure as production code.

## 🚀 Quick Start

### Installation

Install the required dependency:

```bash
npm install email-templates
```

### Basic Usage

```javascript
const createEmailSender = require('./sendEmail');

// Create email sender (supports 'aws-ses' or 'mailgun')
const sendEmail = createEmailSender('mailgun');

// Send email
await sendEmail('welcome', {
  to: 'user@example.com',
  subject: 'Welcome!',
  locals: { name: 'John Doe' }
});
```

## 📋 Configuration

Both AWS SES and Mailgun use the same SMTP environment variables. Simply set them appropriately for your chosen provider.

### Required Environment Variables

```bash
SMTP_HOST=your-smtp-host
SMTP_PORT=465
SMTP_FROM_ADDRESS=noreply@example.com
SMTP_AUTH_USER=your-smtp-username
SMTP_AUTH_PASSWORD=your-smtp-password
```

### AWS SES Configuration

For AWS SES, set these environment variables:

```bash
# AWS SES SMTP endpoint (varies by region)
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
# Or for other regions:
# SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
# SMTP_HOST=email-smtp.ap-south-1.amazonaws.com

SMTP_PORT=465          # Use 465 for SSL or 587 for TLS
SMTP_FROM_ADDRESS=noreply@example.com  # Must be verified in AWS SES
SMTP_AUTH_USER=your-iam-smtp-username   # IAM SMTP username
SMTP_AUTH_PASSWORD=your-iam-smtp-password  # IAM SMTP password
```

**Getting AWS SES SMTP Credentials:**
1. Go to AWS SES Console → SMTP Settings
2. Create SMTP credentials (IAM user)
3. Copy the SMTP username and password
4. Use the SMTP endpoint for your region

**AWS SES SMTP Endpoints by Region:**
- US East (N. Virginia): `email-smtp.us-east-1.amazonaws.com`
- US West (Oregon): `email-smtp.us-west-2.amazonaws.com`
- EU (Ireland): `email-smtp.eu-west-1.amazonaws.com`
- EU (Frankfurt): `email-smtp.eu-central-1.amazonaws.com`
- Asia Pacific (Mumbai): `email-smtp.ap-south-1.amazonaws.com`
- Asia Pacific (Singapore): `email-smtp.ap-southeast-1.amazonaws.com`
- [Full list of endpoints](https://docs.aws.amazon.com/ses/latest/dg/smtp-endpoints.html)

### Mailgun Configuration

For Mailgun, set these environment variables:

```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=465          # Use 465 for SSL or 587 for TLS
SMTP_FROM_ADDRESS=noreply@example.com  # Must be from your Mailgun domain
SMTP_AUTH_USER=postmaster@mg.example.com  # Your Mailgun SMTP username
SMTP_AUTH_PASSWORD=your-mailgun-smtp-password  # Your Mailgun SMTP password
```

**Getting Mailgun SMTP Credentials:**
1. Go to Mailgun Dashboard → Sending → Domain Settings
2. Find your domain's SMTP credentials
3. Copy the SMTP username (usually `postmaster@mg.yourdomain.com`)
4. Copy the SMTP password

## 📖 API Reference

### `createEmailSender(provider)`

Creates an email sender function with the specified provider.

**Parameters:**
- `provider` (string, optional) - Email provider: `'aws-ses'` or `'mailgun'`. Defaults to `'mailgun'`.

**Returns:**
A function `sendEmail(template, options)` that sends emails using the configured SMTP provider.

**Example:**
```javascript
const sendEmail = createEmailSender('aws-ses');
// or
const sendEmail = createEmailSender('mailgun');
```

### `sendEmail(template, options)`

Sends an email using the configured provider.

**Parameters:**
- `template` (string, required) - Template name (directory name in templates folder)
- `options` (Object, required) - Email options
  - `to` (string|Array, required) - Recipient email address(es)
  - `subject` (string, required) - Email subject
  - `locals` (Object, required) - Template variables to pass to the template
  - `attachments` (Array, optional) - Email attachments
  - `from` (string, optional) - From email address (uses `SMTP_FROM_ADDRESS` if not provided)
  - `replyTo` (string, optional) - Reply-to email address
  - `send` (boolean, optional) - Whether to actually send (default: `true`, set to `false` for dry-runs)

**Returns:**
Promise that resolves to the email sending result.

## 💡 Examples

### Basic Email

```javascript
const createEmailSender = require('./sendEmail');
const sendEmail = createEmailSender('mailgun');

await sendEmail('welcome', {
  to: 'user@example.com',
  subject: 'Welcome to our service!',
  locals: {
    name: 'John Doe',
    company: 'Example Inc'
  }
});
```

### Multiple Recipients

```javascript
await sendEmail('newsletter', {
  to: ['user1@example.com', 'user2@example.com'],
  subject: 'Monthly Newsletter',
  locals: { month: 'January' }
});
```

### With Attachments

```javascript
await sendEmail('invoice', {
  to: 'customer@example.com',
  subject: 'Your Invoice',
  locals: { invoiceNumber: 'INV-123' },
  attachments: [
    {
      filename: 'invoice.pdf',
      path: './invoices/invoice-123.pdf'
    }
  ]
});
```

### Custom From and Reply-To

```javascript
await sendEmail('support', {
  to: 'user@example.com',
  subject: 'Support Request',
  locals: { ticketId: 'TICKET-123' },
  from: 'support@example.com',
  replyTo: 'support-team@example.com'
});
```

### Dry Run (Testing)

```javascript
// Set send to false to test without actually sending
const result = await sendEmail('welcome', {
  to: 'user@example.com',
  subject: 'Welcome!',
  locals: { name: 'Test User' },
  send: false // Won't actually send the email
});

console.log('Dry-run result:', result);
```

### Switching Providers

```javascript
// Use environment variable to switch providers
const provider = process.env.EMAIL_PROVIDER || 'mailgun';
const sendEmail = createEmailSender(provider);

// Same function works for both providers
await sendEmail('welcome', {
  to: 'user@example.com',
  subject: 'Welcome!',
  locals: { name: 'John' }
});
```

### Error Handling

```javascript
try {
  const result = await sendEmail('welcome', {
    to: 'user@example.com',
    subject: 'Welcome!',
    locals: { name: 'John' }
  });
  console.log('Email sent:', result);
} catch (error) {
  console.error('Failed to send email:', error);
  // Handle error appropriately
}
```

## 📁 Template Structure

The function uses `email-templates` for template rendering. Your templates should be organized like this:

```
templates/
  welcome/
    html.ejs    # HTML template (required)
    text.ejs    # Plain text template (optional)
    subject.ejs # Subject template (optional)
  invoice/
    html.ejs
    text.ejs
```

### Example Template (`templates/welcome/html.ejs`)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Welcome</title>
</head>
<body>
  <h1>Welcome, <%= name %>!</h1>
  <p>Thank you for joining <%= company %>.</p>
  <p>We're excited to have you on board!</p>
</body>
</html>
```

### Example Template (`templates/welcome/text.ejs`)

```
Welcome, <%= name %>!

Thank you for joining <%= company %>.

We're excited to have you on board!
```

### Example Template (`templates/welcome/subject.ejs`)

```
Welcome to <%= company %>, <%= name %>!
```

## 🔧 Environment Variables

All configuration is done through environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.mailgun.org` or `email-smtp.us-east-1.amazonaws.com` |
| `SMTP_PORT` | SMTP server port | `465` (SSL) or `587` (TLS) |
| `SMTP_FROM_ADDRESS` | Default from email address | `noreply@example.com` |
| `SMTP_AUTH_USER` | SMTP authentication username | `postmaster@mg.example.com` or IAM SMTP username |
| `SMTP_AUTH_PASSWORD` | SMTP authentication password | Your SMTP password |

### Using .env File

Create a `.env` file in your project root:

```bash
# For Mailgun
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=465
SMTP_FROM_ADDRESS=noreply@example.com
SMTP_AUTH_USER=postmaster@mg.example.com
SMTP_AUTH_PASSWORD=your-mailgun-smtp-password

# Or for AWS SES
# SMTP_HOST=email-smtp.us-east-1.amazonaws.com
# SMTP_PORT=465
# SMTP_FROM_ADDRESS=noreply@example.com
# SMTP_AUTH_USER=your-iam-smtp-username
# SMTP_AUTH_PASSWORD=your-iam-smtp-password
```

Then load it using `dotenv`:

```javascript
require('dotenv').config();
const createEmailSender = require('./sendEmail');
const sendEmail = createEmailSender('mailgun');
```

## ⚙️ Port Configuration

### Port 465 (SSL)
- Uses SSL/TLS encryption
- Set `secure: true` in transport (already configured)
- Recommended for most use cases

### Port 587 (TLS/STARTTLS)
- Uses STARTTLS encryption
- Requires `secure: false` and `requireTLS: true`
- If you need to use port 587, modify the transport configuration

**Note:** The current implementation uses `secure: true` which works with port 465. For port 587, you would need to modify the transport configuration in `sendEmail.js`.

## 📦 Requirements

- Node.js >= 14.0.0
- `email-templates` - For template rendering

## 🔍 Troubleshooting

### Common Issues

**1. "Connection timeout" or "Connection refused"**
- Check that `SMTP_HOST` and `SMTP_PORT` are correct
- Verify firewall/network settings allow SMTP connections
- For AWS SES, ensure you're using the correct regional endpoint

**2. "Authentication failed"**
- Verify `SMTP_AUTH_USER` and `SMTP_AUTH_PASSWORD` are correct
- For AWS SES, ensure SMTP credentials are created and active
- For Mailgun, check that SMTP credentials match your domain

**3. "Sender not verified"**
- For AWS SES: Verify the sender email address in AWS SES Console
- For Mailgun: Ensure the sender email is from your verified Mailgun domain

**4. "Template not found"**
- Ensure templates are in the `templates/` directory
- Check that template name matches the directory name
- Verify `html.ejs` file exists in the template directory

## 📚 See Also

- [email-templates documentation](https://www.npmjs.com/package/email-templates)
- [AWS SES SMTP documentation](https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html)
- [Mailgun SMTP documentation](https://documentation.mailgun.com/en/latest/user_manual.html#sending-via-smtp)

## 📝 License

MIT

