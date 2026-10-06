// ============================================
// YOL TARİFİ UYGULAMASI - ANA JAVASCRIPT
// ============================================

// --- CITY CONFIG ---
const CITIES = {
  istanbul: {
    name: 'İstanbul',
    center: [41.0082, 28.9784],
    zoom: 11,
    bbox: [28.0, 40.8, 29.5, 41.3],
    overpassBbox: '40.8,28.0,41.3,29.5'
  },
  kayseri: {
    name: 'Kayseri',
    center: [38.7312, 35.4787],
    zoom: 12,
    bbox: [35.0, 38.5, 36.0, 39.0],
    overpassBbox: '38.5,35.0,39.0,36.0'
  }
};

let currentCity = 'istanbul';
let map, userMarker, userLocation = null;
let stationsLayer = L.layerGroup();
let placesLayer = L.layerGroup();
let routeLayer = L.layerGroup();
let currentTab = 'route';
let activeTransportFilters = { metro: true, tram: true, bus: true };
let selectedTimeSlot = null;
let destinationMarker = null;

// --- ICONS ---
const StationIcon = L.DivIcon.extend({
  createIcon() {
    const div = document.createElement('div');
    div.style.cssText = `
      width: 12px; height: 12px;
      background: #EF4444; border: 2px solid white;
      border-radius: 50%; box-shadow: 0 0 0 2px #EF4444;
    `;
    return div;
  }
});

const UserIcon = L.DivIcon.extend({
  createIcon() {
    const div = document.createElement('div');
    div.style.cssText = `
      width: 20px; height: 20px;
      background: #22C55E; border: 3px solid white;
      border-radius: 50%; box-shadow: 0 0 0 2px #22C55E;
      animation: pulse 2s infinite;
    `;
    return div;
  }
});

const DestIcon = L.DivIcon.extend({
  createIcon() {
    const div = document.createElement('div');
    div.style.cssText = `
      width: 16px; height: 16px;
      background: #EF4444; border: 3px solid white;
      border-radius: 50%; box-shadow: 0 2px 8px rgba(239,68,68,0.5);
    `;
    return div;
  }
});

const PlaceIcon = L.DivIcon.extend({
  createIcon() {
    const div = document.createElement('div');
    const { emoji } = this.options;
    div.className = 'place-marker';
    div.innerHTML = emoji || '📍';
    return div;
  }
});

// --- PLACE CATEGORIES BY TIME ---
const PLACE_CATEGORIES = {
  morning: [
    { tag: 'tourism', values: ['museum', 'artwork', 'gallery'], emoji: '🏛️', label: 'Müzeler/Galeriler' },
    { tag: 'historic', values: ['yes'], emoji: '🏛️', label: 'Tarihi Yerler' },
    { tag: 'leisure', values: ['park', 'garden'], emoji: '🌳', label: 'Parklar/Bahçeler' }
  ],
  afternoon: [
    { tag: 'tourism', values: ['attraction', 'viewpoint', 'monument'], emoji: '🗽', label: 'Turistik Yerler' },
    { tag: 'shop', values: ['mall', 'department_store', 'bazaar'], emoji: '🛍️', label: 'Alışveriş' },
    { tag: 'amenity', values: ['cafe', 'restaurant'], emoji: '☕', label: 'Kafe/Restoran' }
  ],
  evening: [
    { tag: 'amenity', values: ['restaurant', 'bar', 'pub', 'biergarten'], emoji: '🍽️', label: 'Yemek/İçki' },
    { tag: 'leisure', values: ['park', 'marina'], emoji: '🌅', label: 'Gezilecek Sahil/Park' },
    { tag: 'tourism', values: ['viewpoint'], emoji: '🌇', label: 'Manzara Noktaları' }
  ],
  night: [
    { tag: 'amenity', values: ['bar', 'nightclub', 'pub'], emoji: '🌙', label: 'Gece Hayatı' },
    { tag: 'leisure', values: ['marina'], emoji: '🌊', label: 'Sahil Yürüyüşü' }
  ]
};

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    initMap();
    setupEventListeners();
    await getUserLocation();
    loadStations();
  } catch (err) {
    console.error('Init hatası:', err);
  } finally {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
  }
}

// ============================================
// MAP SETUP
// ============================================
function initMap() {
  const city = CITIES[currentCity];
  map = L.map('map', {
    center: city.center,
    zoom: city.zoom,
    zoomControl: false,
    attributionControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  map.addLayer(stationsLayer);
  map.addLayer(placesLayer);
  map.addLayer(routeLayer);

  L.control.zoom({ position: 'topright' }).addTo(map);

  map.whenReady(() => {
    setTimeout(() => {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) overlay.classList.add('hidden');
    }, 500);
  });
}

// ============================================
// USER LOCATION
// ============================================
function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        userLocation = [pos.coords.latitude, pos.coords.longitude];
        addUserMarker();
        map.setView(userLocation, 15, { animate: true });
        resolve(true);
      },
      err => {
        console.log('Konum alınamadı:', err.message);
        const city = CITIES[currentCity];
        map.setView(city.center, city.zoom);
        resolve(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  });
}

function addUserMarker() {
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker(userLocation, { icon: new UserIcon() }).addTo(map);
  userMarker.bindPopup('<b>📍 Konumunuz</b>').openPopup();
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // City select
  document.getElementById('citySelect').addEventListener('change', e => {
    currentCity = e.target.value;
    switchCity();
  });

  // Close info panel
  document.getElementById('closeInfo').addEventListener('click', () => {
    document.getElementById('infoPanel').classList.add('hidden');
  });

  // Time selector
  document.querySelectorAll('#timeSelector .time-options button').forEach(btn => {
    btn.addEventListener('click', () => selectTimeSlot(btn.dataset.time));
  });

  // Route search
  const destInput = document.getElementById('destinationInput');
  const searchResults = document.getElementById('searchResults');
  let searchDebounce = null;

  destInput.addEventListener('input', e => {
    clearTimeout(searchDebounce);
    const q = e.target.value.trim();
    if (q.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }
    searchDebounce = setTimeout(() => searchPlaces(q), 300);
  });

  destInput.addEventListener('focus', e => {
    if (e.target.value.trim().length >= 2) searchPlaces(e.target.value.trim());
  });

  document.addEventListener('click', e => {
    if (!destInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });

  document.getElementById('routeBtn').addEventListener('click', calculateRoute);
  document.getElementById('clearRouteBtn').addEventListener('click', clearRoute);

  // Transport filters
  document.querySelectorAll('.transport-filter button').forEach(btn => {
    btn.addEventListener('click', () => toggleTransportFilter(btn.dataset.type));
  });

  // Map click for destination
  map.on('click', e => {
    if (currentTab === 'route' && !document.getElementById('destinationInput').value) {
      setDestination(e.latlng);
    }
  });
}

function switchTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  document.querySelectorAll('.route-search, .transport-filter').forEach(el => el.classList.add('hidden'));
  document.getElementById('infoPanel').classList.add('hidden');
  document.getElementById('timeSelector').classList.add('hidden');
  document.querySelector('.route-info')?.classList.add('hidden');

  stationsLayer.clearLayers();
  placesLayer.clearLayers();
  routeLayer.clearLayers();

  if (tab === 'route') {
    document.querySelector('.route-search').classList.remove('hidden');
  } else if (tab === 'transport') {
    document.querySelector('.transport-filter').classList.remove('hidden');
    loadStations();
  } else if (tab === 'nearby') {
    loadNearbyStations();
  }
}

function switchCity() {
  const city = CITIES[currentCity];
  map.setView(city.center, city.zoom, { animate: true });
  stationsLayer.clearLayers();
  placesLayer.clearLayers();
  routeLayer.clearLayers();
  document.getElementById('infoPanel').classList.add('hidden');

  if (currentTab === 'transport') {
    loadStations();
  } else if (currentTab === 'nearby') {
    loadNearbyStations();
  }
}

// ============================================
// STATIONS - OVERPASS API
// ============================================
async function loadStations() {
  showLoading('Duraklar yükleniyor...');
  const city = CITIES[currentCity];

  const query = `
    [out:json][timeout:25];
    (
      node["railway"="station"]["station"="subway"](${city.overpassBbox});
      node["railway"="station"]["station"="light_rail"](${city.overpassBbox});
      node["railway"="station"]["station"="tram"](${city.overpassBbox});
      node["railway"="halt"]["station"="subway"](${city.overpassBbox});
      node["railway"="halt"]["station"="light_rail"](${city.overpassBbox});
      node["railway"="halt"]["station"="tram"](${city.overpassBbox});
      node["highway"="bus_stop"](${city.overpassBbox});
      node["public_transport"="stop_position"]["bus"="yes"](${city.overpassBbox});
      node["public_transport"="platform"]["bus"="yes"](${city.overpassBbox});
    );
    out body;
  `;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query)
    });
    const data = await res.json();
    renderStations(data.elements);
  } catch (err) {
    console.error('İstasyon hatası:', err);
    showError('Duraklar yüklenemedi');
  }
}

function renderStations(elements) {
  stationsLayer.clearLayers();
  const groups = { metro: [], tram: [], bus: [] };

  elements.forEach(el => {
    if (!el.lat || !el.lon) return;
    const tags = el.tags || {};
    let type = null;

    if (tags.railway === 'station' || tags.railway === 'halt') {
      if (tags.station === 'subway') type = 'metro';
      else if (tags.station === 'light_rail' || tags.station === 'tram') type = 'tram';
    } else if (tags.highway === 'bus_stop' || tags.bus === 'yes') {
      type = 'bus';
    }

    if (type && activeTransportFilters[type]) {
      groups[type].push({ ...el, type });
    }
  });

  const allStations = [...groups.metro, ...groups.tram, ...groups.bus];

  allStations.forEach(station => {
    const marker = L.marker([station.lat, station.lon], {
      icon: new StationIcon({ type: station.type })
    }).addTo(stationsLayer);

    const name = station.tags?.name || station.tags?.['name:tr'] || 'İsimsiz Durak';
    const lines = station.tags?.line || station.tags?.['line:tr'] || '';

    marker.bindPopup(`
      <div style="min-width:180px">
        <strong>${escapeHtml(name)}</strong><br>
        <small>${getTypeLabel(station.type)}${lines ? ' • ' + lines : ''}</small><br>
        <button onclick="showRouteTo(${station.lat}, ${station.lon}, '${escapeHtml(name)}')" 
          style="margin-top:8px;padding:6px 12px;background:#4F46E5;color:white;border:none;border-radius:6px;cursor:pointer;width:100%">
          🚏 Yol Tarifi Al
        </button>
      </div>
    `);
  });

  document.getElementById('infoPanel').classList.add('hidden');
}

function getTypeLabel(type) {
  const labels = { metro: '🚇 Metro', tram: '🚋 Tramvay', bus: '🚌 Otobüs' };
  return labels[type] || type;
}

function toggleTransportFilter(type) {
  activeTransportFilters[type] = !activeTransportFilters[type];
  const btn = document.querySelector(`.transport-filter button[data-type="${type}"]`);
  if (btn) btn.classList.toggle('active', activeTransportFilters[type]);
  if (currentTab === 'transport') loadStations();
}

// ============================================
// NEARBY STATIONS
// ============================================
async function loadNearbyStations() {
  if (!userLocation) {
    const got = await getUserLocation();
    if (!got) { showError('Konum gerekli'); return; }
  }

  showLoading('Yakın duraklar aranıyor...');

  const [lat, lon] = userLocation;
  const query = `
    [out:json][timeout:25];
    (
      node["railway"~"station|halt"]["station"~"subway|light_rail|tram"](around:1500,${lat},${lon});
      node["highway"="bus_stop"](around:800,${lat},${lon});
      node["public_transport"="stop_position"]["bus"="yes"](around:800,${lat},${lon});
      node["public_transport"="platform"]["bus"="yes"](around:800,${lat},${lon});
    );
    out body;
  `;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query)
    });
    const data = await res.json();
    renderNearbyList(data.elements);
  } catch (err) {
    console.error('Yakın durak hatası:', err);
    showError('Duraklar bulunamadı');
  }
}

function renderNearbyList(elements) {
  const stations = [];

  elements.forEach(el => {
    if (!el.lat || !el.lon) return;
    const tags = el.tags || {};
    let type = null;

    if (tags.railway && (tags.station === 'subway' || tags.station === 'light_rail' || tags.station === 'tram')) {
      type = tags.station === 'subway' ? 'metro' : 'tram';
    } else if (tags.highway === 'bus_stop' || tags.bus === 'yes') {
      type = 'bus';
    }

    if (!type) return;

    const name = tags.name || tags['name:tr'] || 'İsimsiz';
    const dist = getDistance(userLocation[0], userLocation[1], el.lat, el.lon);
    stations.push({ ...el, type, name, dist });
  });

  stations.sort((a, b) => a.dist - b.dist);
  const nearest = stations.slice(0, 15);

  const html = nearest.map(s => `
    <div class="stop-item" onclick="showRouteTo(${s.lat}, ${s.lon}, '${escapeHtml(s.name)}')">
      <div class="type">${getTypeLabel(s.type)}</div>
      <div class="name">${escapeHtml(s.name)}</div>
      <div class="dist">${s.dist < 1000 ? Math.round(s.dist) + ' m' : (s.dist/1000).toFixed(1) + ' km'}</div>
    </div>
  `).join('') || '<p style="text-align:center;color:var(--text-muted);padding:20px">Yakınınızda durak bulunamadı</p>';

  document.getElementById('infoContent').innerHTML = `
    <h3>📍 En Yakın Duraklar</h3>
    ${html}
  `;
  document.getElementById('infoPanel').classList.remove('hidden');
}

// ============================================
// ROUTE CALCULATION - OSRM
// ============================================
function setDestination(latlng) {
  destinationMarker = L.marker([latlng.lat, latlng.lng], { icon: new DestIcon() }).addTo(routeLayer);
  document.getElementById('destinationInput').value = '📍 Haritada seçildi';
  document.getElementById('destinationInput').dataset.coords = `${latlng.lat},${latlng.lng}`;
}

async function calculateRoute() {
  const destEl = document.getElementById('destinationInput');
  const dest = destEl.dataset.coords;

  if (!dest) {
    showError('Nereye gideceğinizi seçin');
    return;
  }

  if (!userLocation) {
    showError('Konumunuz alınamadı, lütfen izin verin');
    return;
  }

  const [dLat, dLon] = dest.split(',').map(Number);
  const [oLat, oLon] = userLocation;

  showLoading('Rota hesaplanıyor...');

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?overview=full&geometries=geojson&steps=true&annotations=true`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok') throw new Error('Rota bulunamadı');

    renderRoute(data.routes[0]);
  } catch (err) {
    console.error('Rota hatası:', err);
    showError('Rota hesaplanamadı');
  }
}

function renderRoute(route) {
  routeLayer.clearLayers();

  if (destinationMarker) {
    routeLayer.removeLayer(destinationMarker);
    destinationMarker = null;
  }

  const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  const line = L.polyline(coords, {
    color: '#4F46E5',
    weight: 5,
    opacity: 0.8,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(routeLayer);

  const distKm = (route.distance / 1000).toFixed(1);
  const durMin = Math.round(route.duration / 60);

  const infoHtml = document.createElement('div');
  infoHtml.className = 'route-info';
  infoHtml.innerHTML = `
    <p>📏 Mesafe: <strong>${distKm} km</strong></p>
    <p>⏱️ Süre: <strong>${durMin} dk</strong></p>
    <button onclick="startNavigation(${JSON.stringify(route.legs[0].steps).replace(/"/g, '"')})"
      class="btn-primary" style="margin-top:12px;width:100%;padding:12px;font-size:14px">
      🧭 Navigasyonu Başlat
    </button>
  `;
  document.body.appendChild(infoHtml);

  map.fitBounds(line.getBounds().pad(0.1));
}

function clearRoute() {
  routeLayer.clearLayers();
  if (destinationMarker) { destinationMarker = null; }
  document.getElementById('destinationInput').value = '';
  document.getElementById('destinationInput').dataset.coords = '';
  document.getElementById('searchResults').classList.add('hidden');
  document.querySelector('.route-info')?.remove();
}

function showRouteTo(lat, lon, name) {
  document.getElementById('destinationInput').value = name;
  document.getElementById('destinationInput').dataset.coords = `${lat},${lon}`;
  document.getElementById('searchResults').classList.add('hidden');
  switchTab('route');
  calculateRoute();
}

async function searchPlaces(query) {
  const city = CITIES[currentCity];
  const [minLon, minLat, maxLon, maxLat] = city.bbox;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=${minLon},${minLat},${maxLon},${maxLat}&bounded=1&limit=5&addressdetails=1&accept-language=tr`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'YolTarifiApp/1.0' }});
    const data = await res.json();
    renderSearchResults(data);
  } catch (err) {
    console.error('Arama hatası:', err);
  }
}

function renderSearchResults(results) {
  const searchResults = document.getElementById('searchResults');
  if (!results.length) {
    searchResults.classList.add('hidden');
    return;
  }

  searchResults.innerHTML = results.map(r => `
    <div class="search-result-item" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${escapeHtml(r.display_name.split(',')[0])}">
      <strong>${escapeHtml(r.display_name.split(',')[0])}</strong><br>
      <small>${escapeHtml(r.display_name.split(',').slice(1).join(','))}</small>
    </div>
  `).join('');

  searchResults.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const lat = parseFloat(item.dataset.lat);
      const lon = parseFloat(item.dataset.lon);
      const name = item.dataset.name;
      document.getElementById('destinationInput').value = name;
      document.getElementById('destinationInput').dataset.coords = `${lat},${lon}`;
      searchResults.classList.add('hidden');
      if (destinationMarker) routeLayer.removeLayer(destinationMarker);
      destinationMarker = L.marker([lat, lon], { icon: new DestIcon() }).addTo(routeLayer);
      map.setView([lat, lon], 15);
    });
  });

  searchResults.classList.remove('hidden');
}

function startNavigation(steps) {
  // Basit adım adım navigasyon
  alert('Navigasyon başlatıldı (demo). Adım sayısı: ' + steps.length);
}

// ============================================
// PLACES / ATTRACTIONS BY TIME
// ============================================
function selectTimeSlot(slot) {
  selectedTimeSlot = slot;
  document.querySelectorAll('#timeSelector .time-options button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.time === slot);
  });
  document.getElementById('timeSelector').classList.add('hidden');
  loadPlacesForTime(slot);
}

async function loadPlacesForTime(slot) {
  if (!userLocation) {
    const got = await getUserLocation();
    if (!got) { showError('Konum gerekli'); return; }
  }

  showLoading('Gezilecek yerler aranıyor...');

  const categories = PLACE_CATEGORIES[slot];
  if (!categories) return;

  const [lat, lon] = userLocation;
  const radius = 3000;

  const queries = categories.map(cat => {
    const vals = cat.values.map(v => `"${cat.tag}"="${v}"`).join(' ');
    return `
      node[${vals}](around:${radius},${lat},${lon});
      way[${vals}](around:${radius},${lat},${lon});
    `;
  }).join('');

  const query = `[out:json][timeout:25];(${queries});out center;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query)
    });
    const data = await res.json();
    renderPlaces(data.elements, categories);
  } catch (err) {
    console.error('Yerler hatası:', err);
    showError('Yerler yüklenemedi');
  }
}

function renderPlaces(elements, categories) {
  placesLayer.clearLayers();

  const catMap = {};
  categories.forEach(c => catMap[c.tag + ':' + c.values.join(',')] = c);

  const places = [];
  elements.forEach(el => {
    let lat, lon;
    if (el.type === 'node') { lat = el.lat; lon = el.lon; }
    else if (el.center) { lat = el.center.lat; lon = el.center.lon; }
    else return;

    const tags = el.tags || {};
    const name = tags.name || tags['name:tr'] || tags['name:en'] || 'İsimsiz Yer';

    let matchedCat = null;
    for (const cat of categories) {
      if (cat.values.includes(tags[cat.tag])) {
        matchedCat = cat;
        break;
      }
    }
    if (!matchedCat) return;

    const dist = getDistance(userLocation[0], userLocation[1], lat, lon);
    places.push({ lat, lon, name, tags, cat: matchedCat, dist });
  });

  places.sort((a, b) => a.dist - b.dist);
  const topPlaces = places.slice(0, 20);

  topPlaces.forEach(p => {
    const marker = L.marker([p.lat, p.lon], {
      icon: new PlaceIcon({ emoji: p.cat.emoji })
    }).addTo(placesLayer);

    const transportInfo = getNearbyTransport(p.lat, p.lon);

    marker.bindPopup(`
      <div class="place-popup" style="min-width:200px">
        <h4>${p.cat.emoji} ${escapeHtml(p.name)}</h4>
        <small>${p.cat.label} • ${p.dist < 1000 ? Math.round(p.dist)+'m' : (p.dist/1000).toFixed(1)+'km'}</small>
        ${transportInfo ? `<br><small>🚌 Yakın: ${transportInfo}</small>` : ''}
        <button onclick="showRouteTo(${p.lat}, ${p.lon}, '${escapeHtml(p.name)}')"
          style="margin-top:8px;padding:6px 12px;background:#4F46E5;color:white;border:none;border-radius:6px;cursor:pointer;width:100%">
          🚏 Buraya Git
        </button>
      </div>
    `);
  });

  // Also show list in info panel
  const html = topPlaces.slice(0, 10).map(p => `
    <div class="stop-item" onclick="map.setView([${p.lat}, ${p.lon}], 16); document.getElementById('infoPanel').classList.add('hidden')">
      <div class="type">${p.cat.emoji} ${p.cat.label}</div>
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="dist">${p.dist < 1000 ? Math.round(p.dist) + ' m' : (p.dist/1000).toFixed(1) + ' km'}</div>
    </div>
  `).join('');

  document.getElementById('infoContent').innerHTML = `
    <h3>${getTimeLabel(selectedTimeSlot)} İçin Öneriler</h3>
    ${html || '<p style="text-align:center;color:var(--text-muted);padding:20px">Yakınınızda uygun yer bulunamadı</p>'}
  `;
  document.getElementById('infoPanel').classList.remove('hidden');
}

function getTimeLabel(slot) {
  const labels = { morning: '☀️ Sabah', afternoon: '🌤️ Öğleden Sonra', evening: '🌆 Akşam', night: '🌙 Gece' };
  return labels[slot] || slot;
}

function getNearbyTransport(lat, lon) {
  // Basit: yakın durakları stationsLayer'dan bul
  let nearby = [];
  stationsLayer.eachLayer(layer => {
    if (layer.getLatLng) {
      const d = getDistance(lat, lon, layer.getLatLng().lat, layer.getLatLng().lng);
      if (d < 500) nearby.push(layer);
    }
  });
  if (nearby.length === 0) return null;
  const types = [...new Set(nearby.map(l => l.options.type))];
  return types.map(t => getTypeLabel(t).split(' ')[1]).join(', ');
}

// ============================================
// UTILITIES
// ============================================
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading(msg) {
  document.getElementById('infoContent').innerHTML = `<div class="loading">${msg}</div>`;
  document.getElementById('infoPanel').classList.remove('hidden');
}

function showError(msg) {
  document.getElementById('infoContent').innerHTML = `<p style="text-align:center;color:var(--danger);padding:20px">${msg}</p>`;
  document.getElementById('infoPanel').classList.remove('hidden');
  setTimeout(() => document.getElementById('infoPanel').classList.add('hidden'), 3000);
}

// Global functions for inline onclick
window.showRouteTo = showRouteTo;