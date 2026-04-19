const axios = require('axios');

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification:3006/api/notify';

const sendReceiptEmail = async ({ to, subject, text }) => {
  if (!to) return false;

  try {
    await axios.post(`${NOTIFICATION_SERVICE_URL}/email`, { to, subject, text }, { timeout: 7000 });
    return true;
  } catch (error) {
    console.error('[payment] failed to send receipt email via notification service:', error.message);
    return false;
  }
};

module.exports = {
  sendReceiptEmail,
};
