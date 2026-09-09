const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { createOrder, verifyPaymentSignature, verifyWebhookSignature } = require('../payments/razorpay');
const { queueGeneration } = require('./ai');

const router = express.Router();

const COUPONS = { SUCCESS15: 15, SNSGATE15: 15, PATH15OFF: 15 }; // % off, per FR-005/gatepass reward

function priceForCoupon(code) {
  const base = Number(process.env.PRICE_PAISE || 11000);
  const pct = COUPONS[(code || '').toUpperCase()] || 0;
  return Math.round(base * (1 - pct / 100));
}

// FR-044/FR-045: build order summary + create provider order before redirecting to payment
router.post('/create-order', async (req, res) => {
  try {
    const { assessmentId, couponCode } = req.body || {};
    const assessment = db.prepare('SELECT * FROM assessments WHERE assessment_id = ?').get(assessmentId);
    if (!assessment) return res.status(404).json({ error: 'assessment not found' });

    const amount = priceForCoupon(couponCode);
    const currency = process.env.CURRENCY || 'INR';
    const order_id = nanoid();

    const rzpOrder = await createOrder({
      amount,
      currency,
      receipt: order_id,
      notes: { assessment_id: assessmentId, coupon_code: couponCode || '' },
    });

    db.prepare(
      `INSERT INTO orders (order_id, razorpay_order_id, user_id, assessment_id, amount, currency, coupon_code)
       VALUES (?,?,?,?,?,?,?)`
    ).run(order_id, rzpOrder.id, assessment.user_id, assessmentId, amount, currency, couponCode || null);

    res.json({
      order_id,
      razorpay_order_id: rzpOrder.id,
      amount,
      currency,
      key_id: process.env.RAZORPAY_KEY_ID, // safe to expose — this is the public key
    });
  } catch (err) {
    res.status(500).json({ error: 'failed to create order', detail: err.message });
  }
});

function activate(orderRow) {
  db.prepare("UPDATE orders SET status = 'PAID' WHERE order_id = ?").run(orderRow.order_id);
  const existing = db
    .prepare("SELECT * FROM entitlements WHERE user_id = ? AND status = 'ACTIVE'")
    .get(orderRow.user_id);
  if (!existing) {
    db.prepare('INSERT INTO entitlements (entitlement_id, user_id) VALUES (?,?)').run(
      nanoid(),
      orderRow.user_id
    );
  }
  queueGeneration(orderRow.user_id, orderRow.assessment_id);
}

// FR-047: server-side verification of the signature the browser's checkout handler receives.
// This is the fast path for immediate UI feedback; the webhook below is the source of truth.
router.post('/verify', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(razorpay_order_id);
  if (!order) return res.status(404).json({ error: 'order not found' });

  const valid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!valid) {
    db.prepare("UPDATE orders SET status = 'FAILED' WHERE order_id = ?").run(order.order_id);
    return res.status(400).json({ error: 'invalid signature' });
  }

  db.prepare('UPDATE orders SET provider_reference = ? WHERE order_id = ?').run(
    razorpay_payment_id,
    order.order_id
  );
  activate(order);
  res.json({ ok: true });
});

// FR-049: idempotent webhook handling — the durable source of truth for payment status.
// Requires the raw body (see server.js route-level raw parser for this path).
router.post('/webhook', (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body; // Buffer, thanks to express.raw() on this route

  const valid = verifyWebhookSignature({ rawBody: rawBody.toString('utf8'), signature });
  if (!valid) return res.status(400).json({ error: 'invalid webhook signature' });

  const payload = JSON.parse(rawBody.toString('utf8'));
  const event = payload.event;

  if (event === 'payment.captured' || event === 'order.paid') {
    const rzpOrderId = payload.payload?.payment?.entity?.order_id || payload.payload?.order?.entity?.id;
    const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(rzpOrderId);
    if (order && order.status !== 'PAID') {
      activate(order); // idempotent: activate() no-ops entitlement creation if one already exists
    }
  }

  res.json({ received: true });
});

module.exports = router;