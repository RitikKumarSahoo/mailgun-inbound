/**
 * Example usage of createEmailSender function with SMTP
 * 
 * This example shows how to use the email sender with both AWS SES and Mailgun via SMTP.
 * Both providers use the same SMTP environment variables - just set them appropriately
 * for the provider you're using.
 */

const { createEmailSender } = require('./index');

// Example 1: Using AWS SES SMTP
// Set these environment variables for AWS SES:
// SMTP_HOST=email-smtp.us-east-1.amazonaws.com (or your AWS SES region, e.g., email-smtp.eu-west-1.amazonaws.com)
// SMTP_PORT=465 (or 587 for TLS)
// SMTP_FROM_ADDRESS=noreply@example.com (must be verified in AWS SES)
// SMTP_AUTH_USER=your-ses-smtp-username (IAM SMTP username)
// SMTP_AUTH_PASSWORD=your-ses-smtp-password (IAM SMTP password)
async function exampleAWSSES() {
  const sendEmail = createEmailSender('aws-ses');

  try {
    const result = await sendEmail('welcome', {
      to: 'user@example.com',
      subject: 'Welcome to our service!',
      locals: {
        name: 'John Doe',
        company: 'Example Inc'
      },
      attachments: [], // Optional
      from: 'noreply@example.com', // Optional, uses SMTP_FROM_ADDRESS if not provided
      replyTo: 'support@example.com', // Optional
      send: true // Set to false for dry-run
    });

    console.log('Email sent successfully:', result);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Example 2: Using Mailgun SMTP
// Set these environment variables for Mailgun:
// SMTP_HOST=smtp.mailgun.org
// SMTP_PORT=465 (or 587 for TLS)
// SMTP_FROM_ADDRESS=noreply@example.com (must be from your Mailgun domain)
// SMTP_AUTH_USER=postmaster@mg.example.com (your Mailgun SMTP username, found in Mailgun dashboard)
// SMTP_AUTH_PASSWORD=your-mailgun-smtp-password (your Mailgun SMTP password, found in Mailgun dashboard)
async function exampleMailgun() {
  const sendEmail = createEmailSender('mailgun');

  try {
    const result = await sendEmail('welcome', {
      to: ['user1@example.com', 'user2@example.com'], // Can be array or string
      subject: 'Welcome to our service!',
      locals: {
        name: 'Jane Doe',
        company: 'Example Inc'
      },
      attachments: [
        {
          filename: 'document.pdf',
          path: './path/to/document.pdf'
        }
      ],
      send: true
    });

    console.log('Email sent successfully:', result);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Example 3: Dry-run (testing without sending)
async function exampleDryRun() {
  const sendEmail = createEmailSender('mailgun');

  // Set send to false for dry-run
  const result = await sendEmail('welcome', {
    to: 'user@example.com',
    subject: 'Welcome!',
    locals: { name: 'Test User' },
    send: false // Won't actually send the email
  });

  console.log('Dry-run result:', result);
}

// Run examples (uncomment to test)
// exampleAWSSES();
// exampleMailgun();
// exampleDryRun();

module.exports = {
  exampleAWSSES,
  exampleMailgun,
  exampleDryRun
};
