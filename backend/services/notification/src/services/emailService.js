const nodemailer = require('nodemailer');

// Use ethereal email (or similar mock service) for development
// To use a real SMTP server, update these credentials via environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER || 'medsync.mock@ethereal.email',
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || 'mockpassword',
  },
});

const sendEmail = async (to, subject, text) => {
  if (!to) {
    console.warn('[EmailService] sendEmail called with empty `to` — skipping');
    return false;
  }
  // Gmail rewrites the From header to the auth user anyway; honour EMAIL_FROM
  // when set so other providers display a friendly From.
  const from = process.env.EMAIL_FROM
    || (process.env.EMAIL_USER ? `"MedSync Notifications" <${process.env.EMAIL_USER}>` : '"MedSync Notifications" <no-reply@medsync.com>');
  try {
    const info = await transporter.sendMail({ from, to, subject, text });
    console.log(`[EmailService] ✓ Sent email to ${to} (subject: "${subject}") messageId=${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EmailService] ✗ Send failed to ${to} (subject: "${subject}"): ${error.message}`);
    return false;
  }
};

module.exports = { sendEmail };
