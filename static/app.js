const STARTERS = [
  { id: 25, name: "Pikachu" },
  { id: 1, name: "Bulbasaur" },
  { id: 4, name: "Charmander" },
  { id: 7, name: "Squirtle" },
  { id: 133, name: "Eevee" },
  { id: 656, name: "Froakie" },
  { id: 722, name: "Rowlet" },
  { id: 909, name: "Fuecoco" },
];

const CONTINENT_OPTIONS = [
  { id: "Asia", label: "🌏 Châu Á" },
  { id: "Europe", label: "🏰 Châu Âu" },
  { id: "Africa", label: "🦁 Châu Phi" },
  { id: "North America", label: "🗽 Bắc Mỹ" },
  { id: "South America", label: "🌴 Nam Mỹ" },
  { id: "Oceania", label: "🦘 Châu Úc" },
];

let authMode = "login";
let selectedStarter = 25;
let selectedContinent = "Asia";
let currentZone = null;
let currentUser = null;
let worldCountries = [];
let selectedCountryId = null;
let activeContinentFilter = "ALL";
let pokedexCache = [];
let packsCatalog = [];
let shopItems = [];
let currentExplore = null;
let playerPos = { x: 7, y: 8 };
let currentBattle = null;
let currentEnemySpeciesId = null;
let currentPlayerSpeciesId = null;
let currentOnlineRoom = null;
let onlinePollTimer = null;

let gachaBanners = [];
let selectedGachaId = "kanto";
let activeMissionPeriod = "daily";

const spriteUrl = (id, shiny = false) =>
  shiny
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

const animatedSpriteUrl = (id, shiny = false, isBack = false) => {
  if (isBack) {
    return shiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/shiny/${id}.gif`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${id}.gif`;
  }
  return shiny
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${id}.gif`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;
};

const gen5AnimatedUrl = (id, shiny = false, isBack = false) => {
  if (isBack) {
    return shiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/shiny/${id}.gif`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/${id}.gif`;
  }
  return shiny
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/shiny/${id}.gif`
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;
};

function bindAnimatedSprite(imgEl, id, shiny = false, isBack = false) {
  const s1 = animatedSpriteUrl(id, shiny, isBack);
  const s2 = gen5AnimatedUrl(id, shiny, isBack);
  const s3 = spriteUrl(id, shiny);
  imgEl.onerror = () => {
    imgEl.onerror = () => {
      imgEl.onerror = null;
      imgEl.src = s3;
    };
    imgEl.src = s2;
  };
  imgEl.src = s1;
}

function pokeImgTag(id, shiny = false, cls = "poke-idle-anim", alt = "") {
  const s1 = animatedSpriteUrl(id, shiny, false);
  const s2 = gen5AnimatedUrl(id, shiny, false);
  const s3 = spriteUrl(id, shiny);
  return `<img class="${cls}" src="${s1}" onerror="if(!this.dataset.f1){this.dataset.f1=1;this.src='${s2}';}else{this.onerror=null;this.src='${s3}';}" alt="${alt}" onclick="playCry(${id})" />`;
}

function toast(msg, kind = "info") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra");
  return data;
}

function playCry(id) {
  window.PokeAudio.playCry(id);
}

function openSettings() {
  const a = window.PokeAudio;
  document.getElementById("set-cry-vol").value = Math.round(a.cryVolume * 100);
  document.getElementById("set-sfx-vol").value = Math.round(a.sfxVolume * 100);
  document.getElementById("set-bgm-vol").value = Math.round(a.bgmVolume * 100);
  document.getElementById("lbl-cry-vol").textContent = `${Math.round(a.cryVolume * 100)}%`;
  document.getElementById("lbl-sfx-vol").textContent = `${Math.round(a.sfxVolume * 100)}%`;
  document.getElementById("lbl-bgm-vol").textContent = `${Math.round(a.bgmVolume * 100)}%`;
  document.getElementById("set-sfx-on").checked = a.sfxEnabled;
  document.getElementById("set-cry-on").checked = a.cryEnabled;
  document.getElementById("set-bgm-on").checked = a.bgmEnabled;
  document.getElementById("settings-modal").classList.remove("hidden");
}

function closeSettings() {
  document.getElementById("settings-modal").classList.add("hidden");
}

function updateAudioSettings() {
  const a = window.PokeAudio;
  a.cryVolume = Number(document.getElementById("set-cry-vol").value) / 100;
  a.sfxVolume = Number(document.getElementById("set-sfx-vol").value) / 100;
  a.bgmVolume = Number(document.getElementById("set-bgm-vol").value) / 100;
  a.sfxEnabled = document.getElementById("set-sfx-on").checked;
  a.cryEnabled = document.getElementById("set-cry-on").checked;
  a.bgmEnabled = document.getElementById("set-bgm-on").checked;
  document.getElementById("lbl-cry-vol").textContent = `${Math.round(a.cryVolume * 100)}%`;
  document.getElementById("lbl-sfx-vol").textContent = `${Math.round(a.sfxVolume * 100)}%`;
  document.getElementById("lbl-bgm-vol").textContent = `${Math.round(a.bgmVolume * 100)}%`;
  a.saveSettings();
}

function testSound() {
  window.PokeAudio.playPackOpen();
  setTimeout(() => window.PokeAudio.playCry(25), 250);
}

// ---------------- AUTH ----------------
function renderStarters() {
  const cgrid = document.getElementById("continent-pick-grid");
  if (cgrid) {
    cgrid.innerHTML = CONTINENT_OPTIONS.map(
      (c) => `
      <div class="cont-pick-opt ${c.id === selectedContinent ? "selected" : ""}" onclick="pickStarterContinent('${c.id}')">
        ${c.label}
      </div>`
    ).join("");
  }
  const grid = document.getElementById("starter-grid");
  grid.innerHTML = STARTERS.map(
    (s) => `
    <div class="starter-opt ${s.id === selectedStarter ? "selected" : ""}" onclick="pickStarter(${s.id})">
      <img src="${spriteUrl(s.id)}" alt="${s.name}" />
      <div>${s.name}</div>
    </div>`
  ).join("");
}

function pickStarterContinent(cont) {
  selectedContinent = cont;
  renderStarters();
}

function pickStarter(id) {
  selectedStarter = id;
  renderStarters();
}

function switchAuthMode(mode) {
  authMode = mode;
  document.getElementById("tab-login-btn").classList.toggle("active", mode === "login");
  document.getElementById("tab-reg-btn").classList.toggle("active", mode === "register");
  document.getElementById("starter-picker").classList.toggle("hidden", mode !== "register");
  document.getElementById("auth-submit-btn").textContent =
    mode === "login" ? "Đăng nhập" : "Tạo Tài Khoản & Bắt Đầu";
}

async function submitAuth(e) {
  e.preventDefault();
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  try {
    const endpoint = authMode === "login" ? "/api/login" : "/api/register";
    const body =
      authMode === "login"
        ? { username, password }
        : { username, password, starter_id: selectedStarter, starter_continent: selectedContinent };
    const data = await api(endpoint, { method: "POST", body: JSON.stringify(body) });
    currentUser = data.user;
    enterApp();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  location.reload();
}

// ---------------- INIT & HUD ----------------
async function bootstrap() {
  renderStarters();
  try {
    const me = await api("/api/me");
    if (me.user) {
      currentUser = me.user;
      enterApp();
    }
  } catch (_) {}
}

async function enterApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");
  updateHUD();
  await Promise.all([loadWorld(), loadGachaBanners(), loadPacksAndShop(), loadCups(), loadFriends(true)]);
  renderTeamAndBag();
  renderRelics();
  renderMissions();
  loadPokedex();
}

function updateHUD() {
  if (!currentUser) return;
  document.getElementById("hud-username").textContent = currentUser.username;
  document.getElementById("hud-level").textContent = currentUser.level;
  const pct = Math.min(100, Math.round((currentUser.xp / currentUser.xp_needed) * 100));
  document.getElementById("hud-xp-fill").style.width = `${pct}%`;
  document.getElementById("hud-xp-text").textContent = `${currentUser.xp}/${currentUser.xp_needed}`;
  document.getElementById("hud-open-pts").textContent = currentUser.open_points;
  document.getElementById("hud-coins").textContent = currentUser.coins;
  document.getElementById("hud-tickets").textContent = currentUser.tickets ?? 0;
  document.getElementById("hud-tickets10").textContent = currentUser.tickets_x10 ?? 0;
  document.getElementById("hud-stardust").textContent = currentUser.stardust;
  document.getElementById("hud-dex").textContent = currentUser.pokedex.caught;

  const claimableCount = (currentUser.missions || []).filter((m) => m.can_claim).length;
  const badge = document.getElementById("missions-badge");
  if (badge) {
    badge.classList.toggle("hidden", claimableCount === 0);
    badge.textContent = claimableCount;
  }
}

function switchTab(tab) {
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`panel-${tab}`).classList.add("active");
  if (tab === "online") refreshOnlineRooms();
  if (tab === "friends") loadFriends();
  if (tab === "team") renderTeamAndBag();
  if (tab === "cup") loadCups();
  if (tab === "packs") renderGachaView();
  if (tab === "relics") renderRelics();
  if (tab === "missions") renderMissions();
}

async function claimDaily() {
  try {
    const data = await api("/api/daily", { method: "POST" });
    currentUser = data.user;
    updateHUD();
    toast(data.message, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------------- WORLD MAP ----------------
const WORLD_VB = { x: 0, y: 0, w: 1000, h: 500 };
let worldDidDrag = false;

const CONTINENT_VIEWS = {
  ALL: { x: 0, y: 0, w: 1000, h: 500 },
  Asia: { x: 525, y: 80, w: 460, h: 230 },
  Europe: { x: 435, y: 45, w: 230, h: 115 },
  Africa: { x: 350, y: 135, w: 450, h: 225 },
  "North America": { x: 50, y: 25, w: 420, h: 210 },
  "South America": { x: 165, y: 205, w: 410, h: 205 },
  Oceania: { x: 705, y: 235, w: 295, h: 147.5 },
  Antarctica: { x: 80, y: 390, w: 840, h: 110 },
};

function applyWorldViewBox() {
  const svg = document.getElementById("world-svg");
  if (!svg) return;
  WORLD_VB.w = Math.max(125, Math.min(1000, WORLD_VB.w));
  WORLD_VB.h = WORLD_VB.w * 0.5;
  WORLD_VB.x = Math.max(0, Math.min(1000 - WORLD_VB.w, WORLD_VB.x));
  WORLD_VB.y = Math.max(0, Math.min(500 - WORLD_VB.h, WORLD_VB.y));
  svg.setAttribute("viewBox", `${WORLD_VB.x.toFixed(2)} ${WORLD_VB.y.toFixed(2)} ${WORLD_VB.w.toFixed(2)} ${WORLD_VB.h.toFixed(2)}`);
  const zoomRatio = 1000 / WORLD_VB.w;
  const badge = document.getElementById("world-zoom-badge");
  if (badge) badge.textContent = `${zoomRatio.toFixed(1)}x`;
  // Keep country outlines crisp cleanly scaled when zooming close on tiny nations!
  const sw = Math.max(0.18, 0.65 / Math.sqrt(zoomRatio));
  svg.querySelectorAll(".country-path").forEach((p) => {
    p.style.strokeWidth = p.classList.contains("selected") ? `${sw * 2.4}` : `${sw}`;
  });
}

function zoomWorldMap(factor, anchorClientX = null, anchorClientY = null) {
  const svg = document.getElementById("world-svg");
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  let rx = 0.5;
  let ry = 0.5;
  if (anchorClientX !== null && anchorClientY !== null && rect.width > 0 && rect.height > 0) {
    rx = Math.max(0, Math.min(1, (anchorClientX - rect.left) / rect.width));
    ry = Math.max(0, Math.min(1, (anchorClientY - rect.top) / rect.height));
  }
  const newW = Math.max(125, Math.min(1000, WORLD_VB.w / factor));
  const newH = newW * 0.5;
  WORLD_VB.x += (WORLD_VB.w - newW) * rx;
  WORLD_VB.y += (WORLD_VB.h - newH) * ry;
  WORLD_VB.w = newW;
  WORLD_VB.h = newH;
  applyWorldViewBox();
}

function resetWorldZoom() {
  Object.assign(WORLD_VB, CONTINENT_VIEWS.ALL);
  applyWorldViewBox();
}

function initWorldZoomHandlers() {
  const wrap = document.getElementById("world-map-wrap");
  const svg = document.getElementById("world-svg");
  if (!wrap || !svg || wrap.dataset.zoomBound) return;
  wrap.dataset.zoomBound = "1";

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startVbX = 0;
  let startVbY = 0;
  let pinchDist = 0;

  wrap.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.25 : 0.8;
    zoomWorldMap(factor, e.clientX, e.clientY);
  }, { passive: false });

  svg.addEventListener("dblclick", (e) => {
    zoomWorldMap(1.8, e.clientX, e.clientY);
  });

  // Mouse pan & drag detection
  svg.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    worldDidDrag = false;
    startX = e.clientX;
    startY = e.clientY;
    startVbX = WORLD_VB.x;
    startVbY = WORLD_VB.y;
    svg.classList.add("dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.hypot(dx, dy) > 5) worldDidDrag = true;
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      WORLD_VB.x = startVbX - (dx / rect.width) * WORLD_VB.w;
      WORLD_VB.y = startVbY - (dy / rect.height) * WORLD_VB.h;
      applyWorldViewBox();
    }
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    svg.classList.remove("dragging");
    setTimeout(() => { worldDidDrag = false; }, 30);
  });

  // Mobile 1-finger pan + 2-finger pinch-to-zoom
  svg.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      dragging = true;
      worldDidDrag = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startVbX = WORLD_VB.x;
      startVbY = WORLD_VB.y;
    } else if (e.touches.length === 2) {
      dragging = false;
      worldDidDrag = true;
      pinchDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
    }
  }, { passive: true });

  svg.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && dragging) {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.hypot(dx, dy) > 6) {
        worldDidDrag = true;
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          WORLD_VB.x = startVbX - (dx / rect.width) * WORLD_VB.w;
          WORLD_VB.y = startVbY - (dy / rect.height) * WORLD_VB.h;
          applyWorldViewBox();
        }
      }
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      if (pinchDist > 10 && dist > 10) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
        zoomWorldMap(dist / pinchDist, midX, midY);
      }
      pinchDist = dist;
    }
  }, { passive: false });

  svg.addEventListener("touchend", () => {
    dragging = false;
    pinchDist = 0;
    setTimeout(() => { worldDidDrag = false; }, 60);
  });
}

async function loadWorld() {
  initWorldZoomHandlers();
  const data = await api("/api/world");
  worldCountries = data.countries;
  if (!selectedCountryId) {
    const starter = worldCountries.find((c) => c.unlocked);
    if (starter) selectedCountryId = starter.id;
  }
  renderContinentFilters();
  renderWorldSVG();
  applyWorldViewBox();
  if (selectedCountryId) {
    selectCountry(selectedCountryId, false);
    if (!currentExplore) enterCountryExplore(selectedCountryId, false);
  }
}

function renderContinentFilters() {
  const conts = ["ALL", "Asia", "Europe", "Africa", "North America", "South America", "Oceania", "Antarctica"];
  document.getElementById("continent-filters").innerHTML = conts
    .map(
      (c) => `<button class="cont-chip ${activeContinentFilter === c ? "active" : ""}" onclick="setContinentFilter('${c}')">${c === "ALL" ? "Tất cả" : c}</button>`
    )
    .join("");
}

function setContinentFilter(cont) {
  activeContinentFilter = cont;
  if (CONTINENT_VIEWS[cont]) {
    Object.assign(WORLD_VB, CONTINENT_VIEWS[cont]);
    WORLD_VB.h = WORLD_VB.w * 0.5;
  }
  renderContinentFilters();
  renderWorldSVG();
  applyWorldViewBox();
}

function renderWorldSVG() {
  const svg = document.getElementById("world-svg");
  svg.innerHTML = worldCountries
    .map((c) => {
      const cls = [
        "country-path",
        c.unlocked ? "unlocked" : "",
        c.is_starter ? "starter" : "",
        c.id === selectedCountryId ? "selected" : "",
        activeContinentFilter !== "ALL" && c.continent !== activeContinentFilter ? "dimmed" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<path class="${cls}" data-id="${c.id}" d="${c.svg_path}" onclick="selectCountry('${c.id}')"><title>${c.name} (${c.continent})</title></path>`;
    })
    .join("");
  applyWorldViewBox();
}

function selectCountry(cid, redrawSvg = true) {
  if (worldDidDrag && redrawSvg) return;
  selectedCountryId = cid;
  if (redrawSvg) renderWorldSVG();
  const c = worldCountries.find((x) => x.id === cid);
  if (!c) return;
  const drawer = document.getElementById("country-drawer");
  const exclHtml = c.exclusive_pokemon
    .map(
      (p) => `
      <div class="mini-poke-pill exclusive">
        <img src="${spriteUrl(p.id)}" alt="${p.name}" />
        <div>
          <div><strong>${p.name}</strong> ${tierBadgeHtml(p.tier)}</div>
          <span class="excl-badge">Độc quyền ${c.name}</span>
        </div>
      </div>`
    )
    .join("");
  const localHtml = c.local_pool
    .slice(0, 6)
    .map(
      (p) => `
      <div class="mini-poke-pill">
        <img src="${spriteUrl(p.id)}" alt="${p.name}" />
        <div>${p.name} ${tierBadgeHtml(p.tier)}</div>
      </div>`
    )
    .join("");

  const actionBtn = c.unlocked
    ? `<button class="btn-green full-w" onclick="enterCountryExplore('${c.id}', true)">🎮 Du Hành & Săn Ở ${c.name}</button>`
    : `<button class="btn-gold full-w" onclick="unlockCountry('${c.id}')">🔓 Mở Khóa (-1 Open Point · Hiện có: ${currentUser.open_points})</button>`;

  drawer.innerHTML = `
    <h3>${c.name}</h3>
    <p class="muted">${c.continent} · ${c.biome_label} ${c.is_starter ? "· ⭐ Nước khởi đầu" : ""}</p>
    ${actionBtn}
    <h4 style="margin:14px 0 6px;">⭐ Pokémon Đặc Trưng (Chỉ xuất hiện tại ${c.name})</h4>
    <div class="country-poke-list">${exclHtml}</div>
    <h4 style="margin:10px 0 6px;">🌿 Loài hoang dã bản địa</h4>
    <div class="country-poke-list">${localHtml}</div>
  `;
}

async function unlockCountry(cid) {
  try {
    const data = await api("/api/world/unlock", {
      method: "POST",
      body: JSON.stringify({ country_id: cid }),
    });
    currentUser = data.user;
    updateHUD();
    toast(`🗺️ Đã mở khóa ${data.result.country.name}!`, "success");
    await loadWorld();
    selectCountry(cid);
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------------- 2D RPG EXPLORER ----------------
async function enterCountryExplore(cid, switchView = true) {
  try {
    const data = await api(`/api/explore/${cid}`);
    currentExplore = data;
    playerPos = { ...data.map.spawn };
    currentZone = getZoneAt(playerPos.x, playerPos.y);
    document.getElementById("explore-title").textContent =
      `${data.country.name} (${data.map.width}×${data.map.height} · ${data.map.landmark_count} địa danh)`;
    document.getElementById("explore-sub").textContent =
      currentZone ? `📍 Đang ở: ${currentZone.name} (${currentZone.weather_label}) — Càng nhiều địa danh, Pokémon càng đa dạng!` : "";
    renderExploreSidebar();
    window.RPGRenderer.setMap(data.map, playerPos);
    if (switchView) switchTab("explore");
  } catch (err) {
    toast(err.message, "error");
  }
}

function getZoneAt(x, y) {
  if (!currentExplore || !currentExplore.map.zone_grid) return null;
  const idx = currentExplore.map.zone_grid[y]?.[x] ?? 0;
  return currentExplore.map.zones?.[idx] || null;
}

function renderExploreSidebar() {
  if (!currentExplore) return;
  const c = currentExplore.country;
  const m = currentExplore.map;
  const zonesHtml = (m.zones || [])
    .map(
      (z) => `
      <div class="zone-list-card ${currentZone && currentZone.id === z.id ? "active-zone" : ""}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>${z.is_signature ? "⭐ " : "📍 "}${z.name}</strong>
          <span>${z.weather_label}</span>
        </div>
        <div class="muted" style="font-size:0.76rem;margin-top:4px;">
          Loài: ${z.pokemon.slice(0, 5).map((p) => p.name).join(", ")}...
        </div>
      </div>`
    )
    .join("");

  document.getElementById("explore-sidebar").innerHTML = `
    <h3>${c.name} (${c.continent})</h3>
    <p class="muted">Bản đồ liền mạch <strong>${m.width}×${m.height}</strong> gồm <strong>${m.landmark_count} địa danh</strong> với thời tiết riêng.</p>
    <h4>🗺️ Các Địa Danh & Thời Tiết</h4>
    <div style="max-height:220px;overflow-y:auto;">${zonesHtml}</div>
    <h4 style="margin-top:10px;">⭐ Độc quyền tại ${c.name}</h4>
    <div class="country-poke-list">
      ${c.exclusive_pokemon
        .map(
          (p) => `<div class="mini-poke-pill exclusive"><img src="${spriteUrl(p.id)}" /><strong>${p.name}</strong></div>`
        )
        .join("")}
    </div>
  `;
}

function drawRPGMap() {
  if (!currentExplore) return;
  window.RPGRenderer.render(performance.now() * 0.001);
}

function movePlayer(dx, dy) {
  if (!currentExplore) return;
  const dir = dy < 0 ? "up" : dy > 0 ? "down" : dx < 0 ? "left" : "right";
  const m = currentExplore.map;
  const nx = playerPos.x + dx;
  const ny = playerPos.y + dy;
  if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) {
    window.RPGRenderer.moveTo(playerPos.x, playerPos.y, dir);
    return;
  }
  const tile = m.grid[ny][nx];
  if ([2, 5, 12, 13, 14, 16, 17, 18].includes(tile)) {
    window.RPGRenderer.moveTo(playerPos.x, playerPos.y, dir);
    return;
  }
  playerPos = { x: nx, y: ny };
  window.RPGRenderer.moveTo(nx, ny, dir);

  const newZone = getZoneAt(nx, ny);
  if (newZone && (!currentZone || newZone.id !== currentZone.id)) {
    currentZone = newZone;
    document.getElementById("explore-sub").textContent =
      `📍 Đang ở: ${newZone.name} (${newZone.weather_label}) — Săn Pokémon hệ đặc trưng của vùng này!`;
    renderExploreSidebar();
    toast(`📍 Bạn đã bước vào ${newZone.name} (${newZone.weather_label})!`, "info");
  }

  const hitPoke = (m.overworld_pokemon || []).find((op) => op.x === nx && op.y === ny);
  if (tile === 3) {
    window.PokeAudio.playCatchSuccess();
    toast("💖 Đội hình của bạn đã được nghỉ ngơi tại Trạm PokéCenter!", "success");
  } else if (tile === 10 && newZone) {
    toast(`🪧 Biển chỉ dẫn: Chào mừng đến ${newZone.name} (${newZone.weather_label})!`, "info");
  } else if (tile === 4) {
    startCountryTrainer();
  } else if (tile === 15) {
    toast("🕳️ Bạn bước vào Hang Động Bí Ẩn — Pokémon hiếm xuất hiện!", "info");
    triggerExploreEncounter(true);
  } else if (hitPoke) {
    triggerExploreEncounter(false);
  } else if (tile === 1 && Math.random() < 0.34) {
    triggerExploreEncounter(false);
  }
}

document.addEventListener("keydown", (e) => {
  const exploreActive = document.getElementById("panel-explore").classList.contains("active");
  if (!exploreActive || ["INPUT", "SELECT"].includes(document.activeElement.tagName)) return;
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { e.preventDefault(); movePlayer(0, -1); }
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { e.preventDefault(); movePlayer(0, 1); }
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { e.preventDefault(); movePlayer(-1, 0); }
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { e.preventDefault(); movePlayer(1, 0); }
});

async function triggerExploreEncounter(forceExclusive = false) {
  if (!currentExplore) return toast("Hãy chọn một quốc gia đã mở trước!", "error");
  try {
    const data = await api("/api/battle/start", {
      method: "POST",
      body: JSON.stringify({
        country_id: currentExplore.country.id,
        mode: "wild",
        force_exclusive: forceExclusive,
        zone_id: currentZone ? currentZone.id : null,
        weather: currentZone ? currentZone.weather : null,
      }),
    });
    openBattleState(data.state);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function startCountryTrainer() {
  if (!currentExplore) return;
  try {
    const data = await api("/api/battle/start", {
      method: "POST",
      body: JSON.stringify({ country_id: currentExplore.country.id, mode: "trainer" }),
    });
    openBattleState(data.state);
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------------- BATTLE ARENA ----------------
function typeBadgesHtml(types) {
  return types.map((t) => `<span class="type-badge t-${t}">${t}</span>`).join("");
}

function tierBadgeHtml(tier) {
  const t = tier || "Common";
  return `<span class="tier-pill tier-${t}">${t}</span>`;
}

function openBattleState(state) {
  currentBattle = state;
  document.getElementById("nav-battle-btn").classList.remove("hidden");
  switchTab("battle");
  renderBattle();
  const e = state.enemy_team[state.enemy_active];
  playCry(e.species_id);
}

function renderBattle() {
  const s = currentBattle;
  if (!s) return;
  const p = s.player_team[s.player_active];
  const e = s.enemy_team[s.enemy_active];
  currentPlayerSpeciesId = p.species_id;
  currentEnemySpeciesId = e.species_id;

  document.getElementById("battle-title").textContent = s.title;
  document.getElementById("battle-mode-badge").textContent =
    s.max_team === 6 ? "🏆 GRAND CUP 6v6" : s.can_catch ? "🌿 HOANG DÃ (3 Con)" : "🥊 TRAINER 3v3";
  document.getElementById("battle-team-cap").textContent = s.max_team;

  // Enemy
  document.getElementById("enemy-name").textContent = (e.is_shiny ? "✨ " : "") + e.name;
  document.getElementById("enemy-tier-badge").innerHTML = tierBadgeHtml(e.tier);
  document.getElementById("enemy-excl-tag").classList.toggle("hidden", !e.is_exclusive);
  document.getElementById("enemy-lvl").textContent = e.level;
  document.getElementById("enemy-types").innerHTML = typeBadgesHtml(e.types);
  const ePct = Math.max(0, Math.round((e.hp / e.max_hp) * 100));
  const eBar = document.getElementById("enemy-hp-bar");
  eBar.style.width = `${ePct}%`;
  eBar.style.background = ePct > 50 ? "#22c55e" : ePct > 20 ? "#f59e0b" : "#ef4444";
  document.getElementById("enemy-hp-text").textContent = `${e.hp}/${e.max_hp} HP`;
  const eImg = document.getElementById("enemy-sprite");
  bindAnimatedSprite(eImg, e.species_id, e.is_shiny, false);
  document.getElementById("enemy-pips").innerHTML = s.enemy_team
    .map((x) => `<span class="pip ${x.hp <= 0 ? "fainted" : ""}"></span>`)
    .join("");

  // Player (uses animated back-facing Showdown sprite facing Enemy!)
  document.getElementById("player-name").textContent = (p.is_shiny ? "✨ " : "") + p.name;
  document.getElementById("player-tier-badge").innerHTML = tierBadgeHtml(p.tier);
  document.getElementById("player-lvl").textContent = p.level;
  document.getElementById("player-types").innerHTML = typeBadgesHtml(p.types);
  const pPct = Math.max(0, Math.round((p.hp / p.max_hp) * 100));
  const pBar = document.getElementById("player-hp-bar");
  pBar.style.width = `${pPct}%`;
  pBar.style.background = pPct > 50 ? "#22c55e" : pPct > 20 ? "#f59e0b" : "#ef4444";
  document.getElementById("player-hp-text").textContent = `${p.hp}/${p.max_hp} HP`;
  const pImg = document.getElementById("player-sprite");
  bindAnimatedSprite(pImg, p.species_id, p.is_shiny, true);
  document.getElementById("player-pips").innerHTML = s.player_team
    .map((x) => `<span class="pip ${x.hp <= 0 ? "fainted" : ""}"></span>`)
    .join("");

  const ongoing = s.status === "ongoing";

  // Moves
  document.getElementById("battle-moves").innerHTML = p.moves
    .map(
      (m, idx) => `
      <button class="move-btn" ${ongoing ? "" : "disabled"} onclick="sendBattleAction('move', ${idx})">
        <div>
          <strong>${m.name}</strong><br />
          <small class="muted">Power ${m.power}</small>
        </div>
        <span class="type-badge t-${m.type}">${m.type}</span>
      </button>`
    )
    .join("");

  // Items & Catch with Pixel Ball & Potion Sprites
  const inv = currentUser.inventory || {};
  let itemsHtml = `
    <button class="btn-sm btn-green" ${ongoing ? "" : "disabled"} onclick="sendBattleAction('potion','potion')"><img class="px-icon" src="/static/assets/items/potion.png" /> Potion (${inv.potion || 0})</button>
    <button class="btn-sm btn-green" ${ongoing ? "" : "disabled"} onclick="sendBattleAction('potion','super_potion')"><img class="px-icon" src="/static/assets/items/super-potion.png" /> Super (${inv.super_potion || 0})</button>
  `;
  if (s.can_catch) {
    itemsHtml += `
      <button class="btn-sm btn-gold" ${ongoing ? "" : "disabled"} onclick="sendBattleAction('catch','poke_ball')"><img class="px-icon" src="/static/assets/items/poke-ball.png" /> Poké (${inv.poke_ball || 0})</button>
      <button class="btn-sm btn-primary" ${ongoing ? "" : "disabled"} onclick="sendBattleAction('catch','great_ball')"><img class="px-icon" src="/static/assets/items/great-ball.png" /> Great (${inv.great_ball || 0})</button>
      <button class="btn-sm btn-primary" ${ongoing ? "" : "disabled"} onclick="sendBattleAction('catch','ultra_ball')"><img class="px-icon" src="/static/assets/items/ultra-ball.png" /> Ultra (${inv.ultra_ball || 0})</button>
      <button class="btn-sm btn-danger" ${ongoing ? "" : "disabled"} onclick="sendBattleAction('catch','master_ball')"><img class="px-icon" src="/static/assets/items/master-ball.png" /> Master (${inv.master_ball || 0})</button>
      <button class="btn-sm" ${ongoing ? "" : "disabled"} onclick="sendBattleAction('run')"><img class="px-icon" src="/static/assets/ui/door.svg" /> Chạy</button>
    `;
  }
  document.getElementById("battle-items").innerHTML = itemsHtml;

  // Switch bar
  document.getElementById("battle-switch-bar").innerHTML = s.player_team
    .map(
      (m, idx) => `
      <button class="switch-chip ${idx === s.player_active ? "active" : ""} ${m.hp <= 0 ? "fainted" : ""}"
        ${ongoing && idx !== s.player_active && m.hp > 0 ? `onclick="sendBattleAction('switch', ${idx})"` : "disabled"}>
        <img src="${spriteUrl(m.species_id, m.is_shiny)}" />
        <span>${m.name} (${m.hp}/${m.max_hp})</span>
      </button>`
    )
    .join("");

  // Logs
  document.getElementById("battle-log").innerHTML = s.log
    .slice()
    .reverse()
    .map((line) => `<div>${line}</div>`)
    .join("");

  // End bar
  const endBar = document.getElementById("battle-end-bar");
  if (!ongoing) {
    endBar.classList.remove("hidden");
    const backTab = s.mode === "cup" ? "cup" : "explore";
    let html = `<button class="btn-primary" onclick="switchTab('${backTab}')">Quay lại</button>`;
    if (s.mode === "wild") {
      html += `<button class="btn-green" onclick="triggerExploreEncounter(false)">🌿 Gặp Con Tiếp Theo</button>`;
    }
    if (s.mode === "cup" && s.status === "won") {
      html += `<button class="btn-gold" onclick="startCup('${s.cup_id}')">🏆 Đánh Vòng Tiếp Theo</button>`;
    }
    endBar.innerHTML = html;
  } else {
    endBar.classList.add("hidden");
  }
}

async function sendBattleAction(action, param = 0) {
  try {
    const data = await api("/api/battle/action", {
      method: "POST",
      body: JSON.stringify({ battle_id: currentBattle.battle_id, action, param }),
    });
    currentBattle = data.state;
    const prevLvl = currentUser.level;
    if (data.user) currentUser = data.user;
    else if (data.hud) Object.assign(currentUser, data.hud);
    updateHUD();
    if (currentUser.level > prevLvl) {
      toast(`🎉 LÊN CẤP TRAINER Lv.${currentUser.level}! Nhận +1 Open Point để mở quốc gia mới!`, "success");
      loadWorld();
    }

    const events = data.events || [];
    for (let idx = 0; idx < events.length; idx++) {
      const ev = events[idx];
      const delay = idx * 540;
      setTimeout(() => {
        if (ev.type === "attack") {
          window.PokeAudio.playAttack(ev.move.type);
          const atkImg = document.getElementById(ev.actor === "player" ? "player-sprite" : "enemy-sprite");
          const lungeCls = ev.actor === "player" ? "lunge-right" : "lunge-left";
          atkImg.classList.remove("lunge-right", "lunge-left");
          void atkImg.offsetWidth;
          atkImg.classList.add(lungeCls);

          window.BattleVFX.playAttack(ev.actor, ev.move.type, ev.dmg, ev.eff, ev.crit);

          setTimeout(() => {
            const defImg = document.getElementById(ev.actor === "player" ? "enemy-sprite" : "player-sprite");
            defImg.classList.remove("hit-shake");
            void defImg.offsetWidth;
            defImg.classList.add("hit-shake");
            if (ev.crit || ev.eff >= 2) {
              const stage = document.getElementById("battle-stage");
              stage.classList.remove("stage-quake");
              void stage.offsetWidth;
              stage.classList.add("stage-quake");
            }
          }, 260);
        } else if (ev.type === "throw_ball") {
          window.BattleVFX.throwBall(ev.shakes, ev.caught, ev.ball);
          if (ev.caught) window.PokeAudio.playCatchSuccess();
        }
      }, delay);
    }
    renderBattle();
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------------- REGION GACHA (MATCHING REFERENCE UI) + RELICS + MISSIONS ----------------
function switchGachaSubtab(sub) {
  document.getElementById("subtab-gacha-btn").classList.toggle("active", sub === "gacha");
  document.getElementById("subtab-packshop-btn").classList.toggle("active", sub === "packshop");
  document.getElementById("gacha-main-view").classList.toggle("hidden", sub !== "gacha");
  document.getElementById("packshop-main-view").classList.toggle("hidden", sub !== "packshop");
}

async function loadGachaBanners() {
  const data = await api("/api/gacha/banners");
  gachaBanners = data.banners;
  renderGachaView();
}

function selectGachaBanner(bid) {
  selectedGachaId = bid;
  renderGachaView();
}

function renderGachaView() {
  if (!gachaBanners.length || !currentUser) return;
  const b = gachaBanners.find((x) => x.id === selectedGachaId) || gachaBanners[0];
  document.getElementById("gacha-region-tabs").innerHTML = gachaBanners
    .map(
      (x) => `
      <button class="region-tab-btn ${x.id === b.id ? "active" : ""}" onclick="selectGachaBanner('${x.id}')">
        <span>${x.region}</span>
        <small>${x.gen_label}</small>
      </button>`
    )
    .join("");

  const caughtSet = new Set(currentUser.pokedex?.caught_ids || []);
  const haveCount = b.species_ids.filter((id) => caughtSet.has(id)).length;
  const pityInfo = (currentUser.pity_map && currentUser.pity_map[b.id]) || { pity: 0, egg: 0 };

  document.getElementById("gacha-banner-box").style.background = b.grad;
  document.getElementById("gacha-banner-box").innerHTML = `
    <div>
      <h3 class="gacha-banner-title">${b.title}</h3>
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:1rem;">${b.subtitle}</p>
      <div style="color:#cbd5e1;font-size:0.92rem;">You have <strong>${haveCount}</strong> of <strong>${b.total_species}</strong></div>
    </div>
    <div class="gacha-showcase">
      ${b.featured
        .map(
          (pid) => `
        <div class="gacha-mon-stage">
          ${pokeImgTag(pid, false, "poke-idle-anim")}
          <div class="mon-shadow"></div>
        </div>`
        )
        .join("")}
    </div>
  `;

  document.getElementById("gacha-pull-buttons").innerHTML = `
    <button class="gacha-pull-btn" onclick="pullGacha('x1')"><span>Pull ×1</span><span><img class="px-icon" src="/static/assets/ui/ticket_gold.png" /> 1</span></button>
    <button class="gacha-pull-btn" onclick="pullGacha('x10_t1')"><span>Pull ×10</span><span><img class="px-icon" src="/static/assets/ui/ticket_gold.png" /> 10</span></button>
    <button class="gacha-pull-btn" onclick="pullGacha('x10_t10')"><span>Pull ×10</span><span><img class="px-icon" src="/static/assets/ui/ticket_x10.png" /> 1</span></button>
    <button class="gacha-pull-btn" onclick="pullGacha('x100_t1')"><span>Pull ×100</span><span><img class="px-icon" src="/static/assets/ui/ticket_gold.png" /> 100</span></button>
    <button class="gacha-pull-btn" onclick="pullGacha('x100_t10')"><span>Pull ×100</span><span><img class="px-icon" src="/static/assets/ui/ticket_x10.png" /> 10</span></button>
  `;

  document.getElementById("gacha-ticket-status").innerHTML = `
    <div>You have <img class="px-icon" src="/static/assets/ui/ticket_gold.png" /> <strong>${currentUser.tickets ?? 0}</strong> tickets and <img class="px-icon" src="/static/assets/ui/ticket_x10.png" /> <strong>${currentUser.tickets_x10 ?? 0}</strong> ×10 tickets</div>
    <div><img class="px-icon" src="/static/assets/ui/egg.png" /> Egg from this region: <strong>${pityInfo.egg}</strong> of 10 ×10 pulls</div>
    <div>Pulls without a legendary in ${b.region}: <strong>${pityInfo.pity} / 70</strong></div>
  `;

  document.getElementById("gacha-odds-card").innerHTML = `
    <div>
      <h3 style="margin:0 0 12px;">Odds</h3>
      ${b.odds
        .map(
          (o) => `
        <div class="odds-row">
          <span style="color:${o.color};font-weight:700;"><img class="px-icon" src="${o.ball}" /> ${o.tier}</span>
          <span>${o.pct}% · ${o.count}</span>
        </div>`
        )
        .join("")}
      <div class="odds-row">
        <span style="color:#f472b6;font-weight:700;"><img class="px-icon" src="/static/assets/ui/star.svg" /> Shiny</span>
        <span>${(1 * (currentUser.relic_bonuses?.shiny_mult || 1)).toFixed(1)}%</span>
      </div>
    </div>
    <ul class="odds-rules">
      <li>The ×10 pull guarantees at least one Epic+!</li>
      <li>After 70 pulls without a Legendary or Mythic on a banner, the next one is guaranteed!</li>
      <li>Duplicates give PokéCoins. Shinies never repeat.</li>
      <li>Tickets drop from battles, missions & PokéMart.</li>
    </ul>
  `;
}

async function pullGacha(mode) {
  try {
    const data = await api("/api/gacha/pull", {
      method: "POST",
      body: JSON.stringify({ banner_id: selectedGachaId, mode }),
    });
    const prevLvl = currentUser.level;
    currentUser = data.user;
    updateHUD();
    window.PokeAudio.playPackOpen();
    if (currentUser.level > prevLvl) {
      toast(`🎉 Lên cấp Lv.${currentUser.level}! Nhận +1 Open Point!`, "success");
    }

    const r = data.result;
    const modal = document.getElementById("gacha-reveal-modal");
    modal.classList.remove("hidden");
    const eggHtml = (r.hatched_eggs || [])
      .map(
        (ep) => `<div style="margin-bottom:10px;padding:8px;border:2px solid #4ade80;border-radius:8px;background:rgba(16,185,129,0.16);"><img class="px-icon lg" src="/static/assets/ui/egg.png" /> <strong>TRỨNG NỞ ĐẶC BIỆT:</strong> ${ep.is_shiny ? "✨ " : ""}${ep.species_name} (Lv.${ep.level})!</div>`
      )
      .join("");

    modal.innerHTML = `
      <div class="panel-header-row">
        <h3>Quay ×${r.total_pulled} thành công! ${r.coins_from_dupes > 0 ? `(+${r.coins_from_dupes} Coins từ trùng lặp)` : ""}</h3>
        <button class="btn-sm" onclick="document.getElementById('gacha-reveal-modal').classList.add('hidden')">Đóng</button>
      </div>
      ${eggHtml}
      <div class="pulled-cards-row">
        ${r.pulls
          .map(
            (c) => `
          <div class="tcg-card r-${c.is_shiny ? "Shiny" : c.tier}" onclick="playCry(${c.pokemon.species_id})">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
              <strong>${c.is_shiny ? "SHINY" : c.tier}</strong>
              ${c.is_new ? '<span class="excl-badge">NEW!</span>' : ""}
            </div>
            ${pokeImgTag(c.pokemon.species_id, c.is_shiny, "poke-idle-anim")}
            <div><strong>${c.pokemon.is_shiny ? "✨ " : ""}${c.pokemon.species_name}</strong></div>
          </div>`
          )
          .join("")}
      </div>
    `;
    renderGachaView();
    renderTeamAndBag();
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderRelics() {
  if (!currentUser) return;
  const rels = currentUser.relics || [];
  const b = currentUser.relic_bonuses || {};
  const eqCnt = (b.equipped_ids || []).length;
  document.getElementById("relic-bonus-summary").textContent =
    `Đang kích hoạt: ${eqCnt}/3 · ATK +${Math.round(((b.atk_mult || 1) - 1) * 100)}% · DEF +${Math.round(((b.def_mult || 1) - 1) * 100)}% · SPD +${Math.round(((b.spd_mult || 1) - 1) * 100)}% · HP +${Math.round(((b.hp_mult || 1) - 1) * 100)}%`;

  document.getElementById("relics-grid").innerHTML = rels
    .map(
      (r) => `
      <div class="relic-card ${r.equipped ? "equipped" : ""}">
        <div class="relic-stage" style="border-color:${r.color};">
          <img class="relic-anim-${r.anim}" src="${r.icon}" alt="${r.name}" />
        </div>
        <strong style="color:${r.color};">${r.name}</strong>
        <span class="excl-badge">${r.stat_label}</span>
        <p class="muted" style="margin:2px 0;font-size:0.84rem;">${r.desc}</p>
        ${
          r.unlocked
            ? `<button class="${r.equipped ? "btn-gold" : "btn-primary"} full-w" onclick="toggleEquipRelic('${r.id}')">${r.equipped ? "✅ Đang Trang Bị (Tháo)" : "⚡ Trang Bị Relic"}</button>`
            : `<button class="btn-green full-w" onclick="buyRelic('${r.id}')"><img class="px-icon" src="/static/assets/ui/coin.svg" /> Mở Khóa · ${r.price}</button>`
        }
      </div>`
    )
    .join("");
}

async function buyRelic(rid) {
  try {
    const data = await api("/api/relics/buy", { method: "POST", body: JSON.stringify({ relic_id: rid }) });
    currentUser = data.user;
    updateHUD();
    renderRelics();
    window.PokeAudio.playCatchSuccess();
    toast(data.message, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function toggleEquipRelic(rid) {
  try {
    const data = await api("/api/relics/equip", { method: "POST", body: JSON.stringify({ relic_id: rid }) });
    currentUser = data.user;
    renderRelics();
    renderGachaView();
  } catch (err) {
    toast(err.message, "error");
  }
}

function setMissionPeriod(p) {
  activeMissionPeriod = p;
  for (const k of ["daily", "weekly", "monthly"]) {
    document.getElementById(`mtab-${k}`).classList.toggle("active", k === p);
  }
  renderMissions();
}

function renderMissions() {
  if (!currentUser) return;
  const list = (currentUser.missions || []).filter((m) => m.period === activeMissionPeriod);
  document.getElementById("missions-list").innerHTML = list
    .map((m) => {
      const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
      const rewParts = [];
      if (m.rewards.coins) rewParts.push(`+${m.rewards.coins} Coins`);
      if (m.rewards.tickets) rewParts.push(`+${m.rewards.tickets} Tickets`);
      if (m.rewards.tickets_x10) rewParts.push(`+${m.rewards.tickets_x10} ×10 Tickets`);
      if (m.rewards.poke_ball) rewParts.push(`+${m.rewards.poke_ball} Poké Ball`);
      if (m.rewards.ultra_ball) rewParts.push(`+${m.rewards.ultra_ball} Ultra Ball`);
      if (m.rewards.master_ball) rewParts.push(`+${m.rewards.master_ball} Master Ball`);
      if (m.rewards.rare_candy) rewParts.push(`+${m.rewards.rare_candy} Rare Candy`);
      if (m.rewards.xp) rewParts.push(`+${m.rewards.xp} XP`);

      return `
      <div class="mission-card ${m.can_claim ? "claimable" : ""} ${m.claimed ? "claimed" : ""}">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>${m.title}</strong>
          <span>${m.progress}/${m.target}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <small class="muted">Thưởng: <strong>${rewParts.join(" · ")}</strong></small>
        <button class="${m.can_claim ? "btn-gold" : "btn-sm"}" ${m.can_claim ? `onclick="claimMission('${m.id}')"` : "disabled"}>
          ${m.claimed ? "✅ Đã Nhận" : m.can_claim ? "🎁 Nhận Thưởng Ngay" : "Chưa Hoàn Thành"}
        </button>
      </div>`;
    })
    .join("");
}

async function claimMission(mid) {
  try {
    const data = await api("/api/missions/claim", { method: "POST", body: JSON.stringify({ mission_id: mid }) });
    currentUser = data.user;
    updateHUD();
    renderMissions();
    window.PokeAudio.playCatchSuccess();
    toast(data.message, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------------- TCG PACK SHOP & POKEMART ----------------
async function loadPacksAndShop() {
  const data = await api("/api/packs");
  packsCatalog = data.packs;
  shopItems = data.shop_items;

  document.getElementById("packs-grid").innerHTML = packsCatalog
    .map(
      (pk) => `
      <div class="tcg-pack-card" style="background: linear-gradient(155deg, ${pk.color}, #111827);">
        <div>
          <span class="pack-badge">${pk.badge}</span>
          <h3 style="margin:8px 0 4px;">${pk.name}</h3>
          <p style="font-size:0.82rem; color:#e2e8f0; margin:0;">${pk.subtitle}</p>
        </div>
        <img class="cover" src="${spriteUrl(pk.cover_id)}" alt="${pk.name}" />
        <button class="btn-gold full-w" onclick="openPack('${pk.id}')">🃏 Mở Pack · 🪙 ${pk.price}</button>
      </div>`
    )
    .join("");

  document.getElementById("pokemart-grid").innerHTML = shopItems
    .map((it) => {
      const owned =
        it.key === "ticket"
          ? currentUser.tickets || 0
          : it.key === "ticket_x10"
          ? currentUser.tickets_x10 || 0
          : (currentUser.inventory && currentUser.inventory[it.key]) || 0;
      const ico = it.icon || "/static/assets/items/poke-ball.png";
      return `
      <div class="mart-card">
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <img class="px-icon lg" src="${ico}" alt="${it.name}" />
            <strong>${it.name}</strong>
          </div>
          <p class="muted" style="margin:4px 0;">${it.desc}</p>
          <small>Trong túi: <strong>${owned}</strong></small>
        </div>
        <button class="btn-primary" onclick="buyShopItem('${it.key}')"><img class="px-icon" src="/static/assets/ui/coin.svg" /> Mua 1 · ${it.price}</button>
      </div>`;
    })
    .join("");
}

async function openPack(packId) {
  try {
    const data = await api("/api/packs/open", {
      method: "POST",
      body: JSON.stringify({ pack_id: packId }),
    });
    const prevLvl = currentUser.level;
    currentUser = data.user;
    updateHUD();
    window.PokeAudio.playPackOpen();
    if (currentUser.level > prevLvl) {
      toast(`🎉 Lên cấp Lv.${currentUser.level}! Nhận +1 Open Point!`, "success");
    }

    const r = data.result;
    const stage = document.getElementById("pack-reveal-stage");
    stage.classList.remove("hidden");
    stage.innerHTML = `
      <h3>✨ Đã mở ${r.pack.name}! ${r.stardust_gained > 0 ? `(+${r.stardust_gained} ✨ Stardust từ trùng lặp)` : ""}</h3>
      <div class="pulled-cards-row">
        ${r.cards
          .map(
            (c) => `
          <div class="tcg-card r-${c.rarity.split(" ")[0]}" onclick="playCry(${c.pokemon.species_id})">
            <div style="display:flex;justify-content:space-between;font-size:0.74rem;">
              <strong>${c.rarity}</strong>
              ${c.is_new ? '<span class="excl-badge">NEW!</span>' : ""}
            </div>
            ${pokeImgTag(c.pokemon.species_id, c.pokemon.is_shiny, "poke-idle-anim")}
            <div><strong>${c.pokemon.is_shiny ? "✨ " : ""}${c.pokemon.species_name}</strong></div>
            <small class="muted">Lv.${c.pokemon.level}</small>
            <div class="type-row" style="justify-content:center;margin-top:4px;">${typeBadgesHtml(c.pokemon.types)}</div>
          </div>`
          )
          .join("")}
      </div>
    `;
    renderTeamAndBag();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function buyShopItem(key) {
  try {
    const data = await api("/api/shop/buy", {
      method: "POST",
      body: JSON.stringify({ item_key: key, qty: 1 }),
    });
    currentUser = data.user;
    updateHUD();
    loadPacksAndShop();
    toast(data.message, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------------- GRAND CUP 6v6 ----------------
async function loadCups() {
  const data = await api("/api/cup/list");
  document.getElementById("cups-grid").innerHTML = data.cups
    .map((c) => {
      const prog = data.progress[c.id] || { current_stage: 1, wins: 0, championships: 0 };
      return `
      <div class="cup-card">
        <h3>🏆 ${c.name}</h3>
        <p class="muted">${c.desc}</p>
        <p>Tiến độ hiện tại: <strong>Vòng ${prog.current_stage}/${c.stages}</strong> · Cúp vô địch: <strong>${prog.championships}</strong></p>
        <p>Thưởng giải: 🪙 ${c.reward_coins}+ Coins · +${c.reward_xp} XP (mở khóa quốc gia siêu nhanh!)</p>
        <button class="btn-gold full-w" onclick="startCup('${c.id}')">⚔️ Ra Trận Với Đội Hình 6 Pokémon</button>
      </div>`;
    })
    .join("");
}

async function startCup(cupId) {
  try {
    const data = await api("/api/cup/start", {
      method: "POST",
      body: JSON.stringify({ cup_id: cupId }),
    });
    openBattleState(data.state);
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------------- TEAM & POKEDEX ----------------
function renderTeamAndBag() {
  if (!currentUser) return;
  renderTeamSlots(3, "team-slots-3");
  renderTeamSlots(6, "team-slots-6");
  renderMyPokemon();
}

function renderTeamSlots(size, containerId) {
  const field = size === 3 ? "team_slot_3" : "team_slot_6";
  let html = "";
  for (let s = 1; s <= size; s++) {
    const p = currentUser.pokemon.find((x) => x[field] === s);
    if (p) {
      html += `
        <div class="team-slot-card filled">
          ${pokeImgTag(p.species_id, p.is_shiny, "poke-idle-anim")}
          <strong>${p.is_shiny ? "✨ " : ""}${p.nickname}</strong>
          <small>Lv.${p.level}</small>
          <button class="btn-sm" onclick="assignTeamSlot(${p.id}, ${size}, null)">Tháo</button>
        </div>`;
    } else {
      html += `<div class="team-slot-card"><span class="muted">Slot ${s}<br/>Trống</span></div>`;
    }
  }
  document.getElementById(containerId).innerHTML = html;
}

const SALVAGE_LABEL = {
  Common: "60 Coins",
  Uncommon: "120 Coins",
  Rare: "3 Vé Thường",
  Epic: "5 Vé Thường",
  Legendary: "1 Vé Tím",
  Mythic: "3 Vé Tím",
};

function renderMyPokemon() {
  if (!currentUser) return;
  const q = (document.getElementById("bag-search")?.value || "").toLowerCase();
  const tierF = document.getElementById("bag-tier-filter")?.value || "all";
  const tierRank = { Mythic: 0, Legendary: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5 };
  const list = currentUser.pokemon
    .filter((p) => (tierF === "all" || (p.tier || "Common") === tierF) && p.species_name.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => (tierRank[a.tier] ?? 9) - (tierRank[b.tier] ?? 9) || b.level - a.level);
  document.getElementById("my-pokemon-grid").innerHTML = list
    .map((p) => {
      const tier = p.tier || "Common";
      const safeName = (p.nickname || p.species_name || "").replace(/'/g, "\\'");
      return `
      <div class="poke-card">
        <div class="poke-card-top">
          <span>#${p.species_id} · Lv.${p.level}</span>
          ${tierBadgeHtml(tier)}
        </div>
        ${pokeImgTag(p.species_id, p.is_shiny, "poke-idle-anim")}
        <strong>${p.is_shiny ? "✨ " : ""}${p.nickname}</strong>
        <div class="type-row">${typeBadgesHtml(p.types)}</div>
        <small class="muted">BST ${p.bst || "?"} · HP ${p.stats.max_hp} · ATK ${p.stats.atk} · SPD ${p.stats.spd}</small>
        <div class="slot-actions">
          <button class="btn-sm" onclick="quickAssign(${p.id}, 3)">+Đội 3</button>
          <button class="btn-sm" onclick="quickAssign(${p.id}, 6)">+Đội 6</button>
          <button class="btn-sm btn-gold" onclick="feedCandy(${p.id})"><img class="px-icon" src="/static/assets/items/rare-candy.png" /> Candy</button>
          ${p.can_evolve ? `<button class="btn-sm btn-green" onclick="evolvePoke(${p.id})">🧬 Tiến hóa</button>` : ""}
          <button class="btn-sm btn-danger" onclick="salvagePokemon(${p.id}, '${safeName}', '${tier}')"><img class="px-icon" src="/static/assets/ui/salvage.svg" /> Tách (+${SALVAGE_LABEL[tier] || "60 Coins"})</button>
        </div>
      </div>`;
    })
    .join("");
}

async function salvagePokemon(pokeId, name, tier) {
  const rewardText = SALVAGE_LABEL[tier] || "Coins";
  if (!confirm(`Tách ${name} (${tier}) để nhận ${rewardText}? Pokémon bị tách sẽ biến mất vĩnh viễn!`)) return;
  try {
    const data = await api("/api/pokemon/salvage", {
      method: "POST",
      body: JSON.stringify({ pokemon_id: pokeId }),
    });
    currentUser = data.user;
    updateHUD();
    renderTeamAndBag();
    toast(data.message, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function bulkSalvageTier(tier) {
  if (!confirm(`Tách TẤT CẢ Pokémon bậc ${tier} (tự giữ lại Pokémon trong đội hình 3v3/6v6 và Pokémon Shiny)?`)) return;
  try {
    const data = await api("/api/pokemon/salvage", {
      method: "POST",
      body: JSON.stringify({ bulk_tier: tier, keep_team: true }),
    });
    currentUser = data.user;
    updateHUD();
    renderTeamAndBag();
    toast(data.message, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

function quickAssign(pokeId, size) {
  const field = size === 3 ? "team_slot_3" : "team_slot_6";
  let freeSlot = null;
  for (let s = 1; s <= size; s++) {
    if (!currentUser.pokemon.find((x) => x[field] === s)) {
      freeSlot = s;
      break;
    }
  }
  if (!freeSlot) freeSlot = size; // replace last slot
  assignTeamSlot(pokeId, size, freeSlot);
}

async function assignTeamSlot(pokeId, modeSize, slot) {
  try {
    const data = await api("/api/team/assign", {
      method: "POST",
      body: JSON.stringify({ pokemon_id: pokeId, mode_size: modeSize, slot }),
    });
    currentUser = data.user;
    renderTeamAndBag();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function feedCandy(pokeId) {
  try {
    const data = await api("/api/pokemon/candy", {
      method: "POST",
      body: JSON.stringify({ pokemon_id: pokeId }),
    });
    currentUser = data.user;
    updateHUD();
    renderTeamAndBag();
    toast(`🍬 ${data.pokemon.nickname} đã tăng lên Lv.${data.pokemon.level}!`, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function evolvePoke(pokeId) {
  try {
    const data = await api("/api/pokemon/evolve", {
      method: "POST",
      body: JSON.stringify({ pokemon_id: pokeId }),
    });
    currentUser = data.user;
    updateHUD();
    renderTeamAndBag();
    window.PokeAudio.playCatchSuccess();
    toast(`🧬 Tiến hóa thành công thành ${data.pokemon.species_name}!`, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

function switchTeamSubtab(sub) {
  document.getElementById("subtab-bag-btn").classList.toggle("active", sub === "bag");
  document.getElementById("subtab-dex-btn").classList.toggle("active", sub === "dex");
  document.getElementById("team-bag-view").classList.toggle("hidden", sub !== "bag");
  document.getElementById("team-dex-view").classList.toggle("hidden", sub !== "dex");
  if (sub === "dex") renderPokedex();
}

async function loadPokedex() {
  const data = await api("/api/pokedex");
  pokedexCache = data.species;
}

function renderPokedex() {
  const q = (document.getElementById("dex-search")?.value || "").toLowerCase();
  const tierF = document.getElementById("dex-tier-filter")?.value || "all";
  const gen = document.getElementById("dex-gen-filter")?.value || "all";
  const exclOnly = document.getElementById("dex-excl-only")?.checked || false;
  const caughtSet = new Set(currentUser?.pokedex?.caught_ids || []);

  const filtered = pokedexCache
    .filter((s) => {
      if (tierF !== "all" && (s.tier || "Common") !== tierF) return false;
      if (gen !== "all" && String(s.gen) !== gen) return false;
      if (exclOnly && !s.exclusive_country_name) return false;
      if (q && !s.name.toLowerCase().includes(q) && String(s.id) !== q) return false;
      return true;
    })
    .slice(0, 80);

  document.getElementById("pokedex-grid").innerHTML = filtered
    .map(
      (s) => `
      <div class="poke-card ${caughtSet.has(s.id) ? "caught" : ""}">
        <div class="poke-card-top">
          <span>#${s.id} · Gen ${s.gen}</span>
          ${tierBadgeHtml(s.tier)}
        </div>
        ${pokeImgTag(s.id, false, "poke-idle-anim", s.name)}
        <strong>${s.name} ${caughtSet.has(s.id) ? "✅" : ""}</strong>
        <div class="type-row">${typeBadgesHtml(s.types)}</div>
        <small class="muted">BST ${s.bst || "?"} · Tỉ lệ bắt ${s.capture_rate || "?"}</small>
        ${
          s.exclusive_country_name
            ? `<span class="excl-badge">📍 Độc quyền: ${s.exclusive_country_name}</span>`
            : ``
        }
      </div>`
    )
    .join("");
}

// ---------------- ONLINE PVP & TRADE ----------------
async function refreshOnlineRooms() {
  try {
    const data = await api("/api/online/rooms");
    document.getElementById("online-rooms-list").innerHTML = data.rooms.length
      ? data.rooms
          .map(
            (r) => `
          <div class="room-item">
            <div>
              <strong>${r.title}</strong> <span class="badge">${r.mode}</span><br/>
              <small class="muted">Mã: <strong>${r.code}</strong> · Host: ${r.host_username} · Chỗ: <strong>${r.occupied_slots}/${r.max_slots}</strong></small>
            </div>
            <button class="btn-primary btn-sm" onclick="joinOnlineRoom(${r.id})">Vào phòng</button>
          </div>`
          )
          .join("")
      : `<div class="muted">Chưa có phòng nào đang mở. Hãy tạo phòng mới!</div>`;
    if (currentOnlineRoom) {
      const detail = await api(`/api/online/rooms/${currentOnlineRoom.id}`);
      currentOnlineRoom = detail.room;
      renderOnlineRoomStage();
    }
  } catch (_) {}
}

async function createOnlineRoom(e) {
  e.preventDefault();
  try {
    const data = await api("/api/online/create", {
      method: "POST",
      body: JSON.stringify({
        title: document.getElementById("room-title").value,
        mode: document.getElementById("room-mode").value,
        max_slots: Number(document.getElementById("room-slots").value),
      }),
    });
    currentOnlineRoom = data.room;
    startOnlinePolling();
    renderOnlineRoomStage();
    refreshOnlineRooms();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function joinOnlineRoom(roomId) {
  try {
    const data = await api("/api/online/join", {
      method: "POST",
      body: JSON.stringify({ room_id: roomId }),
    });
    currentOnlineRoom = data.room;
    startOnlinePolling();
    renderOnlineRoomStage();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function joinByCode() {
  const code = document.getElementById("join-code-input").value.trim();
  if (!code) return;
  try {
    const data = await api("/api/online/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    currentOnlineRoom = data.room;
    startOnlinePolling();
    renderOnlineRoomStage();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function leaveOnlineRoom() {
  if (!currentOnlineRoom) return;
  await api("/api/online/leave", {
    method: "POST",
    body: JSON.stringify({ room_id: currentOnlineRoom.id }),
  });
  currentOnlineRoom = null;
  clearInterval(onlinePollTimer);
  document.getElementById("online-room-stage").innerHTML = `<div class="empty-hint">Đã rời phòng.</div>`;
  refreshOnlineRooms();
}

function startOnlinePolling() {
  clearInterval(onlinePollTimer);
  onlinePollTimer = setInterval(async () => {
    if (!currentOnlineRoom) return;
    try {
      const data = await api(`/api/online/rooms/${currentOnlineRoom.id}`);
      currentOnlineRoom = data.room;
      renderOnlineRoomStage();
    } catch (_) {}
  }, 2200);
}

function renderOnlineRoomStage() {
  const r = currentOnlineRoom;
  if (!r) return;
  const stage = document.getElementById("online-room-stage");

  let bodyHtml = `
    <div class="panel-header-row">
      <div>
        <h3>${r.title} <span class="badge">${r.mode}</span></h3>
        <small class="muted">Mã phòng: <strong>${r.code}</strong> · Chỗ: ${r.occupied_slots}/${r.max_slots}</small>
      </div>
      <button class="btn-danger btn-sm" onclick="leaveOnlineRoom()">Rời phòng</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      ${r.players
        .map(
          (p) => `<div class="hud-pill">Slot ${p.slot_index}: <strong>${p.username}</strong> ${p.ready ? "✅ Sẵn sàng" : "⏳"}</div>`
        )
        .join("")}
    </div>
  `;

  if (r.mode === "trade") {
    const p1 = r.players[0];
    const p2 = r.players[1];
    const pokeOpts = currentUser.pokemon
      .map((p) => `<option value="${p.id}">${p.species_name} (Lv.${p.level})</option>`)
      .join("");
    bodyHtml += `
      <div class="trade-grid">
        ${[p1, p2]
          .map((p, idx) =>
            p
              ? `<div class="trade-box">
                  <strong>${p.username}</strong>
                  ${
                    p.offer_pokemon
                      ? `<img src="${spriteUrl(p.offer_pokemon.species_id, p.offer_pokemon.is_shiny)}" style="width:72px;display:block;margin:8px auto;" /><div>${p.offer_pokemon.species_name} Lv.${p.offer_pokemon.level}</div>`
                      : `<p class="muted">Chưa chọn Pokémon</p>`
                  }
                  <small>${p.ready ? "✅ Đã xác nhận" : "Chưa chốt"}</small>
                </div>`
              : `<div class="trade-box"><p class="muted">Đang chờ người chơi ${idx + 1}...</p></div>`
          )
          .join("")}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <select id="trade-select-poke">${pokeOpts}</select>
        <button class="btn-primary" onclick="sendTradeOffer()">Đặt Lên Bàn Trade</button>
        <button class="btn-green" onclick="confirmOnlineTrade()">🤝 Chốt Giao Dịch</button>
      </div>
      ${r.state.last_trade ? `<p style="color:var(--green);margin-top:10px;">${r.state.last_trade}</p>` : ""}
    `;
  } else if (r.status === "waiting") {
    bodyHtml += `
      <p class="muted">Khi cả 2 người chơi đầu nhấn Sẵn Sàng, trận PvP ${r.mode === "pvp_6v6" ? "6v6" : "3v3"} sẽ bắt đầu ngay!</p>
      <button class="btn-green" onclick="togglePvpReady()">✅ Sẵn Sàng / Hủy</button>
    `;
  } else {
    const st = r.state;
    const myKey = String(currentUser.id);
    const foeKey = String(st.p1_user_id) === myKey ? String(st.p2_user_id) : String(st.p1_user_id);
    const myMon = st.teams[myKey]?.[st.active[myKey]];
    const foeMon = st.teams[foeKey]?.[st.active[foeKey]];
    bodyHtml += `
      <div class="trade-grid">
        <div class="trade-box">
          <strong>Bạn: ${myMon?.name || "?"}</strong> (Lv.${myMon?.level})
          ${myMon ? `<img src="${spriteUrl(myMon.species_id)}" style="width:82px;display:block;margin:4px auto;" />` : ""}
          <div>HP: ${myMon?.hp}/${myMon?.max_hp}</div>
        </div>
        <div class="trade-box">
          <strong>Đối thủ: ${foeMon?.name || "?"}</strong> (Lv.${foeMon?.level})
          ${foeMon ? `<img src="${spriteUrl(foeMon.species_id)}" style="width:82px;display:block;margin:4px auto;" />` : ""}
          <div>HP: ${foeMon?.hp}/${foeMon?.max_hp}</div>
        </div>
      </div>
      ${
        st.status === "ongoing" && myMon
          ? `<div class="moves-grid">${myMon.moves
              .map(
                (m, idx) => `<button class="move-btn" onclick="submitPvpAction('move', ${idx})"><span>${m.name}</span><span class="type-badge t-${m.type}">${m.type}</span></button>`
              )
              .join("")}</div>`
          : `<p><strong>${st.winner_user_id === currentUser.id ? "🏆 BẠN ĐÃ THẮNG PVP!" : "Trận đấu kết thúc!"}</strong></p>`
      }
      <div class="battle-log" style="margin-top:10px;max-height:140px;">${(st.log || [])
        .slice()
        .reverse()
        .map((l) => `<div>${l}</div>`)
        .join("")}</div>
    `;
  }

  stage.innerHTML = bodyHtml;
}

async function togglePvpReady() {
  try {
    const data = await api("/api/online/pvp/ready", {
      method: "POST",
      body: JSON.stringify({ room_id: currentOnlineRoom.id }),
    });
    currentOnlineRoom = data.room;
    renderOnlineRoomStage();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function submitPvpAction(action, param) {
  try {
    const data = await api("/api/online/pvp/action", {
      method: "POST",
      body: JSON.stringify({ room_id: currentOnlineRoom.id, action, param }),
    });
    currentOnlineRoom = data.room;
    if (data.user) {
      currentUser = data.user;
      updateHUD();
    }
    renderOnlineRoomStage();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function sendTradeOffer() {
  const pid = Number(document.getElementById("trade-select-poke").value);
  try {
    const data = await api("/api/online/trade/offer", {
      method: "POST",
      body: JSON.stringify({ room_id: currentOnlineRoom.id, pokemon_id: pid }),
    });
    currentOnlineRoom = data.room;
    renderOnlineRoomStage();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function confirmOnlineTrade() {
  try {
    const data = await api("/api/online/trade/confirm", {
      method: "POST",
      body: JSON.stringify({ room_id: currentOnlineRoom.id }),
    });
    currentOnlineRoom = data.room;
    currentUser = data.user;
    updateHUD();
    renderTeamAndBag();
    renderOnlineRoomStage();
    toast("🤝 Hoàn tất giao dịch!", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------------- FRIENDS SYSTEM ----------------
async function loadFriends(silent = false) {
  try {
    const data = await api("/api/friends");
    renderFriends(data);
  } catch (err) {
    if (!silent) toast(err.message, "error");
  }
}

function renderFriends(data) {
  const incoming = data.incoming || [];
  const outgoing = data.outgoing || [];
  const friends = data.friends || [];

  const badge = document.getElementById("friends-badge");
  if (badge) {
    badge.classList.toggle("hidden", incoming.length === 0);
    badge.textContent = incoming.length;
  }

  const inCount = document.getElementById("friends-incoming-count");
  const outCount = document.getElementById("friends-outgoing-count");
  const accCount = document.getElementById("friends-accepted-count");
  if (inCount) inCount.textContent = incoming.length;
  if (outCount) outCount.textContent = outgoing.length;
  if (accCount) accCount.textContent = friends.length;

  const inEl = document.getElementById("friends-incoming-list");
  if (inEl) {
    inEl.innerHTML = incoming.length
      ? incoming
          .map(
            (r) => `
          <div class="friend-card">
            <div class="friend-meta">
              <span class="online-dot ${r.online ? "online" : "offline"}"></span>
              <div>
                <strong>${r.username}</strong> <small class="muted">Lv.${r.level}</small>
              </div>
            </div>
            <div class="friend-actions">
              <button class="btn-sm btn-green" onclick="respondFriend(${r.request_id}, 'accept')">Chấp nhận</button>
              <button class="btn-sm btn-danger" onclick="respondFriend(${r.request_id}, 'reject')">Từ chối</button>
            </div>
          </div>`
          )
          .join("")
      : `<div class="muted">Không có lời mời kết bạn nào.</div>`;
  }

  const outEl = document.getElementById("friends-outgoing-list");
  if (outEl) {
    outEl.innerHTML = outgoing.length
      ? outgoing
          .map(
            (r) => `
          <div class="friend-card">
            <div class="friend-meta">
              <span class="online-dot ${r.online ? "online" : "offline"}"></span>
              <div>
                <strong>${r.username}</strong> <small class="muted">Lv.${r.level} · Đang chờ...</small>
              </div>
            </div>
          </div>`
          )
          .join("")
      : `<div class="muted">Chưa gửi lời mời nào.</div>`;
  }

  const fEl = document.getElementById("friends-list");
  if (fEl) {
    fEl.innerHTML = friends.length
      ? friends
          .map((f) => {
            const safeUser = (f.username || "").replace(/'/g, "\\'");
            return `
          <div class="friend-card">
            <div class="friend-meta">
              <span class="online-dot ${f.online ? "online" : "offline"}" title="${f.online ? "Đang Online" : "Offline"}"></span>
              <div>
                <strong>${f.username}</strong> <small class="badge">Lv.${f.level}</small><br/>
                <small class="muted">${f.online ? "🟢 Online" : "⚪ Offline"} · ${f.countries} vùng · ${f.pokedex} loài</small>
              </div>
            </div>
            <div class="friend-actions">
              <button class="btn-sm btn-primary" onclick="inviteFriendRoom('${safeUser}', 'pvp_3v3')">⚔️ PvP 3v3</button>
              <button class="btn-sm btn-gold" onclick="inviteFriendRoom('${safeUser}', 'trade')">🤝 Trade</button>
              <button class="btn-sm btn-danger" onclick="removeFriend(${f.id}, '${safeUser}')">Xóa</button>
            </div>
          </div>`;
          })
          .join("")
      : `<div class="muted">Bạn chưa có bạn bè nào. Hãy nhập tên Trainer ở trên để kết bạn!</div>`;
  }
}

async function sendFriendRequest(e) {
  e.preventDefault();
  const input = document.getElementById("friend-username-input");
  const username = (input?.value || "").trim();
  if (!username) return;
  try {
    const data = await api("/api/friends/request", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    if (input) input.value = "";
    renderFriends(data.overview);
    toast(data.message, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function respondFriend(requestId, action) {
  try {
    const data = await api("/api/friends/respond", {
      method: "POST",
      body: JSON.stringify({ request_id: requestId, action }),
    });
    renderFriends(data.overview);
    toast(data.message, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function removeFriend(friendId, username) {
  if (!confirm(`Hủy kết bạn với ${username}?`)) return;
  try {
    const data = await api("/api/friends/remove", {
      method: "POST",
      body: JSON.stringify({ friend_id: friendId }),
    });
    renderFriends(data.overview);
    toast(data.message, "info");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function inviteFriendRoom(friendName, mode) {
  try {
    const data = await api("/api/online/create", {
      method: "POST",
      body: JSON.stringify({
        title: `${currentUser.username} vs ${friendName}`,
        mode,
        max_slots: 2,
      }),
    });
    currentOnlineRoom = data.room;
    switchTab("online");
    startOnlinePolling();
    renderOnlineRoomStage();
    refreshOnlineRooms();
    toast(`Đã tạo phòng ${mode === "trade" ? "Trade" : "PvP"}! Mã phòng cho ${friendName}: ${data.room.code}`, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

bootstrap();
