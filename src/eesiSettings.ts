import {
  $,
  DAILY_VERSES,
  PUSH_READY,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  VAPID_PUBLIC_KEY,
  compressImageToDataUrl,
  esc,
  hooks,
  isImageFile,
  runtime,
  state,
  toast,
} from "./eesiTypes";
import { registerSW } from "virtual:pwa-register";

/* ==================== DECORATIONS & PHILIPPINE HOLIDAYS ==================== */
const DECOR: Record<string, { label: string; icons: string[]; from: string; to: string; logo: string }> = {
  christmas: { label: "Merry Christmas", icons: ["🎄", "⭐", "🎁", "❄️", "🔔", "🎅"], from: "#0d3b2e", to: "#7a1020", logo: "🎄" },
  holyweek: { label: "Holy Week", icons: ["✝️", "🕊️", "🌿", "🕯️", "🌹", "🙏"], from: "#2b1846", to: "#5b2d6e", logo: "✝️" },
  newyear: { label: "Happy New Year", icons: ["🎆", "🎇", "🥳", "✨", "🎉", "🎊"], from: "#0b1b38", to: "#7a4a00", logo: "🎆" },
  valentine: { label: "Happy Valentine's", icons: ["❤️", "💖", "🌹", "💘", "💌", "💕"], from: "#4a0f24", to: "#8a1d45", logo: "💖" },
  allsaints: { label: "All Saints' Day", icons: ["🕯️", "🌼", "🌾", "🕊️", "🙏", "🍂"], from: "#2a2014", to: "#5a4420", logo: "🕯️" },
  session: { label: "Session", icons: ["📚", "🧠", "🎓", "💡", "✏️", "📝"], from: "#0b2a4a", to: "#1e6cf2", logo: "🎓" },
  event: { label: "Event", icons: ["🎉", "🎤", "🎶", "🎟️", "🎈", "📣"], from: "#1d1640", to: "#2f8cff", logo: "🎉" },
  default: { label: "EESI Elevators", icons: ["🛗", "⚡", "🔧", "✨"], from: "#0a1a36", to: "#1e4f9c", logo: "✨" },
};

const DAILY_DECOR = [
  { label: "Sunday Blessings", icons: ["🙏", "✨", "🕊️", "💛", "🌟", "☀️"], from: "#1a284d", to: "#3b5998", logo: "🙏" },
  { label: "Monday Safety Focus", icons: ["🦺", "⚡", "🛗", "✨", "🔧", "💪"], from: "#0a1a36", to: "#1e4f9c", logo: "🦺" },
  { label: "Tuesday Good Vibes", icons: ["🌟", "⚡", "🙌", "🔧", "✨", "🚀"], from: "#0c2444", to: "#1e6cf2", logo: "⚡" },
  { label: "Wednesday Precision", icons: ["⚙️", "🔧", "📐", "✨", "🛠️", "💡"], from: "#0b2a4a", to: "#2563eb", logo: "⚙️" },
  { label: "Thursday Protection", icons: ["🛡️", "🪢", "🚧", "✨", "🦺", "⚡"], from: "#0f2942", to: "#1d4ed8", logo: "🛡️" },
  { label: "Friday Excellence", icons: ["🏆", "✨", "🌟", "🎉", "💼", "🙌"], from: "#12234a", to: "#2f8cff", logo: "🏆" },
  { label: "Saturday Craftsmanship", icons: ["🧰", "🔧", "✨", "🛗", "💪", "🌟"], from: "#0a203e", to: "#1e5bb8", logo: "🧰" },
];

export function easterSunday(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, nth: number): Date {
  const first = new Date(year, monthIndex, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, monthIndex, 1 + offset + (nth - 1) * 7);
}

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number): Date {
  const last = new Date(year, monthIndex + 1, 0);
  const back = (last.getDay() - weekday + 7) % 7;
  return new Date(year, monthIndex + 1, 0 - back);
}

export interface PhHolidayItem {
  date: string;
  name: string;
  kind: string;
  category: "National" | "Christian" | "Regional";
  region?: string;
}

export function phHolidays(year: number): PhHolidayItem[] {
  const iso = (d: Date) =>
    d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const shiftDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

  const easter = easterSunday(year);
  const ashWed = shiftDays(easter, -46);
  const palmSun = shiftDays(easter, -7);
  const holyWed = shiftDays(easter, -4);
  const maundy = shiftDays(easter, -3);
  const goodFri = shiftDays(easter, -2);
  const blackSat = shiftDays(easter, -1);
  const ascension = shiftDays(easter, 39);
  const pentecost = shiftDays(easter, 49);
  const heroesDay = lastWeekdayOfMonth(year, 7, 1); // Last Monday of August

  // Feast of Christ the King: Sunday before 1st Sunday of Advent (last Sunday between Nov 20 and Nov 26)
  const nov26 = new Date(year, 10, 26);
  const christKing = new Date(year, 10, 26 - nov26.getDay());

  // Major Philippine Regional Festivities & Charter Holidays
  const sinulogSun = nthWeekdayOfMonth(year, 0, 0, 3); // 3rd Sunday of January
  const dinagyangSun = nthWeekdayOfMonth(year, 0, 0, 4); // 4th Sunday of January
  const panagbengaSun = lastWeekdayOfMonth(year, 1, 0); // Last Sunday of February
  const kadayawanSun = nthWeekdayOfMonth(year, 7, 0, 3); // 3rd Sunday of August
  const penafranciaSun = nthWeekdayOfMonth(year, 8, 0, 3); // 3rd Sunday of September
  const masskaraSun = nthWeekdayOfMonth(year, 9, 0, 4); // 4th Sunday of October

  const holidays: PhHolidayItem[] = [
    // National & Regular / Special Holidays
    { date: `${year}-01-01`, name: "New Year's Day", kind: "Regular Holiday", category: "National" },
    { date: `${year}-02-25`, name: "EDSA People Power Revolution Anniversary", kind: "Special Holiday", category: "National" },
    { date: `${year}-04-09`, name: "Araw ng Kagitingan (Day of Valor)", kind: "Regular Holiday", category: "National" },
    { date: `${year}-05-01`, name: "Labor Day", kind: "Regular Holiday", category: "National" },
    { date: `${year}-06-12`, name: "Independence Day", kind: "Regular Holiday", category: "National" },
    { date: `${year}-07-27`, name: "Iglesia ni Cristo Founding Anniversary", kind: "Special National Working Holiday", category: "National" },
    { date: `${year}-08-21`, name: "Ninoy Aquino Day", kind: "Special Non-Working Holiday", category: "National" },
    { date: iso(heroesDay), name: "National Heroes Day", kind: "Regular Holiday", category: "National" },
    { date: `${year}-11-30`, name: "Bonifacio Day", kind: "Regular Holiday", category: "National" },
    { date: `${year}-12-30`, name: "Rizal Day", kind: "Regular Holiday", category: "National" },
    { date: `${year}-12-31`, name: "Last Day of the Year", kind: "Special Non-Working Holiday", category: "National" },

    // Christian Holidays
    { date: `${year}-01-06`, name: "Epiphany (Three Kings)", kind: "Christian Observance", category: "Christian" },
    { date: iso(ashWed), name: "Ash Wednesday", kind: "Christian Observance", category: "Christian" },
    { date: iso(palmSun), name: "Palm Sunday", kind: "Christian Observance", category: "Christian" },
    { date: iso(holyWed), name: "Holy Wednesday", kind: "Christian Observance", category: "Christian" },
    { date: iso(maundy), name: "Maundy Thursday", kind: "Regular Holiday · Christian", category: "Christian" },
    { date: iso(goodFri), name: "Good Friday", kind: "Regular Holiday · Christian", category: "Christian" },
    { date: iso(blackSat), name: "Black Saturday", kind: "Special Non-Working · Christian", category: "Christian" },
    { date: iso(easter), name: "Easter Sunday", kind: "Christian Solemnity", category: "Christian" },
    { date: iso(ascension), name: "Ascension of Jesus", kind: "Christian Observance", category: "Christian" },
    { date: iso(pentecost), name: "Pentecost Sunday", kind: "Christian Solemnity", category: "Christian" },
    { date: `${year}-08-15`, name: "Assumption of the Blessed Virgin Mary", kind: "Christian Solemnity", category: "Christian" },
    { date: `${year}-09-08`, name: "Feast of the Nativity of the Blessed Virgin Mary", kind: "Special Working · Christian", category: "Christian" },
    { date: `${year}-10-31`, name: "All Saints' Day Eve", kind: "Special Non-Working · Christian", category: "Christian" },
    { date: `${year}-11-01`, name: "All Saints' Day", kind: "Special Non-Working · Christian", category: "Christian" },
    { date: `${year}-11-02`, name: "All Souls' Day", kind: "Special Non-Working · Christian", category: "Christian" },
    { date: iso(christKing), name: "Feast of Christ the King", kind: "Christian Solemnity", category: "Christian" },
    { date: `${year}-12-08`, name: "Feast of the Immaculate Conception of Mary", kind: "Special Non-Working · Christian", category: "Christian" },
    { date: `${year}-12-16`, name: "Start of Simbang Gabi (Misa de Gallo)", kind: "Christian Tradition", category: "Christian" },
    { date: `${year}-12-24`, name: "Christmas Eve", kind: "Special Non-Working · Christian", category: "Christian" },
    { date: `${year}-12-25`, name: "Christmas Day", kind: "Regular Holiday · Christian", category: "Christian" },

    // Philippine Regional Holidays
    { date: iso(sinulogSun), name: "Sinulog Festival (Santo Niño de Cebu)", kind: "Regional Holiday · Cebu", category: "Regional", region: "Visayas · Cebu" },
    { date: iso(dinagyangSun), name: "Dinagyang Festival", kind: "Regional Holiday · Iloilo", category: "Regional", region: "Visayas · Iloilo" },
    { date: `${year}-02-24`, name: "Cebu City Charter Day", kind: "Regional Charter Holiday", category: "Regional", region: "Visayas · Cebu City" },
    { date: iso(panagbengaSun), name: "Panagbenga Flower Festival", kind: "Regional Holiday · Baguio", category: "Regional", region: "Luzon · Baguio City" },
    { date: `${year}-03-01`, name: "Araw ng Dabaw (Davao Day)", kind: "Regional Holiday · Davao", category: "Regional", region: "Mindanao · Davao City" },
    { date: `${year}-04-27`, name: "Kadaugan sa Mactan", kind: "Regional Holiday · Lapu-Lapu", category: "Regional", region: "Visayas · Cebu" },
    { date: `${year}-06-24`, name: "Araw ng Maynila / Feast of St. John the Baptist", kind: "Regional Holiday · Manila", category: "Regional", region: "Luzon · Manila" },
    { date: `${year}-08-06`, name: "Cebu Province Founding Day", kind: "Regional Holiday · Cebu Province", category: "Regional", region: "Visayas · Cebu" },
    { date: iso(kadayawanSun), name: "Kadayawan Festival", kind: "Regional Holiday · Davao", category: "Regional", region: "Mindanao · Davao" },
    { date: iso(penafranciaSun), name: "Peñafrancia Festival", kind: "Regional Holiday · Bicol", category: "Regional", region: "Luzon · Naga City" },
    { date: iso(masskaraSun), name: "MassKara Festival", kind: "Regional Holiday · Bacolod", category: "Regional", region: "Visayas · Bacolod" },
  ];
  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

function autoDecorKey(now: Date): string {
  const y = now.getFullYear();
  const t = new Date(y, now.getMonth(), now.getDate()).getTime();
  const easter = easterSunday(y).getTime();
  const palm = easter - 7 * 864e5;
  if (t >= palm && t <= easter) return "holyweek";
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  if (md === 1231 || md <= 107) return "newyear";
  if (md >= 1201 && md <= 1230) return "christmas";
  if (md >= 201 && md <= 214) return "valentine";
  if (md >= 1031 || md <= 1102) return "allsaints";
  return "default";
}

export function activeDecor() {
  const pref = localStorage.getItem("eesi-decor") || "auto";
  if (pref === "off") return null;
  if (pref === "auto") {
    const key = autoDecorKey(new Date());
    return key === "default" ? DAILY_DECOR[new Date().getDay()] : (DECOR[key] || DECOR.default);
  }
  return DECOR[pref] || DECOR.default;
}

export function renderDailyVerseDecor(): void {
  const box = $("dailyVerseDecor");
  if (!box) return;
  const theme = activeDecor();
  if (!theme) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  box.style.setProperty("--dg1", theme.from);
  box.style.setProperty("--dg2", theme.to);
  box.innerHTML =
    '<div class="deco-ribbon">' + esc(theme.label) + '</div><div class="deco-icons">' +
    theme.icons.map((ic, i) => '<span class="d" style="animation-delay:' + (i * 0.3) + 's">' + ic + "</span>").join("") +
    "</div>";
}

export function renderDecor(): void {
  const sel = $("settingDecor") as HTMLSelectElement | null;
  if (!sel) return;
  sel.value = localStorage.getItem("eesi-decor") || "auto";
  const theme = activeDecor();
  document.body.classList.toggle("no-decor", !theme);
  document.body.style.setProperty("--deco-icon", theme ? '"' + theme.logo + '"' : '""');
  document.querySelectorAll(".deco-band").forEach(n => n.remove());
  document.querySelectorAll(".logo-deco").forEach(n => { n.textContent = theme ? theme.logo : ""; });
  renderDailyVerseDecor();
  if (!theme) return;
  const band =
    '<div class="deco-band" style="--dg1:' + theme.from + ";--dg2:" + theme.to + '">' +
    '<div class="deco-ribbon">' + esc(theme.label) + '</div><div class="deco-icons">' +
    theme.icons.map((ic, i) => '<span class="d" style="animation-delay:' + (i * 0.35) + 's">' + ic + "</span>").join("") +
    "</div></div>";
  document.querySelectorAll("section.page").forEach(sec => {
    if (sec.id === "page-chat") return;
    (sec.querySelector(":scope > .ct") || sec).insertAdjacentHTML("beforeend", band);
  });
}

export function showDailyVerse(): void {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const key = "eesi-daily-verse-date:" + (state.userId || "anon");
  if (localStorage.getItem(key) === today) return;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const day = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const verse = DAILY_VERSES[day % DAILY_VERSES.length];
  renderDailyVerseDecor();
  const txt = $("dailyVerseText");
  const ref = $("dailyVerseReference");
  if (txt) txt.textContent = verse.text;
  if (ref) ref.textContent = verse.reference;
  $("dailyVerseOverlay")?.classList.remove("hidden");
  localStorage.setItem(key, today);
}

/* ==================== BACKGROUND PUSH & NOTIFICATIONS ==================== */
export function requestNotificationPermission(): void {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission().catch(() => {});
  }
}

export async function showBackgroundNotification(title: string, body: string, vibratePattern: number[] = [260, 110, 260, 110, 380]): Promise<void> {
  if (document.visibilityState === "visible") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        vibrate: notificationSettings().vibration ? vibratePattern : undefined,
        silent: false,
        tag: "eesi-notification",
        renotify: true,
      } as NotificationOptions);
    } catch {}
  }
}

export async function showShiftReminderNotification(
  title: string,
  body: string,
  scheduleId: string,
  vibratePattern: number[] = [300, 120, 300, 120, 300]
): Promise<void> {
  const s = notificationSettings();
  if (!s.enabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const tag = "eesi-shift-30m-" + (scheduleId || "upcoming");
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        vibrate: s.vibration ? vibratePattern : undefined,
        silent: false,
        tag,
        renotify: true,
        requireInteraction: true,
        data: { page: "schedule", scheduleId },
      } as NotificationOptions);
      return;
    } catch {}
  }
  try {
    const n = new Notification(title, { body, icon: "/pwa-192x192.png", tag });
    n.onclick = () => {
      window.focus();
      hooks.go?.("schedule");
      n.close();
    };
  } catch {}
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function swKvPut(key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("eesi-push", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

export async function syncPushSession(session: any): Promise<void> {
  if (!session || !window.indexedDB) return;
  try {
    await swKvPut("session", {
      url: SUPABASE_URL,
      key: SUPABASE_PUBLISHABLE_KEY,
      token: session.access_token,
      userId: session.user.id,
      name: (state.profile && state.profile.full_name) || session.user.email || "User",
    });
  } catch {}
}

async function savePushSubscription(sub: PushSubscription): Promise<void> {
  const j = sub.toJSON();
  const { error } = await runtime.client.rpc("save_push_subscription", {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
    p_user_agent: navigator.userAgent.slice(0, 200),
  });
  if (error) throw error;
}

async function ensurePushSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    let reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) {
      reg = await navigator.serviceWorker.register("/push-sw.js");
    }
    const readyPromise = navigator.serviceWorker.ready.catch(() => null);
    const timeoutPromise = new Promise<null>(res => setTimeout(() => res(null), 2800));
    const readyReg = await Promise.race([readyPromise, timeoutPromise]);
    return readyReg || reg || null;
  } catch {
    return null;
  }
}

export async function enablePush(silent: boolean): Promise<void> {
  if (!state.userId) return;
  unlockSharedAudio();

  const activateLocalAlertsFallback = (msg: string) => {
    localStorage.setItem("eesi-notifications", "on");
    const sn = $("settingNotifications") as HTMLInputElement | null;
    if (sn) sn.checked = true;
    if (!silent) {
      playSettingSound(true);
      if ("vibrate" in navigator) navigator.vibrate([180, 80, 180]);
      toast(msg);
    }
  };

  if (!("Notification" in window)) {
    activateLocalAlertsFallback("In-app sound & vibration alerts enabled.");
    return;
  }

  let perm: NotificationPermission = Notification.permission;
  if (perm !== "granted") {
    if (silent) return;
    try {
      perm = await Notification.requestPermission();
    } catch {
      perm = Notification.permission;
    }
  }

  if (perm === "denied") {
    activateLocalAlertsFallback("Browser blocked pop-ups — in-app sound & vibration alerts stay active.");
    return;
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    activateLocalAlertsFallback(
      window.self !== window.top
        ? "Notifications, sound & vibration enabled! (Open outside preview for lock-screen Web Push.)"
        : "Notifications, sound & vibration enabled! (Add to Home Screen on iOS for lock-screen Push.)"
    );
    return;
  }

  if (!PUSH_READY) {
    activateLocalAlertsFallback("Notifications, sound & vibration enabled!");
    return;
  }

  try {
    const reg = await ensurePushSwRegistration();
    if (!reg || !reg.pushManager) {
      activateLocalAlertsFallback("Browser notifications, sound & vibration enabled!");
      return;
    }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
    await savePushSubscription(sub);
    localStorage.setItem("eesi-notifications", "on");
    const sn = $("settingNotifications") as HTMLInputElement | null;
    if (sn) sn.checked = true;
    if (!silent) toast("Background Push, sound & vibration notifications enabled!");
  } catch {
    activateLocalAlertsFallback("Notifications, sound & vibration enabled!");
  }
}

export async function openPushThread(id: string): Promise<boolean> {
  if (!state.userId || !id) return false;
  if (!state.threads.some(t => String(t.id) === String(id))) await hooks.loadThreads?.();
  if (state.threads.some(t => String(t.id) === String(id))) {
    await hooks.openThread(id);
    return true;
  }
  return false;
}

export async function openStartupThread(): Promise<boolean> {
  const params = new URLSearchParams(location.search);
  const id = params.get("thread");
  const page = params.get("page");
  if (id) {
    history.replaceState(null, "", location.pathname);
    return openPushThread(id);
  }
  if (page) {
    history.replaceState(null, "", location.pathname);
    hooks.go?.(page);
    return true;
  }
  return false;
}

/* ==================== SOUND SETTINGS, RINGTONES & VIBRATION ==================== */
let settingsAutoCloseTimer: any = null;
export function resetSettingsTimer(): void {
  clearTimeout(settingsAutoCloseTimer);
  const menu = $("settingsMenu");
  if (menu && !menu.classList.contains("hidden")) {
    settingsAutoCloseTimer = setTimeout(() => menu.classList.add("hidden"), 25000);
  }
}

export function toggleSettingsMenu(): void {
  const menu = $("settingsMenu");
  if (!menu) return;
  menu.classList.toggle("hidden");
  if (menu.classList.contains("hidden")) clearTimeout(settingsAutoCloseTimer);
  else resetSettingsTimer();
}

function setSoundSource(source: string): void {
  localStorage.setItem("eesi-sound-source", source);
  const useCustom = source === "custom";
  $("builtInSoundPanel")?.classList.toggle("hidden", useCustom);
  $("customSoundPanel")?.classList.toggle("hidden", !useCustom);
  $("builtInSoundChoice")?.classList.toggle("btn", !useCustom);
  $("builtInSoundChoice")?.classList.toggle("gray", useCustom);
  $("customSoundChoice")?.classList.toggle("btn", useCustom);
  $("customSoundChoice")?.classList.toggle("gray", !useCustom);
}

const RINGTONE_DB = "eesi-ringtones";
const RINGTONE_STORE = "files";
function openRingtoneDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RINGTONE_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(RINGTONE_STORE)) req.result.createObjectStore(RINGTONE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveRingtoneToDB(userId: string, file: File): Promise<boolean> {
  const db = await openRingtoneDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RINGTONE_STORE, "readwrite");
    tx.objectStore(RINGTONE_STORE).put({ blob: file, name: file.name, type: file.type, savedAt: Date.now() }, "ringtone:" + userId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function loadRingtoneFromDB(userId: string): Promise<any> {
  const db = await openRingtoneDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RINGTONE_STORE, "readonly");
    const req = tx.objectStore(RINGTONE_STORE).get("ringtone:" + userId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function clearRingtoneFromDB(userId: string): Promise<boolean> {
  const db = await openRingtoneDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RINGTONE_STORE, "readwrite");
    tx.objectStore(RINGTONE_STORE).delete("ringtone:" + userId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

let settingSoundTimer: any = null;
let settingSoundTimeout: any = null;
let customSoundUrl: string | null = null;
let customSoundAudio: HTMLAudioElement | null = null;
let settingVibrationTimer: any = null;
let sharedAudioContext: AudioContext | null = null;
let audioUnlockWired = false;

function getOrCreateAudioContext(): AudioContext | null {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextClass();
  }
  return sharedAudioContext;
}

export function unlockSharedAudio(): void {
  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

function wireAudioGestureUnlock(): void {
  if (audioUnlockWired) return;
  audioUnlockWired = true;
  const unlock = () => {
    unlockSharedAudio();
  };
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("touchstart", unlock, { passive: true });
  document.addEventListener("keydown", unlock, { passive: true });
}

export function stopSettingSound(): void {
  clearInterval(settingSoundTimer);
  clearTimeout(settingSoundTimeout);
  clearInterval(settingVibrationTimer);
  settingSoundTimer = null;
  settingSoundTimeout = null;
  settingVibrationTimer = null;
  if ("vibrate" in navigator) navigator.vibrate(0);
  if (customSoundAudio) { customSoundAudio.pause(); customSoundAudio.currentTime = 0; customSoundAudio = null; }
  if (customSoundUrl) { URL.revokeObjectURL(customSoundUrl); customSoundUrl = null; }
}

export function notificationSettings() {
  return {
    enabled: localStorage.getItem("eesi-notifications") !== "off",
    vibration: localStorage.getItem("eesi-vibration") !== "off",
  };
}

function saveNotificationSettings(): void {
  const notifEl = $("settingNotifications") as HTMLInputElement | null;
  const vibEl = $("settingVibration") as HTMLInputElement | null;
  localStorage.setItem("eesi-notifications", notifEl?.checked ? "on" : "off");
  localStorage.setItem("eesi-vibration", vibEl?.checked ? "on" : "off");
  if (!vibEl?.checked && "vibrate" in navigator) navigator.vibrate(0);
  toast("Notification settings saved");
}

function startVibrationPattern(durationSeconds: number): boolean {
  const settings = notificationSettings();
  if (!settings.vibration || !("vibrate" in navigator)) return false;
  navigator.vibrate([250, 150, 250]);
  clearInterval(settingVibrationTimer);
  settingVibrationTimer = setInterval(() => navigator.vibrate([250, 150, 250]), 700);
  if (durationSeconds > 0 && !settingSoundTimeout) {
    settingSoundTimeout = setTimeout(stopSettingSound, durationSeconds * 1000);
  }
  return true;
}

async function playCustomSettingSound(): Promise<boolean> {
  if (!state.userId) return false;
  const soundInput = $("settingSoundFile") as HTMLInputElement | null;
  let file = soundInput?.files?.[0];
  if (!file) {
    try {
      const saved = await loadRingtoneFromDB(state.userId);
      if (!saved || !saved.blob) return false;
      file = new File([saved.blob], saved.name || "ringtone.mp3", { type: saved.type || "audio/mpeg" });
    } catch { return false; }
  }
  stopSettingSound();
  customSoundUrl = URL.createObjectURL(file);
  customSoundAudio = new Audio(customSoundUrl);
  const audio = customSoundAudio;
  const url = customSoundUrl;
  audio.addEventListener("ended", () => {
    if (customSoundAudio === audio) { customSoundAudio = null; customSoundUrl = null; URL.revokeObjectURL(url); }
  }, { once: true });
  audio.addEventListener("error", () => {
    if (customSoundAudio === audio) { customSoundAudio = null; customSoundUrl = null; URL.revokeObjectURL(url); }
    toast("This audio file could not be played.");
  }, { once: true });
  audio.play().catch(() => { stopSettingSound(); toast("Could not play the selected audio file."); });
  return true;
}

export function playSettingSound(silent = false): void {
  stopSettingSound();
  const choice = ($("settingSound") as HTMLSelectElement | null)?.value || localStorage.getItem("eesi-sound") || "bright";
  const source = localStorage.getItem("eesi-sound-source") || "built-in";
  const durationEl = (source === "custom" ? $("settingCustomAlertDuration") : $("settingAlertDuration")) as HTMLSelectElement | null;
  const duration = Number(durationEl?.value || localStorage.getItem(source === "custom" ? "eesi-custom-alert-duration" : "eesi-alert-duration") || 15);
  const settings = notificationSettings();

  if (silent && !settings.enabled) return;

  if (source !== "custom" && choice === "off") {
    if (settings.vibration && "vibrate" in navigator) {
      startVibrationPattern(duration > 0 ? Math.min(duration, 4) : 3);
      if (!silent) toast("Vibration preview (sound is off)");
    } else if (!silent) {
      toast("Choose a built-in sound or turn on vibration.");
    }
    return;
  }

  if (duration === 0) {
    if (settings.vibration && "vibrate" in navigator) {
      startVibrationPattern(3);
      if (!silent) toast("Vibration preview (alert duration is off)");
    } else if (!silent) {
      toast("Choose an alert duration first.");
    }
    return;
  }

  // For background incoming notification chimes, keep chime concise (max ~3.2s) while full preview honors selected duration
  const effectiveDuration = silent ? Math.min(duration, 3.2) : duration;

  if (source === "custom") {
    playCustomSettingSound().then(started => {
      if (!started && !silent) toast("No custom ringtone saved. Upload one first.");
    });
    settingSoundTimeout = setTimeout(stopSettingSound, effectiveDuration * 1000);
    startVibrationPattern(effectiveDuration);
    return;
  }

  const ctx = getOrCreateAudioContext();
  if (!ctx) {
    startVibrationPattern(effectiveDuration);
    if (!silent) toast("Sound preview is not supported in this browser.");
    return;
  }
  const patterns: Record<string, number[]> = {
    classic: [659, 784, 988, 784, 659],
    bright: [880, 1175, 1397, 1175],
    digital: [660, 660, 880, 660],
    retro: [784, 659, 523, 659, 784],
    soft: [523, 659, 784, 659],
    bell: [784, 988, 784],
  };
  const notes = patterns[choice] || patterns.bright;

  const playPattern = () => {
    if (!ctx || ctx.state === "closed") return;
    const start = ctx.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteStart = start + index * 0.14;
      const noteEnd = noteStart + 0.12;
      oscillator.type = choice === "digital" ? "square" : "sine";
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.13, noteStart + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, noteEnd);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd);
    });
  };
  const runSound = () => {
    if (ctx.state !== "running") return;
    playPattern();
    if (!silent) {
      settingSoundTimer = setInterval(playPattern, notes.length * 140 + 350);
    }
  };
  if (ctx.state === "running") {
    runSound();
  } else {
    ctx.resume().then(runSound).catch(() => {});
  }

  startVibrationPattern(effectiveDuration);
  settingSoundTimeout = setTimeout(stopSettingSound, effectiveDuration * 1000);
}

function vibrateForNotification(pattern: number[] = [220, 100, 220]): void {
  const s = notificationSettings();
  if (s.enabled && s.vibration && "vibrate" in navigator) {
    try { navigator.vibrate(pattern); } catch {}
  }
}

export function triggerAndroidHapticTap(): void {
  const s = notificationSettings();
  if (!s.vibration || !("vibrate" in navigator)) return;
  const ua = (navigator as any).userActivation;
  if (ua && !ua.hasBeenActive) return;
  try { navigator.vibrate(12); } catch {}
}

let lastAlertAt = 0;
export function triggerAlert(title: string, body: string, vibratePattern: number[] = [220, 100, 220]): void {
  const s = notificationSettings();
  if (s.enabled && Date.now() - lastAlertAt > 350) {
    lastAlertAt = Date.now();
    vibrateForNotification(vibratePattern);
    playSettingSound(true);
  }
  showBackgroundNotification(title, body, vibratePattern);
}

export function triggerMentionAlert(title: string, body: string): void {
  const mentionPattern = [350, 120, 350, 120, 450];
  const s = notificationSettings();
  lastAlertAt = Date.now();
  if ("vibrate" in navigator) {
    try { navigator.vibrate(mentionPattern); } catch {}
  }
  if (s.enabled) {
    playSettingSound(true);
  }
  showBackgroundNotification(title, body, mentionPattern);
}

export function triggerShiftAlert(
  title: string,
  body: string,
  scheduleId: string,
  vibratePattern: number[] = [300, 120, 300, 120, 300]
): void {
  const s = notificationSettings();
  if (s.enabled) {
    lastAlertAt = Date.now();
    vibrateForNotification(vibratePattern);
    playSettingSound(true);
  }
  showShiftReminderNotification(title, body, scheduleId, vibratePattern);
}

/* ==================== THEME & DISPLAY SETTINGS ==================== */
export function applyTheme(mode: string): void {
  const cleanMode = mode === "light" ? "light" : "dark";
  const useLight = cleanMode === "light";
  document.body.classList.toggle("light", useLight);
  const sel = $("settingTheme") as HTMLSelectElement | null;
  if (sel) sel.value = cleanMode;
  const headerBtn = $("headerThemeBtn");
  if (headerBtn) {
    headerBtn.textContent = useLight ? "🌙" : "☀️";
    headerBtn.title = useLight ? "Switch to dark mode" : "Switch to light mode";
    headerBtn.setAttribute("aria-label", useLight ? "Switch to dark mode" : "Switch to light mode");
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", useLight ? "#eef4fb" : "#060e1f");
}

export function toggleTheme(): void {
  const isLight = document.body.classList.contains("light");
  const next = isLight ? "dark" : "light";
  localStorage.setItem("eesi-theme", next);
  applyTheme(next);
}

export function applyDisplaySettings(): void {
  const font = localStorage.getItem("eesi-font") || "system";
  const weight = localStorage.getItem("eesi-font-weight") || "regular";
  const style = localStorage.getItem("eesi-font-style") || "regular";
  const fonts: Record<string, string> = {
    system: "'Inter',system-ui,-apple-system,'Segoe UI',sans-serif",
    poppins: "'Poppins',sans-serif",
    montserrat: "'Montserrat',sans-serif",
    rajdhani: "'Rajdhani','Segoe UI',system-ui,sans-serif",
    orbitron: "'Orbitron',sans-serif",
    cinzel: "'Cinzel',serif",
    playfair: "'Playfair Display',serif",
    robotomono: "'Roboto Mono',monospace",
    dancing: "'Dancing Script',cursive",
    pacifico: "'Pacifico',cursive",
    segoe: "'Segoe UI',system-ui,sans-serif",
    arial: "Arial, Helvetica, sans-serif",
    verdana: "Verdana, Geneva, sans-serif",
    trebuchet: "'Trebuchet MS',Helvetica,sans-serif",
    georgia: "Georgia, serif",
    times: "'Times New Roman',Times,serif",
    courier: "'Courier New',Courier,monospace",
  };
  const selectedFont = fonts[font] || fonts.system;
  document.documentElement.style.setProperty("--app-font", selectedFont);
  document.body.style.setProperty("font-family", selectedFont, "important");
  ["fw-light", "fw-regular", "fw-semibold", "fw-bold"].forEach(c => document.body.classList.remove(c));
  document.body.classList.add("fw-" + (["light", "regular", "semibold", "bold"].includes(weight) ? weight : "regular"));
  ["fs-regular", "fs-italic", "fs-oblique", "fs-uppercase", "fs-capitalize", "fs-wide", "fs-smallcaps"].forEach(c => document.body.classList.remove(c));
  document.body.classList.add("fs-" + (["regular", "italic", "oblique", "uppercase", "capitalize", "wide", "smallcaps"].includes(style) ? style : "regular"));
  const sf = $("settingFont") as HTMLSelectElement | null;
  const sw = $("settingWeight") as HTMLSelectElement | null;
  const ss = $("settingStyle") as HTMLSelectElement | null;
  if (sf) sf.value = fonts[font] ? font : "system";
  if (sw) sw.value = ["light", "regular", "semibold", "bold"].includes(weight) ? weight : "regular";
  if (ss) ss.value = ["regular", "italic", "oblique", "uppercase", "capitalize", "wide", "smallcaps"].includes(style) ? style : "regular";

  const textSize = localStorage.getItem("eesi-text-size") || "regular";
  const compact = localStorage.getItem("eesi-compact") === "on";
  document.body.style.fontSize = "15px";
  const zoomMap: Record<string, number> = { xs: 0.85, small: 0.92, regular: 1, large: 1.12 };
  const appEl = $("app");
  if (appEl) (appEl.style as any).zoom = "";
  const mainEl = document.querySelector<HTMLElement>("#app > main");
  if (mainEl) (mainEl.style as any).zoom = String(zoomMap[textSize] || 1);
  document.body.classList.toggle("compact", compact);
  const sts = $("settingTextSize") as HTMLSelectElement | null;
  const sc = $("settingCompact") as HTMLInputElement | null;
  if (sts) sts.value = textSize;
  if (sc) sc.checked = compact;

  const atmosPref = localStorage.getItem("eesi-atmosphere") || "auto";
  runtime.atmosphereSession = atmosPref;
  const sa = $("settingAtmosphere") as HTMLSelectElement | null;
  if (sa) sa.value = atmosPref;
  applyAmbientSessionBackground();
  applyWatermark();
}

function watermarkImgKey(): string {
  return "eesi-watermark-img:" + (state.userId || "default");
}
function watermarkOpacityKey(): string {
  return "eesi-watermark-opacity:" + (state.userId || "default");
}

export function applyWatermark(): void {
  const layer = $("appWatermark");
  const imgData = localStorage.getItem(watermarkImgKey()) || localStorage.getItem("eesi-watermark-img:default") || "";
  const opRaw = localStorage.getItem(watermarkOpacityKey()) || localStorage.getItem("eesi-watermark-opacity:default") || "0.14";
  const opacity = Math.max(0.04, Math.min(0.45, Number(opRaw) || 0.14));

  const opSlider = $("settingWatermarkOpacity") as HTMLInputElement | null;
  if (opSlider) opSlider.value = String(Math.round(opacity * 100));
  const opLbl = $("watermarkOpacityLabel");
  if (opLbl) opLbl.textContent = Math.round(opacity * 100) + "%";
  const clearBtn = $("clearWatermarkBtn");
  if (clearBtn) clearBtn.classList.toggle("hidden", !imgData);
  const statusEl = $("watermarkStatus");
  if (statusEl) statusEl.textContent = imgData ? "Active" : "None selected";

  if (!layer) return;
  if (imgData) {
    layer.style.backgroundImage = `url("${imgData}")`;
    layer.style.opacity = String(opacity);
    layer.classList.remove("hidden");
  } else {
    layer.style.backgroundImage = "";
    layer.classList.add("hidden");
  }
}

export function setWatermarkOpacity(percentVal: string | number): void {
  const pct = Math.max(4, Math.min(45, Number(percentVal) || 14));
  localStorage.setItem(watermarkOpacityKey(), String(pct / 100));
  localStorage.setItem("eesi-watermark-opacity:default", String(pct / 100));
  applyWatermark();
}

export function clearWatermark(): void {
  localStorage.removeItem(watermarkImgKey());
  localStorage.removeItem("eesi-watermark-img:default");
  const inp = $("settingWatermarkFile") as HTMLInputElement | null;
  if (inp) inp.value = "";
  applyWatermark();
  toast("Background watermark removed");
}

export function resetDisplaySettings(): void {
  ["eesi-font", "eesi-font-weight", "eesi-font-style", "eesi-text-size", "eesi-compact", "eesi-theme", "eesi-atmosphere"].forEach(k => localStorage.removeItem(k));
  clearWatermark();
  applyDisplaySettings();
  applyTheme("dark");
  toast("Display settings reset");
}

/* ==================== APP LOCK (6-DIGIT PIN & BIOMETRIC WEBAUTHN) ==================== */
const PIN_KEY = "eesi-pin-hash";
const BIO_KEY_PREFIX = "eesi-biometric-cred:";
let pinFailures = 0;
let pinLockedUntil = 0;
let lastHiddenAt = 0;
let bioAutoPrompted = false;

function bioKey(uid?: string | null): string {
  return BIO_KEY_PREFIX + (uid || state.userId || "anon");
}
function bytesToB64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64UrlToBytes(b64u: string): Uint8Array {
  const pad = "=".repeat((4 - (b64u.length % 4)) % 4);
  const bin = atob((b64u + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function getStoredBiometric(uid?: string | null): { id: string; createdAt: number; label?: string } | null {
  try {
    const raw = localStorage.getItem(bioKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function hasBiometricLock(uid?: string | null): boolean {
  return !!getStoredBiometric(uid)?.id;
}
export function hasAppPin(): boolean { return !!localStorage.getItem(PIN_KEY); }
export function hasAnyAppLock(): boolean { return hasAppPin() || hasBiometricLock(); }

export async function isPlatformBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential || !navigator.credentials || !window.isSecureContext) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return true;
  }
}

export async function refreshBiometricSettings(): Promise<void> {
  const enabled = hasBiometricLock();
  const stateEl = $("biometricLockState");
  const enableBtn = $("enableBiometricBtn") as HTMLButtonElement | null;
  const disableBtn = $("disableBiometricBtn") as HTMLButtonElement | null;
  const supported = !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
  const avail = supported ? await isPlatformBiometricAvailable() : false;

  if (stateEl) {
    stateEl.textContent = enabled ? "On (Fingerprint / Face)" : (avail ? "Off" : (supported ? "Available on device" : "Unavailable"));
  }
  enableBtn?.classList.toggle("hidden", enabled);
  disableBtn?.classList.toggle("hidden", !enabled);
}

export async function enableBiometricLock(): Promise<void> {
  if (!state.userId) { toast("Sign in first."); return; }
  if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials) {
    toast("Biometric unlock requires a secure HTTPS browser with WebAuthn support.");
    return;
  }
  const btn = $("enableBiometricBtn") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(state.userId);
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "EESI Elevators" },
        user: {
          id: userIdBytes,
          name: state.email || state.userId,
          displayName: state.profile?.full_name || state.email || "EESI Member",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
    if (!cred) { toast("Biometric registration cancelled."); return; }
    localStorage.setItem(
      bioKey(),
      JSON.stringify({ id: bytesToB64Url(cred.rawId), createdAt: Date.now() })
    );
    await refreshBiometricSettings();
    toast("Fingerprint / Face unlock enabled!");
  } catch (err: any) {
    const msg = err?.name === "NotAllowedError"
      ? "Biometric setup cancelled or blocked in embedded preview. Install the app on your phone or open directly over HTTPS."
      : "Could not enable biometrics: " + (err?.message || err);
    toast(msg);
  } finally {
    if (btn) btn.disabled = false;
  }
}

export async function disableBiometricLock(): Promise<void> {
  localStorage.removeItem(bioKey());
  await refreshBiometricSettings();
  toast("Biometric unlock disabled");
}

export async function unlockWithBiometrics(silentAuto = false): Promise<boolean> {
  const stored = getStoredBiometric();
  const statusEl = $("pinLockStatus");
  if (!stored || !stored.id) {
    if (!silentAuto) toast("Biometrics not set up on this device.");
    return false;
  }
  if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials) {
    if (!silentAuto && statusEl) statusEl.textContent = "Biometric unlock requires HTTPS.";
    return false;
  }
  const bioBtn = $("pinLockBiometricBtn") as HTMLButtonElement | null;
  if (bioBtn) bioBtn.disabled = true;
  if (statusEl && !silentAuto) statusEl.textContent = "Verifying fingerprint / face…";
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credId = b64UrlToBytes(stored.id);
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          type: "public-key",
          id: credId.buffer as ArrayBuffer,
          transports: ["internal", "hybrid"],
        }],
        userVerification: "required",
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion || bytesToB64Url(assertion.rawId) !== stored.id) {
      if (statusEl) statusEl.textContent = "Biometric verification did not match.";
      return false;
    }
    pinFailures = 0;
    const inp = $("pinLockInput") as HTMLInputElement | null;
    if (inp) inp.value = "";
    updatePinDots();
    if (statusEl) statusEl.textContent = "";
    $("pinLockOverlay")?.classList.add("hidden");
    bioAutoPrompted = false;
    toast("Unlocked with biometrics");
    return true;
  } catch (err: any) {
    if (!silentAuto && statusEl) {
      statusEl.textContent = err?.name === "NotAllowedError"
        ? "Biometric prompt cancelled or unavailable here. Tap retry or use your PIN."
        : "Biometric error: " + (err?.message || err);
    } else if (silentAuto && statusEl) {
      statusEl.textContent = "Tap 'Unlock with Fingerprint / Face' or enter your PIN.";
    }
    return false;
  } finally {
    if (bioBtn) bioBtn.disabled = false;
  }
}

function cleanPin(v: string): string { return String(v || "").replace(/\D/g, "").slice(0, 6); }
async function hashPin(pin: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function savePin(pin: string): Promise<void> {
  const salt = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/\$/g, "");
  localStorage.setItem(PIN_KEY, salt + "$" + await hashPin(pin, salt));
}
async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_KEY) || "";
  const i = stored.indexOf("$");
  if (i < 0) return false;
  return (await hashPin(pin, stored.slice(0, i))) === stored.slice(i + 1);
}
export function refreshPinSettings(): void {
  const on = hasAppPin();
  const lbl = $("appLockState");
  if (lbl) lbl.textContent = on ? "On" : "Off";
  $("setPinBtn")?.classList.toggle("hidden", on);
  $("changePinBtn")?.classList.toggle("hidden", !on);
  $("removePinBtn")?.classList.toggle("hidden", !on);
  refreshBiometricSettings();
}
export function openPinSetup(mode: boolean | string): void {
  if (!window.isSecureContext || !crypto.subtle) { toast("PIN needs a secure (https) connection"); return; }
  const remove = mode === "remove";
  const changing = mode === true;
  const overlay = $("pinSetupOverlay");
  if (!overlay) return;
  overlay.dataset.mode = remove ? "remove" : changing ? "change" : "set";
  const title = $("pinSetupTitle");
  if (title) title.textContent = remove ? "Turn off PIN" : changing ? "Change PIN" : "Set PIN";
  $("pinCurrentField")?.classList.toggle("hidden", !(remove || changing));
  $("pinNewFields")?.classList.toggle("hidden", remove);
  ["pinCurrent", "pinNew", "pinConfirm"].forEach(id => {
    const el = $(id) as HTMLInputElement | null;
    if (el) el.value = "";
  });
  const st = $("pinSetupStatus");
  if (st) st.textContent = "";
  overlay.classList.remove("hidden");
  ($(remove || changing ? "pinCurrent" : "pinNew") as HTMLInputElement | null)?.focus();
}
export function closePinSetup(): void {
  $("pinSetupOverlay")?.classList.add("hidden");
  ["pinCurrent", "pinNew", "pinConfirm"].forEach(id => {
    const el = $(id) as HTMLInputElement | null;
    if (el) el.value = "";
  });
}
export async function submitPinSetup(): Promise<void> {
  const overlay = $("pinSetupOverlay");
  const mode = overlay?.dataset.mode;
  const status = $("pinSetupStatus");
  const cur = cleanPin(($("pinCurrent") as HTMLInputElement | null)?.value || "");
  const nw = cleanPin(($("pinNew") as HTMLInputElement | null)?.value || "");
  const cf = cleanPin(($("pinConfirm") as HTMLInputElement | null)?.value || "");
  if (mode !== "set" && cur.length !== 6) { if (status) status.textContent = "Enter your current 6-digit PIN."; return; }
  if (mode !== "set" && !(await verifyPin(cur))) { if (status) status.textContent = "Current PIN is wrong."; return; }
  if (mode === "remove") { localStorage.removeItem(PIN_KEY); closePinSetup(); refreshPinSettings(); toast("App lock PIN turned off"); return; }
  if (nw.length !== 6) { if (status) status.textContent = "New PIN must be exactly 6 digits."; return; }
  if (nw !== cf) { if (status) status.textContent = "PINs do not match."; return; }
  if (nw === cur && mode === "change") { if (status) status.textContent = "Choose a PIN different from the current one."; return; }
  await savePin(nw);
  closePinSetup();
  refreshPinSettings();
  toast(mode === "change" ? "PIN changed" : "App lock PIN set");
}
function updatePinDots(): void {
  const n = cleanPin(($("pinLockInput") as HTMLInputElement | null)?.value || "").length;
  document.querySelectorAll("#pinDots span").forEach((s, i) => s.classList.toggle("on", i < n));
}
function showPinLock(): void {
  if (!hasAnyAppLock() || !state.userId) return;
  const hasPin = hasAppPin();
  const hasBio = hasBiometricLock();
  const inp = $("pinLockInput") as HTMLInputElement | null;
  if (inp) inp.value = "";
  updatePinDots();
  const st = $("pinLockStatus");
  if (st) st.textContent = "";
  $("pinEntryBlock")?.classList.toggle("hidden", !hasPin);
  $("pinLockBiometricBtn")?.classList.toggle("hidden", !hasBio);
  const sub = $("pinLockSubtitle");
  if (sub) {
    sub.textContent = hasPin && hasBio
      ? "Use Fingerprint / Face Unlock or enter your 6-digit PIN."
      : hasBio
        ? "Verify your Fingerprint or Face ID to continue."
        : "Enter your 6-digit PIN to continue.";
  }
  $("pinLockOverlay")?.classList.remove("hidden");
  if (hasPin) setTimeout(() => inp?.focus(), 50);
  if (hasBio && !bioAutoPrompted) {
    bioAutoPrompted = true;
    setTimeout(() => { unlockWithBiometrics(true); }, 180);
  }
}
export function checkAppLock(): void {
  refreshPinSettings();
  if (hasAnyAppLock()) showPinLock();
}

/* ==================== PWA INSTALL PROMPT (ANDROID / DESKTOP / IOS) ==================== */
let deferredInstallPrompt: any = null;
let androidBannerDismissed = false;
try {
  androidBannerDismissed = sessionStorage.getItem("eesi-android-banner-dismissed") === "1";
} catch {}

function isStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}
function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}
function isAndroidDevice(): boolean {
  return /android/i.test(navigator.userAgent);
}

export async function syncAndroidDevicePrefsToDb(installed?: boolean): Promise<void> {
  if (!state.userId || !runtime.client || !navigator.onLine) return;
  const s = notificationSettings();
  const soundName = localStorage.getItem("eesi-sound") || "bright";
  const platform = isAndroidDevice() ? "android" : isIosDevice() ? "ios" : "web";
  try {
    await runtime.client.rpc("register_android_device_prefs", {
      p_platform: platform,
      p_sound_enabled: s.enabled && soundName !== "off",
      p_sound_name: soundName,
      p_vibration_enabled: s.vibration,
      p_is_installed: installed ?? isStandaloneMode(),
      p_user_agent: navigator.userAgent,
    });
  } catch {}
}

export async function activateAndroidSoundAndVibration(): Promise<void> {
  try {
    localStorage.setItem("eesi-notifications", "on");
    localStorage.setItem("eesi-vibration", "on");
    const curSound = localStorage.getItem("eesi-sound") || "bright";
    if (curSound === "off") localStorage.setItem("eesi-sound", "bright");
  } catch {}

  const sn = $("settingNotifications") as HTMLInputElement | null;
  const sv = $("settingVibration") as HTMLInputElement | null;
  const ss = $("settingSound") as HTMLSelectElement | null;
  if (sn) sn.checked = true;
  if (sv) sv.checked = true;
  if (ss && ss.value === "off") ss.value = "bright";

  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === "suspended") {
    try { await ctx.resume(); } catch {}
  }

  let perm: NotificationPermission = "Notification" in window ? Notification.permission : "denied";
  if ("Notification" in window && Notification.permission !== "granted") {
    try { perm = await Notification.requestPermission(); } catch {}
  }

  if ("vibrate" in navigator) {
    try { navigator.vibrate([220, 90, 220, 90, 320]); } catch {}
  }
  playSettingSound(true);
  if (state.userId) {
    void enablePush(true);
    void syncAndroidDevicePrefsToDb(isStandaloneMode());
  }

  const stEl = $("androidAlertsStatus");
  if (stEl) {
    stEl.textContent = perm === "granted"
      ? "✅ Sound chime & vibration enabled! Alerts will ring and vibrate."
      : "🔊 In-app sound & vibration active! Allow browser notifications for lock-screen push alerts.";
  }
  toast("Android sound & vibration activated!");
}

export function refreshPwaInstallUi(): void {
  const standalone = isStandaloneMode();
  const ios = isIosDevice();
  const android = isAndroidDevice();
  const canShowPrompt = !standalone && (!!deferredInstallPrompt || ios || android);
  ["headerInstallBtn", "authInstallBtn", "settingsInstallBtn"].forEach(id => {
    const el = $(id);
    if (!el) return;
    if (standalone) {
      el.classList.add("hidden");
    } else if (id === "settingsInstallBtn") {
      el.classList.remove("hidden");
    } else {
      el.classList.toggle("hidden", !canShowPrompt);
    }
  });

  const banner = $("androidInstallBanner");
  if (banner) {
    const showBanner = !standalone && !androidBannerDismissed && (android || !!deferredInstallPrompt || ios);
    banner.classList.toggle("hidden", !showBanner);
  }

  const sheetInstallBtn = $("androidSheetInstallBtn");
  if (sheetInstallBtn) {
    if (standalone) {
      sheetInstallBtn.classList.add("hidden");
    } else {
      sheetInstallBtn.classList.remove("hidden");
      sheetInstallBtn.textContent = deferredInstallPrompt
        ? "📲 Install Official Android App Now"
        : ios
          ? "📲 Follow Safari Steps Below to Install"
          : "📲 How to Install on Android Home Screen";
    }
  }
}

export function dismissAndroidInstallBanner(): void {
  androidBannerDismissed = true;
  try { sessionStorage.setItem("eesi-android-banner-dismissed", "1"); } catch {}
  $("androidInstallBanner")?.classList.add("hidden");
}

export async function installFromAndroidSheet(): Promise<void> {
  if (isStandaloneMode()) {
    toast("EESI Elevators, Inc. is already installed!");
    closeIosInstallModal();
    return;
  }
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      refreshPwaInstallUi();
      if (outcome === "accepted") {
        void activateAndroidSoundAndVibration();
        void syncAndroidDevicePrefsToDb(true);
        closeIosInstallModal();
        toast("Installing official EESI Elevators, Inc. app…");
      }
      return;
    } catch {}
  }
  const steps = $("androidInstallStepsBox");
  if (steps) {
    steps.scrollIntoView({ behavior: "smooth", block: "nearest" });
    steps.style.borderColor = "var(--cyan)";
  }
  toast(isIosDevice() ? "Tap Safari Share (↑) → Add to Home Screen" : "Tap Chrome menu ⋮ → Install app / Add to Home screen");
}

export async function triggerPwaInstall(): Promise<void> {
  if (isStandaloneMode()) {
    toast("EESI Elevators, Inc. is already installed!");
    return;
  }
  if (!isAndroidDevice() && !isIosDevice() && deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      refreshPwaInstallUi();
      if (outcome === "accepted") {
        void activateAndroidSoundAndVibration();
        void syncAndroidDevicePrefsToDb(true);
        toast("Installing EESI Elevators, Inc.…");
      }
      return;
    } catch {}
  }
  // Open Android Material-style Install & Sound/Vibration bottom sheet
  $("iosInstallOverlay")?.classList.remove("hidden");
  refreshPwaInstallUi();
}

export function closeIosInstallModal(): void {
  $("iosInstallOverlay")?.classList.add("hidden");
}

export function initPwaInstall(): void {
  if (location.protocol.startsWith("http")) {
    if (import.meta.env.DEV) {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          let evicted = false;
          regs.forEach(reg => {
            const url = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || "";
            if (url.includes("dev-sw") || url.includes("/sw.js")) {
              evicted = true;
              void reg.unregister();
            }
          });
          if (evicted && "caches" in window) {
            caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
          }
        }).catch(() => {});
        navigator.serviceWorker.register("/push-sw.js").catch(() => {});
      }
    } else {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() { void updateSW(true); },
        onRegisteredSW(_url, reg) { if (reg) void reg.update(); },
        onRegisterError() {},
      });
    }
  }
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    refreshPwaInstallUi();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    refreshPwaInstallUi();
    if ("vibrate" in navigator) {
      try { navigator.vibrate([180, 80, 260]); } catch {}
    }
    playSettingSound(true);
    void syncAndroidDevicePrefsToDb(true);
    toast("EESI Elevators, Inc. installed with sound & vibration alerts!");
  });
  window.matchMedia("(display-mode: standalone)").addEventListener("change", refreshPwaInstallUi);
  refreshPwaInstallUi();
}

/* ==================== WEATHER + SESSION ATMOSPHERE + 1S AUTO SYNC ==================== */
let clockTimer: any = null;
let weatherAutoSyncTimer: any = null;
let weatherGeoProbeInFlight = false;
let weatherFetchInFlight = false;
let lastWeatherGeoProbeAt = 0;
let lastWeatherUiHtml: {
  temp: string;
  feels: string;
  rh: string;
  wind: string;
  rainChanceStr: string;
  icon: string;
  label: string;
  placeName: string;
} | null = null;
const WEATHER_API_REFRESH_MS = 15000;
const weatherPlaceCache = new Map<string, string>();

export type TimeSessionSlot = "daytime" | "noontime" | "sunset" | "nighttime" | "midnight";
export type WeatherAtmosphereKind = "clear" | "cloudy" | "rain" | "storm";

export function getTimeSessionSlot(now = new Date()): TimeSessionSlot {
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins >= 330 && mins < 660) return "daytime";    // 05:30 – 10:59
  if (mins >= 660 && mins < 960) return "noontime";   // 11:00 – 15:59
  if (mins >= 960 && mins < 1110) return "sunset";    // 16:00 – 18:29
  if (mins >= 1110 && mins < 1410) return "nighttime"; // 18:30 – 23:29
  return "midnight";                                   // 23:30 – 05:29
}

export function getWeatherAtmosphereKind(code = runtime.lastWeatherCode): WeatherAtmosphereKind {
  const c = Number(code);
  if (c >= 95) return "storm";
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "rain";
  if (c === 2 || c === 3 || c === 45 || c === 48) return "cloudy";
  return "clear";
}

export function applyAmbientSessionBackground(): {
  pref: string;
  timeSlot: TimeSessionSlot | "off";
  weatherKind: WeatherAtmosphereKind;
  label: string;
} {
  const pref = localStorage.getItem("eesi-atmosphere") || "auto";
  runtime.atmosphereSession = pref;
  const body = document.body;
  if (!body) {
    return { pref, timeSlot: "daytime", weatherKind: "clear", label: "Daytime" };
  }

  if (pref === "off") {
    body.setAttribute("data-atmos", "off");
    body.removeAttribute("data-atmos-time");
    body.removeAttribute("data-atmos-weather");
    return { pref, timeSlot: "off", weatherKind: "clear", label: "Solid Theme" };
  }

  body.setAttribute("data-atmos", pref);
  const autoSlot = getTimeSessionSlot();
  let timeSlot: TimeSessionSlot = autoSlot;
  let weatherKind: WeatherAtmosphereKind = getWeatherAtmosphereKind();

  if (pref === "daytime" || pref === "noontime" || pref === "sunset" || pref === "nighttime" || pref === "midnight") {
    timeSlot = pref;
    weatherKind = "clear";
  } else if (pref === "rain" || pref === "storm") {
    weatherKind = pref;
  }

  body.setAttribute("data-atmos-time", timeSlot);
  body.setAttribute("data-atmos-weather", weatherKind);

  const timeNames: Record<TimeSessionSlot, string> = {
    daytime: "🌅 Daytime",
    noontime: "☀️ Noontime",
    sunset: "🌇 Sunset",
    nighttime: "🌙 Nighttime",
    midnight: "🌌 Midnight",
  };
  const weatherNames: Record<WeatherAtmosphereKind, string> = {
    clear: "Clear",
    cloudy: "Cloudy",
    rain: "Rainy",
    storm: "Stormy",
  };
  const label = `${timeNames[timeSlot]} · ${weatherNames[weatherKind]}`;
  const pillEl = $("liveAtmospherePill");
  if (pillEl) pillEl.textContent = label;
  return { pref, timeSlot, weatherKind, label };
}

export function startClock(): void {
  const tick = () => {
    const el = $("liveClock");
    if (el) el.textContent = new Date().toLocaleString(undefined, { dateStyle: "full", timeStyle: "medium" });
    applyAmbientSessionBackground();
  };
  tick();
  clearInterval(clockTimer);
  clockTimer = setInterval(tick, 1000);
}

function weatherCodeInfo(code: number, isDay = 1): { icon: string; label: string } {
  const c = Number(code);
  if (c === 0) return { icon: isDay ? "☀️" : "🌙", label: "Clear sky" };
  if (c === 1) return { icon: isDay ? "🌤️" : "🌙", label: "Mostly clear" };
  if (c === 2) return { icon: "⛅", label: "Partly cloudy" };
  if (c === 3) return { icon: "☁️", label: "Overcast" };
  if (c === 45 || c === 48) return { icon: "🌫️", label: "Foggy" };
  if (c >= 51 && c <= 57) return { icon: "🌦️", label: "Drizzle" };
  if (c >= 61 && c <= 67) return { icon: "🌧️", label: c >= 65 ? "Heavy rain" : "Rain" };
  if (c >= 80 && c <= 82) return { icon: "🌦️", label: c === 82 ? "Heavy showers" : "Rain showers" };
  if (c >= 95) return { icon: "⛈️", label: "Thunderstorm" };
  return { icon: "🌤️", label: "Fair" };
}

async function resolveWeatherPlaceName(lat: number, lon: number): Promise<string> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (weatherPlaceCache.has(key)) return weatherPlaceCache.get(key)!;
  try {
    const saved = JSON.parse(localStorage.getItem("eesi-weather-places") || "{}");
    if (saved && typeof saved[key] === "string" && saved[key]) {
      weatherPlaceCache.set(key, saved[key]);
      return saved[key];
    }
  } catch {}

  let place = "";
  try {
    const r = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng: lon }),
    });
    if (r.ok) {
      const data: any = await r.json();
      const city = String(data?.city || "").trim();
      const addr = String(data?.formattedAddress || "").trim();
      if (city) place = city;
      else if (addr) place = addr.split(",").slice(0, 2).join(", ").trim();
    }
  } catch {}

  if (!place) {
    try {
      const nom = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&zoom=14`
      );
      if (nom.ok) {
        const j: any = await nom.json();
        const a = j?.address || {};
        const sub = a.suburb || a.neighbourhood || a.quarter || a.village || a.barangay || "";
        const city = a.city || a.town || a.municipality || a.county || a.state || "";
        place = [sub, city].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", ");
      }
    } catch {}
  }

  if (!place) place = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  weatherPlaceCache.set(key, place);
  try {
    const saved = JSON.parse(localStorage.getItem("eesi-weather-places") || "{}");
    saved[key] = place;
    localStorage.setItem("eesi-weather-places", JSON.stringify(saved));
  } catch {}
  return place;
}

function renderLiveWeatherCard(): void {
  const el = $("liveWeather");
  if (!el) return;
  const atmos = applyAmbientSessionBackground();
  const gpsTag = runtime.hasLiveGpsLock
    ? `🟢 Live GPS${runtime.lastWeatherAcc ? ` ±${runtime.lastWeatherAcc}m` : ""} · Auto 1s`
    : "📡 Auto-syncing GPS every 1s…";

  if (!lastWeatherUiHtml) {
    el.innerHTML =
      `<div class="muted" style="font-size:13px;">${esc(gpsTag)}</div>` +
      `<div id="liveAtmospherePill" class="atmos-pill">${esc(atmos.label)}</div>`;
    return;
  }

  const d = lastWeatherUiHtml;
  const subParts = [
    `📍 ${d.placeName} (${gpsTag})`,
    [d.rh, d.wind, d.rainChanceStr].filter(Boolean).join(" · "),
  ].filter(Boolean);

  el.innerHTML =
    `<div>${d.icon} <b>${esc(d.temp)}</b> · ${esc(d.label)}${d.feels ? ` <span class="muted" style="font-size:13px;font-weight:500;">(${esc(d.feels)})</span>` : ""}</div>` +
    `<div class="muted" style="font-size:12px;margin-top:4px;line-height:1.45;">${subParts.map(esc).join("<br>")}</div>` +
    `<div id="liveAtmospherePill" class="atmos-pill">${esc(atmos.label)}</div>`;
}

export async function updateLiveWeather(
  latArg?: number,
  lonArg?: number,
  opts?: { fromGps?: boolean; accuracy?: number; force?: boolean }
): Promise<void> {
  const cachedGps = hooks.getCachedGps?.();
  let lat = typeof latArg === "number" && Number.isFinite(latArg) ? latArg : undefined;
  let lon = typeof lonArg === "number" && Number.isFinite(lonArg) ? lonArg : undefined;
  let fromGps = Boolean(opts?.fromGps);
  let acc = typeof opts?.accuracy === "number" ? Math.round(opts.accuracy) : runtime.lastWeatherAcc;

  if (lat == null || lon == null) {
    if (cachedGps && Number.isFinite(cachedGps.lat) && Number.isFinite(cachedGps.lng)) {
      lat = cachedGps.lat;
      lon = cachedGps.lng;
      fromGps = true;
      acc = Math.round(cachedGps.acc || acc || 0);
    } else if (!runtime.hasLiveGpsLock && "geolocation" in navigator && !weatherGeoProbeInFlight) {
      weatherGeoProbeInFlight = true;
      lastWeatherGeoProbeAt = Date.now();
      renderLiveWeatherCard();
      navigator.geolocation.getCurrentPosition(
        pos => {
          weatherGeoProbeInFlight = false;
          void updateLiveWeather(pos.coords.latitude, pos.coords.longitude, {
            fromGps: true,
            accuracy: pos.coords.accuracy,
            force: true,
          });
        },
        () => {
          weatherGeoProbeInFlight = false;
          if (!runtime.hasLiveGpsLock) {
            void updateLiveWeather(runtime.lastWeatherLat, runtime.lastWeatherLon, { fromGps: false });
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      );
      return;
    } else {
      lat = runtime.lastWeatherLat;
      lon = runtime.lastWeatherLon;
      fromGps = runtime.hasLiveGpsLock;
    }
  }

  const resolvedLat: number = lat ?? runtime.lastWeatherLat;
  const resolvedLon: number = lon ?? runtime.lastWeatherLon;
  const coordsChanged =
    Math.abs(resolvedLat - runtime.lastWeatherLat) > 0.0015 ||
    Math.abs(resolvedLon - runtime.lastWeatherLon) > 0.0015;
  const newlyLocked = fromGps && !runtime.hasLiveGpsLock;

  runtime.lastWeatherLat = resolvedLat;
  runtime.lastWeatherLon = resolvedLon;
  if (fromGps) {
    runtime.hasLiveGpsLock = true;
    if (acc > 0) runtime.lastWeatherAcc = acc;
  }

  const age = Date.now() - (runtime.lastWeatherUpdatedAt || 0);
  if (!opts?.force && !newlyLocked && !coordsChanged && lastWeatherUiHtml && age < WEATHER_API_REFRESH_MS) {
    renderLiveWeatherCard();
    return;
  }
  if (weatherFetchInFlight) return;
  weatherFetchInFlight = true;

  try {
    const [weatherRes, placeName] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${resolvedLat}&longitude=${resolvedLon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,is_day&hourly=precipitation_probability&forecast_days=1&timezone=auto`
      ),
      resolveWeatherPlaceName(resolvedLat, resolvedLon),
    ]);
    const j = await weatherRes.json();
    const c = j.current || {};
    const wCode = Number(c.weather_code ?? 0);
    const isDay = Number(c.is_day ?? 1);
    const info = weatherCodeInfo(wCode, isDay);
    const temp = c.temperature_2m != null ? `${c.temperature_2m}°C` : "—";
    const feels = c.apparent_temperature != null ? `Feels ${c.apparent_temperature}°C` : "";
    const rh = c.relative_humidity_2m != null ? `💧 ${c.relative_humidity_2m}%` : "";
    const wind = c.wind_speed_10m != null ? `💨 ${c.wind_speed_10m} km/h` : "";
    let rainChanceStr = "";
    if (Array.isArray(j.hourly?.precipitation_probability) && Array.isArray(j.hourly?.time) && c.time) {
      const curHourPrefix = String(c.time).slice(0, 13);
      const idx = j.hourly.time.findIndex((t: string) => String(t).startsWith(curHourPrefix));
      const prob = idx >= 0 ? j.hourly.precipitation_probability[idx] : j.hourly.precipitation_probability[0];
      if (prob != null) rainChanceStr = `☔ ${prob}% rain`;
    }

    runtime.lastWeatherCode = wCode;
    runtime.lastWeatherIsDay = isDay;
    runtime.lastWeatherTemp = c.temperature_2m != null ? Number(c.temperature_2m) : null;
    runtime.lastWeatherLabel = info.label;
    runtime.lastWeatherPlace = placeName;
    runtime.lastWeatherUpdatedAt = Date.now();

    lastWeatherUiHtml = {
      temp,
      feels,
      rh,
      wind,
      rainChanceStr,
      icon: info.icon,
      label: info.label,
      placeName,
    };
    renderLiveWeatherCard();
  } catch {
    renderLiveWeatherCard();
  } finally {
    weatherFetchInFlight = false;
  }
}

export function startAutoWeatherSyncLoop(): void {
  clearInterval(weatherAutoSyncTimer);
  const syncTick = () => {
    const cachedGps = hooks.getCachedGps?.();
    if (cachedGps && Number.isFinite(cachedGps.lat) && Number.isFinite(cachedGps.lng)) {
      const moved =
        !runtime.hasLiveGpsLock ||
        Math.abs(cachedGps.lat - runtime.lastWeatherLat) > 0.0015 ||
        Math.abs(cachedGps.lng - runtime.lastWeatherLon) > 0.0015;
      const stale = Date.now() - (runtime.lastWeatherUpdatedAt || 0) >= WEATHER_API_REFRESH_MS;
      void updateLiveWeather(cachedGps.lat, cachedGps.lng, {
        fromGps: true,
        accuracy: cachedGps.acc,
        force: moved || stale,
      });
    } else {
      if ("geolocation" in navigator && !weatherGeoProbeInFlight && Date.now() - lastWeatherGeoProbeAt >= 3000) {
        weatherGeoProbeInFlight = true;
        lastWeatherGeoProbeAt = Date.now();
        navigator.geolocation.getCurrentPosition(
          pos => {
            weatherGeoProbeInFlight = false;
            void updateLiveWeather(pos.coords.latitude, pos.coords.longitude, {
              fromGps: true,
              accuracy: pos.coords.accuracy,
              force: true,
            });
          },
          () => {
            weatherGeoProbeInFlight = false;
          },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 4000 }
        );
      }
      void updateLiveWeather();
    }
  };
  syncTick();
  weatherAutoSyncTimer = setInterval(syncTick, 1000);
}

/* ==================== PULL TO RELOAD (REMOVED) ==================== */
export function initPullToReload(): void {
  // Auto-reload on pull removed per user request so scrolling remains steady.
}

/* ==================== SETTINGS WIRING ==================== */
export function initSettingsWiring(): void {
  wireAudioGestureUnlock();
  const sn = $("settingNotifications") as HTMLInputElement | null;
  const sv = $("settingVibration") as HTMLInputElement | null;
  const ss = $("settingSound") as HTMLSelectElement | null;
  const sd = $("settingAlertDuration") as HTMLSelectElement | null;
  const scd = $("settingCustomAlertDuration") as HTMLSelectElement | null;

  if (sn) sn.checked = localStorage.getItem("eesi-notifications") !== "off";
  if (sv) sv.checked = localStorage.getItem("eesi-vibration") !== "off";
  if (ss) ss.value = localStorage.getItem("eesi-sound") || "bright";
  if (sd) sd.value = localStorage.getItem("eesi-alert-duration") || "15";
  if (scd) scd.value = localStorage.getItem("eesi-custom-alert-duration") || "15";
  setSoundSource(localStorage.getItem("eesi-sound-source") || "built-in");

  $("closeDailyVerseButton")?.addEventListener("click", () => $("dailyVerseOverlay")?.classList.add("hidden"));

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", e => {
      if (e.data && e.data.type === "open-thread") openPushThread(e.data.threadId);
      if (e.data && e.data.type === "open-page" && e.data.page) hooks.go?.(String(e.data.page));
      if (e.data && e.data.type === "push-received") {
        triggerAlert(
          String(e.data.title || "EESI Elevators, Inc."),
          String(e.data.body || ""),
          Array.isArray(e.data.vibrate) ? e.data.vibrate : [260, 110, 260, 110, 380]
        );
      }
    });
  }

  $("settingsMenu")?.addEventListener("change", resetSettingsTimer);
  $("settingsMenu")?.addEventListener("click", e => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "BUTTON" || t.tagName === "SELECT" || t.tagName === "INPUT")) resetSettingsTimer();
  });

  ss?.addEventListener("change", () => {
    localStorage.setItem("eesi-sound", ss.value);
    if (ss.value === "off") stopSettingSound();
    toast("Sound setting saved");
  });

  $("builtInSoundChoice")?.addEventListener("click", () => setSoundSource("built-in"));
  $("customSoundChoice")?.addEventListener("click", () => setSoundSource("custom"));

  const soundFile = $("settingSoundFile") as HTMLInputElement | null;
  soundFile?.addEventListener("change", async () => {
    const file = soundFile.files?.[0];
    if (!file) return;
    if (!state.userId) { toast("Sign in first."); return; }
    if (!file.type.startsWith("audio/")) { toast("Choose an audio file."); return; }
    try {
      await saveRingtoneToDB(state.userId, file);
      toast("Custom ringtone saved: " + file.name);
    } catch (err: any) {
      toast("Could not save ringtone: " + (err?.message || err));
    }
  });

  $("clearSoundFileButton")?.addEventListener("click", async () => {
    stopSettingSound();
    if (soundFile) soundFile.value = "";
    if (state.userId) { try { await clearRingtoneFromDB(state.userId); } catch {} }
    toast("Custom ringtone cleared.");
  });

  sd?.addEventListener("change", () => {
    localStorage.setItem("eesi-alert-duration", sd.value);
    stopSettingSound();
    toast("Alert duration saved");
  });

  scd?.addEventListener("change", () => {
    localStorage.setItem("eesi-custom-alert-duration", scd.value);
    stopSettingSound();
    toast("Custom ringtone duration saved");
  });

  sn?.addEventListener("change", saveNotificationSettings);
  $("enablePushBtn")?.addEventListener("click", () => enablePush(false));
  sv?.addEventListener("change", saveNotificationSettings);

  $("closeSettingsButton")?.addEventListener("click", () => {
    $("settingsMenu")?.classList.add("hidden");
    clearTimeout(settingsAutoCloseTimer);
  });

  $("displaySettingsBtn")?.addEventListener("click", () => {
    const p = $("displaySettingsPanel");
    if (!p) return;
    const opening = p.classList.contains("hidden");
    p.classList.toggle("hidden");
    if (opening) $("appSettingsPanel")?.classList.add("hidden");
    resetSettingsTimer();
  });

  $("appSettingsBtn")?.addEventListener("click", () => {
    const p = $("appSettingsPanel");
    if (!p) return;
    const opening = p.classList.contains("hidden");
    p.classList.toggle("hidden");
    if (opening) $("displaySettingsPanel")?.classList.add("hidden");
    resetSettingsTimer();
  });

  $("settingTextSize")?.addEventListener("change", () => {
    localStorage.setItem("eesi-text-size", ($("settingTextSize") as HTMLSelectElement).value);
    applyDisplaySettings();
  });
  $("settingCompact")?.addEventListener("change", () => {
    localStorage.setItem("eesi-compact", ($("settingCompact") as HTMLInputElement).checked ? "on" : "off");
    applyDisplaySettings();
  });
  $("settingDecor")?.addEventListener("change", () => {
    localStorage.setItem("eesi-decor", ($("settingDecor") as HTMLSelectElement).value);
    renderDecor();
  });
  $("settingFont")?.addEventListener("change", () => {
    localStorage.setItem("eesi-font", ($("settingFont") as HTMLSelectElement).value);
    applyDisplaySettings();
  });
  $("settingWeight")?.addEventListener("change", () => {
    localStorage.setItem("eesi-font-weight", ($("settingWeight") as HTMLSelectElement).value);
    applyDisplaySettings();
  });
  $("settingStyle")?.addEventListener("change", () => {
    localStorage.setItem("eesi-font-style", ($("settingStyle") as HTMLSelectElement).value);
    applyDisplaySettings();
  });
  $("settingTheme")?.addEventListener("change", () => {
    const val = ($("settingTheme") as HTMLSelectElement).value;
    localStorage.setItem("eesi-theme", val);
    applyTheme(val);
    applyAmbientSessionBackground();
  });
  $("settingAtmosphere")?.addEventListener("change", () => {
    const val = ($("settingAtmosphere") as HTMLSelectElement).value;
    localStorage.setItem("eesi-atmosphere", val);
    applyDisplaySettings();
    renderLiveWeatherCard();
  });

  const wmFile = $("settingWatermarkFile") as HTMLInputElement | null;
  wmFile?.addEventListener("change", async () => {
    const f = wmFile.files?.[0];
    wmFile.value = "";
    if (!f) return;
    if (!isImageFile(f)) { toast("Please select an image file for watermark."); return; }
    try {
      const dataUrl = await compressImageToDataUrl(f, 1280, 1280, 0.8);
      localStorage.setItem(watermarkImgKey(), dataUrl);
      localStorage.setItem("eesi-watermark-img:default", dataUrl);
      applyWatermark();
      toast("Background watermark applied");
    } catch (err: any) {
      toast("Could not apply watermark: " + (err?.message || err));
    }
  });
  $("settingWatermarkOpacity")?.addEventListener("input", e => {
    const el = e.target as HTMLInputElement;
    setWatermarkOpacity(el.value);
  });

  $("pinLockInput")?.addEventListener("input", async () => {
    const input = $("pinLockInput") as HTMLInputElement;
    input.value = cleanPin(input.value);
    updatePinDots();
    if (input.value.length !== 6) return;
    const status = $("pinLockStatus");
    const waitSec = Math.ceil((pinLockedUntil - Date.now()) / 1000);
    if (waitSec > 0) {
      if (status) status.textContent = "Too many wrong tries. Wait " + waitSec + " seconds.";
      input.value = "";
      updatePinDots();
      return;
    }
    if (await verifyPin(input.value)) {
      pinFailures = 0;
      input.value = "";
      updatePinDots();
      if (status) status.textContent = "";
      $("pinLockOverlay")?.classList.add("hidden");
      return;
    }
    pinFailures++;
    input.value = "";
    updatePinDots();
    if (pinFailures >= 5) {
      pinFailures = 0;
      pinLockedUntil = Date.now() + 30000;
      if (status) status.textContent = "Too many wrong tries. Wait 30 seconds.";
    } else if (status) {
      status.textContent = "Wrong PIN. " + (5 - pinFailures) + " tries left.";
    }
    const card = document.querySelector("#pinLockOverlay .card") as HTMLElement | null;
    if (card) {
      card.classList.remove("pin-shake");
      void card.offsetWidth;
      card.classList.add("pin-shake");
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { lastHiddenAt = Date.now(); return; }
    if (lastHiddenAt && Date.now() - lastHiddenAt > 30000) showPinLock();
    if (state.userId) hooks.checkShiftReminders?.();
  });

  document.addEventListener("click", e => {
    const menu = $("settingsMenu");
    if (!menu || menu.classList.contains("hidden")) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest("#settingsMenu") || t?.closest("[onclick='toggleSettingsMenu()']")) return;
    menu.classList.add("hidden");
  });

  applyAmbientSessionBackground();
  renderDecor();
  startAutoWeatherSyncLoop();
}
