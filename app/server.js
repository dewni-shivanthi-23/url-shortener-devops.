const express = require('express');
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const client = require('prom-client');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/urlshortener';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Prometheus metrics (Phase 7: Monitoring) ----------
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});
register.registerMetric(httpRequestCounter);

app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ---------- Health check (used by Docker/K8s probes) ----------
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({ status: 'ok', db: dbState });
});

// ---------- Mongoose model ----------
const urlSchema = new mongoose.Schema({
  shortCode: { type: String, required: true, unique: true },
  originalUrl: { type: String, required: true },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Url = mongoose.model('Url', urlSchema);

// ---------- Routes ----------

// Create a short URL
app.post('/api/shorten', async (req, res) => {
  try {
    const { originalUrl } = req.body;
    if (!originalUrl || !/^https?:\/\//.test(originalUrl)) {
      return res.status(400).json({ error: 'Please provide a valid URL starting with http:// or https://' });
    }

    const shortCode = nanoid(7);
    const url = new Url({ shortCode, originalUrl });
    await url.save();

    res.json({
      shortCode,
      shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`,
      originalUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong', details: err.message });
  }
});

// Redirect short URL to original
app.get('/:shortCode', async (req, res) => {
  try {
    const url = await Url.findOne({ shortCode: req.params.shortCode });
    if (!url) return res.status(404).json({ error: 'Short URL not found' });

    url.clicks += 1;
    await url.save();
    res.redirect(url.originalUrl);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Get stats for a short URL
app.get('/api/stats/:shortCode', async (req, res) => {
  const url = await Url.findOne({ shortCode: req.params.shortCode });
  if (!url) return res.status(404).json({ error: 'Not found' });
  res.json(url);
});

// ---------- Start server ----------
async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
