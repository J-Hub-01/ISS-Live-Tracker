// ===== GLOBAL STATE =====
const state = {
  iss: { lat: 0, lng: 0, speed: 0, location: 'Calculating...', positions: [], timestamp: null },
  astronauts: [],
  news: [],
  chatHistory: []
};

let map, issMarker, pathLine;
const ISS_ICON_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/International_Space_Station.svg/200px-International_Space_Station.svg.png';

// ===== CLOCK =====
function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ===== MAP INITIALIZATION =====
function initMap() {
  map = L.map('iss-map', {
    center: [20, 0], zoom: 2, minZoom: 2, maxZoom: 8,
    zoomControl: false, attributionControl: false
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);

  const issIcon = L.icon({
    iconUrl: ISS_ICON_URL,
    iconSize: [50, 32], iconAnchor: [25, 16]
  });
  issMarker = L.marker([0, 0], { icon: issIcon }).addTo(map);
  issMarker.bindPopup('<b>ISS</b><br>International Space Station');

  pathLine = L.polyline([], {
    color: '#6366f1', weight: 2.5, opacity: 0.7, dashArray: '8, 6'
  }).addTo(map);
}

// ===== SPEED CALCULATION (Haversine Formula) =====
function calculateSpeed(pos1, pos2, timeDiffSeconds) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => deg * (Math.PI / 180);
  const dLat = toRad(pos2.lat - pos1.lat);
  const dLon = toRad(pos2.lng - pos1.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(pos1.lat)) * Math.cos(toRad(pos2.lat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // distance in km
  const speedKmh = (distance / timeDiffSeconds) * 3600;
  return speedKmh;
}

// ===== ISS TRACKING =====
async function fetchISS() {
  try {
    const res = await fetch('http://api.open-notify.org/iss-now.json');
    const data = await res.json();
    const lat = parseFloat(data.iss_position.latitude);
    const lng = parseFloat(data.iss_position.longitude);
    const now = Date.now();

    // Calculate speed using Haversine formula
    if (state.iss.timestamp) {
      const timeDiffSeconds = (now - state.iss.timestamp) / 1000;
      const pos1 = { lat: state.iss.lat, lng: state.iss.lng };
      const pos2 = { lat: lat, lng: lng };
      state.iss.speed = Math.round(calculateSpeed(pos1, pos2, timeDiffSeconds));
    } else {
      state.iss.speed = 27580; // average ISS speed
    }

    state.iss.lat = lat;
    state.iss.lng = lng;
    state.iss.timestamp = now;
    state.iss.positions.push([lat, lng]);
    if (state.iss.positions.length > 15) state.iss.positions.shift();

    // Update map
    issMarker.setLatLng([lat, lng]);
    pathLine.setLatLngs(state.iss.positions);
    map.panTo([lat, lng], { animate: true, duration: 1 });

    // Reverse geocode
    fetchLocationName(lat, lng);

    // Update UI
    updateISSInfo();
  } catch (e) {
    console.error('ISS fetch error:', e);
  }
}

async function fetchLocationName(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=5&accept-language=en`);
    const data = await res.json();
    state.iss.location = data.display_name || determineOcean(lat, lng);
  } catch {
    state.iss.location = determineOcean(lat, lng);
  }
  document.getElementById('iss-location').textContent = state.iss.location;
}

function determineOcean(lat, lng) {
  if (lng > -30 && lng < 70 && lat > -40 && lat < 35) return 'Indian Ocean';
  if (lng > -80 && lng < 0) return 'Atlantic Ocean';
  if (lng > 100 || lng < -100) return 'Pacific Ocean';
  if (lat > 66) return 'Arctic Ocean';
  if (lat < -60) return 'Southern Ocean';
  return 'Over Ocean';
}

function updateISSInfo() {
  document.getElementById('iss-lat').textContent = state.iss.lat.toFixed(4) + '°';
  document.getElementById('iss-lng').textContent = state.iss.lng.toFixed(4) + '°';
  document.getElementById('iss-speed').textContent = state.iss.speed.toLocaleString() + ' km/h';
  document.getElementById('iss-positions').textContent = state.iss.positions.length;
  document.getElementById('stat-lat').textContent = state.iss.lat.toFixed(2) + '°';
  document.getElementById('stat-speed').textContent = state.iss.speed.toLocaleString() + ' km/h';
}

// ===== PEOPLE IN SPACE =====
async function fetchAstronauts() {
  try {
    const res = await fetch('http://api.open-notify.org/astros.json');
    const data = await res.json();
    state.astronauts = data.people || [];
    document.getElementById('stat-astro').textContent = data.number || 0;
    renderAstronauts();
  } catch (e) {
    console.error('Astronaut fetch error:', e);
    document.getElementById('astronaut-list').innerHTML = '<p style="color:var(--text-muted);padding:16px;">Failed to load astronaut data.</p>';
  }
}

function renderAstronauts() {
  const container = document.getElementById('astronaut-list');
  if (!state.astronauts.length) {
    container.innerHTML = '<p style="color:var(--text-muted);">No data available.</p>';
    return;
  }
  container.innerHTML = state.astronauts.map(a => `
    <div class="astronaut-item">
      <div class="astronaut-avatar">${a.name.charAt(0)}</div>
      <div>
        <div class="astronaut-name">${a.name}</div>
        <div class="astronaut-craft">🚀 ${a.craft}</div>
      </div>
    </div>
  `).join('');
}

// ===== NEWS (Enhanced with API Key, Caching, Search, Sort) =====
const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY; // from .env VITE_NEWS_API_KEY
const NEWS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes in ms
const NEWS_CATEGORIES = ['technology', 'science'];
let activeCategory = 'technology';

// Get cached news from localStorage
function getNewsCache(category) {
  try {
    const cached = localStorage.getItem(`news_${category}`);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > NEWS_CACHE_TTL) {
      localStorage.removeItem(`news_${category}`);
      return null;
    }
    return data;
  } catch { return null; }
}

// Save news to localStorage
function setNewsCache(category, data) {
  try {
    localStorage.setItem(`news_${category}`, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) { console.warn('localStorage write failed:', e); }
}

// Show loading state
function showNewsLoading() {
  document.getElementById('news-grid').innerHTML = `
    <div class="news-loading">
      <div class="news-spinner"></div>
      <span style="color:var(--text-muted);font-size:0.85rem;">Loading articles...</span>
    </div>`;
}

// Show error state
function showNewsError(message) {
  document.getElementById('news-grid').innerHTML = `
    <div class="news-error">
      <div class="error-icon">⚠️</div>
      <p>${message}</p>
      <button class="btn" onclick="fetchNewsByCategory(activeCategory, true)">🔄 Try Again</button>
    </div>`;
}

// Fetch news for a category
async function fetchNewsByCategory(category, forceRefresh = false) {
  // Check cache first
  if (!forceRefresh) {
    const cached = getNewsCache(category);
    if (cached) {
      state.news = cached;
      updateCacheBadge(category);
      renderNews();
      updateNewsCount();
      if (typeof updateNewsChart === 'function') updateNewsChart();
      return;
    }
  }

  showNewsLoading();

  try {
    const url = `https://gnews.io/api/v4/top-headlines?category=${category}&lang=en&max=5&apikey=${NEWS_API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    if (data.errors) {
      throw new Error(data.errors[0] || 'API error');
    }

    state.news = (data.articles || []).map(a => ({
      title: a.title || 'Untitled',
      source: a.source?.name || 'Unknown',
      author: a.author || 'Unknown Author',
      date: a.publishedAt || new Date().toISOString(),
      dateFormatted: new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      url: a.url || '#',
      image: a.image || '',
      description: a.description || 'No description available.',
      category: category
    }));

    // Cache the results
    setNewsCache(category, state.news);
    updateCacheBadge(category);
    renderNews();
    updateNewsCount();
    if (typeof updateNewsChart === 'function') updateNewsChart();

  } catch (e) {
    console.error('News fetch error:', e);
    // Try fallback: Spaceflight News API (no key needed)
    try {
      const fallbackUrl = `https://api.spaceflightnewsapi.net/v4/articles/?limit=5&ordering=-published_at`;
      const res2 = await fetch(fallbackUrl);
      const data2 = await res2.json();
      state.news = (data2.results || []).map(a => ({
        title: a.title,
        source: a.news_site || 'Space News',
        author: a.authors?.[0]?.name || 'Staff Reporter',
        date: a.published_at || new Date().toISOString(),
        dateFormatted: new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        url: a.url,
        image: a.image_url || '',
        description: a.summary || 'No description available.',
        category: category
      }));
      setNewsCache(category, state.news);
      updateCacheBadge(category);
      renderNews();
      updateNewsCount();
      if (typeof updateNewsChart === 'function') updateNewsChart();
    } catch (e2) {
      showNewsError('Failed to load news. Please check your connection and try again.');
    }
  }
}

// Update cache badge
function updateCacheBadge(category) {
  const badge = document.getElementById('news-cache-badge');
  const cached = localStorage.getItem(`news_${category}`);
  if (cached) {
    const { timestamp } = JSON.parse(cached);
    const minsAgo = Math.round((Date.now() - timestamp) / 60000);
    badge.textContent = minsAgo === 0 ? '🟢 Just updated' : `🕐 Cached ${minsAgo}m ago`;
  } else {
    badge.textContent = '🔴 Live';
  }
}

// Update total news count
function updateNewsCount() {
  document.getElementById('stat-news').textContent = state.news.length;
}

// Render news articles
function renderNews() {
  const container = document.getElementById('news-grid');
  let articles = [...state.news];

  // Apply search filter
  const searchQuery = document.getElementById('news-search')?.value?.toLowerCase().trim();
  if (searchQuery) {
    articles = articles.filter(n =>
      n.title.toLowerCase().includes(searchQuery) ||
      n.source.toLowerCase().includes(searchQuery) ||
      n.description.toLowerCase().includes(searchQuery) ||
      n.author.toLowerCase().includes(searchQuery)
    );
  }

  // Apply sort
  const sortVal = document.getElementById('news-sort')?.value || 'date-desc';
  switch (sortVal) {
    case 'date-desc': articles.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
    case 'date-asc': articles.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
    case 'source-asc': articles.sort((a, b) => a.source.localeCompare(b.source)); break;
    case 'source-desc': articles.sort((a, b) => b.source.localeCompare(a.source)); break;
  }

  if (!articles.length) {
    container.innerHTML = '<div class="news-error"><div class="error-icon">🔍</div><p>No articles match your search.</p></div>';
    return;
  }

  container.innerHTML = articles.map(n => `
    <div class="news-item">
      ${n.image
        ? `<img class="news-thumb" src="${n.image}" alt="${n.title}" onerror="this.outerHTML='<div class=\\'news-thumb-placeholder\\'>📰</div>'">`
        : '<div class="news-thumb-placeholder">📰</div>'
      }
      <div class="news-content">
        <div class="news-meta">
          <span class="news-source">${n.source}</span>
          <span class="news-author">✍️ ${n.author}</span>
        </div>
        <div class="news-title-text">${n.title}</div>
        <div class="news-description">${n.description}</div>
        <div class="news-footer">
          <span class="news-date">📅 ${n.dateFormatted}</span>
          <a href="${n.url}" target="_blank" rel="noopener" class="news-read-more">Read More →</a>
        </div>
      </div>
    </div>
  `).join('');
}

// Switch category tab
function switchCategory(category) {
  activeCategory = category;
  document.querySelectorAll('.news-cat-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === category);
  });
  fetchNewsByCategory(category);
}

// Refresh a specific category (force)
function refreshCategory(category) {
  const btn = document.querySelector(`.news-cat-tab[data-category="${category}"] .news-cat-refresh`);
  if (btn) { btn.classList.add('spinning'); setTimeout(() => btn.classList.remove('spinning'), 1000); }
  localStorage.removeItem(`news_${category}`);
  if (category === activeCategory) {
    fetchNewsByCategory(category, true);
  }
}

// Sort news (called from dropdown)
function sortNews() { renderNews(); }

// Initialize news search debounce
function initNewsSearch() {
  let debounceTimer;
  document.getElementById('news-search')?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderNews(), 300);
  });
}

// Legacy wrapper
async function fetchNews() {
  await fetchNewsByCategory(activeCategory);
  initNewsSearch();
}

// ===== CHATBOT (Data-Aware) =====
// ===== FLOATING CHATBOT (HF Mistral AI) =====
const HF_TOKEN = import.meta.env.VITE_AI_TOKEN; // from .env VITE_AI_TOKEN
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
const CHAT_STORAGE_KEY = 'dashboard_chat_history';
const MAX_CHAT_MSGS = 30;

function toggleChatWindow() {
  const win = document.getElementById('chat-window');
  const fab = document.getElementById('chat-fab');
  const isOpen = win.classList.toggle('visible');
  fab.textContent = isOpen ? '✕' : '💬';
  fab.classList.toggle('open', isOpen);
  if (isOpen && !document.getElementById('chat-messages').children.length) {
    loadChatHistory();
  }
}

function addChatMessage(text, sender, save = true) {
  const container = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${sender}`;
  msg.textContent = text;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  if (save) saveChatMessage(text, sender);
}

function saveChatMessage(text, sender) {
  let history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
  history.push({ text, sender, time: Date.now() });
  if (history.length > MAX_CHAT_MSGS) history = history.slice(-MAX_CHAT_MSGS);
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
}

function loadChatHistory() {
  const history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
  if (history.length === 0) {
    addChatMessage('Welcome! 🛰️ I answer questions ONLY about dashboard data (ISS & News). Try "Where is the ISS?"', 'bot');
    return;
  }
  history.forEach(m => addChatMessage(m.text, m.sender, false));
}

function clearChat() {
  localStorage.removeItem(CHAT_STORAGE_KEY);
  document.getElementById('chat-messages').innerHTML = '';
  addChatMessage('Chat cleared! Ask me anything about the dashboard data.', 'bot');
  showToast('Chat history cleared', 'info');
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'chat-msg bot typing-indicator';
  el.id = 'typing-indicator';
  el.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

function buildDashboardContext() {
  const newsSum = state.news.slice(0, 5).map(n => `"${n.title}" by ${n.author} (${n.source})`).join('; ');
  const astroNames = state.astronauts.map(a => `${a.name} on ${a.craft}`).join(', ');
  return `DASHBOARD DATA (answer ONLY from this):
ISS Position: Lat ${state.iss.lat.toFixed(4)}°, Lng ${state.iss.lng.toFixed(4)}°
ISS Speed: ${state.iss.speed.toLocaleString()} km/h
ISS Location: ${state.iss.location}
Positions Tracked: ${state.iss.positions.length}/15
People in Space: ${state.astronauts.length} — ${astroNames || 'loading'}
News (${activeCategory}): ${state.news.length} articles — ${newsSum || 'loading'}
Total articles available: ${state.news.length}`;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  addChatMessage(text, 'user');
  input.value = '';
  showTypingIndicator();

  const context = buildDashboardContext();
  const prompt = `<s>[INST] You are a dashboard AI assistant. You ONLY answer using the data provided below. Do NOT use any external knowledge. If the question is outside the dashboard data, say "I can only answer questions about ISS tracking and news from the dashboard."

${context}

User question: ${text} [/INST]`;

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 250, temperature: 0.3, return_full_text: false }
      })
    });

    removeTypingIndicator();

    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    let reply = data[0]?.generated_text?.trim() || 'Sorry, I could not generate a response.';
    // Clean up any leftover instruction tokens
    reply = reply.replace(/<\/?s>/g, '').replace(/\[\/INST\]/g, '').trim();
    addChatMessage(reply, 'bot');
  } catch (e) {
    removeTypingIndicator();
    console.error('Chat API error:', e);
    // Fallback to local processing
    const fallback = processLocalChat(text);
    addChatMessage(fallback, 'bot');
    showToast('AI unavailable, using local mode', 'error');
  }
}

// Local fallback if HF API fails
function processLocalChat(query) {
  const q = query.toLowerCase().trim();
  if (q.includes('where') || q.includes('location') || q.includes('position') || q.includes('iss'))
    return `ISS is at ${state.iss.lat.toFixed(4)}°, ${state.iss.lng.toFixed(4)}° near ${state.iss.location}, traveling at ${state.iss.speed.toLocaleString()} km/h.`;
  if (q.includes('speed') || q.includes('fast'))
    return `ISS speed: ~${state.iss.speed.toLocaleString()} km/h.`;
  if (q.includes('astronaut') || q.includes('people') || q.includes('crew'))
    return `${state.astronauts.length} people in space: ${state.astronauts.map(a => a.name).join(', ')}.`;
  if (q.includes('news') || q.includes('article'))
    return `${state.news.length} ${activeCategory} articles loaded. Top: "${state.news[0]?.title || 'N/A'}"`;
  return 'I can only answer about ISS tracking and news. Try "Where is the ISS?" or "Show news".';
}

// ===== CHARTS (Chart.js) =====
const speedHistory = { labels: [], data: [] };
let speedChart = null, newsChart = null;

function initSpeedChart() {
  const ctx = document.getElementById('speed-chart')?.getContext('2d');
  if (!ctx) return;
  speedChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: speedHistory.labels,
      datasets: [{
        label: 'Speed (km/h)',
        data: speedHistory.data,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.1)',
        fill: true, tension: 0.4, pointRadius: 3,
        pointBackgroundColor: '#818cf8', borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } }, tooltip: { mode: 'index' } },
      scales: {
        x: { ticks: { color: '#64748b', maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' },
          suggestedMin: 20000, suggestedMax: 35000 }
      }
    }
  });
}

function recordSpeed() {
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  speedHistory.labels.push(now);
  speedHistory.data.push(state.iss.speed);
  if (speedHistory.labels.length > 30) { speedHistory.labels.shift(); speedHistory.data.shift(); }
  if (speedChart) speedChart.update('none');
}

function initNewsChart() {
  const ctx = document.getElementById('news-chart')?.getContext('2d');
  if (!ctx) return;
  newsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Technology', 'Science'],
      datasets: [{
        data: [0, 0],
        backgroundColor: ['#6366f1', '#22c55e'],
        borderColor: ['#4f46e5', '#16a34a'],
        borderWidth: 2, hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} articles` } }
      },
      onClick: (e, elements) => {
        if (elements.length) {
          const idx = elements[0].index;
          switchCategory(idx === 0 ? 'technology' : 'science');
        }
      }
    }
  });
}

function updateNewsChart() {
  if (!newsChart) return;
  const techCount = getNewsCache('technology')?.length || 0;
  const sciCount = getNewsCache('science')?.length || 0;
  newsChart.data.datasets[0].data = [techCount, sciCount];
  newsChart.update('none');
}

// ===== THEME TOGGLE =====
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('dashboard_theme', next);
  document.getElementById('theme-toggle').textContent = next === 'dark' ? '🌙' : '☀️';
  showToast(`Switched to ${next} mode`, 'info');
  // Update Leaflet tile layer for theme
  if (map) {
    map.eachLayer(l => { if (l instanceof L.TileLayer) map.removeLayer(l); });
    const tileUrl = next === 'light'
      ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
  }
}

function loadTheme() {
  const saved = localStorage.getItem('dashboard_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-toggle').textContent = saved === 'dark' ? '🌙' : '☀️';
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== REFRESH =====
function refreshISS() {
  fetchISS();
  showToast('ISS position refreshed', 'success');
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  initMap();
  fetchISS();
  fetchAstronauts();
  fetchNews();
  initSpeedChart();
  initNewsChart();

  // Auto-refresh ISS every 15 seconds
  setInterval(() => { fetchISS(); recordSpeed(); }, 15000);

  // Pre-fetch both categories for news chart
  fetchNewsByCategory('science').then(() => updateNewsChart());

  showToast('Dashboard loaded successfully!', 'success');
});

// Expose functions to global window object so HTML inline event handlers still work
window.toggleTheme = toggleTheme;
window.refreshISS = refreshISS;
window.switchCategory = switchCategory;
window.refreshCategory = refreshCategory;
window.sortNews = sortNews;
window.toggleChatWindow = toggleChatWindow;
window.clearChat = clearChat;
window.sendChat = sendChat;

