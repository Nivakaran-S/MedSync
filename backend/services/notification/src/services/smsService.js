let twilioClient = null;
if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM &&
    process.env.TWILIO_SID.startsWith('AC') && !process.env.TWILIO_SID.includes('your_')) {
  twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
}

const sendSMS = async (phoneNumber, message) => {
  if (!phoneNumber) {
    console.warn('[SMSService] No phone number provided');
    return;
  }

  if (twilioClient) {
    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_FROM,
        to: phoneNumber,
      });
      console.log(`[SMSService] Sent SMS to ${phoneNumber}`);
    } catch (error) {
      console.error(`[SMSService] Twilio error:`, error.message);
    }
    return;
  }

  console.log(`[SMSService] (mock) SMS to ${phoneNumber}: "${message}"`);
};

module.exports = { sendSMS };
