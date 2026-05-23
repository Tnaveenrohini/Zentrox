/*
  ============================================================
  ZENTROX — server.js
  Simple Express backend for the Instagram Downloader API.
  
  How to run:
    1. npm install express
    2. node server.js
    3. Open http://localhost:3000
  ============================================================
*/

// ===== IMPORTS =====
const express = require('express');
const path    = require('path');

// Create Express app
const app  = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====

// Parse incoming JSON request bodies
app.use(express.json());

// Serve all static files (HTML, CSS, JS) from current directory
app.use(express.static(path.join(__dirname)));

// Basic security headers (no extra library needed)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});


// ===== HELPER: Detect content type from Instagram URL =====
function detectType(url) {
  const lower = url.toLowerCase();
  if (lower.includes('/reel/') || lower.includes('/reels/'))  return 'reel';
  if (lower.includes('/stories/'))                             return 'story';
  if (lower.includes('/tv/'))                                  return 'video';
  if (lower.includes('/p/'))                                   return 'photo';
  return 'video'; // default
}

// ===== HELPER: Validate Instagram URL =====
function isValidInstagramUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('instagram.com');
  } catch {
    return false;
  }
}


// ===== API: POST /api/download =====
/*
  Request body:  { url: "https://www.instagram.com/reel/..." }
  Response:      { title, type, thumbnail, downloadUrl, duration }
  
  NOTE: This demo returns simulated data.
  For a real app, you would integrate a scraping library here
  (e.g., instagram-url-direct, yt-dlp via child_process, or a
  third-party API). We keep this simple and educational.
*/
app.post('/api/download', async (req, res) => {
  const { url } = req.body;

  // 1. Check URL was provided
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'No URL provided. Please paste an Instagram link.' });
  }

  // 2. Validate it's an Instagram URL
  if (!isValidInstagramUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL. Only instagram.com links are supported.' });
  }

  // 3. Detect content type from URL structure
  const type = detectType(url);

  /*
    ---- REAL INTEGRATION POINT ----
    Replace the block below with actual scraping logic.
    Example using yt-dlp (must be installed on server):

    const { execFile } = require('child_process');
    execFile('yt-dlp', ['--get-url', '--get-title', url], (err, stdout) => {
      if (err) return res.status(500).json({ error: 'Could not fetch media.' });
      const [title, downloadUrl] = stdout.split('\n');
      return res.json({ title, type, downloadUrl, thumbnail: '' });
    });
  */

  // 4. Simulate a small delay (mimics network fetch)
  await new Promise(resolve => setTimeout(resolve, 1200));

  // 5. Return demo response
  //    In production: replace with real title/thumbnail/downloadUrl from scraper
  const typeLabels = {
    reel:  'Instagram Reel',
    story: 'Instagram Story',
    video: 'Instagram Video',
    photo: 'Instagram Photo',
  };

  return res.json({
    success:     true,
    type:        type,
    title:       typeLabels[type] || 'Instagram Content',
    thumbnail:   'https://picsum.photos/300/300?grayscale&random=' + Math.floor(Math.random() * 100),
    downloadUrl: url,          // In production: actual media URL from scraper
    duration:    type === 'photo' ? '—' : '0:' + (Math.floor(Math.random() * 59) + 10),
    quality:     'HD 1080p',
  });
});


// ===== API: GET /api/health =====
// Simple health-check endpoint (useful for Render / Vercel monitoring)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime().toFixed(1) + 's' });
});


// ===== CATCH-ALL: serve index.html for any unknown route =====
// This supports client-side navigation (all pages are in index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════╗
  ║   ZENTROX Server Running         ║
  ║   http://localhost:${PORT}          ║
  ╚══════════════════════════════════╝
  `);
});

module.exports = app; // export for testing or Vercel serverless
