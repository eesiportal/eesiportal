declare global {
  interface Window {
    supabase: any;
    html2canvas: any;
    [key: string]: any;
  }
}

export const SUPABASE_URL = "https://subzomvuyxvzhhlpsyrf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0q5GP8Z8dgltw88xuLdg7g_T56LYzBX";
export const VAPID_PUBLIC_KEY = "BNT3Q6NqxPufbX4RitFEzRCa3izXGcV3wYgP71J1hZfRmpvleiryAIFmW0rfB_kyaXywdWxJJ5dC2RVV1kER4iM";
export const PUSH_READY = !!VAPID_PUBLIC_KEY && !VAPID_PUBLIC_KEY.startsWith("REPLACE_");
export const BLANK_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  representative: "Selective Representative",
  technician: "Technician",
  employee: "Employee",
};

export const DAILY_VERSES = [
  { text: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
  { text: "Be strong and courageous. Do not be afraid.", reference: "Joshua 1:9" },
  { text: "Trust in the Lord with all your heart.", reference: "Proverbs 3:5" },
  { text: "I can do all things through Christ who strengthens me.", reference: "Philippians 4:13" },
  { text: "For I know the plans I have for you, declares the Lord.", reference: "Jeremiah 29:11" },
  { text: "Commit to the Lord whatever you do, and he will establish your plans.", reference: "Proverbs 16:3" },
  { text: "The Lord is my light and my salvation—whom shall I fear?", reference: "Psalm 27:1" },
];

export const PMS_ITEMS: Record<"elevator" | "escalator", Array<[string, string[]]>> = {
  elevator: [
    ["1. Machine Room & Control", [
      "Check controller panel indicators and fault log",
      "Inspect main drive motor / traction machine",
      "Check brake lining, coil, and plunger action",
      "Inspect gear oil level and leaks",
      "Verify governor overspeed switch and rope",
      "Check machine room temperature & ventilation",
    ]],
    ["2. Hoistway & Car Top", [
      "Inspect main hoist ropes and terminations",
      "Check car & counterweight guide rail lubrication",
      "Inspect door operator motor, belt, and rollers",
      "Verify car top stop switch and inspection box",
      "Check hoistway limit switches & vane alignment",
    ]],
    ["3. Car Interior & Landing Doors", [
      "Test emergency alarm bell & intercom",
      "Test emergency car lighting",
      "Test door safety edge / light curtain",
      "Inspect landing door locks & gibs at all floors",
      "Check leveling accuracy at each floor",
    ]],
    ["4. Pit & Safety", [
      "Inspect pit stop switch & pit lighting",
      "Check buffers (oil level / spring condition)",
      "Check governor tension sheave & switch",
      "Clean pit floor and verify dry condition",
    ]],
  ],
  escalator: [
    ["1. Top & Bottom Machine Rooms", [
      "Inspect main drive chain, sprockets, and tension",
      "Check drive motor & brake assembly",
      "Check gear reducer oil level & noise",
      "Verify controller fault log & safety circuit",
      "Clean machine spaces and check pit dryness",
    ]],
    ["2. Steps, Combplates & Skirt", [
      "Inspect step treads, risers, and yellow demarcation",
      "Check combplate teeth alignment and clearance",
      "Verify combplate impact safety switch",
      "Check skirt brush & skirt panel clearances",
      "Check step chain tension and lubrication",
    ]],
    ["3. Handrails & Safety Switches", [
      "Check handrail speed synchronization with steps",
      "Inspect handrail belt surface & entry guards",
      "Test handrail entry safety switches",
      "Test emergency stop buttons (top & bottom)",
      "Verify key switch, directional indicators & lighting",
    ]],
  ],
};

export interface AppState {
  userId: string | null;
  email: string | null;
  role: string | null;
  profile: any;
  profiles: any[];
  roles: Record<string, { app_role: string; area?: string; approval_status?: string }>;
  presence: Record<string, any>;
  announcements: any[];
  pending: any[];
  appNotifications: any[];
  approvalNotifications: any[];
  leaveRequests: any[];
  pmsRecords: any[];
  recentChatNotices: any[];
  units: any[];
  threads: any[];
  unread: Record<string, number>;
  previews: Record<string, any>;
  chatFilter: string;
  activeThread: string | null;
  messages: any[];
  sites: any[];
  schedules: any[];
  dtrs: any[];
  dtrTimeLogs: any[];
  notes: any[];
  recs: any[];
  reports: any[];
  reportType: string;
  setupIssue: string;
  booted: boolean;
  blockedUsers: string[];
  stories: any[];
  payslips: any[];
}

export const state: AppState = {
  userId: null,
  email: null,
  role: null,
  profile: null,
  profiles: [],
  roles: {},
  presence: {},
  announcements: [],
  pending: [],
  appNotifications: [],
  approvalNotifications: [],
  leaveRequests: [],
  pmsRecords: [],
  recentChatNotices: [],
  units: [],
  threads: [],
  unread: {},
  previews: {},
  chatFilter: "all",
  activeThread: null,
  messages: [],
  sites: [],
  schedules: [],
  dtrs: [],
  dtrTimeLogs: [],
  notes: [],
  recs: [],
  reports: [],
  reportType: "service",
  setupIssue: "",
  booted: false,
  blockedUsers: [],
  stories: [],
  payslips: [],
};

export const runtime = {
  client: null as any,
  APP_REDIRECT_URL: "",
  editingReportId: null as string | null,
  editingExistingUrls: [] as string[],
  pendingReportFiles: [] as Array<{ file: File; previewUrl: string }>,
  pendingPmsFiles: [] as Array<{ file: File; previewUrl: string }>,
  editingAnnouncementId: null as string | null,
  editingSiteId: null as string | null,
  editingUnitId: null as string | null,
  selectedUnitsSiteId: null as string | null,
  editingLeaveId: null as string | null,
  adminRoleFilter: "all" as string,
  editingMessageId: null as string | null,
  replyingToMsg: null as any,
  currentPage: "home",
  currentNoteTab: "notes" as "notes" | "recs",
  currentDtrTab: "fill" as "fill" | "time_log" | "preview",
  timeLogMode: "time_in" as "time_in" | "time_out",
  timeLogModeManual: false,
  unitsRegion: "ALL",
  unitsLocationFilter: "ALL",
  unitsSideFilter: "ALL",
  unitsFloorFilter: "ALL",
  unitsDirFilter: "ALL" as "ALL" | "UP" | "DOWN" | "ELEVATOR",
  unitsShowAllInline: false,
  unitsTab: "list" as "list" | "manual",
  manualUnitId: null as string | null,
  expandedUnitSiteIds: {} as Record<string, boolean>,
  editingDtrId: null as string | null,
  pmsRegion: "Luzon",
  pmsUnit: "elevator" as "elevator" | "escalator",
  pmsSiteId: null as string | null,
  reportsViewMode: "list" as "list" | "checklist" | "pms-records" | "search",
  suppressNotificationsUntil: 0,
  authRun: 0,
  booting: false,
  recoveryMode: false,
  isRegistering: false,
  dbReady: false,
  restoringView: false,
  locationWatchId: null as number | null,
  lastWeatherLat: 14.5995,
  lastWeatherLon: 120.9842,
  liveMapFilter: "all",
  isOnlineVerified: navigator.onLine,
  dtrTimeLogsTableMissing: false,
  dtrApprovedByColMissing: false,
  storiesTableMissing: false,
  notificationDismissalsTableMissing: false,
  payslipsTableMissing: false,
  editingPayslipId: null as string | null,
  activeDtrSigDataUrl: "" as string,
  amcbSeedAttempted: false,
  dtrCutoffKey: "",
  tickerIndex: 0,
  tickerQueueKey: "",
  selectedSiteId: null as string | null,
  siteMapTravelMode: "DRIVING" as "DRIVING" | "WALKING" | "TWO_WHEELER",
  siteMapLayer: "roadmap" as "roadmap" | "satellite",
  sitesRegionFilter: "ALL" as string,
  sitesStatusFilter: "ALL" as string,
  sitesExtraColsMissing: false,
  siteDistances: {} as Record<string, {
    status: "idle" | "loading" | "ready" | "no_route" | "no_gps" | "error";
    distanceMeters?: number;
    durationMillis?: number;
    distanceText?: string;
    durationText?: string;
    straightKm?: number;
    message?: string;
  }>,
  siteDistanceOriginKey: "",
  siteMetaNotices: {} as Record<string, { thumbnail_url?: string | null; status?: string | null; latitude?: number | null; longitude?: number | null; updated_at?: string }>,
};

export const hooks: Record<string, (...args: any[]) => any> = {
  go: () => {},
  renderAll: () => {},
  renderHome: () => {},
  renderMembers: () => {},
  renderOnline: () => {},
  renderPending: () => {},
  renderAdmin: () => {},
  renderAnnouncements: () => {},
  renderSchedules: () => {},
  renderAssigneesPicker: () => {},
  renderSites: () => {},
  renderUnits: () => {},
  renderUnitSiteOptions: () => {},
  renderDtr: () => {},
  renderDtrSiteOptions: () => {},
  renderNotes: () => {},
  renderRecs: () => {},
  renderNotices: () => {},
  renderReports: () => {},
  renderReportSites: () => {},
  renderSearchSiteOptions: () => {},
  renderPmsSiteOptions: () => {},
  renderPmsChecklist: () => {},
  renderPmsRecordsFilters: () => {},
  renderPmsRecords: () => {},
  renderLeave: () => {},
  renderLeaveBalances: () => {},
  renderChatList: () => {},
  renderMessages: () => {},
  openThread: async () => {},
  closeChat: () => {},
  cancelReply: () => {},
  updateSendBtn: () => {},
  isMuted: () => false,
  threadTitle: () => "Chat",
  startCallListener: () => {},
  stopCallListener: () => {},
  endActiveCall: () => {},
  hideIncoming: () => {},
  clearTyping: () => {},
  updateAccess: () => {},
  updateAnnouncementTicker: () => {},
  signOut: async () => {},
  showAuth: () => {},
  startLive: () => {},
  reloadEverything: async () => {},
  runSearch: () => {},
  dtrTab: () => {},
  switchNoteTab: () => {},
  openPmsChecklist: () => {},
  saveLastView: () => {},
  visibleSchedules: () => [],
  renderTimeLog: () => {},
  loadTimeLogs: async () => {},
  applyWatermark: () => {},
  checkShiftReminders: () => {},
  autoFillDtrFromSchedule: () => {},
  loadStories: async () => {},
  ensureAmcbUnitsSeeded: async () => {},
  openEditDtr: () => {},
  openTimemarkCamera: () => {},
  openSiteOnMap: () => {},
  refreshVisibleSiteDistances: async () => {},
  clearDtrAfterExport: async (_ids?: string[]) => {},
  canRunDtrThreeStepPdf: () => true,
  completeDtrExportStep: async (_step: "jpeg" | "print" | "pdf", _ids?: string[]) => {},
  renderLiveOnlineMembers: () => {},
  closeSiteUnitsOverlay: () => {},
  renderPayroll: () => {},
  evaluateDailySiteGeofence: () => {},
};

export const $ = (id: string): HTMLElement | null => document.getElementById(id);

export const val = (id: string): string =>
  (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value ?? "";

export const setVal = (id: string, v: string): void => {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (el) el.value = v;
};

export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] || c));
}

export function isManager(): boolean {
  return state.role === "admin" || state.role === "representative";
}
export function isAdmin(): boolean {
  return state.role === "admin";
}
export function roleLabel(r: string | null | undefined): string {
  return (r && ROLE_LABELS[r]) || r || "—";
}
export function suppressNotifications(ms = 5000): void {
  runtime.suppressNotificationsUntil = Date.now() + ms;
}
export function isWithinSelfActionWindow(): boolean {
  return Date.now() < runtime.suppressNotificationsUntil;
}

export function safeUrl(u: unknown): string | null {
  if (!u || typeof u !== "string") return null;
  if (/^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(u)) return u;
  if (u.startsWith(SUPABASE_URL + "/storage/v1/object/") && !/["'()\\\s<>]/.test(u)) return u;
  if (/^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\//i.test(u) && !/["'()\\\s<>]/.test(u)) return u;
  return null;
}

export function isImageUrl(u: unknown): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)(\?|#|$)/i.test(String(u || "")) || /^data:image\//i.test(String(u || ""));
}

let toastTimer: any = null;
export function toast(t: string): void {
  const box = $("toastBox");
  if (!box) return;
  box.textContent = t;
  box.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.add("hidden"), 2600);
}

export function checkNetwork(): boolean {
  if (!navigator.onLine) {
    $("offlineOverlay")?.classList.remove("hidden");
    $("offlineBanner")?.classList.remove("hidden");
    toast("No internet connection. Can't continue offline.");
    return false;
  }
  return true;
}

export function isImageFile(f: File): boolean {
  return (f.type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)$/i.test(f.name || "");
}

function loadBitmapOrImage(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close?: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width || 800,
        height: img.naturalHeight || img.height || 600,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        close: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

export async function prepareImageFile(file: File, maxDim = 1600, quality = 0.86): Promise<File> {
  if (!isImageFile(file)) return file;
  if (/\.gif$/i.test(file.name) && file.size <= 4 * 1024 * 1024) return file;
  try {
    const loaded = await loadBitmapOrImage(file);
    try {
      const scale = Math.min(1, maxDim / Math.max(loaded.width, loaded.height));
      const w = Math.max(1, Math.round(loaded.width * scale));
      const h = Math.max(1, Math.round(loaded.height * scale));
      if (scale === 1 && file.size <= 1.2 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/i.test(file.type)) {
        return file;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      loaded.draw(ctx, w, h);
      const outType = file.type === "image/png" && file.size < 1.5 * 1024 * 1024 ? "image/png" : "image/jpeg";
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, outType, quality));
      if (!blob) return file;
      const ext = outType === "image/png" ? ".png" : ".jpg";
      const baseName = (file.name || "photo").replace(/\.[^.]+$/, "");
      return new File([blob], baseName + ext, { type: outType, lastModified: Date.now() });
    } finally {
      loaded.close?.();
    }
  } catch {
    return file;
  }
}

export async function compressImageToDataUrl(file: File, maxW = 800, maxH = 360, quality = 0.85): Promise<string> {
  try {
    const loaded = await loadBitmapOrImage(file);
    try {
      const scale = Math.min(1, maxW / loaded.width, maxH / loaded.height);
      const w = Math.max(1, Math.round(loaded.width * scale));
      const h = Math.max(1, Math.round(loaded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      loaded.draw(ctx, w, h);
      return canvas.toDataURL("image/jpeg", quality);
    } finally {
      loaded.close?.();
    }
  } catch {
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("Could not read image"));
      r.readAsDataURL(file);
    });
  }
}

export function confirmDialog(message: string, title = "Confirm"): Promise<boolean> {
  return new Promise(resolve => {
    const overlay = $("confirmOverlay");
    const msgEl = $("confirmMessage");
    const titleEl = $("confirmTitle");
    const okBtn = $("confirmOkBtn");
    const cancelBtn = $("confirmCancelBtn");
    if (!overlay || !msgEl || !okBtn || !cancelBtn) {
      resolve(false);
      return;
    }
    if (titleEl) titleEl.textContent = title;
    msgEl.textContent = message;
    overlay.classList.remove("hidden");
    const cleanup = (result: boolean) => {
      overlay.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onBackdrop);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onBackdrop = (e: Event) => { if (e.target === overlay) cleanup(false); };
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onBackdrop);
  });
}

export function openSheet(html: string): void {
  const body = $("sheetBody");
  const sheet = $("sheet");
  if (body) body.innerHTML = html;
  if (sheet) sheet.classList.remove("hidden");
}
export function closeSheet(): void {
  const sheet = $("sheet");
  const body = $("sheetBody");
  if (sheet) sheet.classList.add("hidden");
  if (body) body.innerHTML = "";
}
export function sheetClose(): string {
  return '<button class="gray" style="width:100%;margin-top:10px" type="button" data-act="close-sheet">Close</button>';
}
export function openPhotoPreview(url: string, label = "Photo", deleteTimeLogId?: string): void {
  const safe = safeUrl(url);
  if (!safe) return;
  openSheet(
    `<h2>${esc(label)}</h2>` +
    `<img src="${esc(safe)}" alt="${esc(label)}" style="width:100%;max-height:65vh;object-fit:contain;border-radius:10px;border:1px solid var(--border);background:#000;">` +
    `<div class="inline-actions" style="margin-top:12px;">` +
    `<a class="btn" style="text-decoration:none;display:inline-flex;align-items:center;" href="${esc(safe)}" target="_blank" rel="noopener">Open / Download</a>` +
    (deleteTimeLogId
      ? `<button class="red" type="button" onclick="closeSheet();deleteTimeLog('${esc(deleteTimeLogId)}')">🗑 Delete Photo</button>`
      : "") +
    `<button class="gray" type="button" data-act="close-sheet">Close</button>` +
    `</div>`
  );
}

export function fmtDate(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
export function fmtDay(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v) + "T00:00:00");
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}
export function fmtTableDate(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v) + "T00:00:00");
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function fmtClock(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
export function fmtShort(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 86400000;
  return diff < 1
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}
export function localDateKey(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export interface DtrCutoffPeriod {
  key: string;
  startDate: string;
  endDate: string;
  cycleType: "11-25" | "26-10";
  label: string;
}

function formatCutoffShort(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function getDtrCutoffForDate(dateIso?: string): DtrCutoffPeriod {
  const ref = String(dateIso || "").trim();
  const match = ref.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const now = new Date();
  const y = match ? Number(match[1]) : now.getFullYear();
  const m = match ? Number(match[2]) : now.getMonth() + 1; // 1-12
  const day = match ? Number(match[3]) : now.getDate();

  let startYear = y;
  let startMonth = m;
  let startDay = 11;
  let endYear = y;
  let endMonth = m;
  let endDay = 25;
  let cycleType: "11-25" | "26-10" = "11-25";

  if (day >= 11 && day <= 25) {
    startDay = 11;
    endDay = 25;
    cycleType = "11-25";
  } else if (day >= 26) {
    startDay = 26;
    endDay = 10;
    cycleType = "26-10";
    if (m === 12) {
      endYear = y + 1;
      endMonth = 1;
    } else {
      endMonth = m + 1;
    }
  } else {
    startDay = 26;
    endDay = 10;
    cycleType = "26-10";
    if (m === 1) {
      startYear = y - 1;
      startMonth = 12;
    } else {
      startMonth = m - 1;
    }
  }

  const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  return {
    key: `${startDate}_${endDate}`,
    startDate,
    endDate,
    cycleType,
    label: `${formatCutoffShort(startDate)} – ${formatCutoffShort(endDate)}, ${endYear} (${cycleType})`,
  };
}

export function listAvailableDtrCutoffs(dtrs: any[]): DtrCutoffPeriod[] {
  const map = new Map<string, DtrCutoffPeriod>();
  const current = getDtrCutoffForDate(localDateKey(new Date()));
  map.set(current.key, current);

  // Include previous cutoff right before current
  const cs = current.startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (cs) {
    const prevDay = new Date(Number(cs[1]), Number(cs[2]) - 1, Number(cs[3]) - 1);
    const prev = getDtrCutoffForDate(localDateKey(prevDay));
    map.set(prev.key, prev);
  }

  (dtrs || []).forEach(d => {
    const wd = String(d?.work_date || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(wd)) {
      const p = getDtrCutoffForDate(wd);
      if (!map.has(p.key)) map.set(p.key, p);
    }
  });

  return [...map.values()].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function sortDtrEntriesAscending(rows: any[]): any[] {
  return [...(rows || [])].sort((a, b) => {
    const dCmp = String(a?.work_date || "").localeCompare(String(b?.work_date || ""));
    if (dCmp !== 0) return dCmp;
    const tCmp = String(a?.time_in || "").localeCompare(String(b?.time_in || ""));
    if (tCmp !== 0) return tCmp;
    return String(a?.created_at || "").localeCompare(String(b?.created_at || ""));
  });
}

export function filterDtrRowsByCutoff(rows: any[], cutoffKey?: string): { period: DtrCutoffPeriod | null; rows: any[] } {
  const sorted = sortDtrEntriesAscending(rows);
  if (cutoffKey === "all") {
    return { period: null, rows: sorted };
  }
  const key = cutoffKey || getDtrCutoffForDate(localDateKey(new Date())).key;
  const parts = key.split("_");
  if (parts.length !== 2) {
    const cur = getDtrCutoffForDate(localDateKey(new Date()));
    return {
      period: cur,
      rows: sorted.filter(d => String(d?.work_date || "") >= cur.startDate && String(d?.work_date || "") <= cur.endDate),
    };
  }
  const [startDate, endDate] = parts;
  const period = getDtrCutoffForDate(startDate);
  return {
    period,
    rows: sorted.filter(d => String(d?.work_date || "") >= startDate && String(d?.work_date || "") <= endDate),
  };
}

export function parseTimeToMinutes(raw: string): number | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?$/i);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm < 0 || mm > 59) return null;
  const ap = (m[3] || "").replace(/\./g, "").toLowerCase();
  if (ap === "pm" && hh < 12) hh += 12;
  else if (ap === "am" && hh === 12) hh = 0;
  if (hh < 0 || hh > 23) return null;
  return hh * 60 + mm;
}

export const REGULAR_WORKING_HOURS_PER_DAY = 9;
export const DTR_MAX_TIME_OUT_MINUTES = 19 * 60; // 7:00 PM (19:00)

export interface DtrRuleOptions {
  workDate?: string | null;
  nightshiftRepair?: boolean;
}

export function isSundayDate(workDate: string | null | undefined): boolean {
  const s = String(workDate || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return !isNaN(dt.getTime()) && dt.getDay() === 0;
}

export function capDtrTimeOut(
  timeIn: string | null | undefined,
  timeOut: string | null | undefined,
  opts?: DtrRuleOptions
): string {
  const rawOut = String(timeOut || "").trim();
  if (!rawOut) return "";
  if (opts?.nightshiftRepair) return rawOut;
  const outMins = parseTimeToMinutes(rawOut);
  if (outMins === null) return rawOut;
  const inMins = parseTimeToMinutes(String(timeIn || ""));
  if ((inMins === null || inMins < DTR_MAX_TIME_OUT_MINUTES) && outMins > DTR_MAX_TIME_OUT_MINUTES) {
    return "19:00";
  }
  return rawOut;
}

export function calculateDtrMinutes(
  timeIn: string | null | undefined,
  timeOut: string | null | undefined,
  liveNowMinutes?: number | null,
  opts?: DtrRuleOptions
): number {
  const inMins = parseTimeToMinutes(String(timeIn || ""));
  if (inMins === null) return 0;
  const outMins = parseTimeToMinutes(String(timeOut || ""));
  if (outMins === null) {
    if (typeof liveNowMinutes === "number" && Number.isFinite(liveNowMinutes)) {
      const effectiveNow = (!opts?.nightshiftRepair && inMins < DTR_MAX_TIME_OUT_MINUTES)
        ? Math.min(liveNowMinutes, DTR_MAX_TIME_OUT_MINUTES)
        : liveNowMinutes;
      return Math.max(0, effectiveNow - inMins);
    }
    return 0;
  }
  const effectiveOut = (!opts?.nightshiftRepair && inMins < DTR_MAX_TIME_OUT_MINUTES && outMins > DTR_MAX_TIME_OUT_MINUTES)
    ? DTR_MAX_TIME_OUT_MINUTES
    : outMins;
  let mins = effectiveOut - inMins;
  if (mins < 0) mins += 1440;
  return mins;
}

export function formatDtrDuration(totalMins: number): string {
  const total = Math.max(0, Math.round(totalMins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} ${m === 1 ? "min" : "mins"}`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function calculateDtrHours(
  timeIn: string,
  timeOut: string,
  _isApproved = true,
  opts?: DtrRuleOptions
): number {
  return calculateDtrMinutes(timeIn, timeOut, null, opts) / 60;
}

export function calculateOtMinutes(
  timeIn: string,
  timeOut: string,
  opts?: DtrRuleOptions
): number {
  return calculateShiftBreakdown(timeIn, timeOut, null, opts).finalOtMins;
}

export interface DtrShiftBreakdown {
  workedMins: number;
  standardMins: number;
  regularMins: number;
  lackingMins: number;
  inShiftWorkedMins: number;
  grossOtMins: number;
  finalOtMins: number;
  shiftStartLabel: string;
  shiftEndLabel: string;
  isSunday: boolean;
  nightshiftRepair: boolean;
}

export function calculateShiftBreakdown(
  firstTimeIn: string | null | undefined,
  lastTimeOut: string | null | undefined,
  totalWorkedOverride?: number | null,
  opts?: DtrRuleOptions
): DtrShiftBreakdown {
  const standardMins = REGULAR_WORKING_HOURS_PER_DAY * 60; // 540 mins (9 hours)
  const isSun = isSundayDate(opts?.workDate);
  const nightshiftRepair = Boolean(opts?.nightshiftRepair);
  const inMins = parseTimeToMinutes(String(firstTimeIn || ""));
  const cappedOut = capDtrTimeOut(firstTimeIn, lastTimeOut, opts);
  const outMins = parseTimeToMinutes(cappedOut);
  const computedWorked =
    typeof totalWorkedOverride === "number" && Number.isFinite(totalWorkedOverride)
      ? Math.max(0, Math.round(totalWorkedOverride))
      : calculateDtrMinutes(firstTimeIn, cappedOut, null, opts);

  const regularMins = Math.min(standardMins, computedWorked);

  // Standard 9h shift anchor:
  // Mon–Sat: 8:00 AM–5:00 PM (or 7:00 AM–4:00 PM shift) | Sunday: 10:00 AM–7:00 PM
  const isSevenShift = !isSun && inMins !== null && inMins >= 6 * 60 + 30 && inMins < 7 * 60 + 45;
  const shiftStart = isSun ? 10 * 60 : (isSevenShift ? 7 * 60 : 8 * 60);
  const shiftEnd = shiftStart + standardMins; // 1140 (7:00 PM) on Sunday
  const shiftStartLabel = isSun ? "10:00 AM" : (isSevenShift ? "7:00 AM" : "8:00 AM");
  const shiftEndLabel = isSun ? "7:00 PM" : (isSevenShift ? "4:00 PM" : "5:00 PM");

  let lateMins = 0;
  let inShiftWorkedMins = regularMins;
  let grossOtMins = Math.max(0, computedWorked - standardMins);
  let finalOtMins = grossOtMins;

  if (inMins !== null && outMins !== null) {
    let effOut = outMins;
    if (effOut < inMins) effOut += 1440;
    const effIn = Math.max(inMins, shiftStart);
    const windowOut = Math.min(effOut, shiftEnd);
    inShiftWorkedMins = Math.max(0, Math.min(computedWorked, windowOut - effIn));
    lateMins = Math.max(0, standardMins - inShiftWorkedMins);
    if (isSun) {
      // Sunday O.T.: any hours worked before 10:00 AM OR beyond 7:00 PM when Operations Fix/Install/Repair/Nightshift is requested
      const earlyBefore10 = inMins < shiftStart ? Math.max(0, Math.min(effOut, shiftStart) - inMins) : 0;
      const after7Pm = nightshiftRepair ? Math.max(0, effOut - shiftEnd) : 0;
      grossOtMins = earlyBefore10 + after7Pm;
      finalOtMins = Math.min(Math.max(0, computedWorked - standardMins), grossOtMins);
    } else {
      grossOtMins = Math.max(0, effOut - shiftEnd);
      finalOtMins = Math.max(0, computedWorked - standardMins);
    }
  } else {
    lateMins = Math.max(0, standardMins - computedWorked);
    if (isSun) {
      if (inMins !== null) {
        const impliedOut = inMins + computedWorked;
        const earlyBefore10 = inMins < shiftStart ? Math.max(0, Math.min(impliedOut, shiftStart) - inMins) : 0;
        const after7Pm = nightshiftRepair ? Math.max(0, impliedOut - shiftEnd) : 0;
        grossOtMins = earlyBefore10 + after7Pm;
        finalOtMins = Math.min(Math.max(0, computedWorked - standardMins), grossOtMins);
      } else if (!nightshiftRepair) {
        grossOtMins = 0;
        finalOtMins = 0;
      }
    }
  }

  return {
    workedMins: computedWorked,
    standardMins,
    regularMins,
    lackingMins: lateMins,
    inShiftWorkedMins,
    grossOtMins,
    finalOtMins,
    shiftStartLabel,
    shiftEndLabel,
    isSunday: isSun,
    nightshiftRepair,
  };
}

export function profileOf(id: string | null | undefined): any {
  if (!id) return null;
  return state.profiles.find(p => String(p.user_id) === String(id)) || null;
}
export function profileName(id: string | null | undefined): string {
  const p = profileOf(id);
  return p && p.full_name ? p.full_name : "Unknown member";
}
export function face(p: any): string {
  const src = safeUrl(p?.avatar_url);
  const initial = esc(((p?.full_name || "?")[0] || "?").toUpperCase());
  return src ? `<img class="avatar" src="${esc(src)}" alt="">` : `<span class="avatar initial">${initial}</span>`;
}
export function avatarHtml(userId: string | null | undefined, label?: string): string {
  const p = profileOf(userId);
  const av = safeUrl(p?.avatar_url);
  const name = label || p?.full_name || "?";
  const init = esc((name.trim()[0] || "?").toUpperCase());
  if (av) return `<img class="avatar" src="${esc(av)}" alt="${esc(name)}">`;
  return `<span class="avatar initial">${init}</span>`;
}
export function bigFace(p: any, label?: string): string {
  const name = label || p?.full_name || "?";
  const av = safeUrl(p?.avatar_url);
  const init = esc((name.trim()[0] || "?").toUpperCase());
  return av
    ? `<img class="big-av" src="${esc(av)}" alt="${esc(name)}">`
    : `<div class="big-av big-init">${init}</div>`;
}

export function setLive(ok: boolean): void {
  const dot = $("liveDot");
  if (dot) {
    dot.dataset.live = ok ? "1" : "0";
    dot.title = ok ? "Live sync on" : "Live sync offline — check connection";
  }
  runtime.dbReady = ok;
}

export function setupError(message: string, error: any): void {
  console.error(message, error);
  const msg = error && error.message ? error.message : String(error || "");
  if (/does not exist|schema cache|could not find the table|relation/i.test(msg)) {
    state.setupIssue = msg;
    $("setupWarn")?.classList.remove("hidden");
    const warnText = $("setupWarnText");
    if (warnText) warnText.textContent = "Database notice: " + msg;
  }
}

export async function deleteStorageFile(bucket: string, publicUrl: string): Promise<boolean> {
  if (!publicUrl || typeof publicUrl !== "string" || !runtime.client) return false;
  const prefix = SUPABASE_URL + "/storage/v1/object/public/" + bucket + "/";
  if (!publicUrl.startsWith(prefix)) return false;
  const path = decodeURIComponent(publicUrl.slice(prefix.length).split("?")[0]);
  if (!path || path.includes("..")) return false;
  try {
    const { error } = await runtime.client.storage.from(bucket).remove([path]);
    if (error) { console.warn("Storage cleanup failed:", error.message); return false; }
    return true;
  } catch (err) {
    console.warn("Storage cleanup threw:", err);
    return false;
  }
}

export function extractReportPhotoUrls(details: string | null | undefined): string[] {
  if (!details) return [];
  const parts = String(details).split("\n\nPhotos:\n");
  if (parts.length < 2) return [];
  return parts[1].split("\n").map(s => s.trim()).filter(Boolean);
}
export function stripReportPhotos(details: string | null | undefined): string {
  if (!details) return "";
  return parseReportUnit(String(details).split("\n\nPhotos:\n")[0]).cleanDetails;
}

/* ==================== SIGNATURE STROKE-ONLY EXTRACTION ==================== */
export async function extractSignatureStrokeOnly(file: File): Promise<string> {
  const loaded = await loadBitmapOrImage(file);
  try {
    const maxW = 900;
    const maxH = 380;
    const scale = Math.min(1, maxW / loaded.width, maxH / loaded.height);
    const w = Math.max(1, Math.round(loaded.width * scale));
    const h = Math.max(1, Math.round(loaded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas context unavailable");
    loaded.draw(ctx, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    // Sample paper background luminance from edges + overall high-percentile brightness
    let lumSum = 0;
    let lumCount = 0;
    const samples: number[] = [];
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const idx = (y * w + x) * 4;
        if (d[idx + 3] < 40) continue;
        const l = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
        samples.push(l);
        if (x < 8 || x > w - 9 || y < 8 || y > h - 9) {
          lumSum += l;
          lumCount++;
        }
      }
    }
    samples.sort((a, b) => a - b);
    const p80 = samples.length ? samples[Math.floor(samples.length * 0.8)] : 225;
    const edgeAvg = lumCount ? lumSum / lumCount : p80;
    const bgLum = Math.max(125, Math.min(255, Math.round(edgeAvg * 0.5 + p80 * 0.5)));
    const cutoff = Math.max(70, bgLum - 34);
    const softBand = 24;

    let minX = w, minY = h, maxX = -1, maxY = -1;
    let strokePixels = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const origA = d[i + 3];
        if (origA < 25) {
          d[i + 3] = 0;
          continue;
        }
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (lum >= cutoff) {
          d[i + 3] = 0;
        } else {
          // Pure dark crisp stroke with smooth anti-aliased alpha
          const strength = Math.min(1, (cutoff - lum) / softBand);
          const alpha = Math.round(Math.min(255, strength * 255 * (origA / 255)));
          if (alpha < 20) {
            d[i + 3] = 0;
          } else {
            // Keep deep charcoal/black stroke so it looks clean on white DTR sheet
            d[i] = Math.min(35, Math.round(r * 0.25));
            d[i + 1] = Math.min(35, Math.round(g * 0.25));
            d[i + 2] = Math.min(45, Math.round(b * 0.25));
            d[i + 3] = alpha;
            strokePixels++;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // If image already had transparent background & sparse strokes or threshold cropped all, fallback cleanly
    if (strokePixels < 15 || maxX < minX || maxY < minY) {
      return canvas.toDataURL("image/png");
    }

    // Tight crop around extracted signature strokes with neat padding
    const pad = 10;
    const cx = Math.max(0, minX - pad);
    const cy = Math.max(0, minY - pad);
    const cw = Math.min(w - cx, maxX - minX + 1 + pad * 2);
    const ch = Math.min(h - cy, maxY - minY + 1 + pad * 2);
    const out = document.createElement("canvas");
    out.width = Math.max(1, cw);
    out.height = Math.max(1, ch);
    const octx = out.getContext("2d");
    if (!octx) return canvas.toDataURL("image/png");
    octx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    return out.toDataURL("image/png");
  } finally {
    loaded.close?.();
  }
}

/* ==================== CONNECTED METADATA HELPERS ==================== */
export function parseReportUnit(details: string | null | undefined): { unitId: string; unitName: string; cleanDetails: string } {
  const raw = String(details || "");
  const m = raw.match(/^\[UNIT:\s*([^\]|]+?)(?:\|([^\]]*))?\]\s*\n?/);
  if (!m) return { unitId: "", unitName: "", cleanDetails: raw };
  return {
    unitName: m[1].trim(),
    unitId: (m[2] || "").trim(),
    cleanDetails: raw.slice(m[0].length),
  };
}

export function buildReportDetailsWithUnit(unitId: string, unitName: string, cleanDetails: string): string {
  const clean = String(cleanDetails || "").trim();
  const uName = String(unitName || "").trim();
  const uId = String(unitId || "").trim();
  if (!uName && !uId) return clean;
  const tag = `[UNIT: ${uName || "Unit"}${uId ? "|" + uId : ""}]`;
  return clean ? `${tag}\n${clean}` : tag;
}

export function isMissingTableError(error: any): boolean {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return code === "PGRST205" || code === "42P01" || /schema cache|could not find the table|does not exist/i.test(msg);
}

export interface TimeLogNoticeMeta {
  user_id: string | null;
  sender_name: string;
  mode: "time_in" | "time_out";
  work_date: string;
  time_24?: string | null;
  time_12?: string | null;
  location?: string | null;
  unit?: string | null;
  note?: string | null;
  ai_summary?: string | null;
  image_url?: string | null;
  dtr_entry_id?: string | null;
}

export function buildTimeLogAppNoticeBody(displayBody: string, meta: TimeLogNoticeMeta): string {
  const clean = String(displayBody || "").trim();
  return `${clean}\n[[TIME_LOG_META:${JSON.stringify(meta)}]]`;
}

export function stripTimeLogMeta(body: string | null | undefined): string {
  return String(body || "").replace(/\s*\[\[TIME_LOG_META:[\s\S]*?\]\]/g, "").trim();
}

export function parseTimeLogFromAppNotice(n: any): any | null {
  const raw = String(n?.body || "");
  const match = raw.match(/\[\[TIME_LOG_META:([\s\S]*?)\]\]/);
  if (!match) return null;
  try {
    const meta = JSON.parse(match[1]);
    return {
      id: `notice:${n.id}`,
      app_notification_id: n.id,
      user_id: meta.user_id || "",
      sender_name: meta.sender_name || "",
      mode: meta.mode === "time_out" ? "time_out" : "time_in",
      work_date: meta.work_date || "",
      time_24: meta.time_24 || null,
      time_12: meta.time_12 || null,
      location: meta.location || null,
      unit: meta.unit || null,
      note: meta.note || null,
      ai_summary: meta.ai_summary || null,
      image_url: meta.image_url || null,
      dtr_entry_id: meta.dtr_entry_id || null,
      created_at: n.created_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function parseRecMeta(reason: string | null | undefined): {
  siteUnit: string;
  assignedNames: string[];
  cleanReason: string;
} {
  let text = String(reason || "");
  let siteUnit = "";
  let assignedNames: string[] = [];

  const unitMatch = text.match(/^\[UNIT:\s*([^\]]+)\]\s*\n?/);
  if (unitMatch) {
    siteUnit = unitMatch[1].trim();
    text = text.slice(unitMatch[0].length);
  }
  const assignMatch = text.match(/^\[ASSIGNED:\s*([^\]]+)\]\s*\n?/);
  if (assignMatch) {
    assignedNames = assignMatch[1].split(",").map(s => s.trim()).filter(Boolean);
    text = text.slice(assignMatch[0].length);
  }
  return { siteUnit, assignedNames, cleanReason: text };
}

export function buildRecReasonWithMeta(siteUnit: string, assignedNames: string[], cleanReason: string): string {
  const lines: string[] = [];
  if (siteUnit.trim()) lines.push(`[UNIT: ${siteUnit.trim()}]`);
  if (assignedNames.length) lines.push(`[ASSIGNED: ${assignedNames.join(", ")}]`);
  if (cleanReason.trim()) lines.push(cleanReason.trim());
  return lines.join("\n");
}

export function canCommentOnRec(rec: any): boolean {
  if (!state.userId || !rec) return false;
  // Admin & Selective Representative can comment
  if (state.role === "admin" || state.role === "representative") return true;
  // Uploader can comment
  if (String(rec.user_id) === String(state.userId)) return true;
  // Mentioned / Assigned personnel can comment
  const myName = (state.profile?.full_name || "").trim().toLowerCase();
  const myEmail = (state.email || "").trim().toLowerCase();
  if (!myName && !myEmail) return false;
  const { assignedNames, cleanReason } = parseRecMeta(rec.reason);
  if (myName && assignedNames.some(n => n.toLowerCase() === myName)) return true;
  const fullReason = String(rec.reason || "") + " " + cleanReason;
  if (myName) {
    const escaped = myName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`@${escaped}\\b`, "i").test(fullReason)) return true;
    // Also match if first+last or exact name appears in [ASSIGNED: ...]
    if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(assignedNames.join(", "))) return true;
  }
  if (myEmail && fullReason.toLowerCase().includes(myEmail)) return true;
  return false;
}

export function parseUnitManualMeta(notes: string | null | undefined): {
  cleanNotes: string;
  manualUrl: string;
  manualText: string;
} {
  let text = String(notes || "");
  let manualUrl = "";
  let manualText = "";

  const urlMatch = text.match(/\[MANUAL_URL:\s*([^\]]+)\]/);
  if (urlMatch) {
    manualUrl = urlMatch[1].trim();
    text = text.replace(urlMatch[0], "").trim();
  }
  const textMatch = text.match(/\[MANUAL_TEXT:\s*([\s\S]*?)\s*\[\/MANUAL_TEXT\]/);
  if (textMatch) {
    manualText = textMatch[1].trim();
    text = text.replace(textMatch[0], "").trim();
  }
  return { cleanNotes: text.trim(), manualUrl, manualText };
}

export function buildUnitNotesWithManual(cleanNotes: string, manualUrl: string, manualText: string): string {
  const parts: string[] = [];
  if (cleanNotes.trim()) parts.push(cleanNotes.trim());
  if (manualUrl.trim()) parts.push(`[MANUAL_URL: ${manualUrl.trim()}]`);
  if (manualText.trim()) parts.push(`[MANUAL_TEXT:\n${manualText.trim()}\n[/MANUAL_TEXT]`);
  return parts.join("\n\n");
}

export const UNIT_MANUAL_DEFAULTS: Record<string, { title: string; sections: Array<{ heading: string; steps: string[] }> }> = {
  elevator: {
    title: "Passenger / Service Elevator Standard Operations & PMS Manual",
    sections: [
      {
        heading: "1. Lockout / Tagout (LOTO) & Pre-Service Safety",
        steps: [
          "Place warning barricades and 'Unit Under Maintenance' signage at Ground and affected landings.",
          "Switch main breaker/disconnect OFF and apply personal padlock & LOTO tag before entering hoistway or pit.",
          "Verify zero voltage using a calibrated multimeter and confirm car top/pit stop switches engage properly.",
        ],
      },
      {
        heading: "2. Machine Room, Brake & Traction Inspection",
        steps: [
          "Check controller fault logs, power supply voltage balance, and thermal fan operation.",
          "Inspect traction sheave grooves, hoist ropes for broken wires/rust, and check brake shoe clearance & coil action.",
          "Check gear reducer oil sight glass (if geared) and ensure machine room temperature stays below 40°C.",
        ],
      },
      {
        heading: "3. Hoistway, Doors, Safety Gear & Pit",
        steps: [
          "Clean car top, verify door operator belt tension, rollers, and door safety light curtain sensitivity.",
          "Test landing door interlock contacts, emergency alarm bell, intercom, and emergency car lighting.",
          "Keep pit dry and clean; verify oil buffer levels, governor tension switch, and pit stop switch.",
        ],
      },
    ],
  },
  escalator: {
    title: "Escalator Standard Operations & PMS Manual",
    sections: [
      {
        heading: "1. Barricading & Power Isolation",
        steps: [
          "Install safety barricades at both upper and lower landings before opening floor access plates.",
          "Engage emergency stop button and turn main disconnect OFF with LOTO lock before accessing drive pit.",
        ],
      },
      {
        heading: "2. Drive Chain, Steps & Combplates",
        steps: [
          "Inspect main drive chain tension, sprocket wear, brake stopping distance, and gear reducer oil level.",
          "Check step treads, risers, yellow demarcation lines, step chain tension, and combplate teeth clearance.",
          "Test combplate impact switches, broken step chain switches, and skirt panel deflection switches.",
        ],
      },
      {
        heading: "3. Handrails & Operational Checks",
        steps: [
          "Verify handrail speed synchronization with step speed and inspect handrail entry finger guards.",
          "Test top and bottom Emergency Stop buttons, key start switches, and landing lighting before reopening.",
        ],
      },
    ],
  },
  "moving-walkway": {
    title: "Moving Walkway Standard Operations & PMS Manual",
    sections: [
      {
        heading: "1. Safety Isolation & Access",
        steps: [
          "Place landing barriers at entry and exit zones and isolate main electrical supply via LOTO.",
        ],
      },
      {
        heading: "2. Pallets, Combplates & Handrails",
        steps: [
          "Inspect pallet surface alignment, combplate tooth clearance, handrail synchronization, and entry switches.",
          "Check drive motor, brake response, pallet chain lubrication, and pit cleanliness.",
        ],
      },
    ],
  },
  dumbwaiter: {
    title: "Dumbwaiter Standard Operations & PMS Manual",
    sections: [
      {
        heading: "1. Interlocks & Hoistway Check",
        steps: [
          "Isolate power before servicing hoistway; never allow personnel inside the dumbwaiter car.",
          "Test every landing gate interlock, overload switch, call/send pushbuttons, and slack-rope/limit switches.",
        ],
      },
    ],
  },
};

/* ==================== LEAVE BALANCE HELPERS ==================== */
export function leaveDaysCount(a: string, b: string): number {
  if (!a || !b) return 0;
  const start = new Date(a + "T00:00:00");
  const end = new Date(b + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function getUserLeaveBalances(userId: string) {
  const year = String(new Date().getFullYear());
  const approved = (state.leaveRequests || []).filter(
    r => String(r.user_id) === String(userId) && r.status === "approved" && String(r.start_date || "").startsWith(year)
  );
  const quotas: Record<"sick" | "emergency" | "vacation", number> = { sick: 15, emergency: 5, vacation: 15 };
  const result = (["sick", "emergency", "vacation"] as const).map(type => {
    const used = approved
      .filter(r => r.leave_type === type)
      .reduce((s, r) => s + (r.calendar_days || leaveDaysCount(r.start_date, r.end_date) || r.workdays || 0), 0);
    const total = quotas[type];
    return {
      type,
      label: type[0].toUpperCase() + type.slice(1) + " Leave",
      total,
      used,
      left: Math.max(0, total - used),
    };
  });
  return { year, items: result };
}

export function renderUserLeaveBalanceHtml(userId: string): string {
  const { year, items } = getUserLeaveBalances(userId);
  return (
    `<div class="muted" style="font-size:11px;margin-bottom:6px;">Calendar Year ${esc(year)}</div>` +
    items
      .map(
        it =>
          `<div class="pv-row"><span>${esc(it.label)}</span><span><b>${it.left}</b> / ${it.total} left (${it.used} used)</span></div>`
      )
      .join("")
  );
}

/* ==================== CHAT DELETE FOR ME STORAGE ==================== */
function deletedForMeKey(): string {
  return "eesi-msg-deleted-me:" + (state.userId || "anon");
}
export function getDeletedForMeSet(): Set<string> {
  try {
    const raw = localStorage.getItem(deletedForMeKey());
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}
export function markDeletedForMe(msgId: string): void {
  const set = getDeletedForMeSet();
  set.add(String(msgId));
  const arr = [...set].slice(-1000);
  try {
    localStorage.setItem(deletedForMeKey(), JSON.stringify(arr));
  } catch {}
}

/* ==================== MEDIA / DTR / LEAVE / STORY / UNIT HELPERS ==================== */
export function isVideoUrl(u: unknown): boolean {
  const s = String(u || "");
  return /\.(mp4|webm|mov|m4v|3gp|mkv)(\?|#|$)/i.test(s) || /^data:video\//i.test(s);
}

export function fmtHalfSheetDate(v: unknown): string {
  const s = String(v || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[2]}/${m[3]}/${m[1].slice(2)}`;
}

export function fmtTime12h(t: unknown): string {
  const s = String(t || "").trim();
  if (!s) return "";
  if (/[ap]m$/i.test(s)) return s.toUpperCase();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  let h = Number(m[1]);
  const suf = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${suf}`;
}

export function parseDtrJobMeta(
  job: unknown,
  approvedByCol?: unknown,
  nightshiftRepairCol?: unknown
): { unitName: string; approvedBy: string; cleanJob: string; nightshiftRepair: boolean } {
  let text = String(job || "").trim();
  let unitName = "";
  let approvedBy = String(approvedByCol || "").trim();
  let nightshiftRepair = Boolean(nightshiftRepairCol);

  const nsMatch = text.match(/\s*\[NS_REPAIR\]\s*/i);
  if (nsMatch) {
    nightshiftRepair = true;
    text = text.replace(/\s*\[NS_REPAIR\]\s*/gi, " ").trim();
  }
  const unitMatch = text.match(/^\[Unit:\s*([^\]]+)\]\s*/i);
  if (unitMatch) {
    unitName = unitMatch[1].trim();
    text = text.slice(unitMatch[0].length).trim();
  }
  const apprMatch = text.match(/\s*\[APPR:\s*([^\]]+)\]\s*$/i);
  if (apprMatch) {
    if (!approvedBy) approvedBy = apprMatch[1].trim();
    text = text.slice(0, apprMatch.index).trim();
  }
  if (/night\s*shift|operations?\s+(?:to\s+)?(?:fix|install|repair)|(?:fix|install|repair)\s+op|ns[\s/_-]*repair/i.test(approvedBy)) {
    nightshiftRepair = true;
  }
  return { unitName, approvedBy, cleanJob: text, nightshiftRepair };
}

export function buildDtrJobWithApproval(
  unitName: string,
  cleanJob: string,
  approvedBy: string,
  includeApprTag = true,
  nightshiftRepair = false
): string {
  let out = String(cleanJob || "").replace(/\s*\[NS_REPAIR\]\s*/gi, " ").trim();
  if (unitName && unitName.trim() && !out.toLowerCase().startsWith("[unit:")) {
    out = `[Unit: ${unitName.trim()}] ${out}`.trim();
  }
  if (nightshiftRepair) {
    out = `${out} [NS_REPAIR]`.trim();
  }
  if (includeApprTag && approvedBy && approvedBy.trim()) {
    out = `${out} [APPR: ${approvedBy.trim()}]`.trim();
  }
  return out;
}

export interface LeaveSheetMeta {
  filingDate?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  displayType?: "vacation" | "sick" | "others" | "emergency";
  othersSpecify?: string;
  vacationPlace?: "within" | "outside" | "";
  outsideSpecify?: string;
  inHospital?: boolean;
  hospitalSpecify?: string;
  workingDays?: string;
  applicantName?: string;
  reasonText?: string;
}

export function parseLeaveMeta(reason: unknown): LeaveSheetMeta & { cleanReason: string } {
  const raw = String(reason || "");
  const m = raw.match(/\[\[LEAVE_META:([\s\S]*?)\]\]/);
  if (!m) {
    return { cleanReason: raw.trim(), reasonText: raw.trim() };
  }
  const cleanReason = raw.replace(m[0], "").trim();
  try {
    const parsed = JSON.parse(m[1]) || {};
    return {
      ...parsed,
      cleanReason,
      reasonText: parsed.reasonText || cleanReason,
    };
  } catch {
    return { cleanReason, reasonText: cleanReason };
  }
}

export function buildLeaveReasonWithMeta(meta: LeaveSheetMeta): string {
  const clean = String(meta.reasonText || "").trim();
  const compact: LeaveSheetMeta = { ...meta };
  delete compact.reasonText;
  return `${clean}\n[[LEAVE_META:${JSON.stringify(compact)}]]`.trim();
}

export interface StoryNoticeMeta {
  id?: string;
  user_id: string;
  sender_name: string;
  caption?: string;
  media_url?: string | null;
  media_type?: "image" | "video" | "text";
  bg_style?: string;
  expires_at: string;
}

export function isStoryNotice(n: any): boolean {
  return String(n?.body || "").includes("[[STORY_META:");
}

export function buildStoryAppNoticeBody(caption: string, meta: StoryNoticeMeta): string {
  return `${String(caption || "My Day Story").trim()}\n[[STORY_META:${JSON.stringify(meta)}]]`;
}

export function parseStoryFromAppNotice(n: any): any | null {
  const raw = String(n?.body || "");
  const match = raw.match(/\[\[STORY_META:([\s\S]*?)\]\]/);
  if (!match) return null;
  try {
    const meta = JSON.parse(match[1]);
    return {
      id: `notice:${n.id}`,
      app_notification_id: n.id,
      user_id: meta.user_id || "",
      sender_name: meta.sender_name || "",
      caption: meta.caption ?? raw.replace(match[0], "").trim(),
      media_url: meta.media_url || null,
      media_type: meta.media_type || "text",
      bg_style: meta.bg_style || "linear-gradient(135deg,#0d254d,#1e6cf2)",
      expires_at: meta.expires_at || new Date(Date.now() + 86400000).toISOString(),
      created_at: n.created_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function parseUnitSideTag(notes: unknown): { side: string; cleanNotes: string } {
  const raw = String(notes || "");
  const m = raw.match(/\[SIDE:\s*([^\]]+)\]\s*/i);
  if (!m) return { side: "", cleanNotes: raw.trim() };
  return {
    side: m[1].trim().toUpperCase(),
    cleanNotes: raw.replace(m[0], "").trim(),
  };
}

export const SITE_STATUS_OPTIONS = [
  "Operational",
  "Under Maintenance",
  "Needs Repair",
  "Shutdown",
  "Completed",
] as const;

export interface SiteMetaNoticePayload {
  site_id: string;
  thumbnail_url?: string | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  updated_at?: string;
}

export function isSiteMetaNotice(n: any): boolean {
  return String(n?.body || "").includes("[[SITE_META:");
}

export interface PayslipRecord {
  id: string;
  user_id: string;
  employee_name: string;
  period_start: string;
  period_end: string;
  dtr_cutoff_start?: string | null;
  dtr_cutoff_end?: string | null;
  basic_pay: number;
  overtime_hours: number;
  overtime_amount: number;
  night_diff_hours: number;
  night_diff_amount: number;
  allowance: number;
  sss: number;
  philhealth: number;
  pagibig: number;
  cash_advance: number;
  absent: number;
  abuloy: number;
  total_earnings: number;
  total_deductions: number;
  net_pay: number;
  created_by?: string | null;
  created_at?: string;
  app_notification_id?: string | null;
}

export function resolvePayrollDtrWindow(
  periodStart: string,
  periodEnd: string,
  preset?: string
): { dtrStart: string; dtrEnd: string; ruleLabel: string; mapped: boolean } {
  const sMatch = String(periodStart || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const eMatch = String(periodEnd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const pad = (x: number) => String(x).padStart(2, "0");

  if (sMatch && eMatch) {
    const sy = Number(sMatch[1]);
    const sm = Number(sMatch[2]);
    const sd = Number(sMatch[3]);
    const ey = Number(eMatch[1]);
    const em = Number(eMatch[2]);
    const ed = Number(eMatch[3]);
    const sameMonth = sy === ey && sm === em;

    // Rule 1: Pay period 1 to 15 counts DTR from 26 of previous month to 10 of current month
    if ((sameMonth && sd === 1 && ed === 15) || (preset === "1-15" && sd === 1 && ed === 15)) {
      const prevMo = sm === 1 ? 12 : sm - 1;
      const prevYr = sm === 1 ? sy - 1 : sy;
      return {
        dtrStart: `${prevYr}-${pad(prevMo)}-26`,
        dtrEnd: `${sy}-${pad(sm)}-10`,
        ruleLabel: "1–15 Pay Period → DTR 26–10",
        mapped: true,
      };
    }

    // Rule 2: Pay period 16 to 30/end counts DTR from 11 to 25 of current month
    if ((sameMonth && sd === 16 && ed >= 28 && ed <= 31) || (preset === "16-end" && sd === 16 && ed >= 28)) {
      return {
        dtrStart: `${sy}-${pad(sm)}-11`,
        dtrEnd: `${sy}-${pad(sm)}-25`,
        ruleLabel: "16–30 Pay Period → DTR 11–25",
        mapped: true,
      };
    }
  }

  return {
    dtrStart: periodStart,
    dtrEnd: periodEnd,
    ruleLabel: "Selected date range",
    mapped: false,
  };
}

export function isPayslipNotice(n: any): boolean {
  return String(n?.body || "").includes("[[PAYSLIP_DATA:");
}

export function isHiddenSystemNotice(n: any): boolean {
  return isStoryNotice(n) || isSiteMetaNotice(n) || isPayslipNotice(n);
}

export function buildPayslipAppNoticeBody(rec: Omit<PayslipRecord, "id">): string {
  return `Payslip record for ${rec.employee_name}\n[[PAYSLIP_DATA:${JSON.stringify(rec)}]]`;
}

export function parsePayslipFromAppNotice(n: any): PayslipRecord | null {
  const raw = String(n?.body || "");
  const match = raw.match(/\[\[PAYSLIP_DATA:([\s\S]*?)\]\]/);
  if (!match) return null;
  try {
    const p = JSON.parse(match[1]);
    if (!p || !p.user_id) return null;
    return {
      ...p,
      id: `notice:${n.id}`,
      app_notification_id: String(n.id),
      created_at: p.created_at || n.created_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function buildSiteMetaAppNoticeBody(meta: SiteMetaNoticePayload): string {
  return `Site metadata update\n[[SITE_META:${JSON.stringify(meta)}]]`;
}

export function parseSiteMetaFromAppNotice(n: any): SiteMetaNoticePayload | null {
  const raw = String(n?.body || "");
  const match = raw.match(/\[\[SITE_META:([\s\S]*?)\]\]/);
  if (!match) return null;
  try {
    const meta = JSON.parse(match[1]);
    if (!meta || !meta.site_id) return null;
    const lat = Number(meta.latitude);
    const lng = Number(meta.longitude);
    return {
      site_id: String(meta.site_id),
      thumbnail_url: typeof meta.thumbnail_url === "string" ? meta.thumbnail_url : (meta.thumbnail_url === null ? null : undefined),
      status: typeof meta.status === "string" ? meta.status : undefined,
      latitude: meta.latitude !== undefined && meta.latitude !== null && Number.isFinite(lat) ? lat : undefined,
      longitude: meta.longitude !== undefined && meta.longitude !== null && Number.isFinite(lng) ? lng : undefined,
      updated_at: String(meta.updated_at || n.created_at || ""),
    };
  } catch {
    return null;
  }
}

export function getSiteThumbnailUrl(site: any): string | null {
  if (!site) return null;
  const meta = runtime.siteMetaNotices[String(site.id)];
  const raw = site.thumbnail_url !== undefined && site.thumbnail_url !== null && site.thumbnail_url !== ""
    ? site.thumbnail_url
    : (meta?.thumbnail_url || "");
  return safeUrl(raw);
}

export function getSiteEffectiveStatus(site: any, units: any[] = state.units): string {
  if (!site) return "Operational";
  const meta = runtime.siteMetaNotices[String(site.id)];
  const explicit = String(site.status || meta?.status || "").trim();
  if (explicit) return explicit;
  const siteUnits = (units || []).filter(u => String(u.site_id) === String(site.id));
  if (siteUnits.some(u => u.status === "Shutdown")) return "Shutdown";
  if (siteUnits.some(u => u.status === "Needs Repair")) return "Needs Repair";
  if (siteUnits.some(u => u.status === "Under Maintenance")) return "Under Maintenance";
  return "Operational";
}



