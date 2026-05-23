# ⬡ ZENTROX — Premium Instagram Downloader

> Download Instagram Reels, Videos, Photos, Stories, Carousels, and Audio in HD quality. Fast, free, and forever.

![Version](https://img.shields.io/badge/version-1.0.0-00cfff?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-9b5de5?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-06ffa5?style=flat-square)

---

## 📁 Project Structure

```
zentrox/
├── index.html      ← All 7 pages (SPA — single file)
├── style.css       ← Full cyberpunk design system
├── script.js       ← Frontend logic, animations, API calls
├── server.js       ← Express backend & download API
├── package.json    ← Dependencies & scripts
└── README.md       ← You are here
```

---

## ⚡ Quick Start

**1. Install dependencies**
```bash
npm install
```

**2. Start the server**
```bash
node server.js
```

**3. Open in browser**
```
http://localhost:3000
```

That's it. No build step. No bundler. No config.

---

## 🌐 Pages

| Page | Description |
|---|---|
| Home | Main downloader with URL input, preview & download |
| About Us | Mission, tech stack, and origin story |
| FAQ | Accordion-style answers to common questions |
| Contact | Contact form + email & social info |
| Privacy Policy | Zero-data policy explained |
| Terms & Conditions | Usage rules and legal disclaimers |
| Share | Social share cards + copy link + native share |

---

## 🔌 API Reference

### `POST /api/download`
Analyzes an Instagram URL and returns media metadata.

**Request**
```json
{
  "url": "https://www.instagram.com/reel/ABC123/"
}
```

**Response**
```json
{
  "success": true,
  "type": "reel",
  "title": "Instagram Reel",
  "thumbnail": "https://...",
  "downloadUrl": "https://...",
  "duration": "0:32",
  "quality": "HD 1080p"
}
```

**Error Response**
```json
{
  "error": "Invalid URL. Only instagram.com links are supported."
}
```

---

### `GET /api/health`
Health check endpoint for uptime monitoring.

```json
{ "status": "ok", "uptime": "42.3s" }
```

---

## 🔧 Adding Real Download Support

The `/api/download` endpoint currently returns demo data. To enable real downloads, replace the placeholder block in `server.js` with one of these approaches:

**Option A — yt-dlp (recommended, must be installed on server)**
```js
const { execFile } = require('child_process');

execFile('yt-dlp', [
  '--get-url',
  '--get-title',
  '--get-thumbnail',
  url
], (err, stdout) => {
  if (err) return res.status(500).json({ error: 'Could not fetch media.' });
  const [title, downloadUrl, thumbnail] = stdout.trim().split('\n');
  return res.json({ success: true, type, title, downloadUrl, thumbnail });
});
```

**Option B — Third-party API**
```js
const response = await fetch(`https://your-api.com/instagram?url=${encodeURIComponent(url)}`);
const data = await response.json();
return res.json({ success: true, ...data });
```

---

## 🎨 Design System

| Token | Value |
|---|---|
| Primary font | Orbitron (display/headings) |
| Body font | Rajdhani |
| Mono font | Share Tech Mono |
| Neon Blue | `#00cfff` |
| Neon Purple | `#9b5de5` |
| Neon Pink | `#f72585` |
| Neon Cyan | `#00f5d4` |
| Background | `#000005` |
| Glass border | `rgba(0,207,255,0.2)` |

All tokens are defined as CSS variables in `:root` inside `style.css`.

---

## 🚀 Deployment

### Render
1. Push the project to a GitHub repository
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo
4. Set **Start Command** to `node server.js`
5. Set **Environment** to `Node`
6. Deploy — done

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project folder
3. Follow the prompts

> Vercel runs `server.js` as a serverless function. The `module.exports = app` line at the bottom of `server.js` handles this automatically.

### Environment Variables (optional)
```
PORT=3000          # Default: 3000
```

---

## 📱 Features Checklist

- [x] Paste URL input with clipboard support
- [x] Auto content-type detection (Reel, Story, Photo, Video, Carousel)
- [x] Multi-step processing animation
- [x] Preview thumbnail before download
- [x] Quality selector (HD 1080p / SD 720p / Audio Only)
- [x] Download button + Copy Link button
- [x] Live Recent Downloads feed
- [x] Animated stats counter
- [x] FAQ accordion
- [x] Contact form
- [x] Social share (Twitter, WhatsApp, Telegram, Reddit)
- [x] Native device share (Web Share API)
- [x] Floating glassmorphism navbar
- [x] Futuristic loading screen
- [x] Animated background (grid + orbs)
- [x] Button ripple + glow effects
- [x] Toast notifications
- [x] Mobile responsive
- [x] SEO meta tags & Open Graph
- [x] Security headers (no extra library)
- [x] Health check endpoint

---

## 🛡 Security Notes

- All API requests are validated server-side before processing
- Only `instagram.com` URLs are accepted
- No user data, URLs, or downloads are stored or logged
- Security headers (`X-Frame-Options`, `X-XSS-Protection`, etc.) are set on every response without any external library

---

## 📄 License

MIT — free to use, modify, and deploy.

---

> Built with Node.js · Express · Vanilla JS · Zero unnecessary dependencies
