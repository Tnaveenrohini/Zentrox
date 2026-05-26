/*
  ============================================================
  ZENTROX — server.js  (Real Download Engine)
  
  Strategy:
    1. Extract shortcode from any Instagram URL
    2. Try yt-dlp (works on Render/VPS with cookies set)
    3. Try Instagram's internal GraphQL API as fallback
    4. Return structured media data to frontend
  
  Run locally:  node server.js
  Deploy:       Render / Railway / VPS (NOT Vercel — needs yt-dlp binary)
  ============================================================
*/

const express    = require('express');
const path       = require('path');
const { execFile, exec } = require('child_process');
const https      = require('https');
const http       = require('http');
const url        = require('url');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ===== MIDDLEWARE ===== */
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Security headers — no library needed
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Allow cross-origin for media preview
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});


/* ===================================================
   HELPER: Validate & parse any Instagram URL
   Supports: /reel/, /p/, /tv/, /stories/, /reels/
   =================================================== */
function parseInstagramUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl.trim());

    // Must be instagram.com
    if (!parsed.hostname.includes('instagram.com')) {
      return { valid: false, error: 'Not an Instagram URL. Please paste a link from instagram.com' };
    }

    const pathname = parsed.pathname;

    // Detect type and extract shortcode
    let type = 'unknown';
    let shortcode = null;

    if (/\/(reel|reels)\/([A-Za-z0-9_-]+)/.test(pathname)) {
      const m = pathname.match(/\/(reel|reels)\/([A-Za-z0-9_-]+)/);
      type = 'reel';
      shortcode = m[2];
    } else if (/\/tv\/([A-Za-z0-9_-]+)/.test(pathname)) {
      const m = pathname.match(/\/tv\/([A-Za-z0-9_-]+)/);
      type = 'video';
      shortcode = m[1];
    } else if (/\/stories\/([^/]+)\/(\d+)/.test(pathname)) {
      type = 'story';
      shortcode = null; // stories use numeric IDs
    } else if (/\/p\/([A-Za-z0-9_-]+)/.test(pathname)) {
      const m = pathname.match(/\/p\/([A-Za-z0-9_-]+)/);
      type = 'photo';
      shortcode = m[1];
    }

    if (!shortcode && type !== 'story') {
      return { valid: false, error: 'Could not parse Instagram URL. Make sure you copy the full link from the Instagram share button.' };
    }

    // Normalize to clean URL
    const cleanUrl = shortcode
      ? `https://www.instagram.com/p/${shortcode}/`
      : rawUrl;

    return { valid: true, type, shortcode, cleanUrl, originalUrl: rawUrl };

  } catch {
    return { valid: false, error: 'Invalid URL format. Please paste a complete Instagram URL.' };
  }
}


/* ===================================================
   METHOD 1: yt-dlp extraction (best quality)
   Requires yt-dlp installed: pip install yt-dlp
   
   For authenticated content (most Instagram posts),
   export your browser cookies:
     yt-dlp --cookies-from-browser chrome --cookies cookies.txt "URL"
   Then set COOKIE_FILE env var to the cookies.txt path.
   =================================================== */
function extractWithYtDlp(targetUrl) {
  return new Promise((resolve, reject) => {

    const cookieFile = process.env.COOKIE_FILE || null;

    // Use "python3 -m yt_dlp" — works on Railway/Render without PATH issues
    // Falls back to "yt-dlp" binary if YTDLP_PATH env var is set
    const useCustomPath = process.env.YTDLP_PATH || null;
    const cmd  = useCustomPath || 'python3';
    const args = useCustomPath
      ? []
      : ['-m', 'yt_dlp'];

    args.push(
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
    );

    // Add cookies if provided
    if (cookieFile) {
      args.push('--cookies', cookieFile);
    }

    args.push(targetUrl);

    execFile(cmd, args, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        // Parse specific yt-dlp error messages
        const msg = stderr || err.message || '';
        if (msg.includes('login required') || msg.includes('Private')) {
          return reject(new Error('This content is private or requires Instagram login. Only public posts can be downloaded.'));
        }
        if (msg.includes('not found') || msg.includes('404')) {
          return reject(new Error('Post not found. It may have been deleted or the URL is incorrect.'));
        }
        if (msg.includes('Forbidden') || msg.includes('403')) {
          return reject(new Error('Instagram blocked this request. Try again in a moment, or set up cookies (see README).'));
        }
        return reject(new Error('Could not fetch media. ' + (msg.split('\n')[0] || '')));
      }

      try {
        const info = JSON.parse(stdout.trim());

        // Build formats list from yt-dlp output
        const formats = (info.formats || [])
          .filter(f => f.url)
          .map(f => ({
            quality: f.format_note || f.height ? `${f.height}p` : 'default',
            url: f.url,
            ext: f.ext || 'mp4',
            filesize: f.filesize || null,
          }))
          .reverse(); // best quality first

        resolve({
          title:       info.title || info.description?.substring(0, 60) || 'Instagram Content',
          thumbnail:   info.thumbnail || info.thumbnails?.[0]?.url || null,
          downloadUrl: info.url || (formats[0]?.url),
          formats,
          duration:    info.duration ? formatDuration(info.duration) : null,
          type:        info.ext === 'jpg' || info.ext === 'png' ? 'photo' : 'video',
          uploader:    info.uploader || info.channel || null,
          source:      'yt-dlp',
        });

      } catch {
        reject(new Error('Failed to parse media info from yt-dlp.'));
      }
    });
  });
}


/* ===================================================
   METHOD 2: Instagram oEmbed API (public metadata only)
   No auth needed — gives title, thumbnail, author
   Does NOT give direct video URL (Meta removed that)
   Used as a fallback for metadata enrichment
   =================================================== */
function fetchOembed(shortcode) {
  return new Promise((resolve, reject) => {
    const postUrl = encodeURIComponent(`https://www.instagram.com/p/${shortcode}/`);
    const apiUrl  = `https://api.instagram.com/oembed/?url=${postUrl}&format=json&hidecaption=false`;

    const req = https.get(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            title:       json.title || 'Instagram Content',
            thumbnail:   json.thumbnail_url || null,
            author:      json.author_name || null,
          });
        } catch {
          reject(new Error('oEmbed parse failed'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('oEmbed timeout')));
  });
}


/* ===================================================
   HELPER: Format seconds → "m:ss"
   =================================================== */
function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}


/* ===================================================
   PROXY ENDPOINT: GET /api/proxy?url=...
   Streams media through server to avoid CORS issues
   when the frontend tries to display/download media
   =================================================== */
app.get('/api/proxy', (req, res) => {
  const mediaUrl = req.query.url;
  if (!mediaUrl) return res.status(400).json({ error: 'No URL provided' });

  try {
    new URL(mediaUrl); // validate
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const transport = mediaUrl.startsWith('https') ? https : http;
  const proxyReq = transport.get(mediaUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.instagram.com/',
    }
  }, (proxyRes) => {
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'video/mp4');
    if (proxyRes.headers['content-length']) {
      res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }
    res.setHeader('Content-Disposition', 'attachment; filename="zentrox_download.mp4"');
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => res.status(502).json({ error: 'Failed to fetch media from source.' }));
});


/* ===================================================
   MAIN API: POST /api/download
   Body: { url: "https://instagram.com/reel/..." }
   =================================================== */
app.post('/api/download', async (req, res) => {
  const { url: rawUrl } = req.body;

  // 1. Basic input check
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length < 10) {
    return res.status(400).json({
      error: 'Please paste a complete Instagram URL (e.g. https://www.instagram.com/reel/ABC123/)'
    });
  }

  // 2. Parse & validate URL
  const parsed = parseInstagramUrl(rawUrl);
  if (!parsed.valid) {
    return res.status(400).json({ error: parsed.error });
  }

  const { type, shortcode, cleanUrl } = parsed;

  // 3. Try yt-dlp first (most reliable for actual video URLs)
  try {
    const result = await extractWithYtDlp(cleanUrl);
    return res.json({
      success:     true,
      type:        type || result.type,
      title:       result.title,
      thumbnail:   result.thumbnail,
      downloadUrl: result.downloadUrl,
      proxyUrl:    result.downloadUrl
        ? `/api/proxy?url=${encodeURIComponent(result.downloadUrl)}`
        : null,
      formats:     result.formats || [],
      duration:    result.duration,
      uploader:    result.uploader,
      quality:     'HD',
      source:      'yt-dlp',
    });

  } catch (ytdlpError) {

    // 4. yt-dlp failed — try oEmbed for at least title/thumbnail
    //    and return a meaningful error with the metadata we could get
    let meta = {};
    if (shortcode) {
      try { meta = await fetchOembed(shortcode); } catch { /* ignore */ }
    }

    // Decide error message
    const errMsg = ytdlpError.message || 'Could not extract media.';

    // If it's a private/deleted post — hard fail with good message
    if (
      errMsg.includes('private') ||
      errMsg.includes('login') ||
      errMsg.includes('deleted') ||
      errMsg.includes('not found')
    ) {
      return res.status(422).json({ error: errMsg });
    }

    // For rate-limit / block errors — suggest cookies setup
    if (errMsg.includes('blocked') || errMsg.includes('403') || errMsg.includes('cookie')) {
      return res.status(503).json({
        error: 'Instagram is rate-limiting this server. To fix this, set up browser cookies for yt-dlp. See README → "Cookie Setup" section.',
        meta, // still return title/thumb if we got it from oEmbed
      });
    }

    // Generic failure with whatever metadata we managed to get
    return res.status(500).json({
      error: 'Could not extract download link: ' + errMsg,
      meta,
    });
  }
});


/* ===================================================
   HEALTH CHECK: GET /api/health
   =================================================== */
app.get('/api/health', async (req, res) => {
  // Check if yt-dlp is available
  let ytdlpVersion = null;
  try {
    ytdlpVersion = await new Promise((resolve, reject) => {
      exec('yt-dlp --version', { timeout: 5000 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.trim());
      });
    });
  } catch {
    ytdlpVersion = 'not installed';
  }

  res.json({
    status:    'ok',
    uptime:    process.uptime().toFixed(1) + 's',
    ytdlp:     ytdlpVersion,
    cookies:   process.env.COOKIE_FILE ? 'configured' : 'not set (public content only)',
    node:      process.version,
  });
});


/* ===== Catch-all → index.html ===== */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


/* ===== START ===== */
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   ZENTROX Server — Real Download Engine  ║
  ║   http://localhost:${PORT}                  ║
  ║                                          ║
  ║   yt-dlp: required (pip install yt-dlp)  ║
  ║   Cookies: set COOKIE_FILE env var       ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
