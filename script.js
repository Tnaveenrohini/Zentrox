/* ============================================================
   ZENTROX — Frontend JavaScript
   Handles: page routing, URL detection, download logic,
   animations, FAQ, stats counter, recent downloads, sharing
   ============================================================ */

/* ===== PAGE ROUTER ===== */
/**
 * showPage(name) — switches the active page
 * Hides all pages, shows the target, updates nav links
 */
function showPage(name) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target page
  const target = document.getElementById('page-' + name);
  if (target) target.classList.add('active');

  // Update nav link active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(name)) {
      link.classList.add('active');
    }
  });

  // Close mobile menu
  closeMenu();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


/* ===== LOADING SCREEN ===== */
window.addEventListener('load', () => {
  // Wait for loader bar animation (2.5s) then hide
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
  }, 2800);

  // Init everything
  initRecentDownloads();
  initStats();
  initNavScroll();
});


/* ===== NAVBAR — SCROLL BEHAVIOR ===== */
function initNavScroll() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}


/* ===== HAMBURGER MENU ===== */
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});

function closeMenu() {
  hamburger.classList.remove('open');
  navLinks.classList.remove('open');
}


/* ===== URL AUTO-DETECTION ===== */
/**
 * detectContentType(url) — guesses the Instagram content type from URL
 * Returns an object with type, label, and icon
 */
function detectContentType(url) {
  if (!url) return null;
  const lower = url.toLowerCase();

  if (lower.includes('/reel/') || lower.includes('/reels/')) {
    return { type: 'reel', label: 'Reel Detected', icon: '🎬' };
  }
  if (lower.includes('/stories/')) {
    return { type: 'story', label: 'Story Detected', icon: '📖' };
  }
  if (lower.includes('/p/') && lower.includes('?img_index')) {
    return { type: 'carousel', label: 'Carousel Post Detected', icon: '🎠' };
  }
  if (lower.includes('/p/')) {
    return { type: 'photo', label: 'Photo/Video Detected', icon: '🖼' };
  }
  if (lower.includes('/tv/')) {
    return { type: 'video', label: 'IGTV Video Detected', icon: '📹' };
  }
  if (lower.includes('instagram.com')) {
    return { type: 'unknown', label: 'Instagram Content Detected', icon: '📱' };
  }
  return null;
}

// Listen to URL input for live detection
const urlInput = document.getElementById('urlInput');
const detectedType = document.getElementById('detectedType');
const detectLabel = document.getElementById('detectLabel');
const detectIcon = document.getElementById('detectIcon');

urlInput.addEventListener('input', () => {
  const val = urlInput.value.trim();
  const detected = detectContentType(val);

  if (detected) {
    detectIcon.textContent = detected.icon;
    detectLabel.textContent = detected.label;
    detectedType.style.display = 'flex';
  } else {
    detectedType.style.display = 'none';
  }

  // Hide previous errors
  hideError();
  hideResult();
});


/* ===== PASTE BUTTON ===== */
document.getElementById('pasteBtn').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text;
    // Trigger detection
    urlInput.dispatchEvent(new Event('input'));
    showToast('🔗 URL pasted!');
  } catch {
    showToast('❌ Clipboard access denied — paste manually');
  }
});


/* ===== DOWNLOAD HANDLER ===== */
/**
 * handleDownload() — called when "Analyze" button is clicked
 * Validates URL → shows loading → calls API → shows result
 */
async function handleDownload() {
  const url = urlInput.value.trim();

  // Validate: must be a non-empty Instagram URL
  if (!url) {
    showError('⚡ Please paste an Instagram URL first.');
    return;
  }
  if (!url.includes('instagram.com')) {
    showError('❌ Invalid URL. Only Instagram links are supported (instagram.com/...)');
    return;
  }

  hideError();
  hideResult();
  showProcessing(true);

  // Simulate processing steps (in production this calls the server)
  const steps = [
    'Fetching media data...',
    'Analyzing content type...',
    'Extracting HD stream...',
    'Generating download link...',
  ];
  let stepIndex = 0;

  const stepInterval = setInterval(() => {
    stepIndex++;
    if (stepIndex < steps.length) {
      document.getElementById('processStep').textContent = steps[stepIndex];
    }
  }, 600);

  try {
    // Call backend API
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    clearInterval(stepInterval);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Download failed. Please try again.');
    }

    // Show result
    showProcessing(false);
    showResult(data);
    addToRecent(data);

  } catch (err) {
    clearInterval(stepInterval);
    showProcessing(false);
    showError('⚠ ' + (err.message || 'Something went wrong. Check the URL and try again.'));
  }
}


/* ===== SHOW / HIDE HELPERS ===== */
function showProcessing(show) {
  document.getElementById('processing').style.display = show ? 'flex' : 'none';
  if (show) {
    document.getElementById('processStep').textContent = 'Fetching media data...';
  }
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('errorMsg').style.display = 'none';
}

function showResult(data) {
  const panel = document.getElementById('resultPanel');
  document.getElementById('resultThumb').src = data.thumbnail || 'https://picsum.photos/140/140?grayscale';
  document.getElementById('resultTitle').textContent = data.title || 'Instagram Content';
  document.getElementById('resultMeta').textContent = (data.type || 'Video') + ' · HD Ready · ' + (data.duration || '—');

  // Wire download button
  document.getElementById('dlMainBtn').onclick = () => {
    window.open(data.downloadUrl || data.url, '_blank');
    addToRecent(data);
    showToast('✅ Download started!');
  };

  panel.style.display = 'flex';
}

function hideResult() {
  document.getElementById('resultPanel').style.display = 'none';
}

// Quality button toggle
document.querySelectorAll('.btn-quality').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.btn-quality').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});


/* ===== COPY LINK ===== */
function copyLink() {
  const url = urlInput.value.trim() || window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('⧉ Link copied to clipboard!');
  }).catch(() => {
    showToast('❌ Copy failed — try manually');
  });
}


/* ===== RECENT DOWNLOADS ===== */
// Demo data for the recent downloads feed
const demoRecent = [
  { icon: '🎬', name: 'Morning Motivation Reel', meta: '2 min ago · 1080p HD', badge: 'badge-reel', label: 'REEL' },
  { icon: '🖼', name: 'Sunset Photography Post', meta: '5 min ago · Original Quality', badge: 'badge-photo', label: 'PHOTO' },
  { icon: '📖', name: 'Travel Story Pack', meta: '12 min ago · 720p', badge: 'badge-story', label: 'STORY' },
  { icon: '📹', name: 'Cooking Tutorial Video', meta: '18 min ago · 1080p HD', badge: 'badge-video', label: 'VIDEO' },
  { icon: '🎵', name: 'Background Music Extract', meta: '24 min ago · MP3 320kbps', badge: 'badge-audio', label: 'AUDIO' },
];

function initRecentDownloads() {
  const list = document.getElementById('recentList');
  if (!list) return;

  demoRecent.forEach((item, i) => {
    setTimeout(() => renderRecentItem(item, list), i * 180);
  });
}

function renderRecentItem(item, container) {
  const el = document.createElement('div');
  el.className = 'recent-item';
  el.innerHTML = `
    <div class="recent-thumb">${item.icon}</div>
    <div class="recent-info">
      <div class="recent-name">${item.name}</div>
      <div class="recent-meta">${item.meta}</div>
    </div>
    <span class="recent-badge ${item.badge}">${item.label}</span>
  `;
  container.appendChild(el);
}

// Add a new item from a real download result
function addToRecent(data) {
  const list = document.getElementById('recentList');
  if (!list) return;

  const typeMap = {
    reel: { icon: '🎬', badge: 'badge-reel', label: 'REEL' },
    photo: { icon: '🖼', badge: 'badge-photo', label: 'PHOTO' },
    story: { icon: '📖', badge: 'badge-story', label: 'STORY' },
    video: { icon: '📹', badge: 'badge-video', label: 'VIDEO' },
    audio: { icon: '🎵', badge: 'badge-audio', label: 'AUDIO' },
    carousel: { icon: '🎠', badge: 'badge-reel', label: 'CAROUSEL' },
  };
  const t = typeMap[data.type] || typeMap.video;

  const item = {
    icon: t.icon,
    name: data.title || 'Downloaded Content',
    meta: 'Just now · HD',
    badge: t.badge,
    label: t.label,
  };

  // Insert at top
  const el = document.createElement('div');
  el.className = 'recent-item';
  el.innerHTML = `
    <div class="recent-thumb">${item.icon}</div>
    <div class="recent-info">
      <div class="recent-name">${item.name}</div>
      <div class="recent-meta">${item.meta}</div>
    </div>
    <span class="recent-badge ${item.badge}">${item.label}</span>
  `;
  list.insertBefore(el, list.firstChild);

  // Keep max 8 items
  while (list.children.length > 8) {
    list.removeChild(list.lastChild);
  }
}


/* ===== ANIMATED STATS COUNTER ===== */
function initStats() {
  const stats = document.querySelectorAll('.stat-num');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  stats.forEach(el => observer.observe(el));
}

function animateCount(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 1800;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);

    // Format large numbers
    el.textContent = target >= 1000000
      ? (current / 1000000).toFixed(1) + 'M+'
      : target >= 1000
        ? (current / 1000).toFixed(0) + 'K+'
        : current + (target === 99 ? '%' : target === 2 ? 's' : '+');

    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}


/* ===== FAQ ACCORDION ===== */
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const answer = item.querySelector('.faq-answer');
  const isOpen = item.classList.contains('open');

  // Close all
  document.querySelectorAll('.faq-item').forEach(i => {
    i.classList.remove('open');
    i.querySelector('.faq-answer').classList.remove('open');
  });

  // Toggle current
  if (!isOpen) {
    item.classList.add('open');
    answer.classList.add('open');
  }
}


/* ===== SOCIAL SHARE ===== */
function shareToSocial(platform) {
  const url = encodeURIComponent('https://zentrox.app');
  const text = encodeURIComponent('🚀 Download Instagram content in HD for free! Check out Zentrox:');

  const links = {
    twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    reddit: `https://reddit.com/submit?url=${url}&title=${text}`,
  };

  if (links[platform]) {
    window.open(links[platform], '_blank', 'width=600,height=500');
  }
}

function copyZentroxLink() {
  navigator.clipboard.writeText('https://zentrox.app').then(() => {
    showToast('⧉ Zentrox link copied!');
  });
}

// Native share (mobile)
function nativeShare() {
  if (navigator.share) {
    navigator.share({
      title: 'Zentrox — Instagram Downloader',
      text: 'Download Instagram Reels, Videos, Photos & more in HD for free!',
      url: 'https://zentrox.app',
    }).catch(() => {}); // user cancelled — no error needed
  } else {
    // Fallback: copy to clipboard
    copyZentroxLink();
    showToast('📋 Link copied! Share it anywhere.');
  }
}


/* ===== CONTACT FORM ===== */
function submitContact(btn) {
  btn.querySelector('.btn-label').textContent = '⏳ Sending...';
  btn.disabled = true;

  setTimeout(() => {
    btn.querySelector('.btn-label').textContent = '✅ Message Sent!';
    showToast('✅ Your message has been sent! We\'ll reply within 24 hours.');
    setTimeout(() => {
      btn.querySelector('.btn-label').textContent = '⇡ Send Message';
      btn.disabled = false;
    }, 3000);
  }, 1800);
}


/* ===== TOAST NOTIFICATION ===== */
let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}


/* ===== BUTTON RIPPLE EFFECT ===== */
// Adds ripple to all .btn-download buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-download, .btn-dl-main');
  if (!btn) return;

  const ripple = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top - size / 2;

  ripple.style.cssText = `
    position:absolute;
    width:${size}px;
    height:${size}px;
    left:${x}px;
    top:${y}px;
    background:rgba(255,255,255,0.25);
    border-radius:50%;
    transform:scale(0);
    animation:rippleAnim 0.6s linear;
    pointer-events:none;
    z-index:10;
  `;

  // Inject ripple keyframe once
  if (!document.getElementById('rippleStyle')) {
    const style = document.createElement('style');
    style.id = 'rippleStyle';
    style.textContent = `@keyframes rippleAnim{to{transform:scale(3);opacity:0;}}`;
    document.head.appendChild(style);
  }

  btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
});


/* ===== KEYBOARD: Enter on URL input triggers download ===== */
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleDownload();
});
