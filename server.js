require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const assessmentRoutes = require('./src/routes/assessment');
const checkoutRoutes = require('./src/routes/checkout');
const aiRoutes = require('./src/routes/ai');
const dashboardRoutes = require('./src/routes/dashboard');
const waitlistRoutes = require('./src/routes/waitlist');

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim());

app.use(
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  })
);

// Razorpay webhook needs the raw, unparsed body to verify the HMAC signature.
// Express body-parsers set req._body=true once they've run, so registering this
// narrower raw parser first (matched only for the exact webhook path) makes the
// later, broader express.json() call below skip re-parsing for that one route —
// while still parsing JSON normally for every other /api/checkout/* route.
app.use('/api/checkout/webhook', express.raw({ type: '*/*' }));
app.use(express.json());

app.use('/api/checkout', checkoutRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/generation', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/waitlist', waitlistRoutes);

// Lets the frontend know whether to show live Razorpay checkout or a waitlist
// capture. Flip ENABLE_PAYMENTS to "true" once Razorpay keys are configured —
// no frontend redeploy needed beyond the env var change.
app.get('/api/config', (req, res) => {
  res.json({ paymentsEnabled: process.env.ENABLE_PAYMENTS === 'true' });
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serves the marketing site (public/index.html) so the whole product is one deployable app.
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Skill N Success backend listening on :${PORT}`));
