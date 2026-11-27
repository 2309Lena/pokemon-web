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
  const box = document.getElementById("toast-container");
  if (!box) return;
  while (box.children.length >= 2) box.firstElementChild.remove();
  const icon = kind === "error" ? "⚠️" : kind === "success" ? "✨" : "📢";
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = `${icon} ${msg}`;
  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function askConfirm(message, title = "⚠️ Xác Nhận Thao Tác", okLabel = "✓ Xác Nhận") {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-confirm-modal");
    const tEl = document.getElementById("confirm-modal-title");
    const mEl = document.getElementById("confirm-modal-msg");
    const okBtn = document.getElementById("confirm-modal-ok");
    const cancelBtn = document.getElementById("confirm-modal-cancel");
    if (!modal || !okBtn || !cancelBtn) return resolve(true);
    tEl.textContent = title;
    mEl.textContent = message;
    okBtn.textContent = okLabel;
    modal.classList.remove("hidden");

    const cleanup = (ans) => {
      modal.classList.add("hidden");
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(ans);
    };
    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
  });
}

const CLIENT_APP_VERSION =
  (document.querySelector('meta[name="app-version"]') &&
    document.querySelector('meta[name="app-version"]').getAttribute("content")) ||
  "";
let isForceReloading = false;
let versionPollTimer = null;

function stripUpdateParamIfPresent() {
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.has("_v")) {
      u.searchParams.delete("_v");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
  } catch (_) {}
}

function triggerForceUpdateReload(newVer) {
  if (!newVer || !CLIENT_APP_VERSION || newVer === CLIENT_APP_VERSION || isForceReloading) return;
  try {
    const last = JSON.parse(sessionStorage.getItem("pokeworld_reloading_ver") || "null");
    if (last && last.ver === newVer && Date.now() - last.ts < 12000) return;
    sessionStorage.setItem("pokeworld_reloading_ver", JSON.stringify({ ver: newVer, ts: Date.now() }));
  } catch (_) {}

  isForceReloading = true;
  clearInterval(versionPollTimer);
  const modal = document.getElementById("force-update-modal");
  const msgEl = document.getElementById("force-update-msg");
  if (msgEl) {
    msgEl.textContent = "Server vừa cập nhật bản mới! Đang tự động tải lại để áp dụng ngay...";
  }
  if (modal) modal.classList.remove("hidden");

  setTimeout(() => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("_v", Date.now().toString());
      window.location.replace(u.toString());
    } catch (_) {
      window.location.reload();
    }
  }, 1400);
}

async function checkAppVersion() {
  if (!CLIENT_APP_VERSION || isForceReloading) return;
  try {
    const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
    const headerVer = res.headers.get("X-App-Version");
    if (headerVer && headerVer !== CLIENT_APP_VERSION) {
      triggerForceUpdateReload(headerVer);
      return;
    }
    if (res.ok) {
      const data = await res.json();
      if (data.version && data.version !== CLIENT_APP_VERSION) {
        triggerForceUpdateReload(data.version);
      }
    }
  } catch (_) {}
}

function startVersionWatcher() {
  stripUpdateParamIfPresent();
  clearInterval(versionPollTimer);
  versionPollTimer = setInterval(() => {
    if (!document.hidden) checkAppVersion();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkAppVersion();
  });
  window.addEventListener("focus", checkAppVersion);
}

let pingPollTimer = null;
let pingInFlight = false;

function updatePingHud(ms, ok = true) {
  const hud = document.getElementById("ping-hud");
  const txt = document.getElementById("ping-text");
  if (!hud || !txt) return;
  hud.classList.remove("ping-good", "ping-warn", "ping-bad");
  if (!ok) {
    txt.textContent = "Ping: Offline";
    hud.classList.add("ping-bad");
    return;
  }
  const cleanMs = Math.max(1, Math.round(ms));
  txt.textContent = `Ping: ${cleanMs} ms`;
  if (cleanMs < 150) hud.classList.add("ping-good");
  else if (cleanMs < 380) hud.classList.add("ping-warn");
  else hud.classList.add("ping-bad");
}

async function measurePing() {
  if (pingInFlight) return;
  pingInFlight = true;
  const ctrl = new AbortController();
  const abortId = setTimeout(() => ctrl.abort(), 6000);
  const t0 = performance.now();
  try {
    const res = await fetch(`/api/ping?t=${Date.now()}`, {
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(abortId);
    if (!res.ok) throw new Error("HTTP " + res.status);
    updatePingHud(performance.now() - t0, true);
    const serverVer = res.headers.get("X-App-Version");
    if (serverVer && CLIENT_APP_VERSION && serverVer !== CLIENT_APP_VERSION) {
      triggerForceUpdateReload(serverVer);
    }
  } catch (_) {
    clearTimeout(abortId);
    updatePingHud(0, false);
  } finally {
    pingInFlight = false;
  }
}

function startPingMonitor() {
  measurePing();
  clearInterval(pingPollTimer);
  pingPollTimer = setInterval(() => {
    if (!document.hidden) measurePing();
  }, 12000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) measurePing();
  });
}

async function api(url, opts = {}) {
  const t0 = performance.now();
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  updatePingHud(performance.now() - t0, true);
  const serverVer = res.headers.get("X-App-Version");
  if (serverVer && CLIENT_APP_VERSION && serverVer !== CLIENT_APP_VERSION) {
    triggerForceUpdateReload(serverVer);
  }
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
  startVersionWatcher();
  startPingMonitor();
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
  startSoloInvitePolling();
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
  if (tab === "forum") loadForumPosts();
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
    if (e.target.closest(".country-drawer, .map-zoom-controls")) return;
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

let countryDrawerCollapsed = false;

function toggleCountryDrawer() {
  countryDrawerCollapsed = !countryDrawerCollapsed;
  const drawer = document.getElementById("country-drawer");
  if (!drawer) return;
  drawer.classList.toggle("collapsed", countryDrawerCollapsed);
  const btn = drawer.querySelector(".country-toggle-btn");
  if (btn) btn.textContent = countryDrawerCollapsed ? "▲" : "▼";
}

function selectCountry(cid, redrawSvg = true) {
  if (worldDidDrag && redrawSvg) return;
  selectedCountryId = cid;
  if (redrawSvg) {
    countryDrawerCollapsed = false;
    renderWorldSVG();
  }
  const c = worldCountries.find((x) => x.id === cid);
  if (!c) return;
  const drawer = document.getElementById("country-drawer");
  drawer.classList.toggle("collapsed", countryDrawerCollapsed);
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
    <div class="country-drawer-head">
      <div>
        <h3>${c.name}</h3>
        <p class="muted country-drawer-sub">${c.continent} · ${c.biome_label} ${c.is_starter ? "· ⭐ Nước khởi đầu" : ""}</p>
      </div>
      <button type="button" class="btn-sm country-toggle-btn" onclick="toggleCountryDrawer()" title="Thu gọn / Mở rộng">${countryDrawerCollapsed ? "▲" : "▼"}</button>
    </div>
    <div class="country-drawer-body">
      ${actionBtn}
      <h4>⭐ Pokémon Đặc Trưng (${c.name})</h4>
      <div class="country-poke-list">${exclHtml}</div>
      <h4>🌿 Loài hoang dã bản địa</h4>
      <div class="country-poke-list">${localHtml}</div>
    </div>
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

const CLIENT_TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0.0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2.0, ice: 2.0, bug: 2.0, rock: 0.5, dragon: 0.5, steel: 2.0 },
  water: { fire: 2.0, water: 0.5, grass: 0.5, ground: 2.0, rock: 2.0, dragon: 0.5 },
  electric: { water: 2.0, electric: 0.5, grass: 0.5, ground: 0.0, flying: 2.0, dragon: 0.5 },
  grass: { fire: 0.5, water: 2.0, grass: 0.5, poison: 0.5, ground: 2.0, flying: 0.5, bug: 0.5, rock: 2.0, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2.0, ice: 0.5, ground: 2.0, flying: 2.0, dragon: 2.0, steel: 0.5 },
  fighting: { normal: 2.0, ice: 2.0, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2.0, ghost: 0.0, dark: 2.0, steel: 2.0, fairy: 0.5 },
  poison: { grass: 2.0, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0.0, fairy: 2.0 },
  ground: { fire: 2.0, electric: 2.0, grass: 0.5, poison: 2.0, flying: 0.0, bug: 0.5, rock: 2.0, steel: 2.0 },
  flying: { electric: 0.5, grass: 2.0, fighting: 2.0, bug: 2.0, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2.0, poison: 2.0, psychic: 0.5, dark: 0.0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2.0, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2.0, ghost: 0.5, dark: 2.0, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2.0, ice: 2.0, fighting: 0.5, ground: 0.5, flying: 2.0, bug: 2.0, steel: 0.5 },
  ghost: { normal: 0.0, psychic: 2.0, ghost: 2.0, dark: 0.5 },
  dragon: { dragon: 2.0, steel: 0.5, fairy: 0.0 },
  dark: { fighting: 0.5, psychic: 2.0, ghost: 2.0, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2.0, rock: 2.0, steel: 0.5, fairy: 2.0 },
  fairy: { fire: 0.5, fighting: 2.0, poison: 0.5, dragon: 2.0, dark: 2.0, steel: 0.5 },
};

function movePreviewMeta(attacker, defender, m) {
  const chart = CLIENT_TYPE_CHART[m.type] || {};
  let eff = 1.0;
  for (const dt of defender?.types || []) eff *= chart[dt] ?? 1.0;
  let badge = `<span style="color:#cbd5e1;">⚔️ ×1 Thường</span>`;
  let effMult = 1.0;
  if (eff === 0) {
    badge = `<span style="color:#f87171;">🚫 Vô hiệu</span>`;
    effMult = 0;
  } else if (eff >= 4) {
    badge = `<span style="color:#facc15;font-weight:800;">💥 ×4 KHẮC</span>`;
    effMult = 3.6;
  } else if (eff >= 2) {
    badge = `<span style="color:#4ade80;font-weight:800;">🔥 ×2 KHẮC</span>`;
    effMult = 2.15;
  } else if (eff < 1) {
    badge = `<span style="color:#93c5fd;">🛡️ ×${eff} Kháng</span>`;
    effMult = eff >= 0.5 ? 0.55 : 0.3;
  }
  const stab = (attacker?.types || []).includes(m.type) ? 1.28 : 1.0;
  const raw = (((2 * (attacker?.level || 1)) / 5 + 2) * (m.power || 50) * ((attacker?.atk || 10) / Math.max(1, defender?.def || 10))) / 42 + 2;
  const est = eff === 0 ? 0 : Math.max(1, Math.round(raw * stab * effMult));
  return { badge, est };
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

  // Moves with live STAB, Khắc / Không khắc effectiveness & estimated damage!
  document.getElementById("battle-moves").innerHTML = p.moves
    .map((m, idx) => {
      const pv = movePreviewMeta(p, e, m);
      return `
      <button class="move-btn" ${ongoing ? "" : "disabled"} onclick="sendBattleAction('move', ${idx})">
        <div>
          <strong>${m.name}</strong> ${m.role === "Signature" ? `<span class="excl-badge">★</span>` : ""}<br />
          <small class="muted">Pow ${m.power} · ~${pv.est} DMG · ${pv.badge}</small>
        </div>
        <span class="type-badge t-${m.type}">${m.type}</span>
      </button>`;
    })
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
    const relicDrop = data.state?.rewards?.dropped_relic;
    if (relicDrop && relicDrop.relic) {
      const rObj = relicDrop.relic;
      if (window.PokeAudio && window.PokeAudio.playPackOpen) {
        window.PokeAudio.playPackOpen();
      }
      if (relicDrop.is_new) {
        toast(`🏺 RƠI RELIC MỚI [${rObj.tier}]: ${rObj.name}!`, "success");
      } else {
        toast(`🏺 Rơi Relic trùng [${rObj.tier}] ${rObj.name} → +${relicDrop.dup_coins} Coins!`, "info");
      }
      renderRelics();
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

let relicFilter = { tier: "all", own: "all" };

function setRelicFilter(key, val) {
  relicFilter[key] = val;
  renderRelics();
}

function renderRelics() {
  if (!currentUser) return;
  const rels = currentUser.relics || [];
  const b = currentUser.relic_bonuses || {};
  const eqCnt = (b.equipped_ids || []).length;
  const ownedCnt = rels.filter((r) => r.unlocked).length;
  document.getElementById("relic-bonus-summary").textContent =
    `Đã mở: ${ownedCnt}/${rels.length} · Trang bị: ${eqCnt}/3 · ATK +${Math.round(((b.atk_mult || 1) - 1) * 100)}% · DEF +${Math.round(((b.def_mult || 1) - 1) * 100)}% · SPD +${Math.round(((b.spd_mult || 1) - 1) * 100)}% · HP +${Math.round(((b.hp_mult || 1) - 1) * 100)}%`;

  const tChips = document.getElementById("relic-tier-chips");
  if (tChips) {
    const tiers = ["all", "Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common"];
    tChips.innerHTML = tiers
      .map((t) => `<button type="button" class="pp-chip ${relicFilter.tier === t ? "active" : ""}" onclick="setRelicFilter('tier','${t}')">${t === "all" ? "Tất cả Tier" : t}</button>`)
      .join("");
  }
  const oChips = document.getElementById("relic-own-chips");
  if (oChips) {
    const opts = [
      ["all", "Tất cả"],
      ["owned", "✅ Đã sở hữu"],
      ["locked", "🔒 Chưa mở"],
    ];
    oChips.innerHTML = opts
      .map(([k, lbl]) => `<button type="button" class="pp-chip ${relicFilter.own === k ? "active" : ""}" onclick="setRelicFilter('own','${k}')">${lbl}</button>`)
      .join("");
  }

  const q = (document.getElementById("relic-search")?.value || "").trim().toLowerCase();
  const tierRank = { Mythic: 0, Legendary: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5 };
  const filtered = rels
    .filter((r) => {
      if (relicFilter.tier !== "all" && (r.tier || "Rare") !== relicFilter.tier) return false;
      if (relicFilter.own === "owned" && !r.unlocked) return false;
      if (relicFilter.own === "locked" && r.unlocked) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.stat_label.toLowerCase().includes(q)) return false;
      return true;
    })
    .slice()
    .sort((a, b2) => {
      if (a.equipped !== b2.equipped) return a.equipped ? -1 : 1;
      if (a.unlocked !== b2.unlocked) return a.unlocked ? -1 : 1;
      return (tierRank[b2.tier] ?? 9) - (tierRank[a.tier] ?? 9) || a.price - b2.price;
    });

  const cntLbl = document.getElementById("relic-count-label");
  if (cntLbl) cntLbl.textContent = `${filtered.length}/${rels.length} Relic`;

  document.getElementById("relics-grid").innerHTML = filtered.length
    ? filtered
        .map(
          (r) => `
      <div class="relic-card ${r.equipped ? "equipped" : ""}">
        <div style="width:100%;display:flex;justify-content:space-between;align-items:center;">
          ${tierBadgeHtml(r.tier || "Rare")}
          <small class="muted">${r.equipped ? "⚡ Đang dùng" : r.unlocked ? "✅ Đã mở" : `🪙 ${r.price.toLocaleString()}`}</small>
        </div>
        <div class="relic-stage" style="border-color:${r.color};">
          <img class="relic-anim-${r.anim}" style="filter:hue-rotate(${r.hue || 0}deg);" src="${r.icon}" alt="${r.name}" />
        </div>
        <strong style="color:${r.color};">${r.name}</strong>
        <span class="excl-badge">${r.stat_label}</span>
        <p class="muted" style="margin:2px 0;font-size:0.82rem;">${r.desc}</p>
        ${
          r.unlocked
            ? `<button class="${r.equipped ? "btn-gold" : "btn-primary"} full-w" onclick="toggleEquipRelic('${r.id}')">${r.equipped ? "✅ Đang Trang Bị (Tháo)" : "⚡ Trang Bị Relic"}</button>`
            : `<button class="btn-green full-w" onclick="buyRelic('${r.id}')"><img class="px-icon" src="/static/assets/ui/coin.svg" /> Mua Relic · ${r.price.toLocaleString()}</button>`
        }
      </div>`
        )
        .join("")
    : `<div class="muted">Không có Relic nào khớp bộ lọc.</div>`;
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
      if (m.rewards.plate_stone) rewParts.push(`+${m.rewards.plate_stone} 🔮 Phiến Đá Đa Hệ`);
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

// ---------------- KECLEON SHOP & TCG PACKS ----------------
function switchKecleonTab(tab) {
  const isItems = tab === "items";
  document.getElementById("kshop-tab-items")?.classList.toggle("active", isItems);
  document.getElementById("kshop-tab-packs")?.classList.toggle("active", !isItems);
  document.getElementById("kshop-items-pane")?.classList.toggle("hidden", !isItems);
  document.getElementById("kshop-packs-pane")?.classList.toggle("hidden", isItems);
  const tip = document.getElementById("kshop-tip");
  if (tip) {
    tip.textContent = isItems
      ? "💡 Bấm nút tiền Vàng để mua ×1 hoặc chọn nhanh ×10 / ×100 cho Bóng, Thuốc & Vé Gacha."
      : "✨ Mỗi Booster Pack mở ra 5 thẻ Pokémon ngẫu nhiên theo chủ đề — thẻ trùng tự đổi thành Stardust!";
  }
}

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
        <button class="kshop-price-btn full-w" onclick="openPack('${pk.id}')"><img src="/static/assets/ui/coin.svg" alt="" /> ${pk.price.toLocaleString()} · Mở Pack</button>
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
      <div class="kshop-card">
        <div class="kshop-icon-wrap">
          <img src="${ico}" alt="${it.name}" />
        </div>
        <div class="kshop-info">
          <div class="kshop-name">${it.name}</div>
          <div class="kshop-desc">${it.desc}</div>
          <div class="kshop-owned">Trong túi: ${owned.toLocaleString()}</div>
        </div>
        <div class="kshop-buy-col">
          <button class="kshop-price-btn" onclick="buyShopItem('${it.key}', 1)" title="Mua ×1">
            <img src="/static/assets/ui/coin.svg" alt="" />
            <span>${it.price.toLocaleString()}</span>
          </button>
          <div class="kshop-bulk-row">
            <button type="button" class="kshop-bulk-btn" onclick="buyShopItem('${it.key}', 10)" title="Mua ×10 (${(it.price * 10).toLocaleString()} Coins)">×10</button>
            <button type="button" class="kshop-bulk-btn" onclick="buyShopItem('${it.key}', 100)" title="Mua ×100 (${(it.price * 100).toLocaleString()} Coins)">×100</button>
          </div>
        </div>
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

async function buyShopItem(key, qty = 1) {
  try {
    const data = await api("/api/shop/buy", {
      method: "POST",
      body: JSON.stringify({ item_key: key, qty }),
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
  Common: "25 Coins",
  Uncommon: "55 Coins",
  Rare: "3 Vé Thường",
  Epic: "5 Vé Thường",
  Legendary: "1 Vé Tím",
  Mythic: "3 Vé Tím",
};

const TIER_BALL_ICON = {
  Mythic: "/static/assets/items/master-ball.png",
  Legendary: "/static/assets/items/master-ball.png",
  Epic: "/static/assets/items/ultra-ball.png",
  Rare: "/static/assets/items/great-ball.png",
  Uncommon: "/static/assets/items/safari-ball.png",
  Common: "/static/assets/items/poke-ball.png",
};

const GEN_REGIONS = [
  { gen: "all", label: "All" },
  { gen: "1", label: "Kanto" },
  { gen: "2", label: "Johto" },
  { gen: "3", label: "Hoenn" },
  { gen: "4", label: "Sinnoh" },
  { gen: "5", label: "Unova" },
  { gen: "6", label: "Kalos" },
  { gen: "7", label: "Alola" },
  { gen: "8", label: "Galar" },
  { gen: "9", label: "Paldea" },
];

const PP_TYPE_COLOR = {
  grass: "#4ade80", fire: "#fb923c", water: "#38bdf8", electric: "#facc15",
  ice: "#67e8f9", fighting: "#f87171", poison: "#c084fc", ground: "#fbbf24",
  flying: "#818cf8", psychic: "#f472b6", bug: "#a3e635", rock: "#a8a29e",
  ghost: "#a78bfa", dragon: "#6366f1", dark: "#94a3b8", steel: "#cbd5e1",
  fairy: "#f9a8d4", normal: "#e2e8f0",
};

let bagState = { gen: "all", status: "all", rarity: "all", sort: "tier", selectedId: null };
let dexState = { gen: "all", status: "all", rarity: "all", sort: "id", selectedId: null };

function calcPokeDps(p) {
  const atk = p?.stats?.atk || 10;
  const spd = p?.stats?.spd || 10;
  return Math.round(atk * (1 + spd / 100));
}

function setBagFilter(key, val) {
  bagState[key] = val;
  renderMyPokemon();
}

function selectBagPokemon(id) {
  bagState.selectedId = id;
  renderMyPokemon();
}

function pickRandomBagPokemon() {
  const items = window._lastBagList || [];
  if (!items.length) return;
  const pick = items[Math.floor(Math.random() * items.length)];
  bagState.selectedId = pick.id;
  renderMyPokemon();
  playCry(pick.species_id);
}

function setDexFilter(key, val) {
  dexState[key] = val;
  renderPokedex();
}

function selectDexPokemon(id) {
  dexState.selectedId = id;
  renderPokedex();
}

function pickRandomDexPokemon() {
  const items = window._lastDexList || [];
  if (!items.length) return;
  const pick = items[Math.floor(Math.random() * items.length)];
  dexState.selectedId = pick.id;
  renderPokedex();
  playCry(pick.id);
}

function _statBarRow(label, val, maxVal, color) {
  const pct = Math.max(6, Math.min(100, Math.round((val / maxVal) * 100)));
  return `
    <div class="pp-stat-row">
      <span style="color:${color};font-weight:700;">${label}</span>
      <div class="pp-stat-track"><div class="pp-stat-fill" style="width:${pct}%;background:${color};"></div></div>
      <span class="pp-stat-val">${val}</span>
    </div>`;
}

function renderMyPokemon() {
  if (!currentUser) return;
  const allPokes = currentUser.pokemon || [];
  const q = (document.getElementById("bag-search")?.value || "").trim().toLowerCase();
  const typeF = document.getElementById("bag-type-filter")?.value || "all";
  const tierRank = { Mythic: 0, Legendary: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5 };

  // Count per species for duplicate badge & Keep-1 salvage
  const speciesCounts = {};
  for (const p of allPokes) speciesCounts[p.species_id] = (speciesCounts[p.species_id] || 0) + 1;

  // Region Tabs with owned counts
  document.getElementById("bag-gen-tabs").innerHTML = GEN_REGIONS.map((g) => {
    const cnt = g.gen === "all" ? allPokes.length : allPokes.filter((p) => String(p.gen) === g.gen).length;
    return `<button type="button" class="pp-region-btn ${bagState.gen === g.gen ? "active" : ""}" onclick="setBagFilter('gen','${g.gen}')"><strong>${g.label}</strong><small>${cnt}</small></button>`;
  }).join("");

  // Chips rows
  const stOpts = [
    ["all", "All"],
    ["team", "Trong Đội"],
    ["shiny", "✨ Shiny"],
    ["dup", "♻️ Trùng"],
    ["dps30", "DPS ≥ 30"],
    ["dps80", "DPS ≥ 80"],
    ["dps150", "DPS ≥ 150"],
  ];
  document.getElementById("bag-status-chips").innerHTML = stOpts
    .map(([k, lbl]) => `<button type="button" class="pp-chip ${bagState.status === k ? "active" : ""}" onclick="setBagFilter('status','${k}')">${lbl}</button>`)
    .join("");

  const rarOpts = ["all", "Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common"];
  document.getElementById("bag-rarity-chips").innerHTML = rarOpts
    .map((r) => {
      const ico = r === "all" ? "" : `<img class="pp-tile-ball" src="${TIER_BALL_ICON[r]}" />`;
      return `<button type="button" class="pp-chip ${bagState.rarity === r ? "active" : ""}" onclick="setBagFilter('rarity','${r}')">${ico}${r === "all" ? "All Rarity" : r}</button>`;
    })
    .join("");

  const sortOpts = [
    ["tier", "Rarity"],
    ["dps_desc", "DPS Cao"],
    ["dps_asc", "DPS Thấp"],
    ["lvl_desc", "Level"],
    ["id", "No."],
    ["name", "Name"],
  ];
  document.getElementById("bag-sort-chips").innerHTML =
    `<span class="pp-sort-label">Sort:</span>` +
    sortOpts
      .map(([k, lbl]) => `<button type="button" class="pp-chip ${bagState.sort === k ? "active" : ""}" onclick="setBagFilter('sort','${k}')">${lbl}</button>`)
      .join("");

  const list = allPokes
    .filter((p) => {
      if (bagState.gen !== "all" && String(p.gen) !== bagState.gen) return false;
      if (bagState.rarity !== "all" && (p.tier || "Common") !== bagState.rarity) return false;
      if (typeF !== "all" && !(p.types || []).includes(typeF)) return false;
      if (bagState.status === "team" && !p.team_slot_3 && !p.team_slot_6) return false;
      if (bagState.status === "shiny" && !p.is_shiny) return false;
      if (bagState.status === "dup" && (speciesCounts[p.species_id] || 1) <= 1) return false;
      if (bagState.status === "dps30" && calcPokeDps(p) < 30) return false;
      if (bagState.status === "dps80" && calcPokeDps(p) < 80) return false;
      if (bagState.status === "dps150" && calcPokeDps(p) < 150) return false;
      if (q && !p.species_name.toLowerCase().includes(q) && String(p.species_id) !== q) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (bagState.sort === "dps_desc") return calcPokeDps(b) - calcPokeDps(a) || b.level - a.level;
      if (bagState.sort === "dps_asc") return calcPokeDps(a) - calcPokeDps(b) || a.level - b.level;
      if (bagState.sort === "lvl_desc") return b.level - a.level || calcPokeDps(b) - calcPokeDps(a);
      if (bagState.sort === "id") return a.species_id - b.species_id || b.level - a.level;
      if (bagState.sort === "name") return a.species_name.localeCompare(b.species_name);
      return (tierRank[a.tier] ?? 9) - (tierRank[b.tier] ?? 9) || calcPokeDps(b) - calcPokeDps(a);
    });

  window._lastBagList = list;
  document.getElementById("bag-count-label").textContent = `${list.length} Pokémon`;

  let sel = list.find((p) => p.id === bagState.selectedId) || list[0] || null;
  if (sel) bagState.selectedId = sel.id;

  document.getElementById("my-pokemon-grid").innerHTML = list.length
    ? list
        .map((p) => {
          const tier = p.tier || "Common";
          const dupCnt = speciesCounts[p.species_id] || 1;
          const isSel = sel && sel.id === p.id;
          return `
          <div class="pp-tile ${isSel ? "selected" : ""}" onclick="selectBagPokemon(${p.id})">
            <div class="pp-tile-head">
              <span>Lv.${p.level}</span>
              <span>${p.team_slot_3 || p.team_slot_6 ? "👑" : ""}${p.is_shiny ? "✨" : ""}${dupCnt > 1 ? `×${dupCnt}` : ""}</span>
            </div>
            <img class="pp-sprite poke-idle-anim" src="${spriteUrl(p.species_id, p.is_shiny)}" alt="${p.species_name}" />
            <div class="pp-tile-name">${p.nickname}</div>
            <div style="display:flex;align-items:center;gap:4px;">
              <img class="pp-tile-ball" src="${TIER_BALL_ICON[tier] || TIER_BALL_ICON.Common}" />
              <small style="color:#93c5fd;font-size:0.7rem;">⚡${calcPokeDps(p)}</small>
            </div>
          </div>`;
        })
        .join("")
    : `<div class="muted">Không có Pokémon nào khớp bộ lọc.</div>`;

  // Right Inspector Spotlight
  const insp = document.getElementById("bag-inspector");
  if (!sel) {
    insp.innerHTML = `<div class="empty-hint">Chọn một Pokémon bên trái để xem chỉ số & thao tác!</div>`;
    return;
  }
  const tier = sel.tier || "Common";
  const dps = calcPokeDps(sel);
  const dupCnt = speciesCounts[sel.species_id] || 1;
  const safeName = (sel.nickname || sel.species_name || "").replace(/'/g, "\\'");
  const tColor = PP_TYPE_COLOR[(sel.types || [])[0]] || "#4ade80";
  const regObj = GEN_REGIONS.find((g) => g.gen === String(sel.gen));
  insp.innerHTML = `
    <div class="pp-spotlight" style="border-color:${tColor};background:radial-gradient(circle at center, ${tColor}44 0%, #091029 76%);">
      <div class="pp-spot-icons">
        ${sel.is_shiny ? `<span class="pp-spot-pill" title="Shiny">✨</span>` : ""}
        ${sel.team_slot_3 || sel.team_slot_6 ? `<span class="pp-spot-pill" title="Đang trong Đội Hình">👑</span>` : ""}
        <button type="button" class="pp-spot-pill" onclick="playCry(${sel.species_id})" title="Nghe tiếng kêu">🔊</button>
      </div>
      ${pokeImgTag(sel.species_id, sel.is_shiny, "poke-idle-anim")}
    </div>
    <div class="pp-insp-head">
      <div class="pp-insp-sub">N° ${String(sel.species_id).padStart(3, "0")} · ${regObj ? regObj.label : `Gen ${sel.gen}`} · Lv.${sel.level}</div>
      <div class="pp-insp-name">${sel.is_shiny ? "✨ " : ""}${sel.nickname}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:6px;">
        <img class="pp-tile-ball" src="${TIER_BALL_ICON[tier] || TIER_BALL_ICON.Common}" />
        ${tierBadgeHtml(tier)}
      </div>
      <div class="type-row" style="justify-content:center;">${typeBadgesHtml(sel.types)}</div>
    </div>
    <div class="pp-stat-list">
      ${_statBarRow("HP", sel.stats.max_hp, 260, "#facc15")}
      ${_statBarRow("DPS", dps, 240, "#4ade80")}
      ${_statBarRow("Attack", sel.stats.atk, 160, "#fbbf24")}
      ${_statBarRow("Defense", sel.stats.def, 160, "#fb7185")}
      ${_statBarRow("Speed", sel.stats.spd, 160, "#4ade80")}
    </div>
    ${
      (sel.moves || []).length
        ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:10px;">
            ${sel.moves
              .map(
                (m) => `
                <div style="background:#19265c;border:1.5px solid #4159a3;border-radius:7px;padding:4px 7px;font-size:0.74rem;">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                    <strong>${m.name}</strong>
                    <span class="type-badge t-${m.type}" style="font-size:0.62rem;padding:1px 5px;">${m.type}</span>
                  </div>
                  <small class="muted">Pow ${m.power}${m.role ? ` · ${m.role}` : ""}</small>
                </div>`
              )
              .join("")}
          </div>`
        : ""
    }
    <div class="pp-insp-actions">
      <button class="btn-sm" onclick="quickAssign(${sel.id}, 3)">+Đội 3</button>
      <button class="btn-sm" onclick="quickAssign(${sel.id}, 6)">+Đội 6</button>
      <div style="grid-column:span 2;background:#19265c;border:1.5px solid #4861ad;border-radius:9px;padding:7px;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;margin-bottom:5px;">
          <span><img class="px-icon" src="/static/assets/items/rare-candy.png" /> Tăng cấp (Rare Candy)</span>
          <strong style="color:var(--gold);">Có: ${(currentUser.inventory && currentUser.inventory.rare_candy) || 0}</strong>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;">
          <button class="btn-sm btn-gold" style="padding:4px 2px;" onclick="feedCandy(${sel.id}, 1)">+1</button>
          <button class="btn-sm btn-gold" style="padding:4px 2px;" onclick="feedCandy(${sel.id}, 3)">+3</button>
          <button class="btn-sm btn-gold" style="padding:4px 2px;" onclick="feedCandy(${sel.id}, 5)">+5</button>
          <button class="btn-sm btn-gold" style="padding:4px 2px;" onclick="feedCandy(${sel.id}, 10)">+10</button>
          <button class="btn-sm btn-green" style="padding:4px 2px;" onclick="feedCandy(${sel.id}, 'max')">MAX</button>
        </div>
      </div>
      ${sel.can_evolve ? `<button class="btn-sm btn-green" style="grid-column:span 2;" onclick="evolvePoke(${sel.id})">🧬 Tiến hóa</button>` : `<button class="btn-sm" style="grid-column:span 2;" disabled>BST ${sel.bst}</button>`}
      ${
        sel.is_multitype
          ? `<div style="grid-column:span 2;background:linear-gradient(145deg,#211c52,#16204d);border:1.5px solid #c084fc;border-radius:9px;padding:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;margin-bottom:5px;">
                <span style="color:#e9d5ff;font-weight:700;">🔮 Phiến Đá Đa Hệ (Multitype)</span>
                <strong style="color:#facc15;">Có: ${(currentUser.inventory && currentUser.inventory.plate_stone) || 0}</strong>
              </div>
              <div style="display:flex;gap:5px;flex-wrap:wrap;">
                <select id="plate-type-select" class="pp-select" style="flex:1;padding:4px 8px;font-size:0.8rem;">
                  <option value="dark">Dread Plate (Bóng Tối)</option>
                  <option value="dragon">Draco Plate (Rồng)</option>
                  <option value="fairy">Pixie Plate (Tiên)</option>
                  <option value="fire">Flame Plate (Lửa)</option>
                  <option value="water">Splash Plate (Nước)</option>
                  <option value="grass">Meadow Plate (Cỏ)</option>
                  <option value="electric">Zap Plate (Điện)</option>
                  <option value="ice">Icicle Plate (Băng)</option>
                  <option value="fighting">Fist Plate (Giác Đấu)</option>
                  <option value="poison">Toxic Plate (Độc)</option>
                  <option value="ground">Earth Plate (Đất)</option>
                  <option value="flying">Sky Plate (Bay)</option>
                  <option value="psychic">Mind Plate (Tâm Linh)</option>
                  <option value="bug">Insect Plate (Bọ)</option>
                  <option value="rock">Stone Plate (Đá)</option>
                  <option value="ghost">Spooky Plate (Ma)</option>
                  <option value="steel">Iron Plate (Thép)</option>
                  <option value="normal">Tháo về Gốc (Normal - Miễn phí)</option>
                </select>
                <button class="btn-sm btn-primary" onclick="equipPlateStone(${sel.id})">🔮 Gắn Đá</button>
              </div>
              <small class="muted" style="font-size:0.7rem;">Hiện tại: ${sel.plate_name || "Gốc"} · Nhận đá qua Quest Khó Tuần</small>
            </div>`
          : ""
      }
      <button class="btn-sm btn-danger" style="grid-column:span 2;" onclick="salvagePokemon(${sel.id}, '${safeName}', '${tier}')"><img class="px-icon" src="/static/assets/ui/salvage.svg" /> Tách (+${SALVAGE_LABEL[tier] || "25 Coins"})</button>
      ${dupCnt > 1 ? `<button class="btn-sm btn-gold" style="grid-column:span 2;" onclick="salvageKeepOneSpecies(${sel.species_id}, '${safeName}', ${dupCnt - 1})">♻️ Tách hết ${dupCnt - 1} con trùng (giữ 1)</button>` : ""}
    </div>`;
}

async function salvageKeepOneSpecies(speciesId, name, extraCount) {
  const ok = await askConfirm(
    `Tách toàn bộ ${extraCount} bản sao trùng của ${name} và giữ lại ĐÚNG 1 con mạnh nhất?`,
    "♻️ Tách Hết Bản Sao (Giữ 1)",
    "♻️ Tách & Giữ 1"
  );
  if (!ok) return;
  try {
    const data = await api("/api/pokemon/salvage", {
      method: "POST",
      body: JSON.stringify({ species_id: speciesId, keep_team: true }),
    });
    currentUser = data.user;
    updateHUD();
    renderTeamAndBag();
    toast(data.message, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function salvagePokemon(pokeId, name, tier) {
  const rewardText = SALVAGE_LABEL[tier] || "Coins";
  const ok = await askConfirm(
    `Tách ${name} (${tier}) để nhận ${rewardText}? Pokémon bị tách sẽ biến mất vĩnh viễn!`,
    "✂️ Tách Pokémon",
    `✂️ Tách (+${rewardText})`
  );
  if (!ok) return;
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
  const label = tier === "duplicates" ? "toàn bộ bản sao trùng (mỗi loài giữ 1)" : `TẤT CẢ Pokémon bậc ${tier}`;
  const ok = await askConfirm(
    `Tách ${label} (tự giữ lại Pokémon trong đội hình 3v3/6v6 và Pokémon Shiny)?`,
    "✂️ Tách Hàng Loạt",
    "✂️ Xác Nhận Tách"
  );
  if (!ok) return;
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

async function feedCandy(pokeId, amount = 1) {
  try {
    const data = await api("/api/pokemon/candy", {
      method: "POST",
      body: JSON.stringify({ pokemon_id: pokeId, amount }),
    });
    currentUser = data.user;
    updateHUD();
    renderTeamAndBag();
    toast(data.message || `🍬 ${data.pokemon.nickname} đã tăng lên Lv.${data.pokemon.level}!`, "success");
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

async function equipPlateStone(pokeId) {
  const plateType = document.getElementById("plate-type-select")?.value || "dark";
  try {
    const data = await api("/api/pokemon/plate", {
      method: "POST",
      body: JSON.stringify({ pokemon_id: pokeId, plate_type: plateType }),
    });
    currentUser = data.user;
    updateHUD();
    renderTeamAndBag();
    window.PokeAudio.playCatchSuccess();
    toast(data.message, "success");
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
  if (!pokedexCache.length) return;
  const q = (document.getElementById("dex-search")?.value || "").trim().toLowerCase();
  const typeF = document.getElementById("dex-type-filter")?.value || "all";
  const caughtSet = new Set(currentUser?.pokedex?.caught_ids || []);
  const tierRank = { Mythic: 0, Legendary: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5 };

  document.getElementById("dex-gen-tabs").innerHTML = GEN_REGIONS.map((g) => {
    const grp = g.gen === "all" ? pokedexCache : pokedexCache.filter((s) => String(s.gen) === g.gen);
    const owned = grp.filter((s) => caughtSet.has(s.id)).length;
    return `<button type="button" class="pp-region-btn ${dexState.gen === g.gen ? "active" : ""}" onclick="setDexFilter('gen','${g.gen}')"><strong>${g.label}</strong><small>${owned}/${grp.length}</small></button>`;
  }).join("");

  const stOpts = [
    ["all", "All"],
    ["owned", "Owned"],
    ["missing", "Missing"],
    ["excl", "⭐ Độc Quyền"],
  ];
  document.getElementById("dex-status-chips").innerHTML = stOpts
    .map(([k, lbl]) => `<button type="button" class="pp-chip ${dexState.status === k ? "active" : ""}" onclick="setDexFilter('status','${k}')">${lbl}</button>`)
    .join("");

  const rarOpts = ["all", "Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common"];
  document.getElementById("dex-rarity-chips").innerHTML = rarOpts
    .map((r) => {
      const ico = r === "all" ? "" : `<img class="pp-tile-ball" src="${TIER_BALL_ICON[r]}" />`;
      return `<button type="button" class="pp-chip ${dexState.rarity === r ? "active" : ""}" onclick="setDexFilter('rarity','${r}')">${ico}${r === "all" ? "All Rarity" : r}</button>`;
    })
    .join("");

  const sortOpts = [
    ["id", "No."],
    ["name", "Name"],
    ["tier", "Rarity"],
    ["bst_desc", "BST"],
  ];
  document.getElementById("dex-sort-chips").innerHTML =
    `<span class="pp-sort-label">Sort:</span>` +
    sortOpts
      .map(([k, lbl]) => `<button type="button" class="pp-chip ${dexState.sort === k ? "active" : ""}" onclick="setDexFilter('sort','${k}')">${lbl}</button>`)
      .join("");

  const filtered = pokedexCache
    .filter((s) => {
      if (dexState.gen !== "all" && String(s.gen) !== dexState.gen) return false;
      if (dexState.rarity !== "all" && (s.tier || "Common") !== dexState.rarity) return false;
      if (dexState.status === "owned" && !caughtSet.has(s.id)) return false;
      if (dexState.status === "missing" && caughtSet.has(s.id)) return false;
      if (dexState.status === "excl" && !s.exclusive_country_name) return false;
      if (typeF !== "all" && !(s.types || []).includes(typeF)) return false;
      if (q && !s.name.toLowerCase().includes(q) && String(s.id) !== q) return false;
      return true;
    })
    .sort((a, b) => {
      if (dexState.sort === "name") return a.name.localeCompare(b.name);
      if (dexState.sort === "tier") return (tierRank[a.tier] ?? 9) - (tierRank[b.tier] ?? 9) || a.id - b.id;
      if (dexState.sort === "bst_desc") return (b.bst || 0) - (a.bst || 0);
      return a.id - b.id;
    });

  window._lastDexList = filtered;
  document.getElementById("dex-count-label").textContent = `${filtered.length} Pokémon`;

  const visible = filtered.slice(0, 120);
  const sel = filtered.find((s) => s.id === dexState.selectedId) || visible[0] || null;
  if (sel) dexState.selectedId = sel.id;

  document.getElementById("pokedex-grid").innerHTML = visible.length
    ? visible
        .map((s) => {
          const isOwned = caughtSet.has(s.id);
          const tier = s.tier || "Common";
          const isSel = sel && sel.id === s.id;
          return `
          <div class="pp-tile ${isSel ? "selected" : ""} ${isOwned ? "" : "silhouette"}" onclick="selectDexPokemon(${s.id})">
            <div class="pp-tile-head">
              <span>${s.id}</span>
              <span>${isOwned ? "👑" : ""}</span>
            </div>
            <img class="pp-sprite" src="${spriteUrl(s.id, false)}" alt="${s.name}" />
            <div class="pp-tile-name">${isOwned ? s.name : "???"}</div>
            <img class="pp-tile-ball" src="${TIER_BALL_ICON[tier] || TIER_BALL_ICON.Common}" />
          </div>`;
        })
        .join("")
    : `<div class="muted">Không có loài nào khớp bộ lọc.</div>`;

  const insp = document.getElementById("dex-inspector");
  if (!sel) {
    insp.innerHTML = `<div class="empty-hint">Chọn một loài để xem thông tin chi tiết!</div>`;
    return;
  }
  const isOwned = caughtSet.has(sel.id);
  const tier = sel.tier || "Common";
  const tColor = PP_TYPE_COLOR[(sel.types || [])[0]] || "#4ade80";
  const regObj = GEN_REGIONS.find((g) => g.gen === String(sel.gen));
  const estDps = Math.round((sel.atk || 50) * (1 + (sel.spd || 50) / 100));
  insp.innerHTML = `
    <div class="pp-spotlight ${isOwned ? "" : "silhouette"}" style="border-color:${tColor};background:radial-gradient(circle at center, ${tColor}44 0%, #091029 76%);">
      <div class="pp-spot-icons">
        <span class="pp-spot-pill" title="${isOwned ? "Đã sở hữu" : "Chưa bắt"}">${isOwned ? "👑" : "❓"}</span>
        <button type="button" class="pp-spot-pill" onclick="playCry(${sel.id})" title="Nghe tiếng kêu">🔊</button>
      </div>
      ${pokeImgTag(sel.id, false, isOwned ? "poke-idle-anim" : "")}
    </div>
    <div class="pp-insp-head">
      <div class="pp-insp-sub">N° ${sel.id} · ${regObj ? regObj.label : `Gen ${sel.gen}`}</div>
      <div class="pp-insp-name">${isOwned ? sel.name : `${sel.name} (Chưa bắt)`}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:6px;">
        <img class="pp-tile-ball" src="${TIER_BALL_ICON[tier] || TIER_BALL_ICON.Common}" />
        ${tierBadgeHtml(tier)}
      </div>
      <div class="type-row" style="justify-content:center;">${typeBadgesHtml(sel.types)}</div>
    </div>
    <div class="pp-stat-list">
      ${_statBarRow("HP", sel.hp || 50, 200, "#facc15")}
      ${_statBarRow("Attack", sel.atk || 50, 180, "#fbbf24")}
      ${_statBarRow("Defense", sel.def || 50, 180, "#fb7185")}
      ${_statBarRow("Speed", sel.spd || 50, 180, "#4ade80")}
      ${_statBarRow("Est DPS", estDps, 260, "#38bdf8")}
    </div>
    <div class="muted" style="text-align:center;font-size:0.82rem;margin-top:8px;">
      BST ${sel.bst || "?"} · Tỉ lệ bắt ${sel.capture_rate || "?"}
    </div>
    ${sel.exclusive_country_name ? `<div style="text-align:center;margin-top:8px;"><span class="excl-badge">📍 Độc quyền: ${sel.exclusive_country_name}</span></div>` : ""}
  `;
}

// ---------------- ONLINE PVP & TRADE ----------------
let onlineRoomsCache = [];
let onlineModeFilter = "all";

function setOnlineModeFilter(mode) {
  onlineModeFilter = mode;
  renderOnlineRoomsList();
}

function renderOnlineRoomsList() {
  const chipsEl = document.getElementById("online-mode-chips");
  if (chipsEl) {
    const modes = [
      ["all", "Tất cả"],
      ["pvp_3v3", "⚔️ PvP 3v3"],
      ["pvp_6v6", "🏆 PvP 6v6"],
      ["trade", "🤝 Trade"],
    ];
    chipsEl.innerHTML = modes
      .map(([k, lbl]) => `<button type="button" class="pp-chip ${onlineModeFilter === k ? "active" : ""}" onclick="setOnlineModeFilter('${k}')">${lbl}</button>`)
      .join("");
  }

  const q = (document.getElementById("online-room-search")?.value || "").trim().toLowerCase();
  const filtered = (onlineRoomsCache || []).filter((r) => {
    if (onlineModeFilter !== "all" && r.mode !== onlineModeFilter) return false;
    if (
      q &&
      !r.title.toLowerCase().includes(q) &&
      !r.code.toLowerCase().includes(q) &&
      !r.host_username.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const listEl = document.getElementById("online-rooms-list");
  if (!listEl) return;
  listEl.innerHTML = filtered.length
    ? filtered
        .map((r) => {
          const isFull = r.occupied_slots >= r.max_slots;
          const canWatch = r.mode !== "trade" && r.fighter_count >= 2 && !isFull;
          const btnText = isFull ? "Đã đầy" : canWatch ? "👁️ Xem Trận" : "⚔️ Vào phòng";
          const btnCls = isFull ? "btn-sm" : canWatch ? "btn-gold btn-sm" : "btn-primary btn-sm";
          const specText =
            r.spectators_open > 0 ? ` · Khán giả: ${r.spectator_count}/${r.spectators_open}` : "";
          return `
          <div class="room-item">
            <div>
              <strong>${escapeHtml(r.title)}</strong> <span class="badge">${r.mode}</span><br/>
              <small class="muted">Mã: <strong>${r.code}</strong> · Host: ${escapeHtml(r.host_username)} · Đấu: ${Math.min(2, r.occupied_slots)}/2${specText}</small>
            </div>
            <button class="${btnCls}" ${isFull ? "disabled" : `onclick="joinOnlineRoom(${r.id})"`}>${btnText}</button>
          </div>`;
        })
        .join("")
    : `<div class="muted">Không có phòng nào phù hợp. Hãy tạo phòng mới!</div>`;
}

async function refreshOnlineRooms() {
  try {
    const data = await api("/api/online/rooms");
    onlineRoomsCache = data.rooms || [];
    renderOnlineRoomsList();
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
    if (!currentOnlineRoom || document.hidden) return;
    try {
      const data = await api(`/api/online/rooms/${currentOnlineRoom.id}`);
      currentOnlineRoom = data.room;
      renderOnlineRoomStage();
    } catch (_) {}
  }, 2500);
}

let lastPvpSpriteKey = "";
let lastPvpTurnVfx = 0;

function renderOnlineRoomStage() {
  const r = currentOnlineRoom;
  if (!r) return;
  const stage = document.getElementById("online-room-stage");

  const fighters = r.players.filter((p) => p.slot_index <= 2);
  const spectators = r.players.filter((p) => p.slot_index > 2);
  const mySlot = r.players.find((p) => p.user_id === currentUser.id);
  const isSpectator = mySlot && mySlot.slot_index > 2;

  const specBadge =
    r.spectators_open > 0
      ? `<span class="badge" style="background:#0e7490;">👁️ Khán giả: ${spectators.length}/${r.spectators_open}</span>`
      : `<span class="badge" style="background:#334155;">🔒 Không mở xem</span>`;

  let bodyHtml = `
    <div class="panel-header-row" style="margin-bottom:10px;">
      <div>
        <h3 style="margin:0;">${escapeHtml(r.title)} <span class="badge">${r.mode}</span> ${specBadge}</h3>
        <small class="muted">Mã phòng: <strong>${r.code}</strong> · Chủ phòng: ${escapeHtml(r.host_username)}</small>
      </div>
      <button class="btn-danger btn-sm" onclick="leaveOnlineRoom()">Rời phòng</button>
    </div>
  `;

  if (spectators.length > 0 || r.spectators_open > 0) {
    bodyHtml += `
      <div class="pvp-spectator-strip">
        <small class="muted">👁️ Slot xem (${spectators.length}/${r.spectators_open}):</small>
        ${
          spectators.length
            ? spectators.map((s) => `<span class="hud-pill" style="padding:2px 8px;font-size:0.78rem;">👁️ ${escapeHtml(s.username)}</span>`).join("")
            : `<small class="muted">Chưa có khán giả — bạn bè có thể vào bằng mã phòng để xem!</small>`
        }
      </div>`;
  }

  if (r.mode === "trade") {
    lastPvpSpriteKey = "";
    const p1 = fighters[0];
    const p2 = fighters[1];
    const pokeOpts = currentUser.pokemon
      .map((p) => `<option value="${p.id}">${p.species_name} (Lv.${p.level})</option>`)
      .join("");
    bodyHtml += `
      <div class="trade-grid">
        ${[p1, p2]
          .map((p, idx) =>
            p
              ? `<div class="trade-box">
                  <strong>${escapeHtml(p.username)}</strong>
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
        <select id="trade-select-poke" class="pp-select">${pokeOpts}</select>
        <button class="btn-primary" onclick="sendTradeOffer()">Đặt Lên Bàn Trade</button>
        <button class="btn-green" onclick="confirmOnlineTrade()">🤝 Chốt Giao Dịch</button>
      </div>
      ${r.state.last_trade ? `<p style="color:var(--green);margin-top:10px;">${r.state.last_trade}</p>` : ""}
    `;
    stage.innerHTML = bodyHtml;
    return;
  }

  if (r.status === "waiting") {
    lastPvpSpriteKey = "";
    lastPvpTurnVfx = 0;
    const p1 = fighters[0];
    const p2 = fighters[1];
    bodyHtml += `
      <div class="pvp-waiting-cards">
        ${[p1, p2]
          .map((p, i) =>
            p
              ? `<div class="pvp-fighter-slot ${p.ready ? "ready" : ""}">
                  <small class="muted">Đấu thủ ${i + 1}</small><br/>
                  <strong style="font-size:1.05rem;">${escapeHtml(p.username)}</strong> <small class="badge">Lv.${p.level}</small>
                  <div style="margin-top:6px;">${p.ready ? "✅ Đã Sẵn Sàng!" : "⏳ Đang chuẩn bị..."}</div>
                </div>`
              : `<div class="pvp-fighter-slot"><small class="muted">Đấu thủ ${i + 1}</small><p class="muted">Đang chờ đối thủ vào phòng...</p></div>`
          )
          .join("")}
      </div>
      ${
        isSpectator
          ? `<div class="pvp-spectator-banner"><span>👁️ Bạn đang ở ghế Khán giả! Trận đấu sẽ tự động phát trực tiếp ngay khi 2 Đấu thủ Sẵn sàng.</span></div>`
          : `<button class="btn-green full-w" onclick="togglePvpReady()">✅ ${mySlot?.ready ? "Hủy Sẵn Sàng" : `Sẵn Sàng PvP (${r.mode === "pvp_6v6" ? "6v6" : "3v3"})`}</button>`
      }
    `;
    stage.innerHTML = bodyHtml;
    return;
  }

  // LIVE PVP BATTLE ARENA (IDENTICAL VISUAL EXPERIENCE TO NPC BATTLE!)
  const st = r.state;
  const p1Id = String(st.p1_user_id);
  const p2Id = String(st.p2_user_id);
  const myIdStr = String(currentUser.id);
  const iAmFighter = myIdStr === p1Id || myIdStr === p2Id;

  const leftId = iAmFighter ? myIdStr : p1Id;
  const rightId = leftId === p1Id ? p2Id : p1Id;
  const leftPlayer = r.players.find((p) => String(p.user_id) === leftId) || { username: "Trainer 1" };
  const rightPlayer = r.players.find((p) => String(p.user_id) === rightId) || { username: "Trainer 2" };

  const leftTeam = st.teams[leftId] || [];
  const rightTeam = st.teams[rightId] || [];
  const leftIdx = st.active[leftId] || 0;
  const rightIdx = st.active[rightId] || 0;
  const leftMon = leftTeam[leftIdx];
  const rightMon = rightTeam[rightIdx];

  const lPct = leftMon ? Math.max(0, Math.round((leftMon.hp / leftMon.max_hp) * 100)) : 0;
  const rPct = rightMon ? Math.max(0, Math.round((rightMon.hp / rightMon.max_hp) * 100)) : 0;
  const lHpColor = lPct > 50 ? "#22c55e" : lPct > 20 ? "#f59e0b" : "#ef4444";
  const rHpColor = rPct > 50 ? "#22c55e" : rPct > 20 ? "#f59e0b" : "#ef4444";
  const myActSubmitted = Boolean(st.pending_actions && st.pending_actions[myIdStr]);

  if (isSpectator || !iAmFighter) {
    bodyHtml += `
      <div class="pvp-spectator-banner">
        <span>👁️ CHẾ ĐỘ KHÁN GIẢ — Trực tiếp: ${escapeHtml(leftPlayer.username)} vs ${escapeHtml(rightPlayer.username)}</span>
        <span class="badge">Lượt ${st.turn || 1}</span>
      </div>`;
  }

  const arenaKey = `${r.id}:${leftMon?.species_id}:${leftMon?.is_shiny}:${rightMon?.species_id}:${rightMon?.is_shiny}:${iAmFighter}`;

  bodyHtml += `
    <div class="battle-stage" id="pvp-battle-stage">
      <div class="sprite-wrap enemy-platform-wrap">
        <div class="turf-shadow"></div>
        <img id="pvp-right-sprite" class="poke-idle-anim" src="" alt="${rightMon?.name || "Foe"}" onclick="playCry(${rightMon?.species_id || 25})" />
      </div>
      <div class="sprite-wrap player-platform-wrap">
        <div class="turf-shadow"></div>
        <img id="pvp-left-sprite" class="poke-idle-anim" src="" alt="${leftMon?.name || "Ally"}" onclick="playCry(${leftMon?.species_id || 25})" />
      </div>
    </div>

    <div class="nintendo-hud-dock">
      <div class="nintendo-plate player-plate">
        <div class="plate-head">
          <div class="plate-title">
            <span class="side-tag player-tag">${iAmFighter ? "BẠN" : escapeHtml(leftPlayer.username)}</span>
            <strong>${leftMon?.is_shiny ? "✨ " : ""}${leftMon?.name || "?"}</strong>
            ${tierBadgeHtml(leftMon?.tier)}
          </div>
          <span class="lv-pill">Lv.${leftMon?.level || 1}</span>
        </div>
        <div class="plate-sub">
          <div class="type-row">${typeBadgesHtml(leftMon?.types || ["normal"])}</div>
          <div class="party-pips">${leftTeam.map((x) => `<span class="pip ${x.hp <= 0 ? "fainted" : ""}"></span>`).join("")}</div>
        </div>
        <div class="nintendo-hp-row">
          <span class="hp-badge">HP</span>
          <div class="hp-track"><div class="hp-fill" style="width:${lPct}%;background:${lHpColor};"></div></div>
          <span class="hp-num">${leftMon?.hp || 0}/${leftMon?.max_hp || 0} HP</span>
        </div>
      </div>

      <div class="nintendo-plate enemy-plate">
        <div class="plate-head">
          <div class="plate-title">
            <span class="side-tag enemy-tag">${escapeHtml(rightPlayer.username)}</span>
            <strong>${rightMon?.is_shiny ? "✨ " : ""}${rightMon?.name || "?"}</strong>
            ${tierBadgeHtml(rightMon?.tier)}
          </div>
          <span class="lv-pill">Lv.${rightMon?.level || 1}</span>
        </div>
        <div class="plate-sub">
          <div class="type-row">${typeBadgesHtml(rightMon?.types || ["normal"])}</div>
          <div class="party-pips">${rightTeam.map((x) => `<span class="pip ${x.hp <= 0 ? "fainted" : ""}"></span>`).join("")}</div>
        </div>
        <div class="nintendo-hp-row">
          <span class="hp-badge">HP</span>
          <div class="hp-track"><div class="hp-fill" style="width:${rPct}%;background:${rHpColor};"></div></div>
          <span class="hp-num">${rightMon?.hp || 0}/${rightMon?.max_hp || 0} HP</span>
        </div>
      </div>
    </div>

    <div class="battle-controls-grid" style="margin-top:12px;">
      <div class="battle-actions-panel">
        ${
          st.status === "ongoing" && iAmFighter && leftMon
            ? `
            <h4>Chiêu thức (Lượt ${st.turn}) ${myActSubmitted ? `<span class="badge" style="background:#0284c7;">⏳ Đã chọn — Đang chờ ${escapeHtml(rightPlayer.username)}...</span>` : ""}</h4>
            <div class="moves-grid">
              ${leftMon.moves
                .map((m, idx) => {
                  const pv = movePreviewMeta(leftMon, rightMon, m);
                  return `
                  <button class="move-btn" ${myActSubmitted ? "disabled" : `onclick="submitPvpAction('move', ${idx})"`}>
                    <div>
                      <strong>${m.name}</strong> ${m.role === "Signature" ? `<span class="excl-badge">★</span>` : ""}<br />
                      <small class="muted">Pow ${m.power} · ~${pv.est} DMG · ${pv.badge}</small>
                    </div>
                    <span class="type-badge t-${m.type}">${m.type}</span>
                  </button>`;
                })
                .join("")}
            </div>
            <h4 style="margin-top:10px;">Đổi Pokémon (${leftTeam.length} con)</h4>
            <div class="switch-bar">
              ${leftTeam
                .map(
                  (m, idx) => `
                  <button class="switch-chip ${idx === leftIdx ? "active" : ""} ${m.hp <= 0 ? "fainted" : ""}"
                    ${!myActSubmitted && idx !== leftIdx && m.hp > 0 ? `onclick="submitPvpAction('switch', ${idx})"` : "disabled"}>
                    <img src="${spriteUrl(m.species_id, m.is_shiny)}" />
                    <span>${m.name} (${m.hp}/${m.max_hp})</span>
                  </button>`
                )
                .join("")}
            </div>`
            : st.status === "ongoing"
            ? `<h4>👀 Đang theo dõi trận đấu — Lượt ${st.turn}</h4>
               <p class="muted">Hai đấu thủ đang chọn chiêu thức. Mọi diễn biến sát thương cập nhật trực tiếp theo thời gian thực!</p>`
            : `<div style="padding:12px;background:#1c2c6b;border:2px solid var(--gold);border-radius:10px;text-align:center;">
                 <h3 style="margin:0 0 6px;color:var(--gold);">🏆 ${
                   st.winner_user_id === currentUser.id
                     ? "BẠN ĐÃ CHIẾN THẮNG PVP! (+350 Coins · +60 XP)"
                     : `${escapeHtml((r.players.find((p) => p.user_id === st.winner_user_id) || {}).username || "Đấu thủ")} ĐÃ CHIẾN THẮNG!`
                 }</h3>
                 <button class="btn-primary btn-sm" onclick="leaveOnlineRoom()">Rời phòng</button>
               </div>`
        }
      </div>
      <div class="battle-log-panel">
        <h4>Nhật ký PvP</h4>
        <div class="battle-log" style="max-height:220px;">${(st.log || [])
          .slice()
          .reverse()
          .map((l) => `<div>${escapeHtml(l)}</div>`)
          .join("")}</div>
      </div>
    </div>
  `;

  stage.innerHTML = bodyHtml;
  const lImg = document.getElementById("pvp-left-sprite");
  const rImg = document.getElementById("pvp-right-sprite");
  if (lImg && leftMon) bindAnimatedSprite(lImg, leftMon.species_id, leftMon.is_shiny, true);
  if (rImg && rightMon) bindAnimatedSprite(rImg, rightMon.species_id, rightMon.is_shiny, false);

  if (lastPvpTurnVfx && st.turn > lastPvpTurnVfx && (st.last_events || []).length) {
    const arenaEl = document.getElementById("pvp-battle-stage");
    if (arenaEl) {
      arenaEl.classList.remove("stage-quake");
      void arenaEl.offsetWidth;
      arenaEl.classList.add("stage-quake");
    }
    const lastEv = st.last_events[st.last_events.length - 1];
    window.PokeAudio.playAttack(lastEv.move_type || "normal");
  }
  lastPvpTurnVfx = st.turn || 1;
  lastPvpSpriteKey = arenaKey;
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
              <button class="btn-sm btn-danger" onclick="removeFriend(${f.user_id || f.id}, '${safeUser}')">Xóa</button>
            </div>
          </div>`;
          })
          .join("")
      : `<div class="muted">Bạn chưa có bạn bè nào. Hãy nhập tên Trainer ở trên để kết bạn!</div>`;
  }
}

let friendSearchTimer = null;

function onFriendSearchInput() {
  const input = document.getElementById("friend-username-input");
  const box = document.getElementById("friend-search-results");
  const q = (input?.value || "").trim();
  if (!box) return;
  if (!q) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  clearTimeout(friendSearchTimer);
  friendSearchTimer = setTimeout(async () => {
    try {
      const data = await api(`/api/friends/search?q=${encodeURIComponent(q)}`);
      renderFriendSearchResults(data.users || [], q);
    } catch (_) {}
  }, 140);
}

function renderFriendSearchResults(users, query) {
  const box = document.getElementById("friend-search-results");
  if (!box) return;
  if (!query) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  if (!users.length) {
    box.innerHTML = `<div class="muted" style="padding:4px 6px;">Không tìm thấy Trainer "${escapeHtml(query)}"</div>`;
    return;
  }
  box.innerHTML = users
    .map((u) => {
      const safeU = (u.username || "").replace(/'/g, "\\'");
      let actionHtml = `<button type="button" class="btn-sm btn-gold" onclick="quickAddFriend('${safeU}')">+ Kết Bạn</button>`;
      if (u.relation === "friend") {
        actionHtml = `<button type="button" class="btn-sm btn-primary" onclick="inviteFriendRoom('${safeU}', 'pvp_3v3')">⚔️ Mời PvP</button>`;
      } else if (u.relation === "outgoing") {
        actionHtml = `<button type="button" class="btn-sm" disabled>⏳ Đã gửi</button>`;
      } else if (u.relation === "incoming") {
        actionHtml = `<button type="button" class="btn-sm btn-green" onclick="respondFriend(${u.request_id}, 'accept')">✓ Chấp Nhận</button>`;
      }
      return `
        <div class="friend-search-item ${u.exact ? "exact" : ""}">
          <div class="friend-meta">
            <span class="online-dot ${u.online ? "online" : "offline"}"></span>
            <div>
              <strong>${escapeHtml(u.username)}</strong> <small class="badge">Lv.${u.level}</small>
              ${u.exact ? `<span class="excl-badge">Khớp chính xác</span>` : ""}<br/>
              <small class="muted">${u.online ? "🟢 Online" : "⚪ Offline"} · ${u.countries} vùng · ${u.pokedex} loài</small>
            </div>
          </div>
          ${actionHtml}
        </div>`;
    })
    .join("");
}

async function quickAddFriend(username) {
  try {
    const data = await api("/api/friends/request", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    renderFriends(data.overview);
    toast(data.message, "success");
    onFriendSearchInput();
  } catch (err) {
    toast(err.message, "error");
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
    const box = document.getElementById("friend-search-results");
    if (box) { box.classList.add("hidden"); box.innerHTML = ""; }
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
  if (!(await askConfirm(`Hủy kết bạn với ${username}?`, "👋 Hủy Kết Bạn", "Hủy Kết Bạn"))) return;
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
    const data = await api("/api/friends/invite", {
      method: "POST",
      body: JSON.stringify({ username: friendName, mode }),
    });
    currentOnlineRoom = data.room;
    switchTab("online");
    startOnlinePolling();
    renderOnlineRoomStage();
    refreshOnlineRooms();
    toast(`⚔️ Đã gửi Pop-up Thách Đấu Solo tới ${friendName}! Đang chờ phản hồi...`, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

let activeSoloInvite = null;
let soloInvitePollTimer = null;
let soloCountdownTimer = null;

function startSoloInvitePolling() {
  clearInterval(soloInvitePollTimer);
  soloInvitePollTimer = setInterval(async () => {
    if (!currentUser || document.hidden) return;
    try {
      const data = await api("/api/friends/invites/poll");
      if (data.declined_invite) {
        toast(`${data.declined_invite.receiver_username} đã từ chối lời mời Solo.`, "error");
      }
      const inc = data.incoming_invite;
      if (inc && (!activeSoloInvite || activeSoloInvite.invite_id !== inc.invite_id)) {
        showSoloInviteModal(inc);
      } else if (!inc && activeSoloInvite) {
        hideSoloInviteModal();
      }
    } catch (_) {}
  }, 5000);
}

function showSoloInviteModal(inv) {
  activeSoloInvite = inv;
  const modal = document.getElementById("solo-invite-modal");
  if (!modal) return;
  document.getElementById("solo-sender-name").textContent = inv.sender_username;
  document.getElementById("solo-sender-lvl").textContent = `Lv.${inv.sender_level}`;
  document.getElementById("solo-receiver-name").textContent = inv.receiver_username;
  document.getElementById("solo-receiver-lvl").textContent = `Lv.${inv.receiver_level}`;
  document.getElementById("solo-mode-tag").textContent =
    inv.mode === "trade" ? "🤝 Giao Dịch Trade" : inv.mode === "pvp_6v6" ? "🏆 Đấu Trường Solo 6v6" : "⚔️ Đấu Trường Solo 3v3";
  modal.classList.remove("hidden");
  window.PokeAudio.playPackOpen();

  let left = inv.seconds_left || 30;
  const maxS = Math.max(left, 35);
  clearInterval(soloCountdownTimer);
  const updateBar = () => {
    const fill = document.getElementById("solo-timer-fill");
    const txt = document.getElementById("solo-timer-text");
    if (fill) fill.style.width = `${Math.max(0, Math.round((left / maxS) * 100))}%`;
    if (txt) txt.textContent = `Còn ${left}s để trả lời...`;
  };
  updateBar();
  soloCountdownTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      hideSoloInviteModal();
      return;
    }
    updateBar();
  }, 1000);
}

function hideSoloInviteModal() {
  activeSoloInvite = null;
  clearInterval(soloCountdownTimer);
  const modal = document.getElementById("solo-invite-modal");
  if (modal) modal.classList.add("hidden");
}

async function respondSoloInvite(action) {
  if (!activeSoloInvite) return;
  const invId = activeSoloInvite.invite_id;
  hideSoloInviteModal();
  try {
    const data = await api("/api/friends/invite/respond", {
      method: "POST",
      body: JSON.stringify({ invite_id: invId, action }),
    });
    if (action === "accept" && data.room) {
      currentOnlineRoom = data.room;
      switchTab("online");
      startOnlinePolling();
      renderOnlineRoomStage();
      refreshOnlineRooms();
      toast("⚔️ Đã vào phòng Solo! Nhấn Sẵn Sàng để bắt đầu ngay!", "success");
    } else {
      toast("Đã từ chối lời mời Solo.", "info");
    }
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------------- DEV FEEDBACK FORUM ----------------
let forumCategoryFilter = "all";
const FORUM_CAT_LABELS = {
  suggestion: "💡 Góp Ý",
  bug: "🐛 Báo Lỗi",
  balance: "⚖️ Cân Bằng",
  chat: "💬 Thảo Luận",
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setForumCategory(cat) {
  forumCategoryFilter = cat;
  loadForumPosts();
}

async function loadForumPosts() {
  const chipsEl = document.getElementById("forum-filter-chips");
  if (chipsEl) {
    const cats = [
      ["all", "Tất cả"],
      ["suggestion", "💡 Góp Ý"],
      ["bug", "🐛 Báo Lỗi"],
      ["balance", "⚖️ Cân Bằng"],
      ["chat", "💬 Thảo Luận"],
    ];
    chipsEl.innerHTML = cats
      .map(([k, lbl]) => `<button type="button" class="pp-chip ${forumCategoryFilter === k ? "active" : ""}" onclick="setForumCategory('${k}')">${lbl}</button>`)
      .join("");
  }
  try {
    const data = await api(`/api/forum/posts?category=${encodeURIComponent(forumCategoryFilter)}`);
    renderForumPosts(data.posts || []);
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderForumPosts(posts) {
  const el = document.getElementById("forum-posts-list");
  if (!el) return;
  if (!posts.length) {
    el.innerHTML = `<div class="forum-post-card"><div class="muted">Chưa có bài viết nào trong mục này. Hãy là người đầu tiên góp ý cho Dev!</div></div>`;
    return;
  }
  el.innerHTML = posts
    .map((p) => {
      const dt = new Date((p.created_at || 0) * 1000).toLocaleString("vi-VN");
      const catLabel = FORUM_CAT_LABELS[p.category] || p.category;
      const repHtml = (p.replies || [])
        .map(
          (r) => `
          <div class="forum-reply-item">
            <strong>${escapeHtml(r.username)}</strong> <small class="muted">Lv.${r.level}</small>: ${escapeHtml(r.content)}
          </div>`
        )
        .join("");
      return `
      <div class="forum-post-card">
        <div class="forum-post-head">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="forum-cat-badge">${catLabel}</span>
            <strong>${escapeHtml(p.username)}</strong>
            <small class="badge">Lv.${p.level}</small>
          </div>
          <small class="muted">${dt}</small>
        </div>
        <div class="forum-post-title">${escapeHtml(p.title)}</div>
        <div class="forum-post-body">${escapeHtml(p.content)}</div>
        <div class="forum-post-actions">
          <button type="button" class="btn-sm forum-like-btn ${p.liked_by_me ? "liked" : ""}" onclick="toggleForumLike(${p.id})">👍 Ủng hộ (${p.likes_count})</button>
          <span class="muted">💬 ${(p.replies || []).length} bình luận</span>
          ${p.is_mine ? `<button type="button" class="btn-sm btn-danger" onclick="deleteForumPost(${p.id})">🗑️ Xóa</button>` : ""}
        </div>
        <div class="forum-replies">
          ${repHtml}
          <form class="forum-reply-form" onsubmit="submitForumReply(event, ${p.id})">
            <input id="reply-input-${p.id}" type="text" maxlength="800" placeholder="Viết bình luận..." required />
            <button type="submit" class="btn-sm btn-primary">Gửi</button>
          </form>
        </div>
      </div>`;
    })
    .join("");
}

async function submitForumPost(e) {
  e.preventDefault();
  const category = document.getElementById("forum-cat-input").value;
  const titleEl = document.getElementById("forum-title-input");
  const contentEl = document.getElementById("forum-content-input");
  try {
    const data = await api("/api/forum/posts", {
      method: "POST",
      body: JSON.stringify({ category, title: titleEl.value, content: contentEl.value }),
    });
    titleEl.value = "";
    contentEl.value = "";
    renderForumPosts(data.posts || []);
    toast(data.message, "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function toggleForumLike(postId) {
  try {
    const data = await api(`/api/forum/posts/${postId}/like`, { method: "POST" });
    const filtered = forumCategoryFilter === "all" ? data.posts : (data.posts || []).filter((p) => p.category === forumCategoryFilter);
    renderForumPosts(filtered);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function submitForumReply(e, postId) {
  e.preventDefault();
  const inp = document.getElementById(`reply-input-${postId}`);
  const content = (inp?.value || "").trim();
  if (!content) return;
  try {
    const data = await api(`/api/forum/posts/${postId}/reply`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    if (inp) inp.value = "";
    const filtered = forumCategoryFilter === "all" ? data.posts : (data.posts || []).filter((p) => p.category === forumCategoryFilter);
    renderForumPosts(filtered);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function deleteForumPost(postId) {
  if (!(await askConfirm("Xóa bài viết góp ý này?", "🗑️ Xóa Bài Viết", "🗑️ Xóa"))) return;
  try {
    const data = await api(`/api/forum/posts/${postId}`, { method: "DELETE" });
    const filtered = forumCategoryFilter === "all" ? data.posts : (data.posts || []).filter((p) => p.category === forumCategoryFilter);
    renderForumPosts(filtered);
    toast(data.message, "info");
  } catch (err) {
    toast(err.message, "error");
  }
}

bootstrap();
