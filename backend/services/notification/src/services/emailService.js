const nodemailer = require('nodemailer');

// Use ethereal email (or similar mock service) for development
// To use a real SMTP server, update these credentials via environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || 'medsync.mock@ethereal.email',
    pass: process.env.SMTP_PASS || 'mockpassword',
  },
});

const sendEmail = async (to, subject, text) => {
  try {
    const info = await transporter.sendMail({
      from: '"MedSync Notifications" <no-reply@medsync.com>',
      to,
      subject,
      text,
    });
    console.log(`[EmailService] Sent email to ${to}: ${info.messageId}`);
  } catch (error) {
    console.error(`[EmailService] Error sending email to ${to}:`, error.message);
  }
};

module.exports = { sendEmail };
