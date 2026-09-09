const crypto = require('crypto');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function createOrder({ amount, currency, receipt, notes }) {
  return razorpay.orders.create({ amount, currency, receipt, notes });
}

// Verifies the signature returned to the browser's checkout success handler.
// Per Razorpay docs: expected = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

// Verifies webhook payloads sent by Razorpay's servers (Dashboard → Webhooks).
// Header: x-razorpay-signature. Body must be the raw request body (string).
function verifyWebhookSignature({ rawBody, signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}

module.exports = { razorpay, createOrder, verifyPaymentSignature, verifyWebhookSignature };
