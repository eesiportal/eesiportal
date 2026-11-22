import {
  $,
  esc,
  face,
  fmtDate,
  fmtDay,
  getDeletedForMeSet,
  hooks,
  isAdmin,
  isHiddenSystemNotice,
  isManager,
  isMissingTableError,
  isSiteMetaNotice,
  isWithinSelfActionWindow,
  parseSiteMetaFromAppNotice,
  parseStoryFromAppNotice,
  parseTimeLogFromAppNotice,
  profileName,
  profileOf,
  roleLabel,
  runtime,
  setLive,
  setVal,
  setupError,
  state,
  stripTimeLogMeta,
  toast,
  val,
} from "./eesiTypes";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { triggerAlert, updateLiveWeather } from "./eesiSettings";

/* ==================== NETWORK STATUS (STRICT ONLINE MODE) ==================== */
export function updateNetworkStatus(): void {
  const banner = $("offlineBanner");
  const overlay = $("offlineOverlay");
  const offline = !navigator.onLine;
  if (offline) {
    banner?.classList.remove("hidden");
    overlay?.classList.remove("hidden");
    document.body.style.paddingTop = "40px";
  } else {
    banner?.classList.add("hidden");
    overlay?.classList.add("hidden");
    document.body.style.paddingTop = "";
  }
}

export async function checkConnectionNow(): Promise<void> {
  const statusEl = $("offlineOverlayStatus");
  const btn = $("retryOnlineBtn") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = "Checking internet connection…";
  try {
    if (!navigator.onLine) {
      if (statusEl) statusEl.textContent = "Device reports no internet connection. Turn on Wi-Fi or mobile data.";
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      await fetch("https://subzomvuyxvzhhlpsyrf.supabase.co/auth/v1/health", {
        method: "GET",
        cache: "no-store",
        signal: ctrl.signal,
      }).catch(() => fetch("/", { method: "HEAD", cache: "no-store", signal: ctrl.signal }));
      clearTimeout(timer);
      $("offlineOverlay")?.classList.add("hidden");
      $("offlineBanner")?.classList.add("hidden");
      document.body.style.paddingTop = "";
      if (statusEl) statusEl.textContent = "";
      toast("Internet connection restored.");
      if (state.userId) {
        startLive();
        reloadEverything();
      }
    } catch {
      clearTimeout(timer);
      if (statusEl) statusEl.textContent = "Still cannot reach the server. Please check your internet connection.";
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ==================== PERSISTENT VIEW ACROSS RELOAD ==================== */
function lastViewKey(): string { return "eesi-last-view:" + (state.userId || "anon"); }

export function saveLastView(scrollPos?: number): void {
  if (!state.userId || !state.booted || runtime.restoringView) return;
  try {
    const sy = typeof scrollPos === "number" ? scrollPos : (window.scrollY || document.documentElement.scrollTop || 0);
    localStorage.setItem(lastViewKey(), JSON.stringify({
      page: runtime.currentPage,
      reportType: state.reportType,
      reportsView: runtime.reportsViewMode,
      unitsRegion: runtime.unitsRegion,
      unitsTab: runtime.unitsTab,
      dtrTab: runtime.currentDtrTab,
      noteTab: runtime.currentNoteTab,
      activeThread: state.activeThread || null,
      scrollY: sy,
    }));
  } catch {}
}

export async function restoreLastView(): Promise<void> {
  if (!state.userId) return;
  let saved: any = null;
  try { saved = JSON.parse(localStorage.getItem(lastViewKey()) || "null"); } catch {}
  if (!saved || !saved.page) return;
  runtime.restoringView = true;
  try {
    if (saved.unitsRegion && ["ALL", "Luzon", "Visayas", "Mindanao"].includes(saved.unitsRegion)) {
      runtime.unitsRegion = saved.unitsRegion;
      document.querySelectorAll<HTMLElement>("[data-units-region]").forEach(b =>
        b.classList.toggle("active", b.dataset.unitsRegion === runtime.unitsRegion)
      );
    }
    if (saved.dtrTab) hooks.dtrTab(saved.dtrTab);
    if (saved.noteTab) hooks.switchNoteTab(saved.noteTab);
    if (saved.reportType) {
      state.reportType = saved.reportType;
      document.querySelectorAll<HTMLElement>("#reportTypeTabs [data-report-type]").forEach(x =>
        x.classList.toggle("active", x.dataset.reportType === state.reportType)
      );
    }
    if (saved.page === "reports") {
      if (saved.reportsView === "search") $("reportSearchTab")?.click();
      else if (saved.reportsView === "pms-records" && isManager()) $("pmsRecordsTab")?.click();
      else if (saved.reportsView === "checklist" && !isManager()) {
        (document.querySelector('#reportTypeTabs [data-report-type="checklist"]') as HTMLElement | null)?.click();
      }
    }
    const targetPage =
      saved.page === "admin" && !isAdmin()
        ? "home"
        : (saved.page === "members" || saved.page === "pending" || saved.page === "live-map") && !isManager()
          ? "home"
          : saved.page;
    hooks.go(targetPage, { skipScrollReset: true });
    if (targetPage === "chat" && saved.activeThread && state.threads.some(t => String(t.id) === String(saved.activeThread))) {
      await hooks.openThread(String(saved.activeThread));
    }
    if (typeof saved.scrollY === "number" && saved.scrollY > 0) {
      setTimeout(() => window.scrollTo(0, saved.scrollY), 60);
    }
  } finally {
    runtime.restoringView = false;
  }
}

/* ==================== PERSISTENT NOTIFICATION READ STATE ==================== */
function readNoticesKey(): string { return "eesi-read-notices:" + (state.userId || "anon"); }
function getReadNoticesMap(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(readNoticesKey()) || "{}") || {}; } catch { return {}; }
}
export function isNoticeMarkedRead(key: string): boolean {
  return !!getReadNoticesMap()[String(key)];
}
export function markNoticeRead(key: string): void {
  if (!state.userId || !key) return;
  const map = getReadNoticesMap();
  if (map[String(key)]) return;
  map[String(key)] = Date.now();
  const entries = Object.entries(map);
  if (entries.length > 500) {
    entries.sort((a, b) => b[1] - a[1]);
    localStorage.setItem(readNoticesKey(), JSON.stringify(Object.fromEntries(entries.slice(0, 500))));
  } else {
    localStorage.setItem(readNoticesKey(), JSON.stringify(map));
  }
  hooks.renderNotices();
  hooks.renderHome();
}

/* ==================== LOADERS ==================== */
let leaveLoaded = false;
let reportsLoaded = false;
let appNotificationsLoaded = false;
let approvalNotificationsLoaded = false;
let schedulesLoaded = false;
let announcementsLoaded = false;
let dtrTimeLogsLoaded = false;
let storiesLoaded = false;

export function resetDataLoadFlags(): void {
  appNotificationsLoaded = false;
  approvalNotificationsLoaded = false;
  announcementsLoaded = false;
  reportsLoaded = false;
  schedulesLoaded = false;
  leaveLoaded = false;
  dtrTimeLogsLoaded = false;
  storiesLoaded = false;
  runtime.dtrTimeLogsTableMissing = false;
  runtime.dtrApprovedByColMissing = false;
  runtime.storiesTableMissing = false;
  runtime.sitesExtraColsMissing = false;
  runtime.siteDistances = {};
  runtime.siteDistanceOriginKey = "";
  runtime.siteMetaNotices = {};
  runtime.amcbSeedAttempted = false;
}

export async function loadProfiles(): Promise<void> {
  const { data, error } = await runtime.client
    .from("profiles")
    .select("user_id,full_name,email,id_no,address,team,phone,area,avatar_url,cover_url")
    .order("full_name");
  if (error) { setupError("Could not load members", error); return; }
  state.profiles = data || [];
  const mine = profileOf(state.userId);
  if (mine) state.profile = mine;
  hooks.renderAssigneesPicker();
  hooks.autoFillDtrFromSchedule?.();
}

export async function loadLeaveRequests(): Promise<void> {
  if (!state.userId) return;
  const { data, error } = await runtime.client
    .from("leave_requests")
    .select("id,user_id,leave_type,start_date,end_date,calendar_days,workdays,reason,status,reviewed_by,reviewed_at,review_note,created_at")
    .order("created_at", { ascending: false });
  if (error) { console.error("Could not load leave requests:", error); hooks.renderLeaveBalances(); return; }
  const prevMap = new Map(state.leaveRequests.map(r => [String(r.id), r]));
  const rows = data || [];
  if (leaveLoaded && !isWithinSelfActionWindow()) {
    const decision = rows.find((r: any) => {
      if (String(r.user_id) !== String(state.userId)) return false;
      const prev = prevMap.get(String(r.id));
      return prev && prev.status === "pending" && (r.status === "approved" || r.status === "rejected");
    });
    if (decision) {
      const msg = "Your " + decision.leave_type + " leave (" + fmtDay(decision.start_date) + " – " + fmtDay(decision.end_date) + ") was " + decision.status + ".";
      triggerAlert("🌴 Leave " + decision.status, msg, [250, 100, 250]);
      toast("🌴 " + msg);
    } else if (isManager()) {
      const newPending = rows.find((r: any) => r.status === "pending" && String(r.user_id) !== String(state.userId) && !prevMap.has(String(r.id)));
      if (newPending) {
        const msg = profileName(newPending.user_id) + " requested " + newPending.leave_type + " leave.";
        triggerAlert("🌴 New Leave Request", msg, [200, 100, 200]);
        toast("🌴 " + msg);
      }
    }
  }
  state.leaveRequests = rows;
  leaveLoaded = true;
  hooks.renderLeave();
  hooks.renderLeaveBalances();
  hooks.renderNotices();
  hooks.renderHome();
}

export async function loadRoles(): Promise<void> {
  const { data, error } = await runtime.client.from("user_roles").select("user_id,app_role,approval_status");
  if (error) return;
  state.roles = {};
  (data || []).forEach((r: any) => { state.roles[r.user_id] = r; });
}

export async function loadSites(): Promise<void> {
  let rows: any[] | null = null;
  if (!runtime.sitesExtraColsMissing) {
    const res = await runtime.client
      .from("sites")
      .select("id,name,address,city,region,thumbnail_url,status,latitude,longitude")
      .order("name");
    if (!res.error) {
      rows = res.data || [];
    } else if (/thumbnail_url|status|latitude|longitude|42703|PGRST204/i.test(String(res.error.message || "") + " " + String(res.error.code || ""))) {
      runtime.sitesExtraColsMissing = true;
    } else {
      setupError("Could not load sites", res.error);
      return;
    }
  }
  if (rows === null) {
    const { data, error } = await runtime.client.from("sites").select("id,name,address,city,region").order("name");
    if (error) { setupError("Could not load sites", error); return; }
    rows = data || [];
  }
  state.sites = (rows || []).map((s: any) => {
    const meta = runtime.siteMetaNotices[String(s.id)];
    const hasLat = s.latitude !== undefined && s.latitude !== null && s.latitude !== "" && Number.isFinite(Number(s.latitude));
    const hasLng = s.longitude !== undefined && s.longitude !== null && s.longitude !== "" && Number.isFinite(Number(s.longitude));
    return {
      ...s,
      thumbnail_url: s.thumbnail_url || meta?.thumbnail_url || null,
      status: s.status || meta?.status || undefined,
      latitude: hasLat ? Number(s.latitude) : (meta?.latitude ?? null),
      longitude: hasLng ? Number(s.longitude) : (meta?.longitude ?? null),
    };
  });
  hooks.renderSites();
  hooks.renderUnitSiteOptions();
  hooks.renderUnits();
  hooks.renderDtrSiteOptions();
  hooks.renderPmsSiteOptions();
  hooks.renderPmsChecklist();
  hooks.renderReportSites();
  hooks.renderSearchSiteOptions();
  hooks.renderReports();
  hooks.renderPmsRecordsFilters();
  hooks.renderConnectedPickers?.();
  if (runtime.currentPage === "sites" && (siteMapWasActivated || siteMapInstance)) {
    void refreshVisibleSiteDistances();
  }
}

export async function loadUnits(): Promise<void> {
  const { data, error } = await runtime.client
    .from("site_units")
    .select("id,site_id,unit_name,unit_type,status,brand_model,serial_no,capacity_floors,notes,created_by,created_at")
    .order("unit_name");
  if (error) {
    const hint = $("unitsSetupHint");
    if (hint) {
      hint.classList.remove("hidden");
      hint.textContent = "Run the site_units SQL in Supabase to save units (" + error.message + ")";
    }
    return;
  }
  $("unitsSetupHint")?.classList.add("hidden");
  state.units = data || [];
  hooks.renderUnits();
  hooks.renderConnectedPickers?.();
}

export function timelineReports(): any[] {
  return (state.reports || []).filter(r => {
    const role = state.roles[r.created_by]?.app_role;
    return !role || role === "technician" || role === "representative" || role === "employee";
  });
}

export async function loadReports(): Promise<void> {
  const { data, error } = await runtime.client
    .from("service_delivery_reports")
    .select("id,report_type,site_id,report_date,title,details,created_by,created_at")
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    const box = $("reportList");
    if (box) box.innerHTML = '<p class="muted">Could not load reports: ' + esc(error.message) + "</p>";
    return;
  }
  const previousIds = new Set(state.reports.map(r => String(r.id)));
  const newReports = reportsLoaded ? (data || []).filter((r: any) => !previousIds.has(String(r.id)) && String(r.created_by) !== String(state.userId)) : [];
  state.reports = data || [];
  reportsLoaded = true;
  hooks.renderReports();
  hooks.renderUnits();
  hooks.renderHome();
  hooks.renderNotices();
  if (newReports.length > 0 && !isWithinSelfActionWindow()) {
    const r = newReports[0];
    const typeLbl = r.report_type === "delivery" ? "Delivery Report" : "Service Report";
    triggerAlert("📄 New " + typeLbl, profileName(r.created_by) + ": " + r.title, [250, 100, 250]);
    toast("📄 New " + typeLbl + ": " + r.title);
  }
}

export async function loadPmsRecords(): Promise<void> {
  const { data, error } = await runtime.client
    .from("pms_checklist_records")
    .select("id,site_id,user_id,unit_type,checklist_date,items_passed,items_total,details,created_at")
    .order("checklist_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return;
  state.pmsRecords = data || [];
  hooks.renderPmsRecordsFilters();
  hooks.renderPmsRecords();
  hooks.renderUnits();
}

export async function loadAppNotifications(): Promise<void> {
  const { data, error } = await runtime.client
    .from("app_notifications")
    .select("id,report_id,title,body,created_at,is_read")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return;
  const previousIds = new Set(state.appNotifications.map(item => String(item.id)));
  const newItems = appNotificationsLoaded ? (data || []).filter((item: any) => !previousIds.has(String(item.id))) : [];
  state.appNotifications = data || [];
  appNotificationsLoaded = true;
  let siteMetaUpdated = false;
  const nextMeta: Record<string, { thumbnail_url?: string | null; status?: string | null; latitude?: number | null; longitude?: number | null; updated_at?: string }> = {};
  state.appNotifications.forEach((n: any) => {
    if (!isSiteMetaNotice(n)) return;
    const parsed = parseSiteMetaFromAppNotice(n);
    if (!parsed) return;
    const prev = nextMeta[parsed.site_id];
    const prevTs = prev?.updated_at ? new Date(prev.updated_at).getTime() : 0;
    const curTs = parsed.updated_at ? new Date(parsed.updated_at).getTime() : 0;
    if (!prev || curTs >= prevTs) {
      nextMeta[parsed.site_id] = {
        thumbnail_url: parsed.thumbnail_url !== undefined ? parsed.thumbnail_url : prev?.thumbnail_url,
        status: parsed.status !== undefined ? parsed.status : prev?.status,
        latitude: parsed.latitude !== undefined ? parsed.latitude : prev?.latitude,
        longitude: parsed.longitude !== undefined ? parsed.longitude : prev?.longitude,
        updated_at: parsed.updated_at,
      };
      siteMetaUpdated = true;
    }
  });
  if (siteMetaUpdated) {
    runtime.siteMetaNotices = nextMeta;
    state.sites = (state.sites || []).map((s: any) => {
      const m = nextMeta[String(s.id)];
      if (!m) return s;
      return {
        ...s,
        thumbnail_url: s.thumbnail_url || m.thumbnail_url || null,
        status: s.status || m.status || undefined,
        latitude: Number.isFinite(Number(s.latitude)) && s.latitude !== null ? Number(s.latitude) : (m.latitude ?? null),
        longitude: Number.isFinite(Number(s.longitude)) && s.longitude !== null ? Number(s.longitude) : (m.longitude ?? null),
      };
    });
    hooks.renderSites();
  }
  if (runtime.dtrTimeLogsTableMissing) {
    syncTimeLogsFromAppNotices();
  }
  if (runtime.storiesTableMissing) {
    syncStoriesFromAppNotices();
  }
  hooks.renderNotices();
  hooks.renderHome();
  const visibleNew = newItems.filter((it: any) => !isHiddenSystemNotice(it));
  if (visibleNew.length && !isWithinSelfActionWindow()) {
    const firstTitle = visibleNew[0].title || "Report";
    const cleanBody = stripTimeLogMeta(visibleNew[0].body);
    const alertTitle = /^[📄🟢🔴📅🌴📢💬🔔⚠️]/.test(firstTitle) ? firstTitle : "📄 " + firstTitle;
    triggerAlert(alertTitle, cleanBody);
  }
}

export async function loadApprovalNotifications(): Promise<void> {
  if (!state.userId) return;
  const { data, error } = await runtime.client
    .from("approval_notifications")
    .select("id,title,body,created_at,is_read")
    .eq("recipient_user_id", state.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return;
  const previousIds = new Set(state.approvalNotifications.map(item => String(item.id)));
  const newItems = approvalNotificationsLoaded ? (data || []).filter((item: any) => !previousIds.has(String(item.id))) : [];
  state.approvalNotifications = data || [];
  approvalNotificationsLoaded = true;
  hooks.renderNotices();
  hooks.renderHome();
  if (newItems.length && !isWithinSelfActionWindow()) {
    triggerAlert("🔔 " + (newItems[0].title || "Notification"), newItems[0].body || "");
  }
}

export async function loadSchedules(): Promise<void> {
  const { data, error } = await runtime.client
    .from("schedules")
    .select("id,title,region,scheduled_date,scheduled_time,time_in,time_out,priority,notes,created_at")
    .order("scheduled_date", { ascending: true });
  if (error) { setupError("Could not load schedules", error); return; }
  const prevIds = new Set((hooks.visibleSchedules() || []).map((s: any) => String(s.id)));
  state.schedules = data || [];
  const newlyVisible = schedulesLoaded ? (hooks.visibleSchedules() || []).filter((s: any) => !prevIds.has(String(s.id))) : [];
  schedulesLoaded = true;
  hooks.renderSchedules();
  hooks.renderNotices();
  hooks.renderUnits();
  hooks.renderHome();
  hooks.checkShiftReminders?.();
  hooks.autoFillDtrFromSchedule?.();
  if (newlyVisible.length > 0 && !isWithinSelfActionWindow()) {
    const s = newlyVisible[0];
    triggerAlert("📅 New Schedule", (s.title || "Schedule") + (s.scheduled_date ? " · " + fmtDay(s.scheduled_date) : ""), [300, 100, 300]);
    toast("📅 New Schedule: " + (s.title || ""));
  }
}

export async function loadDtrs(): Promise<void> {
  let rows: any[] | null = null;
  if (!runtime.dtrApprovedByColMissing) {
    const res = await runtime.client
      .from("dtr_entries")
      .select("id,user_id,work_date,location,job,time_in,time_out,overtime_approved,approved_by")
      .order("work_date", { ascending: true });
    if (!res.error) {
      rows = res.data || [];
    } else if (/approved_by|42703|PGRST204/i.test(String(res.error.message || "") + " " + String(res.error.code || ""))) {
      runtime.dtrApprovedByColMissing = true;
    } else {
      setupError("Could not load DTR", res.error);
      return;
    }
  }
  if (rows === null) {
    const { data, error } = await runtime.client
      .from("dtr_entries")
      .select("id,user_id,work_date,location,job,time_in,time_out,overtime_approved")
      .order("work_date", { ascending: true });
    if (error) { setupError("Could not load DTR", error); return; }
    rows = data || [];
  }
  state.dtrs = rows || [];
  hooks.renderDtr();
  hooks.renderHome();
}

function applyStoryRows(rows: any[]): void {
  const nowMs = Date.now();
  const active = (rows || []).filter((s: any) => !s.expires_at || new Date(s.expires_at).getTime() > nowMs);
  const prevIds = new Set((state.stories || []).map((s: any) => String(s.id)));
  const incoming = storiesLoaded
    ? active.filter((s: any) => !prevIds.has(String(s.id)) && String(s.user_id) !== String(state.userId))
    : [];
  state.stories = active;
  storiesLoaded = true;
  hooks.renderChatList?.();
  if (incoming.length > 0 && !isWithinSelfActionWindow()) {
    const s = incoming[0];
    triggerAlert("✨ New My Day Story", (s.sender_name || profileName(s.user_id)) + " shared a story", [180, 90, 180]);
  }
}

function syncStoriesFromAppNotices(): void {
  const rows = (state.appNotifications || [])
    .map((n: any) => parseStoryFromAppNotice(n))
    .filter(Boolean);
  applyStoryRows(rows);
}

export async function loadStories(): Promise<void> {
  if (!state.userId) return;
  if (!runtime.storiesTableMissing) {
    const { data, error } = await runtime.client
      .from("stories")
      .select("id,user_id,sender_name,caption,media_url,media_type,bg_style,expires_at,created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(120);
    if (!error) {
      runtime.storiesTableMissing = false;
      applyStoryRows(data || []);
      return;
    }
    if (!isMissingTableError(error)) {
      console.warn("Could not load stories:", error?.message || error);
      return;
    }
    runtime.storiesTableMissing = true;
  }
  if (!appNotificationsLoaded) {
    await loadAppNotifications();
  } else {
    syncStoriesFromAppNotices();
  }
}

function applyTimeLogRows(rows: any[]): void {
  const prevIds = new Set((state.dtrTimeLogs || []).map((r: any) => String(r.id)));
  const incoming = dtrTimeLogsLoaded
    ? rows.filter((r: any) => !prevIds.has(String(r.id)) && String(r.user_id) !== String(state.userId))
    : [];
  state.dtrTimeLogs = rows;
  dtrTimeLogsLoaded = true;
  hooks.renderTimeLog?.();
  if (incoming.length > 0 && !isWithinSelfActionWindow()) {
    const r = incoming[0];
    const lbl = r.mode === "time_out" ? "Time Out" : "Time In";
    const who = r.sender_name || profileName(r.user_id);
    const when = r.time_12 || r.time_24 ? " (" + (r.time_12 || r.time_24) + ")" : "";
    const where = r.location ? " · " + r.location : "";
    const msg = who + " uploaded " + lbl + when + where;
    triggerAlert((r.mode === "time_out" ? "🔴 " : "🟢 ") + lbl + " Uploaded", msg, [200, 100, 200]);
    toast((r.mode === "time_out" ? "🔴 " : "🟢 ") + msg);
  }
}

function syncTimeLogsFromAppNotices(): void {
  const rows = (state.appNotifications || [])
    .map((n: any) => parseTimeLogFromAppNotice(n))
    .filter(Boolean);
  applyTimeLogRows(rows);
}

export async function loadTimeLogs(): Promise<void> {
  if (!state.userId) return;
  if (!runtime.dtrTimeLogsTableMissing) {
    const { data, error } = await runtime.client
      .from("dtr_time_logs")
      .select("id,user_id,sender_name,mode,work_date,time_24,time_12,location,unit,note,ai_summary,image_url,dtr_entry_id,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error) {
      runtime.dtrTimeLogsTableMissing = false;
      applyTimeLogRows(data || []);
      return;
    }
    if (!isMissingTableError(error)) {
      console.warn("Could not load time logs:", error?.message || error);
      return;
    }
    runtime.dtrTimeLogsTableMissing = true;
  }
  if (!appNotificationsLoaded) {
    await loadAppNotifications();
  } else {
    syncTimeLogsFromAppNotices();
  }
}

export async function loadNotes(): Promise<void> {
  const { data, error } = await runtime.client
    .from("notes")
    .select("id,user_id,title,body,created_at")
    .order("created_at", { ascending: false });
  if (error) { setupError("Could not load notes", error); return; }
  state.notes = data || [];
  hooks.renderNotes();
}

export async function loadRecs(): Promise<void> {
  const { data, error } = await runtime.client
    .from("recommendations")
    .select("id,user_id,condition,part,reason,site,location:specific_location,created_at,recommendation_comments(id,user_id,comment,created_at)")
    .order("created_at", { ascending: false });
  if (error) { setupError("Could not load recommendations", error); return; }
  state.recs = data || [];
  hooks.renderRecs();
  hooks.renderUnits();
}

export async function loadAnnouncements(): Promise<void> {
  const { data, error } = await runtime.client
    .from("announcements")
    .select("id,title,body,author_id,author_name,created_at")
    .order("created_at", { ascending: false });
  if (error) { setupError("Could not load announcements", error); return; }
  const previousIds = new Set(state.announcements.map(item => String(item.id)));
  const newAnnouncements = announcementsLoaded ? (data || []).filter((item: any) => !previousIds.has(String(item.id))) : [];
  state.announcements = data || [];
  announcementsLoaded = true;
  hooks.renderAnnouncements();
  hooks.renderNotices();
  hooks.renderHome();
  if (newAnnouncements.length > 0 && !isWithinSelfActionWindow()) {
    triggerAlert("📢 New Announcement", newAnnouncements[0].title + ": " + newAnnouncements[0].body, [300, 100, 300, 100, 300]);
    toast("📢 New Announcement: " + newAnnouncements[0].title);
    hooks.updateAnnouncementTicker();
  }
}

export async function loadPending(): Promise<void> {
  if (!isManager()) { state.pending = []; hooks.renderPending(); return; }
  const { data, error } = await runtime.client
    .from("registration_requests")
    .select("id,user_id,full_name,email,requested_role,status,created_at,id_no,address,team,phone,area")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) { setupError("Could not load pending registrations", error); return; }
  state.pending = data || [];
  hooks.renderPending();
  hooks.renderNotices();
  hooks.renderHome();
}

export async function loadPreviews(): Promise<void> {
  const ids = state.threads.map(t => t.id);
  state.previews = {};
  if (!ids.length) return;
  const { data, error } = await runtime.client
    .from("messages")
    .select("id,thread_id,user_id,sender_name,body,attachment_name,attachment_type,created_at,deleted_at")
    .in("thread_id", ids)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) return;
  const hiddenForMe = getDeletedForMeSet();
  (data || []).forEach((m: any) => {
    if (hiddenForMe.has(String(m.id))) return;
    const key = String(m.thread_id);
    if (!state.previews[key]) state.previews[key] = m;
  });
}

export async function loadRecentChatNotices(): Promise<void> {
  if (!state.userId) return;
  const ids = state.threads.map(t => t.id);
  if (!ids.length) { state.recentChatNotices = []; return; }
  const { data, error } = await runtime.client
    .from("messages")
    .select("id,thread_id,user_id,sender_name,body,attachment_name,attachment_type,created_at")
    .in("thread_id", ids)
    .neq("user_id", state.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return;
  state.recentChatNotices = data || [];
  hooks.renderNotices();
  hooks.renderHome();
}

export async function loadBlockedUsers(): Promise<void> {
  if (!state.userId) return;
  const { data } = await runtime.client.from("user_blocks").select("blocked_id").eq("blocker_id", state.userId);
  state.blockedUsers = (data || []).map((row: any) => row.blocked_id);
}

export async function loadThreads(): Promise<void> {
  if (!state.userId) return;
  const { data, error } = await runtime.client
    .from("threads")
    .select("id,kind,title,created_at,thread_members(user_id,last_read_at)")
    .order("created_at", { ascending: false });
  if (error) return;
  state.threads = data || [];
  if (state.activeThread && !state.threads.some(t => String(t.id) === String(state.activeThread))) hooks.closeChat();
  await loadPreviews();
  hooks.renderChatList();
}

export async function loadUnread(): Promise<void> {
  if (!state.userId) return;
  const ids = state.threads.map(t => t.id);
  if (!ids.length) { state.unread = {}; hooks.renderHome(); hooks.renderNotices(); return; }
  const lastRead: Record<string, string> = {};
  let min: string | null = null;
  state.threads.forEach(t => {
    const me = (t.thread_members || []).find((m: any) => String(m.user_id) === String(state.userId));
    const at = me?.last_read_at || "1970-01-01T00:00:00Z";
    lastRead[String(t.id)] = at;
    if (!min || at < min) min = at;
  });
  const { data, error } = await runtime.client
    .from("messages")
    .select("id,thread_id,user_id,created_at")
    .in("thread_id", ids)
    .is("deleted_at", null)
    .gt("created_at", min)
    .limit(1000);
  if (error) { setupError("Could not load unread counts", error); return; }
  const counts: Record<string, number> = {};
  (data || []).forEach((m: any) => {
    if (String(m.user_id) === String(state.userId)) return;
    const tid = String(m.thread_id);
    if (new Date(m.created_at) > new Date(lastRead[tid] || 0)) {
      counts[tid] = (counts[tid] || 0) + 1;
    }
  });
  state.unread = counts;
  hooks.renderHome();
  hooks.renderNotices();
  hooks.renderChatList();
}

export async function loadMessages(threadId: string): Promise<void> {
  const { data, error } = await runtime.client
    .from("messages")
    .select("id,thread_id,user_id,sender_name,body,attachment_url,attachment_name,attachment_type,created_at,deleted_at,is_pinned,message_reactions(emoji,user_id),edited_at,reply_to_id")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (String(state.activeThread) !== String(threadId)) return;
  if (error) { toast("Could not load messages: " + error.message); return; }
  state.messages = data || [];
  if (runtime.editingMessageId && !state.messages.some(m => String(m.id) === String(runtime.editingMessageId) && !m.deleted_at)) {
    runtime.editingMessageId = null;
    setVal("messageText", "");
    hooks.updateSendBtn();
  }
  if (runtime.replyingToMsg && !state.messages.some(m => String(m.id) === String(runtime.replyingToMsg.id) && !m.deleted_at)) {
    hooks.cancelReply();
  }
  hooks.renderMessages();
  if (state.messages.some(m => String(m.user_id) !== String(state.userId))) {
    await runtime.client.rpc("mark_thread_messages_delivered", { p_thread_id: threadId });
  }
}

/* ==================== LIVE SYNC ==================== */
let realtimeChannel: any = null;
let presenceChannel: any = null;
let retryTimer: any = null;
const timers: Record<string, any> = {};
let lastOnlineKey = "";
let liveRetryDelay = 15000;

export function onlineIds(): Set<string> {
  const ids = new Set<string>();
  Object.values(state.presence).forEach((metas: any) =>
    (metas || []).forEach((m: any) => { if (m.user_id) ids.add(String(m.user_id)); })
  );
  return ids;
}

export async function refreshOwnRole(): Promise<void> {
  if (!state.userId) return;
  const { data, error } = await runtime.client
    .from("user_roles")
    .select("app_role,approval_status")
    .eq("user_id", state.userId)
    .maybeSingle();
  if (error) return;
  if (!data || data.approval_status !== "approved") {
    await runtime.client.auth.signOut();
    hooks.showAuth("Your account access changed. Contact an administrator.");
    return;
  }
  if (data.app_role !== state.role) {
    state.role = data.app_role;
    const rl = $("roleLabel");
    if (rl) rl.textContent = roleLabel(state.role);
    hooks.updateAccess();
    hooks.renderAll();
    loadRoles();
  }
}

export async function handleIncomingMessage(): Promise<void> {
  if (!state.userId) return;
  const previousUnread = { ...state.unread };
  const thread = state.activeThread;
  const previousChatIds = new Set(state.recentChatNotices.map(m => String(m.id)));
  await loadPreviews();
  await loadThreads();
  await loadRecentChatNotices();
  let activeIncoming: any[] = [];
  if (thread) {
    const { data, error } = await runtime.client
      .from("messages")
      .select("id,thread_id,user_id,sender_name,body,attachment_url,attachment_name,attachment_type,created_at,deleted_at,is_pinned,edited_at,reply_to_id,message_reactions(emoji,user_id)")
      .eq("thread_id", thread)
      .order("created_at", { ascending: true })
      .limit(300);
    if (!error && String(state.activeThread) === String(thread)) {
      const previousIds = new Set(state.messages.map(m => String(m.id)));
      activeIncoming = (data || []).filter((m: any) => String(m.user_id) !== String(state.userId) && !previousIds.has(String(m.id)));
      state.messages = data || [];
      hooks.renderMessages();
      hooks.markThreadRead?.(thread);
    }
  }
  await loadUnread();
  const newChatNotice = state.recentChatNotices.find(m => !previousChatIds.has(String(m.id)));
  const unreadIncreased = Object.keys(state.unread).some(
    id => String(id) !== String(state.activeThread) && !hooks.isMuted(id) && (state.unread[id] || 0) > (previousUnread[id] || 0)
  );
  const activeNewUnmuted = !!state.activeThread && !hooks.isMuted(state.activeThread) && activeIncoming.length > 0;
  if ((unreadIncreased || activeNewUnmuted || !!newChatNotice) && !isWithinSelfActionWindow()) {
    const isMutedThread = newChatNotice && hooks.isMuted(String(newChatNotice.thread_id));
    if (!isMutedThread) {
      const bodyText = newChatNotice
        ? (newChatNotice.sender_name || "Member") + ": " + (newChatNotice.body || "Attachment")
        : "You have unread message(s).";
      triggerAlert("💬 New Chat Message", bodyText, [200, 100, 200]);
    }
  }
  hooks.renderChatList();
}

const RELOADERS: Record<string, () => Promise<any> | any> = {
  message_reactions: () => { if (state.activeThread) return loadMessages(state.activeThread); },
  profiles: () => loadProfiles(),
  user_roles: () => refreshOwnRole(),
  sites: () => loadSites(),
  site_units: () => loadUnits(),
  schedules: () => loadSchedules(),
  dtr_entries: () => loadDtrs(),
  dtr_time_logs: () => loadTimeLogs(),
  notes: () => loadNotes(),
  announcements: () => loadAnnouncements(),
  recommendations: () => loadRecs(),
  recommendation_comments: () => loadRecs(),
  registration_requests: () => loadPending(),
  threads: () => loadThreads(),
  thread_members: () => loadThreads().then(() => { if (state.activeThread) hooks.renderMessages(); }),
  messages: () => handleIncomingMessage(),
  app_notifications: () => loadAppNotifications(),
  service_delivery_reports: () => loadReports(),
  pms_checklist_records: () => loadPmsRecords(),
  leave_requests: () => loadLeaveRequests(),
  approval_notifications: () => loadApprovalNotifications(),
  user_blocks: () => loadBlockedUsers(),
  stories: () => loadStories(),
};
const LIVE_TABLES = Object.keys(RELOADERS);

function queueReload(table: string): void {
  clearTimeout(timers[table]);
  timers[table] = setTimeout(async () => {
    delete timers[table];
    if (!state.userId) return;
    const fn = RELOADERS[table];
    if (fn) await fn();
    if (table !== "messages") {
      hooks.renderHome();
      hooks.renderNotices();
      if (runtime.currentPage === "admin" && (table === "profiles" || table === "user_roles" || table === "registration_requests")) {
        hooks.renderAdmin();
      }
    }
    if (!isWithinSelfActionWindow()) {
      if (table === "recommendations" || table === "recommendation_comments") {
        triggerAlert("📌 New Recommendation", "A new recommendation or comment was added.", [200, 100, 200]);
      } else if (table === "registration_requests" && isManager()) {
        triggerAlert("⏳ Pending Registration", "A new user is waiting for approval.", [200, 100, 200]);
      }
    }
  }, 280);
}

export function teardownLive(): void {
  Object.keys(timers).forEach(t => { clearTimeout(timers[t]); delete timers[t]; });
  clearTimeout(retryTimer);
  retryTimer = null;
  lastOnlineKey = "";
  if (runtime.locationWatchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(runtime.locationWatchId);
    runtime.locationWatchId = null;
  }
  if (locationHeartbeatTimer) {
    clearInterval(locationHeartbeatTimer);
    locationHeartbeatTimer = null;
  }
  if (realtimeChannel && runtime.client) { runtime.client.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (presenceChannel && runtime.client) { runtime.client.removeChannel(presenceChannel); presenceChannel = null; }
  hooks.endActiveCall();
  hooks.hideIncoming();
  hooks.stopCallListener();
  hooks.clearTyping();
  state.presence = {};
  setLive(false);
}

export function startLive(): void {
  teardownLive();
  if (!state.userId || !runtime.client) return;
  const channel = runtime.client.channel("eesi-db-" + state.userId);
  LIVE_TABLES.forEach(table => channel.on("postgres_changes", { event: "*", schema: "public", table }, () => queueReload(table)));
  channel.subscribe((status: string) => {
    if (status === "SUBSCRIBED") {
      liveRetryDelay = 15000;
      setLive(true);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      setLive(false);
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { if (state.userId) startLive(); }, liveRetryDelay);
      liveRetryDelay = Math.min(60000, liveRetryDelay * 2);
    } else if (status === "CLOSED") {
      setLive(false);
    }
  });
  realtimeChannel = channel;

  const presence = runtime.client.channel("eesi-presence", { config: { presence: { key: state.userId } } });
  presence.on("presence", { event: "sync" }, () => {
    state.presence = presence.presenceState();
    const key = [...onlineIds()].sort().join(",");
    if (key === lastOnlineKey) return;
    lastOnlineKey = key;
    hooks.renderOnline();
    hooks.renderMembers();
    hooks.renderHome();
    hooks.renderChatList();
    hooks.renderLiveOnlineMembers?.();
  });
  presence.subscribe(async (status: string) => {
    if (status === "SUBSCRIBED") {
      await presence.track({
        user_id: state.userId,
        name: state.profile?.full_name || state.email,
        online_at: new Date().toISOString(),
      });
    }
  });
  presenceChannel = presence;
  hooks.startCallListener();
}

export async function reloadEverything(): Promise<void> {
  if (!state.userId) return;
  await Promise.all([
    loadProfiles(),
    loadRoles(),
    loadSites(),
    loadUnits(),
    loadSchedules(),
    loadDtrs(),
    loadTimeLogs(),
    loadNotes(),
    loadRecs(),
    loadAnnouncements(),
    loadPending(),
    loadThreads(),
    loadLeaveRequests(),
    loadReports(),
    loadPmsRecords(),
    loadStories(),
  ]);
  await loadUnread();
  await loadRecentChatNotices();
  hooks.renderAll();
  if (state.activeThread) await loadMessages(state.activeThread);
}

/* ==================== LIVE MAP & ALWAYS-ON GPS LOCATION SHARING ==================== */
let locationHeartbeatTimer: any = null;
let lastLocationUploadAt = 0;
let lastKnownCoords: { lat: number; lng: number; acc: number; updatedAt: number } | null = null;
let locationLifecycleBound = false;

function recordLocalPosition(pos: GeolocationPosition): void {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const acc = Math.round(pos.coords.accuracy || 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const now = Date.now();
  // Prefer significantly more accurate recent fixes unless older than 45s
  if (
    lastKnownCoords &&
    now - lastKnownCoords.updatedAt < 45000 &&
    acc > Math.max(250, lastKnownCoords.acc * 2.5)
  ) {
    return;
  }
  lastKnownCoords = { lat, lng, acc, updatedAt: now };

  const statusEl = $("locationStatus");
  if (statusEl) {
    statusEl.classList.remove("hidden");
    statusEl.textContent = "Live GPS: " + lat.toFixed(5) + ", " + lng.toFixed(5) + " (±" + acc + " m)";
  }
  if (Math.abs(lat - runtime.lastWeatherLat) > 0.02 || Math.abs(lng - runtime.lastWeatherLon) > 0.02) {
    updateLiveWeather(lat, lng);
  }
}

async function uploadEmployeeCoordinates(pos: GeolocationPosition, isInitial = false): Promise<void> {
  recordLocalPosition(pos);
  if (!state.userId || !runtime.client) return;
  const statusEl = $("locationStatus");
  const acc = Math.round(pos.coords.accuracy || 0);
  // Accept indoor / Wi-Fi / network fixes up to 5000m when we don't have a recent upload yet,
  // while continuing to refine whenever finer GPS fixes arrive.
  const hasRecentUpload = lastLocationUploadAt > 0 && Date.now() - lastLocationUploadAt < 120000;
  const maxAcc = !hasRecentUpload ? 5000 : isInitial ? 1000 : 500;
  if (acc > maxAcc) {
    if (statusEl) {
      statusEl.classList.remove("hidden");
      statusEl.textContent = "Refining GPS signal (±" + acc + " m)…";
    }
    return;
  }
  const now = Date.now();
  if (!isInitial && now - lastLocationUploadAt < 5000) return;
  lastLocationUploadAt = now;

  const { latitude, longitude } = pos.coords;
  if (statusEl) {
    statusEl.classList.remove("hidden");
    statusEl.textContent = "Live GPS: " + latitude.toFixed(5) + ", " + longitude.toFixed(5) + " (±" + acc + " m)";
  }
  await runtime.client
    .from("employee_locations")
    .upsert({ user_id: state.userId, latitude, longitude, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

function handleGeoFix(pos: GeolocationPosition, isInitial = false): void {
  if (state.userId && runtime.client) {
    void uploadEmployeeCoordinates(pos, isInitial);
  } else {
    recordLocalPosition(pos);
  }
}

function startLocationWatch(): void {
  const statusEl = $("locationStatus");
  if (!navigator.geolocation) {
    if (statusEl) {
      statusEl.classList.remove("hidden");
      statusEl.textContent = "This device cannot share location.";
    }
    return;
  }
  if (statusEl) {
    statusEl.classList.remove("hidden");
    if (!lastKnownCoords) statusEl.textContent = "Acquiring GPS location…";
  }

  navigator.geolocation.getCurrentPosition(
    pos => { handleGeoFix(pos, true); },
    () => {
      // High-accuracy GPS can time out indoors; fall back to network/Wi-Fi geolocation immediately
      navigator.geolocation.getCurrentPosition(
        pos => { handleGeoFix(pos, true); },
        err => {
          if (statusEl && !lastKnownCoords) {
            statusEl.textContent = err.code === 1
              ? "GPS permission needed — allow Location access to keep Live GPS active."
              : "Acquiring GPS location…";
          }
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 12000 }
      );
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 }
  );

  if (runtime.locationWatchId == null) {
    runtime.locationWatchId = navigator.geolocation.watchPosition(
      pos => { handleGeoFix(pos, false); },
      err => {
        if (err?.code === 1 && statusEl && !lastKnownCoords) {
          statusEl.textContent = "Location permission denied — please enable device GPS.";
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }

  if (locationHeartbeatTimer) clearInterval(locationHeartbeatTimer);
  locationHeartbeatTimer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    navigator.geolocation.getCurrentPosition(
      pos => { handleGeoFix(pos, false); },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  }, 15000);
}

export function initAlwaysOnLocation(): void {
  startLocationWatch();
  if (locationLifecycleBound) return;
  locationLifecycleBound = true;

  const refreshFix = () => {
    if (document.visibilityState === "visible") startLocationWatch();
  };
  document.addEventListener("visibilitychange", refreshFix);
  window.addEventListener("focus", refreshFix);

  try {
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "geolocation" as PermissionName }).then(perm => {
        perm.onchange = () => {
          if (perm.state === "granted") {
            if (runtime.locationWatchId != null) {
              try { navigator.geolocation.clearWatch(runtime.locationWatchId); } catch {}
              runtime.locationWatchId = null;
            }
            startLocationWatch();
          }
        };
      }).catch(() => {});
    }
  } catch {}
}

export function startEmployeeLocationSharing(): void {
  initAlwaysOnLocation();
  if (state.userId && runtime.client && lastKnownCoords) {
    const c = lastKnownCoords;
    lastLocationUploadAt = Date.now();
    void runtime.client
      .from("employee_locations")
      .upsert(
        { user_id: state.userId, latitude: c.lat, longitude: c.lng, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  }
}

const MAPS_ATTRIBUTION_ID = "gmp_mcp_codeassist_v1_aistudio";
let mapsConfigured = false;

function getGoogleMapsKey(): string {
  return String((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || "").trim();
}

async function loadGoogleMapsLibraries(): Promise<{
  Map: typeof google.maps.Map;
  InfoWindow: typeof google.maps.InfoWindow;
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
  LatLngBounds: typeof google.maps.LatLngBounds;
  UnitSystem: typeof google.maps.UnitSystem;
  Place: typeof google.maps.places.Place;
  AutocompleteSuggestion: typeof google.maps.places.AutocompleteSuggestion;
  AutocompleteSessionToken: typeof google.maps.places.AutocompleteSessionToken;
  Route: typeof google.maps.routes.Route;
  RouteMatrix: typeof google.maps.routes.RouteMatrix;
  spherical: typeof google.maps.geometry.spherical;
}> {
  const apiKey = getGoogleMapsKey();
  if (!apiKey) {
    throw new Error("Google Maps API key (VITE_GOOGLE_MAPS_API_KEY) is not configured.");
  }
  if (!mapsConfigured) {
    setOptions({ key: apiKey, v: "weekly" });
    mapsConfigured = true;
  }
  const [mapsLib, markerLib, coreLib, placesLib, routesLib, geometryLib] = await Promise.all([
    importLibrary("maps") as Promise<google.maps.MapsLibrary>,
    importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
    importLibrary("core") as Promise<google.maps.CoreLibrary>,
    importLibrary("places") as Promise<google.maps.PlacesLibrary>,
    importLibrary("routes") as Promise<google.maps.RoutesLibrary>,
    importLibrary("geometry") as Promise<google.maps.GeometryLibrary>,
  ]);
  return {
    Map: mapsLib.Map,
    InfoWindow: mapsLib.InfoWindow,
    AdvancedMarkerElement: markerLib.AdvancedMarkerElement,
    LatLngBounds: coreLib.LatLngBounds,
    UnitSystem: coreLib.UnitSystem,
    Place: placesLib.Place,
    AutocompleteSuggestion: placesLib.AutocompleteSuggestion,
    AutocompleteSessionToken: placesLib.AutocompleteSessionToken,
    Route: routesLib.Route,
    RouteMatrix: routesLib.RouteMatrix,
    spherical: geometryLib.spherical,
  };
}

let liveMapInstance: google.maps.Map | null = null;
let liveInfoWindow: google.maps.InfoWindow | null = null;
let liveFitted = false;
let liveBusy = false;
let liveLastPoints: Array<{ lat: number; lng: number }> = [];
let liveAllLocationRows: any[] = [];
const liveMarkers = new Map<
  string,
  { marker: google.maps.marker.AdvancedMarkerElement; infoHtml: string; position: { lat: number; lng: number } }
>();
const LIVE_REFRESH_MS = 10000;
const LIVE_STALE_MS = 5 * 60 * 1000;

const BASEMAPS: Record<string, "roadmap" | "hybrid" | "terrain"> = {
  map: "roadmap",
  satellite: "hybrid",
  terrain: "terrain",
};

function buildEmployeePinElement(name: string, fresh: boolean): HTMLElement {
  const el = document.createElement("div");
  const initial = (name.trim()[0] || "M").toUpperCase();
  el.textContent = initial;
  el.style.cssText =
    `width:28px;height:28px;border-radius:50%;display:grid;place-items:center;` +
    `font-weight:800;font-size:12px;color:#fff;cursor:pointer;` +
    `border:2px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,.45);` +
    `background:${fresh ? "#22c55e" : "#64748b"};`;
  return el;
}

export function setBasemap(name: string): void {
  const mapType = BASEMAPS[name];
  if (!mapType) return;
  if (liveMapInstance) {
    liveMapInstance.setMapTypeId(mapType);
  }
  localStorage.setItem("eesi-basemap", name);
  document.querySelectorAll<HTMLElement>("[data-basemap]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.basemap === name)
  );
}

export function setLiveMapFilter(filter: string): void {
  runtime.liveMapFilter = filter || "all";
  document.querySelectorAll<HTMLElement>("[data-livemap-filter]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.livemapFilter === runtime.liveMapFilter)
  );
  renderLiveOnlineMembersList();
  loadLiveMap({ fit: true });
}

async function ensureLiveMap(): Promise<google.maps.Map | null> {
  const el = $("liveMap");
  if (!el) return null;
  if (liveMapInstance) return liveMapInstance;
  const { Map, InfoWindow } = await loadGoogleMapsLibraries();
  const saved = localStorage.getItem("eesi-basemap") || "map";
  const initialType = BASEMAPS[saved] || "roadmap";
  liveMapInstance = new Map(el, {
    center: { lat: 12.8797, lng: 121.774 },
    zoom: 6,
    mapId: "DEMO_MAP_ID",
    mapTypeId: initialType,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
  } as any);
  liveInfoWindow = new InfoWindow();
  setBasemap(BASEMAPS[saved] ? saved : "map");
  return liveMapInstance;
}

async function fitLiveMap(points: Array<{ lat: number; lng: number }>): Promise<void> {
  if (!liveMapInstance || !points.length) return;
  if (points.length === 1) {
    liveMapInstance.setCenter(points[0]);
    liveMapInstance.setZoom(16);
    return;
  }
  const { LatLngBounds } = await loadGoogleMapsLibraries();
  const bounds = new LatLngBounds();
  points.forEach(pt => bounds.extend(pt));
  liveMapInstance.fitBounds(bounds, 40);
}

export function fitLiveMapAll(): void {
  void fitLiveMap(liveLastPoints);
}

export function renderLiveOnlineMembersList(): void {
  const listEl = $("liveOnlineMembersList");
  const countEl = $("liveOnlineCount");
  if (!listEl && !countEl) return;
  if (!isManager()) {
    if (countEl) countEl.textContent = "0";
    if (listEl) listEl.innerHTML = "";
    return;
  }

  const ids = onlineIds();
  const filter = runtime.liveMapFilter || "all";
  const locByUser = new Map<string, any>();
  liveAllLocationRows.forEach((r: any) => {
    if (r?.user_id) locByUser.set(String(r.user_id), r);
  });

  const onlineMembers = (state.profiles || []).filter(p => {
    const uid = String(p.user_id || "");
    if (!uid || !ids.has(uid)) return false;
    if (filter === "technician" || filter === "representative" || filter === "employee") {
      const userRole = state.roles[uid]?.app_role || "employee";
      return userRole === filter;
    }
    return true;
  });

  onlineMembers.sort((a, b) => {
    const aHasLoc = locByUser.has(String(a.user_id)) ? 1 : 0;
    const bHasLoc = locByUser.has(String(b.user_id)) ? 1 : 0;
    if (aHasLoc !== bHasLoc) return bHasLoc - aHasLoc;
    return String(a.full_name || "").localeCompare(String(b.full_name || ""));
  });

  if (countEl) countEl.textContent = String(onlineMembers.length);
  if (!listEl) return;
  if (!onlineMembers.length) {
    listEl.innerHTML = '<p class="muted" style="margin:0;">No online members right now.</p>';
    return;
  }

  const now = Date.now();
  listEl.innerHTML = onlineMembers
    .map(p => {
      const uid = String(p.user_id);
      const userRole = state.roles[uid]?.app_role || "employee";
      const roleText = roleLabel(userRole);
      const areaTeam = [p.team, p.area].filter(Boolean).join(" · ");
      const loc = locByUser.get(uid);
      const hasCoords = !!loc && Number.isFinite(+loc.latitude) && Number.isFinite(+loc.longitude);
      const fresh = hasCoords && now - new Date(loc.updated_at).getTime() <= LIVE_STALE_MS;
      const age = hasCoords ? formatAgeLabel(loc.updated_at) : "";
      const gpsLabel = hasCoords
        ? `${fresh ? "🟢 GPS Live" : "🟡 Last GPS"} (${age})`
        : "⚪ Waiting for GPS";

      return (
        `<div class="person clickable" style="margin-bottom:6px;" onclick="focusLiveEmployee('${esc(uid)}')">` +
        face(p) +
        `<span class="person-info">` +
        `<b>${esc(p.full_name || "Member")} <span class="badge">${esc(roleText)}</span></b>` +
        `<span class="muted"><span class="online-dot on"></span>Online${areaTeam ? " · " + esc(areaTeam) : ""} · ${esc(gpsLabel)}</span>` +
        `</span>` +
        `<button class="btn small-btn" type="button" onclick="event.stopPropagation();focusLiveEmployee('${esc(uid)}')">📍 Locate</button>` +
        `</div>`
      );
    })
    .join("");
}

export async function focusLiveEmployee(userId: string): Promise<void> {
  const uid = String(userId || "");
  if (!uid) return;
  const map = await ensureLiveMap();
  if (!map) return;

  let entry = liveMarkers.get(uid);
  if (!entry) {
    let locRow = liveAllLocationRows.find((r: any) => String(r.user_id) === uid);
    if (!locRow && runtime.client) {
      const { data } = await runtime.client
        .from("employee_locations")
        .select("user_id,latitude,longitude,updated_at")
        .eq("user_id", uid)
        .maybeSingle();
      if (data && Number.isFinite(+data.latitude) && Number.isFinite(+data.longitude)) {
        locRow = data;
      }
    }
    if (!locRow) {
      toast(`${profileName(uid)} is online, but GPS location is not shared yet.`);
      return;
    }

    const { AdvancedMarkerElement } = await loadGoogleMapsLibraries();
    const p = profileOf(uid);
    const name = p ? p.full_name : "Member";
    const userRole = state.roles[uid]?.app_role || "employee";
    const roleText = roleLabel(userRole);
    const areaTeam = [p?.team, p?.area].filter(Boolean).join(" · ");
    const fresh = Date.now() - new Date(locRow.updated_at).getTime() <= LIVE_STALE_MS;
    const age = formatAgeLabel(locRow.updated_at);
    const position = { lat: +locRow.latitude, lng: +locRow.longitude };
    const infoHtml =
      `<div style="font-size:13px;line-height:1.4;">` +
      `<b>${esc(name)}</b><br>` +
      `<span>${esc(roleText)}${areaTeam ? " · " + esc(areaTeam) : ""}</span><br>` +
      `<span>${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}</span><br>` +
      `<small>${esc(fmtDate(locRow.updated_at))} (${esc(age)}${fresh ? " · LIVE" : " · stale"})</small>` +
      `</div>`;
    const marker = new AdvancedMarkerElement({
      map,
      position,
      title: name,
      content: buildEmployeePinElement(name, fresh),
    });
    entry = { marker, infoHtml, position };
    marker.addListener("click", () => {
      if (liveInfoWindow && liveMapInstance) {
        liveInfoWindow.setContent(entry!.infoHtml);
        liveInfoWindow.open({ map: liveMapInstance, anchor: entry!.marker });
      }
    });
    liveMarkers.set(uid, entry);
  }

  try { google.maps.event.trigger(map, "resize"); } catch {}
  map.setCenter(entry.position);
  map.panTo(entry.position);
  map.setZoom(17);
  if (liveInfoWindow) {
    liveInfoWindow.setContent(entry.infoHtml);
    liveInfoWindow.open({ map, anchor: entry.marker });
  }
  $("liveMap")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function formatAgeLabel(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 15) return "just now";
  if (diffSec < 60) return diffSec + "s ago";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  return hrs + "h ago";
}

export async function loadLiveMap(opts: { fit?: boolean } = {}): Promise<void> {
  if (!$("liveMap") || !isManager() || liveBusy) return;
  liveBusy = true;
  const statusEl = $("liveLocationStatus");
  const listEl = $("liveLocationList");
  try {
    const { data, error } = await runtime.client.from("employee_locations").select("user_id,latitude,longitude,updated_at");
    if (error) throw error;
    const [{ AdvancedMarkerElement }, map] = await Promise.all([
      loadGoogleMapsLibraries(),
      ensureLiveMap(),
    ]);
    if (!map) return;

    const filter = runtime.liveMapFilter || "all";
    const now = Date.now();
    const allRows = (data || []).filter((r: any) => Number.isFinite(+r.latitude) && Number.isFinite(+r.longitude));
    liveAllLocationRows = allRows;
    renderLiveOnlineMembersList();
    const filteredRows = allRows.filter((row: any) => {
      const userRole = state.roles[row.user_id]?.app_role || "employee";
      const fresh = now - new Date(row.updated_at).getTime() <= LIVE_STALE_MS;
      if (filter === "live") return fresh;
      if (filter === "technician" || filter === "representative" || filter === "employee") {
        return userRole === filter;
      }
      return true;
    });

    const seen = new Set<string>();
    const points: Array<{ lat: number; lng: number }> = [];
    const items: Array<{ row: any; name: string; roleText: string; areaTeam: string; fresh: boolean; age: string }> = [];

    filteredRows.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    filteredRows.forEach((row: any) => {
      const p = profileOf(row.user_id);
      const name = p ? p.full_name : "Member";
      const userRole = state.roles[row.user_id]?.app_role || "employee";
      const roleText = roleLabel(userRole);
      const areaTeam = [p?.team, p?.area].filter(Boolean).join(" · ");
      const fresh = now - new Date(row.updated_at).getTime() <= LIVE_STALE_MS;
      const age = formatAgeLabel(row.updated_at);
      const position = { lat: +row.latitude, lng: +row.longitude };
      const infoHtml =
        `<div style="font-size:13px;line-height:1.4;">` +
        `<b>${esc(name)}</b><br>` +
        `<span>${esc(roleText)}${areaTeam ? " · " + esc(areaTeam) : ""}</span><br>` +
        `<span>${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}</span><br>` +
        `<small>${esc(fmtDate(row.updated_at))} (${esc(age)}${fresh ? " · LIVE" : " · stale"})</small>` +
        `</div>`;
      seen.add(row.user_id);
      points.push(position);
      items.push({ row, name, roleText, areaTeam, fresh, age });

      const existing = liveMarkers.get(row.user_id);
      if (!existing) {
        const marker = new AdvancedMarkerElement({
          map,
          position,
          title: name,
          content: buildEmployeePinElement(name, fresh),
        });
        const entry = { marker, infoHtml, position };
        marker.addListener("click", () => {
          if (liveInfoWindow && liveMapInstance) {
            liveInfoWindow.setContent(entry.infoHtml);
            liveInfoWindow.open({ map: liveMapInstance, anchor: entry.marker });
          }
        });
        liveMarkers.set(row.user_id, entry);
      } else {
        existing.marker.position = position;
        existing.marker.title = name;
        existing.marker.content = buildEmployeePinElement(name, fresh);
        existing.infoHtml = infoHtml;
        existing.position = position;
      }
    });

    for (const [id, entry] of liveMarkers) {
      if (!seen.has(id)) {
        entry.marker.map = null;
        liveMarkers.delete(id);
      }
    }

    liveLastPoints = points;
    if (opts.fit || !liveFitted) {
      await fitLiveMap(points);
      liveFitted = points.length > 0;
    }

    const freshCount = items.filter(i => i.fresh).length;
    if (statusEl) {
      statusEl.textContent =
        items.length + " shown (" + freshCount + " live in last 5 min) · Auto-refresh every 10s · Last reload " + new Date().toLocaleTimeString();
    }
    if (listEl) {
      listEl.innerHTML = items.map(({ row, name, roleText, areaTeam, fresh, age }) =>
        '<div class="item" style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><div><b>' + esc(name) +
        '</b> <span class="badge">' + esc(roleText) + '</span>' +
        ' <span class="sess-badge ' + (fresh ? "now" : "") + '"' + (fresh ? "" : ' style="background:#94a3b8;"') + ">" + (fresh ? "LIVE" : "STALE") + "</span>" +
        '<div class="muted">' + esc(age) + " · " + esc(fmtDate(row.updated_at)) + (areaTeam ? " · " + esc(areaTeam) : "") + "</div>" +
        '<div class="muted" style="font-size:11px;">GPS: ' + Number(row.latitude).toFixed(5) + ", " + Number(row.longitude).toFixed(5) + "</div></div>" +
        '<div class="inline-actions" style="margin-top:0"><button class="gray small-btn" type="button" onclick="focusLiveEmployee(\'' + esc(row.user_id) + '\')">📍 Focus</button>' +
        '<a href="https://www.google.com/maps?q=' + encodeURIComponent(row.latitude + "," + row.longitude) + '" target="_blank" rel="noopener">Open</a></div></div>'
      ).join("") || '<p class="muted">No matching locations yet.</p>';
    }
  } catch (err: any) {
    if (statusEl) statusEl.textContent = "Could not load Google Live Map: " + (err?.message || err);
    renderLiveOnlineMembersList();
  } finally {
    liveBusy = false;
  }
}

let siteMapInstance: google.maps.Map | null = null;
let siteMapContainerEl: HTMLElement | null = null;
let siteMapMarker: google.maps.marker.AdvancedMarkerElement | null = null;
let siteOriginMarker: google.maps.marker.AdvancedMarkerElement | null = null;
let siteMapInfoWindow: google.maps.InfoWindow | null = null;
let siteMapPolylines: google.maps.Polyline[] = [];
let siteLastDestPos: { lat: number; lng: number } | null = null;
let siteLastRouteBounds: google.maps.LatLngBounds | null = null;
const siteLocationCache = new Map<
  string,
  { lat: number; lng: number; displayName: string; formattedAddress: string; city?: string; regionHint?: string; photoUrl?: string }
>();
let placesTextSearchDenied = false;
let siteMapLazyObserver: IntersectionObserver | null = null;
let siteMapWasActivated = false;
let lastSiteMapArgs: {
  containerId: string;
  query: string;
  siteTitle: string;
  statusElId?: string;
  fallbackQueries?: string[];
} | null = null;

function clearSiteMapPolylines(): void {
  siteMapPolylines.forEach(p => { try { p.setMap(null); } catch {} });
  siteMapPolylines = [];
  siteLastRouteBounds = null;
}

function buildOriginPinElement(): HTMLElement {
  const el = document.createElement("div");
  el.textContent = "YOU";
  el.style.cssText =
    "padding:3px 7px;border-radius:999px;background:#22c55e;color:#fff;font-size:10px;font-weight:800;" +
    "border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.45);";
  return el;
}

function buildSitePinElement(label: string, selected: boolean): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "site-pin-wrap" + (selected ? " is-selected" : "");

  const pulse = document.createElement("div");
  pulse.className = "site-pin-pulse";

  const core = document.createElement("div");
  core.className = "site-pin-core";

  const tag = document.createElement("div");
  tag.className = "site-pin-label";
  tag.textContent = label || "Work Site";

  wrap.appendChild(pulse);
  wrap.appendChild(core);
  wrap.appendChild(tag);
  return wrap;
}

export function setSiteMapLayer(layer: "roadmap" | "satellite"): void {
  const normalized: "roadmap" | "satellite" = layer === "satellite" ? "satellite" : "roadmap";
  runtime.siteMapLayer = normalized;
  document.querySelectorAll<HTMLElement>("[data-site-map-layer]").forEach(btn => {
    btn.classList.toggle("active", (btn.dataset.siteMapLayer || "roadmap") === normalized);
  });
  if (siteMapInstance) {
    siteMapInstance.setMapTypeId(normalized === "satellite" ? "hybrid" : "roadmap");
  }
}

async function ensureSiteMapInstance(containerId: string) {
  const container = $(containerId);
  if (!container) return null;
  const libs = await loadGoogleMapsLibraries();
  if (!siteMapInstance || siteMapContainerEl !== container) {
    siteMapContainerEl = container;
    siteMapInstance = new libs.Map(container, {
      center: { lat: 10.3157, lng: 123.8854 },
      zoom: 12,
      mapId: "DEMO_MAP_ID",
      mapTypeId: runtime.siteMapLayer === "satellite" ? "hybrid" : "roadmap",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: "cooperative",
      internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
    } as any);
    siteMapInfoWindow = new libs.InfoWindow();
    siteMapMarker = null;
    siteOriginMarker = null;
  }
  setSiteMapLayer(runtime.siteMapLayer || "roadmap");
  return { container, ...libs };
}

export async function initSitesMapOverview(): Promise<void> {
  const container = $("siteGoogleMap");
  if (!container) return;
  if (siteMapLazyObserver) {
    siteMapLazyObserver.disconnect();
    siteMapLazyObserver = null;
  }
  siteMapWasActivated = true;
  initSiteMapControls();
  const statusEl = $("siteMapStatus");
  const dirBox = $("siteMapDirections");
  try {
    await ensureSiteMapInstance("siteGoogleMap");
    if (!lastSiteMapArgs) {
      if (statusEl) {
        statusEl.textContent = "Search an address above or tap \"View on Map\" on any site below.";
      }
      if (dirBox && !dirBox.innerHTML.trim()) dirBox.innerHTML = "";
    }
  } catch (err: any) {
    if (statusEl) {
      statusEl.textContent = "Unable to load map right now: " + (err?.message || err);
    }
  }
}

export function scheduleSiteMapLazyInit(): void {
  const pageEl = $("page-sites");
  const overlayEl = $("siteMapOverlay");
  const container = $("siteGoogleMap");
  if (!pageEl || !container || pageEl.classList.contains("hidden") || overlayEl?.classList.contains("hidden") || runtime.currentPage !== "sites") {
    return;
  }

  if (siteMapInstance) {
    siteMapWasActivated = true;
    try {
      google.maps.event.trigger(siteMapInstance, "resize");
    } catch {}
    void hooks.refreshVisibleSiteDistances?.();
    return;
  }

  const statusEl = $("siteMapStatus");
  if (statusEl && !lastSiteMapArgs) {
    statusEl.textContent = "Google Maps will initialize automatically once visible on screen…";
  }

  const activateNow = () => {
    if (siteMapLazyObserver) {
      siteMapLazyObserver.disconnect();
      siteMapLazyObserver = null;
    }
    if (runtime.currentPage !== "sites" || pageEl.classList.contains("hidden")) return;
    siteMapWasActivated = true;
    void initSitesMapOverview().then(() => {
      void hooks.refreshVisibleSiteDistances?.();
    });
  };

  if (siteMapLazyObserver) {
    siteMapLazyObserver.disconnect();
    siteMapLazyObserver = null;
  }

  if (typeof IntersectionObserver !== "undefined") {
    siteMapLazyObserver = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          activateNow();
        }
      },
      { root: null, rootMargin: "120px", threshold: 0.01 }
    );
    siteMapLazyObserver.observe(container);
  } else {
    requestAnimationFrame(() => activateNow());
  }
}

export function centerSiteMapOnSelected(): void {
  if (!siteMapInstance || !siteLastDestPos) return;
  siteMapInstance.panTo(siteLastDestPos);
  siteMapInstance.setCenter(siteLastDestPos);
  siteMapInstance.setZoom(16);
  if (siteMapInfoWindow && siteMapMarker) {
    siteMapInfoWindow.open({ map: siteMapInstance, anchor: siteMapMarker });
  }
}

export function fitSiteMapRoute(): void {
  if (!siteMapInstance) return;
  if (siteLastRouteBounds) {
    siteMapInstance.fitBounds(siteLastRouteBounds, 48);
  } else {
    centerSiteMapOnSelected();
  }
}

async function getCurrentOriginLatLng(): Promise<{ lat: number; lng: number } | null> {
  if (lastKnownCoords && Date.now() - lastKnownCoords.updatedAt < 60000) {
    return { lat: lastKnownCoords.lat, lng: lastKnownCoords.lng };
  }
  if (navigator.geolocation) {
    const pos = await new Promise<GeolocationPosition | null>(resolve => {
      navigator.geolocation.getCurrentPosition(
        p => resolve(p),
        () => {
          navigator.geolocation.getCurrentPosition(
            p2 => resolve(p2),
            () => resolve(null),
            { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
          );
        },
        { enableHighAccuracy: true, maximumAge: 20000, timeout: 6000 }
      );
    });
    if (pos) {
      handleGeoFix(pos, false);
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
  }
  if (lastKnownCoords) {
    return { lat: lastKnownCoords.lat, lng: lastKnownCoords.lng };
  }
  if (state.userId && runtime.client) {
    try {
      const { data } = await runtime.client
        .from("employee_locations")
        .select("latitude,longitude")
        .eq("user_id", state.userId)
        .maybeSingle();
      if (data && Number.isFinite(+data.latitude) && Number.isFinite(+data.longitude)) {
        return { lat: +data.latitude, lng: +data.longitude };
      }
    } catch {}
  }
  return null;
}

export function getCachedUserGpsCoords(): { lat: number; lng: number; acc: number } | null {
  if (!lastKnownCoords) return null;
  return { lat: lastKnownCoords.lat, lng: lastKnownCoords.lng, acc: lastKnownCoords.acc };
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function resolveSiteCoordinatesByName(siteName: string): Promise<{ lat: number; lng: number; name: string } | null> {
  const query = String(siteName || "").trim();
  if (!query || /^eesi field site$/i.test(query)) return null;
  const low = query.toLowerCase();
  const site =
    (state.sites || []).find(s => String(s.name || "").trim().toLowerCase() === low) ||
    (state.sites || []).find(s => {
      const n = String(s.name || "").trim().toLowerCase();
      return n && (n.includes(low) || (n.length >= 4 && low.includes(n)));
    });
  if (!site) return null;

  const lat = Number(site.latitude);
  const lng = Number(site.longitude);
  if (site.latitude !== null && site.latitude !== undefined && site.longitude !== null && site.longitude !== undefined && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, name: site.name };
  }

  const resolved = await resolveSiteAddressAndPin({
    name: site.name,
    address: site.address || "",
    city: site.city || "",
    region: site.region || "",
  });
  if (resolved && Number.isFinite(resolved.lat) && Number.isFinite(resolved.lng)) {
    site.latitude = resolved.lat;
    site.longitude = resolved.lng;
    return { lat: resolved.lat, lng: resolved.lng, name: site.name };
  }
  return null;
}

function formatDurationMs(msRaw: unknown): string {
  const ms = Number(msRaw || 0);
  if (!ms || isNaN(ms)) return "";
  const totalMin = Math.max(1, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  const hrs = Math.floor(totalMin / 60);
  const rem = totalMin % 60;
  return rem ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

function formatDistanceMeters(metersRaw: unknown): string {
  const m = Number(metersRaw || 0);
  if (!m || isNaN(m)) return "";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function setSiteMapTravelMode(mode: "DRIVING" | "WALKING" | "TWO_WHEELER"): void {
  runtime.siteMapTravelMode = mode;
  if (lastSiteMapArgs) {
    void openSiteGoogleMap(
      lastSiteMapArgs.containerId,
      lastSiteMapArgs.query,
      lastSiteMapArgs.siteTitle,
      lastSiteMapArgs.statusElId,
      lastSiteMapArgs.fallbackQueries
    );
  }
}

function isGenericRegionQuery(q: string): boolean {
  return /^(?:(?:luzon|visayas|mindanao|philippines)\s*,?\s*)+$/i.test(String(q || "").trim());
}

function buildSiteCandidates(site: any): { primary: string; fallbacks: string[] } {
  const rawName = String(site?.name || "").trim();
  const cleanName = rawName.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const addr = String(site?.address || "").trim();
  const city = String(site?.city || "").trim();
  const reg = String(site?.region || "").trim();

  const rawList = [
    [rawName, addr, city, "Philippines"].filter(Boolean).join(", "),
    [cleanName, addr, city, "Philippines"].filter(Boolean).join(", "),
    [cleanName, city, "Philippines"].filter(Boolean).join(", "),
    [rawName, addr, city, reg, "Philippines"].filter(Boolean).join(", "),
    addr || city ? [addr, city, "Philippines"].filter(Boolean).join(", ") : "",
    cleanName ? `${cleanName}, Philippines` : "",
    rawName ? `${rawName}, Philippines` : "",
    city ? `${city}, Philippines` : "",
  ]
    .map(s => s.trim())
    .filter(s => s && !isGenericRegionQuery(s));

  const unique = [...new Set(rawList)];
  return {
    primary: unique[0] || rawName || addr || city || "",
    fallbacks: unique.slice(1),
  };
}

export function inferPhRegionFromTextOrCoords(text: string, lat?: number, lng?: number): "Luzon" | "Visayas" | "Mindanao" {
  const low = String(text || "").toLowerCase();
  if (/(davao|cagayan de oro|zamboanga|general santos|gensan|butuan|iligan|surigao|cotabato|mindanao|dipolog|pagadian|tagum|koronadal|valencia|malaybalay|caraga|soccsksargen|barmm|bukidnon|agusan|misamis)/i.test(low)) {
    return "Mindanao";
  }
  if (/(cebu|mandaue|lapu-lapu|talisay|consolacion|liloan|iloilo|bacolod|negros|tacloban|ormoc|bohol|tagbilaran|dumaguete|kalibo|boracay|aklan|capiz|roxas|leyte|samar|visayas|bantayan|camotes|siquijor|antique|guimaras)/i.test(low)) {
    return "Visayas";
  }
  if (/(manila|makati|taguig|bgc|pasig|ortigas|quezon city|mandaluyong|pasay|paranaque|para\u00f1aque|muntinlupa|alabang|las pinas|caloocan|marikina|san juan|valenzuela|tagaytay|cavite|laguna|batangas|rizal|bulacan|pampanga|clark|angeles|subic|zambales|baguio|benguet|tarlac|pangasinan|bicol|naga|legazpi|luzon|ncr|metro manila|ilocos|la union|isabela|cagayan|palawan|puerto princesa|mindoro)/i.test(low)) {
    return "Luzon";
  }
  if (typeof lat === "number" && Number.isFinite(lat)) {
    if (lat >= 12.6) return "Luzon";
    if (lat >= 9.15 && (lng === undefined || lng < 126.3)) return "Visayas";
    return "Mindanao";
  }
  return "Visayas";
}

function extractCityFromAddressComponents(
  components?: google.maps.places.AddressComponent[] | null,
  formattedAddress = ""
): string {
  if (Array.isArray(components) && components.length) {
    const findType = (t: string) => components.find(c => Array.isArray(c.types) && c.types.includes(t))?.longText || "";
    const picked =
      findType("locality") ||
      findType("administrative_area_level_3") ||
      findType("administrative_area_level_2") ||
      findType("sublocality_level_1");
    if (picked) return String(picked).trim();
  }
  const parts = String(formattedAddress || "").split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const cand = parts.find(p => /\bcity\b/i.test(p)) || parts[parts.length - 3];
    if (cand && !/philippines/i.test(cand)) return cand.replace(/^\d{4}\s+/, "").trim();
  }
  return "";
}

async function tryDirectClientGeocode(
  candidates: string[],
  siteTitle: string
): Promise<{ lat: number; lng: number; displayName: string; formattedAddress: string; city?: string; regionHint?: string } | null> {
  const cleaned = [...new Set(candidates.map(q => q.trim()).filter(q => q && !isGenericRegionQuery(q)))].slice(0, 4);
  for (const q of cleaned) {
    const queryWithPh = /philippines|\bph\b/i.test(q) ? q : `${q}, Philippines`;
    // 1) Photon (CORS-enabled OSM geocoder biased to Philippines)
    try {
      const pUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(queryWithPh)}&limit=1&lat=12.8797&lon=121.774`;
      const pRes = await fetch(pUrl);
      if (pRes.ok) {
        const pData: any = await pRes.json();
        const feat = pData?.features?.[0];
        const coords = feat?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          const lng = Number(coords[0]);
          const lat = Number(coords[1]);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const props = feat?.properties || {};
            const formattedAddress = [props.name, props.street, props.district || props.suburb, props.city || props.county, props.state, props.country]
              .filter(Boolean)
              .filter((v, i, arr) => arr.indexOf(v) === i)
              .join(", ");
            const city = String(props.city || props.county || extractCityFromAddressComponents(null, formattedAddress) || "").trim();
            return {
              lat,
              lng,
              displayName: String(props.name || siteTitle),
              formattedAddress: formattedAddress || queryWithPh,
              city,
              regionHint: inferPhRegionFromTextOrCoords(`${siteTitle} ${city} ${formattedAddress}`, lat, lng),
            };
          }
        }
      }
    } catch {}

    // 2) Nominatim direct fallback
    try {
      const nUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=ph&limit=1&q=${encodeURIComponent(queryWithPh)}`;
      const nRes = await fetch(nUrl);
      if (nRes.ok) {
        const nList: any = await nRes.json();
        const hit = Array.isArray(nList) ? nList[0] : null;
        const lat = Number(hit?.lat);
        const lng = Number(hit?.lon);
        if (hit && Number.isFinite(lat) && Number.isFinite(lng)) {
          const addrObj = hit.address || {};
          const city = String(addrObj.city || addrObj.town || addrObj.municipality || addrObj.county || "").trim();
          const formattedAddress = String(hit.display_name || queryWithPh);
          return {
            lat,
            lng,
            displayName: String(hit.name || siteTitle),
            formattedAddress,
            city,
            regionHint: inferPhRegionFromTextOrCoords(`${siteTitle} ${city} ${formattedAddress}`, lat, lng),
          };
        }
      }
    } catch {}
  }
  return null;
}

async function fetchFallbackGeocode(
  candidates: string[],
  siteTitle: string
): Promise<{ lat: number; lng: number; displayName: string; formattedAddress: string; city?: string; regionHint?: string } | null> {
  const usable = candidates.map(c => c.trim()).filter(c => c && !isGenericRegionQuery(c));
  if (!usable.length) return null;
  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries: usable }),
    });
    if (res.ok) {
      const data: any = await res.json();
      const lat = Number(data?.lat);
      const lng = Number(data?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const formattedAddress = String(data?.formattedAddress || "");
        const city = String(data?.city || extractCityFromAddressComponents(null, formattedAddress) || "").trim();
        return {
          lat,
          lng,
          displayName: String(data?.displayName || siteTitle),
          formattedAddress,
          city,
          regionHint: String(data?.regionHint || inferPhRegionFromTextOrCoords(`${siteTitle} ${city} ${formattedAddress}`, lat, lng)),
        };
      }
    }
  } catch {}
  return await tryDirectClientGeocode(usable, siteTitle);
}

async function fetchReverseGeocode(
  lat: number,
  lng: number
): Promise<{ lat: number; lng: number; formattedAddress: string; city: string; regionHint: "Luzon" | "Visayas" | "Mindanao" } | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const formattedAddress = String(data?.formattedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    const city = String(data?.city || extractCityFromAddressComponents(null, formattedAddress) || "").trim();
    const regionHint = inferPhRegionFromTextOrCoords(`${city} ${formattedAddress}`, lat, lng);
    return { lat, lng, formattedAddress, city, regionHint };
  } catch {
    return null;
  }
}

async function resolveCoordsByQueries(
  Place: typeof google.maps.places.Place,
  query: string,
  siteTitle: string,
  fallbackQueries: string[] = [],
  siteHint?: { latitude?: unknown; longitude?: unknown; address?: string | null; city?: string | null; region?: string | null }
): Promise<{ lat: number; lng: number; displayName: string; formattedAddress: string; city?: string; regionHint?: string; photoUrl?: string; errorMsg?: string } | null> {
  const hintLat = Number(siteHint?.latitude);
  const hintLng = Number(siteHint?.longitude);
  if (
    siteHint?.latitude !== null &&
    siteHint?.latitude !== undefined &&
    siteHint?.latitude !== "" &&
    siteHint?.longitude !== null &&
    siteHint?.longitude !== undefined &&
    siteHint?.longitude !== "" &&
    Number.isFinite(hintLat) &&
    Number.isFinite(hintLng)
  ) {
    return {
      lat: hintLat,
      lng: hintLng,
      displayName: siteTitle,
      formattedAddress: [siteHint.address, siteHint.city, siteHint.region].filter(Boolean).join(", "),
      city: siteHint.city || "",
      regionHint: siteHint.region || inferPhRegionFromTextOrCoords(`${siteHint.address || ""} ${siteHint.city || ""}`, hintLat, hintLng),
    };
  }

  const cacheKey = query.trim().toLowerCase();
  const cached = siteLocationCache.get(cacheKey);
  if (cached) return cached;
  let lastErr = "";
  const candidates = [...new Set([query, ...fallbackQueries].map(q => q.trim()).filter(Boolean))];

  if (!placesTextSearchDenied) {
    for (const q of candidates) {
      try {
        const { places } = await Place.searchByText({
          textQuery: q,
          fields: ["displayName", "location", "formattedAddress", "addressComponents", "photos"],
          maxResultCount: 1,
          internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
        } as any);
        const match = places?.[0];
        if (match?.location) {
          const lat = typeof match.location.lat === "function" ? match.location.lat() : Number((match.location as any).lat);
          const lng = typeof match.location.lng === "function" ? match.location.lng() : Number((match.location as any).lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const formattedAddress = match.formattedAddress || "";
            const city = extractCityFromAddressComponents(match.addressComponents, formattedAddress);
            let photoUrl = "";
            try {
              const firstPhoto: any = Array.isArray((match as any).photos) ? (match as any).photos[0] : null;
              if (firstPhoto && typeof firstPhoto.getURI === "function") {
                photoUrl = String(firstPhoto.getURI({ maxWidth: 800, maxHeight: 600 }) || "");
              }
            } catch {}
            const resolved = {
              lat,
              lng,
              displayName: match.displayName || siteTitle,
              formattedAddress,
              city,
              regionHint: inferPhRegionFromTextOrCoords(`${q} ${city} ${formattedAddress}`, lat, lng),
              ...(photoUrl ? { photoUrl } : {}),
            };
            siteLocationCache.set(cacheKey, resolved);
            return resolved;
          }
        }
      } catch (err: any) {
        lastErr = err?.message || String(err || "");
        if (/PERMISSION_DENIED|Permission denied|not activated|API_KEY/i.test(lastErr)) {
          placesTextSearchDenied = true;
          break;
        }
      }
    }
  }

  const fb = await fetchFallbackGeocode(candidates, siteTitle);
  if (fb) {
    siteLocationCache.set(cacheKey, fb);
    return fb;
  }

  return lastErr ? { lat: NaN, lng: NaN, displayName: siteTitle, formattedAddress: "", errorMsg: lastErr } : null;
}

export async function resolveSiteAddressAndPin(opts: {
  name: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  lat?: number | null;
  lng?: number | null;
}): Promise<{
  address: string;
  city: string;
  region: "Luzon" | "Visayas" | "Mindanao";
  lat: number | null;
  lng: number | null;
  displayName: string;
  photoUrl?: string;
} | null> {
  const cleanName = String(opts.name || "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const givenLat = opts.lat !== null && opts.lat !== undefined && Number.isFinite(Number(opts.lat)) ? Number(opts.lat) : null;
  const givenLng = opts.lng !== null && opts.lng !== undefined && Number.isFinite(Number(opts.lng)) ? Number(opts.lng) : null;

  if (givenLat !== null && givenLng !== null) {
    let address = String(opts.address || "").trim();
    let city = String(opts.city || "").trim();
    let region = (opts.region as "Luzon" | "Visayas" | "Mindanao") || inferPhRegionFromTextOrCoords(`${address} ${city}`, givenLat, givenLng);
    if (!address || !city) {
      const rev = await fetchReverseGeocode(givenLat, givenLng);
      if (rev) {
        if (!address && rev.formattedAddress) address = rev.formattedAddress;
        if (!city && rev.city) city = rev.city;
        if (!opts.region) region = rev.regionHint;
      }
    }
    return { address, city, region, lat: givenLat, lng: givenLng, displayName: cleanName || opts.name };
  }

  const rawName = String(opts.name || "").trim();
  const addr = String(opts.address || "").trim();
  const city = String(opts.city || "").trim();
  const queries = [...new Set([
    [rawName, addr, city, "Philippines"].filter(Boolean).join(", "),
    [cleanName, addr, city, "Philippines"].filter(Boolean).join(", "),
    [cleanName, city, "Philippines"].filter(Boolean).join(", "),
    addr || city ? [addr, city, "Philippines"].filter(Boolean).join(", ") : "",
    cleanName ? `${cleanName}, Philippines` : "",
    rawName ? `${rawName}, Philippines` : "",
  ].map(q => q.trim()).filter(q => q && !isGenericRegionQuery(q)))];

  if (!queries.length) return null;

  try {
    const { Place } = await loadGoogleMapsLibraries();
    const res = await resolveCoordsByQueries(Place, queries[0], rawName || cleanName, queries.slice(1));
    if (res && Number.isFinite(res.lat) && Number.isFinite(res.lng)) {
      const address = String(addr || res.formattedAddress || "").trim();
      const resolvedCity = String(city || res.city || extractCityFromAddressComponents(null, res.formattedAddress) || "").trim();
      const region = inferPhRegionFromTextOrCoords(`${rawName} ${address} ${resolvedCity}`, res.lat, res.lng);
      return {
        address,
        city: resolvedCity,
        region,
        lat: res.lat,
        lng: res.lng,
        displayName: res.displayName || rawName,
        ...(res.photoUrl ? { photoUrl: res.photoUrl } : {}),
      };
    }
  } catch {}

  const fb = await fetchFallbackGeocode(queries, rawName || cleanName);
  if (fb) {
    const address = String(addr || fb.formattedAddress || "").trim();
    const resolvedCity = String(city || fb.city || "").trim();
    const region = inferPhRegionFromTextOrCoords(`${rawName} ${address} ${resolvedCity}`, fb.lat, fb.lng);
    return { address, city: resolvedCity, region, lat: fb.lat, lng: fb.lng, displayName: fb.displayName || rawName };
  }
  return null;
}

export async function resolveSiteAutoPhotoUrl(opts: {
  name: string;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  placesPhotoUrl?: string | null;
}): Promise<{ photoUrl: string; source: string } | null> {
  if (opts.placesPhotoUrl && String(opts.placesPhotoUrl).startsWith("http")) {
    return { photoUrl: String(opts.placesPhotoUrl), source: "google_places" };
  }
  try {
    const res = await fetch("/api/site-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: String(opts.name || "").trim(),
        city: String(opts.city || "").trim(),
        lat: opts.lat,
        lng: opts.lng,
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data?.photoUrl) {
      return { photoUrl: String(data.photoUrl), source: String(data.source || "auto") };
    }
  } catch {}
  return null;
}

export async function createSiteAutoSnapshotFile(
  siteName: string,
  city: string,
  lat: number | null,
  lng: number | null
): Promise<File | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    let drewTile = false;
    if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
      const tileUrl = `/api/site-photo?tile=1&z=16&lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`;
      drewTile = await new Promise<boolean>(resolve => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = tileUrl;
      });
    }

    if (!drewTile) {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "#0b1a36");
      grad.addColorStop(1, "#1e6cf2");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    }

    // Pin marker at center
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 - 14;
    ctx.beginPath();
    ctx.arc(cx, cy + 28, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(30, 108, 242, 0.35)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 20, Math.PI, 0, false);
    ctx.lineTo(cx, cy + 32);
    ctx.closePath();
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Bottom info banner
    const bannerGrad = ctx.createLinearGradient(0, canvas.height - 105, 0, canvas.height);
    bannerGrad.addColorStop(0, "rgba(6, 15, 34, 0)");
    bannerGrad.addColorStop(0.45, "rgba(6, 15, 34, 0.82)");
    bannerGrad.addColorStop(1, "rgba(6, 15, 34, 0.96)");
    ctx.fillStyle = bannerGrad;
    ctx.fillRect(0, canvas.height - 105, canvas.width, 105);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText((siteName || "EESI Work Site").slice(0, 36), 20, canvas.height - 44);

    ctx.fillStyle = "#93c5fd";
    ctx.font = "15px Arial, sans-serif";
    const sub = [city || "Philippines", lat !== null && lng !== null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : ""].filter(Boolean).join(" · ");
    ctx.fillText(sub.slice(0, 56), 20, canvas.height - 18);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), "image/jpeg", 0.86));
    if (!blob) return null;
    const safeSlug = String(siteName || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28) || "site";
    return new File([blob], `${safeSlug}-pin.jpg`, { type: "image/jpeg" });
  } catch {
    return null;
  }
}

let distanceRunSeq = 0;

export async function refreshVisibleSiteDistances(
  sitesList: any[] = state.sites,
  opts: { force?: boolean } = {}
): Promise<void> {
  if (!sitesList?.length) return;
  const runId = ++distanceRunSeq;

  const originCoords = await getCurrentOriginLatLng();
  if (runId !== distanceRunSeq) return;

  if (!originCoords) {
    sitesList.forEach(s => {
      runtime.siteDistances[String(s.id)] = {
        status: "no_gps",
        message: "Enable GPS to calculate driving distance",
      };
    });
    hooks.renderSites();
    return;
  }

  const originKey = `${originCoords.lat.toFixed(3)},${originCoords.lng.toFixed(3)}`;
  if (opts.force || (runtime.siteDistanceOriginKey && runtime.siteDistanceOriginKey !== originKey)) {
    runtime.siteDistances = {};
  }
  runtime.siteDistanceOriginKey = originKey;

  const toCompute = sitesList.filter(s => {
    const prev = runtime.siteDistances[String(s.id)];
    return opts.force || !prev || (prev.status !== "ready" && prev.status !== "no_route" && prev.status !== "loading");
  });
  if (!toCompute.length) return;

  toCompute.forEach(s => {
    runtime.siteDistances[String(s.id)] = { status: "loading" };
  });
  hooks.renderSites();

  try {
    const { Place, RouteMatrix, UnitSystem, spherical } = await loadGoogleMapsLibraries();
    if (runId !== distanceRunSeq) return;

    const resolvedList: Array<{ site: any; coords: { lat: number; lng: number } }> = [];
    const batchSize = 4;
    for (let i = 0; i < toCompute.length; i += batchSize) {
      if (runId !== distanceRunSeq) return;
      const chunk = toCompute.slice(i, i + batchSize);
      await Promise.all(
        chunk.map(async site => {
          const { primary, fallbacks } = buildSiteCandidates(site);
          const res = await resolveCoordsByQueries(Place, primary, site.name, fallbacks, site);
          if (res && Number.isFinite(res.lat) && Number.isFinite(res.lng)) {
            resolvedList.push({ site, coords: { lat: res.lat, lng: res.lng } });
          } else {
            runtime.siteDistances[String(site.id)] = {
              status: "error",
              message: "Site location not found",
            };
          }
        })
      );
    }

    if (runId !== distanceRunSeq) return;
    if (!resolvedList.length) {
      hooks.renderSites();
      return;
    }

    // Pre-sort by geometric distance and query RouteMatrix in chunks of up to 25 destinations
    const withStraight = resolvedList.map(item => ({
      ...item,
      straightKm: spherical.computeDistanceBetween(originCoords, item.coords) / 1000,
    }));
    withStraight.sort((a, b) => a.straightKm - b.straightKm);

    const matrixChunkSize = 25;
    for (let i = 0; i < withStraight.length; i += matrixChunkSize) {
      if (runId !== distanceRunSeq) return;
      const chunk = withStraight.slice(i, i + matrixChunkSize);
      try {
        const request: google.maps.routes.ComputeRouteMatrixRequest = {
          origins: [originCoords],
          destinations: chunk.map(c => c.coords),
          travelMode: "DRIVING" as any,
          units: UnitSystem.METRIC,
          fields: ["distanceMeters", "durationMillis", "condition"],
          internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
        } as any;
        const { matrix } = await RouteMatrix.computeRouteMatrix(request);
        const items = matrix?.rows?.[0]?.items || [];
        chunk.forEach((entry, idx) => {
          const item = items[idx];
          const sid = String(entry.site.id);
          if (item && item.condition === "ROUTE_EXISTS" && typeof item.distanceMeters === "number" && Number.isFinite(item.distanceMeters)) {
            const dMeters = item.distanceMeters;
            const dMillis = typeof item.durationMillis === "number" && Number.isFinite(item.durationMillis) ? item.durationMillis : undefined;
            runtime.siteDistances[sid] = {
              status: "ready",
              distanceMeters: dMeters,
              durationMillis: dMillis,
              distanceText: formatDistanceMeters(dMeters),
              durationText: formatDurationMs(dMillis),
              straightKm: entry.straightKm,
            };
          } else {
            runtime.siteDistances[sid] = {
              status: "no_route",
              straightKm: entry.straightKm,
              message: `No driving route (~${entry.straightKm.toFixed(0)} km straight-line)`,
            };
          }
        });
      } catch {
        chunk.forEach(entry => {
          const estMeters = Math.round(entry.straightKm * 1000);
          runtime.siteDistances[String(entry.site.id)] = {
            status: "ready",
            distanceMeters: estMeters,
            distanceText: `~${formatDistanceMeters(estMeters)} (est.)`,
            straightKm: entry.straightKm,
          };
        });
      }
    }
    if (runId === distanceRunSeq) hooks.renderSites();
  } catch {
    if (runId !== distanceRunSeq) return;
    toCompute.forEach(s => {
      if (runtime.siteDistances[String(s.id)]?.status === "loading") {
        runtime.siteDistances[String(s.id)] = { status: "error", message: "Distance unavailable" };
      }
    });
    hooks.renderSites();
  }
}

export async function openSiteGoogleMap(
  containerId: string,
  query: string,
  siteTitle: string,
  statusElId?: string,
  fallbackQueries: string[] = []
): Promise<void> {
  if (siteMapLazyObserver) {
    siteMapLazyObserver.disconnect();
    siteMapLazyObserver = null;
  }
  siteMapWasActivated = true;
  const statusEl = statusElId ? $(statusElId) : null;
  const dirBox = $("siteMapDirections");
  if (!$(containerId)) return;
  initSiteMapControls();
  lastSiteMapArgs = { containerId, query, siteTitle, statusElId, fallbackQueries };
  if (statusEl) statusEl.textContent = "Centering map on " + siteTitle + "…";
  if (dirBox) dirBox.innerHTML = '<p class="muted">Locating site & calculating live route…</p>';
  clearSiteMapPolylines();

  try {
    const setup = await ensureSiteMapInstance(containerId);
    if (!setup || !siteMapInstance) return;
    const { InfoWindow, AdvancedMarkerElement, LatLngBounds, Place, Route, spherical } = setup;

    if (!siteMapInfoWindow) siteMapInfoWindow = new InfoWindow();

    const matchedSite = state.sites.find(s =>
      (runtime.selectedSiteId && String(s.id) === String(runtime.selectedSiteId)) ||
      String(s.name || "").trim() === String(siteTitle || "").trim()
    );
    const originPromise = getCurrentOriginLatLng();
    const resolvedRaw = await resolveCoordsByQueries(Place, query, siteTitle, fallbackQueries, matchedSite);
    const placeErrorMsg = resolvedRaw?.errorMsg || "";
    const resolved = resolvedRaw && Number.isFinite(resolvedRaw.lat) && Number.isFinite(resolvedRaw.lng) ? resolvedRaw : null;

    const originCoords = await originPromise;

    if (!resolved) {
      if (siteMapMarker) siteMapMarker.map = null;
      siteLastDestPos = null;
      if (statusEl) {
        statusEl.textContent = placeErrorMsg
          ? "Unable to locate site on embedded map (" + placeErrorMsg + ")."
          : 'Could not pinpoint exact coordinates for "' + siteTitle + '" automatically.';
      }
      if (dirBox) {
        const gSearch = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
        dirBox.innerHTML = `<a class="btn small-btn" style="text-decoration:none;display:inline-flex;align-items:center;" href="${esc(gSearch)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>`;
      }
      return;
    }

    if (matchedSite && (matchedSite.latitude == null || matchedSite.longitude == null)) {
      matchedSite.latitude = resolved.lat;
      matchedSite.longitude = resolved.lng;
    }

    const destPos = { lat: resolved.lat, lng: resolved.lng };
    siteLastDestPos = destPos;

    // Always center the existing map component on the selected site location immediately
    try { google.maps.event.trigger(siteMapInstance, "resize"); } catch {}
    siteMapInstance.setCenter(destPos);
    siteMapInstance.panTo(destPos);
    siteMapInstance.setZoom(16);
    requestAnimationFrame(() => {
      if (siteMapInstance) {
        try { google.maps.event.trigger(siteMapInstance, "resize"); } catch {}
        siteMapInstance.setCenter(destPos);
        siteMapInstance.setZoom(16);
      }
    });

    if (!siteMapMarker) {
      siteMapMarker = new AdvancedMarkerElement({
        map: siteMapInstance,
        position: destPos,
        title: resolved.displayName || siteTitle,
        content: buildSitePinElement(resolved.displayName || siteTitle, true),
        zIndex: 999,
      });
    } else {
      siteMapMarker.map = siteMapInstance;
      siteMapMarker.position = destPos;
      siteMapMarker.title = resolved.displayName || siteTitle;
      siteMapMarker.content = buildSitePinElement(resolved.displayName || siteTitle, true);
      siteMapMarker.zIndex = 999;
    }

    const infoContent =
      `<div style="font-size:13px;line-height:1.4;"><b>${esc(resolved.displayName || siteTitle)}</b>` +
      (resolved.formattedAddress ? `<br><span>${esc(resolved.formattedAddress)}</span>` : "") +
      `</div>`;
    if (siteMapInfoWindow) {
      siteMapInfoWindow.setContent(infoContent);
      siteMapInfoWindow.open({ map: siteMapInstance, anchor: siteMapMarker });
    }

    const gmapsExternalUrl = originCoords
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCoords.lat + "," + originCoords.lng)}&destination=${encodeURIComponent(destPos.lat + "," + destPos.lng)}&travelmode=${runtime.siteMapTravelMode === "WALKING" ? "walking" : "driving"}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destPos.lat + "," + destPos.lng)}&travelmode=${runtime.siteMapTravelMode === "WALKING" ? "walking" : "driving"}`;

    const modeTabsHtml =
      `<div class="tabs" style="margin:0 0 8px;">` +
      (["DRIVING", "TWO_WHEELER", "WALKING"] as const)
        .map(mode => {
          const lbl = mode === "DRIVING" ? "🚗 Drive" : mode === "TWO_WHEELER" ? "🏍 Moto" : "🚶 Walk";
          return `<button type="button" class="${runtime.siteMapTravelMode === mode ? "active" : ""}" onclick="setSiteMapTravelMode('${mode}')">${lbl}</button>`;
        })
        .join("") +
      `</div>`;

    if (!originCoords) {
      if (siteOriginMarker) siteOriginMarker.map = null;
      if (statusEl) {
        statusEl.textContent =
          (resolved.formattedAddress ? "📍 " + resolved.formattedAddress : "📍 " + (resolved.displayName || siteTitle)) +
          " · Turn on GPS for live route";
      }
      if (dirBox) {
        dirBox.innerHTML =
          modeTabsHtml +
          `<div class="muted" style="font-size:12px;margin-bottom:8px;">GPS location is unavailable right now. Allow location permission to show live turn-by-turn route from where you are.</div>` +
          `<div class="inline-actions" style="margin-top:0;">` +
          `<button class="gray small-btn" type="button" onclick="centerSiteMapOnSelected()">🎯 Center on Site</button>` +
          `<a class="btn small-btn" style="text-decoration:none;display:inline-flex;align-items:center;" href="${esc(gmapsExternalUrl)}" target="_blank" rel="noopener">🧭 Open Directions in Google Maps ↗</a>` +
          `</div>`;
      }
      return;
    }

    if (!siteOriginMarker) {
      siteOriginMarker = new AdvancedMarkerElement({
        map: siteMapInstance,
        position: originCoords,
        title: "Your Current Location",
        content: buildOriginPinElement(),
      });
    } else {
      siteOriginMarker.map = siteMapInstance;
      siteOriginMarker.position = originCoords;
    }

    // Isolate route computation so routing issues (e.g. inter-island water crossings or traffic layer limits)
    // never break centering on the selected site.
    const mode = runtime.siteMapTravelMode || "DRIVING";
    let route: any = null;
    try {
      const basicReq: any = {
        origin: originCoords,
        destination: destPos,
        travelMode: mode,
        fields: ["path", "distanceMeters", "durationMillis", "viewport", "legs"],
        internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
      };
      if (mode === "DRIVING") {
        try {
          const trafficRes = await Route.computeRoutes({
            ...basicReq,
            routingPreference: "TRAFFIC_AWARE",
            extraComputations: ["TRAFFIC_ON_POLYLINE"],
            fields: ["path", "speedPaths", "distanceMeters", "durationMillis", "viewport", "legs"],
          });
          route = trafficRes.routes?.[0] || null;
        } catch {
          const fallbackRes = await Route.computeRoutes(basicReq);
          route = fallbackRes.routes?.[0] || null;
        }
      } else {
        const res = await Route.computeRoutes(basicReq);
        route = res.routes?.[0] || null;
      }
    } catch {
      route = null;
    }

    if (route) {
      try {
        const polylines = route.createPolylines({
          map: siteMapInstance,
          polylineOptions: {
            strokeColor: "#2f8cff",
            strokeWeight: 6,
            strokeOpacity: 0.9,
          },
        } as any);
        if (Array.isArray(polylines)) siteMapPolylines.push(...polylines);
        else if (polylines) siteMapPolylines.push(polylines as any);
      } catch {}

      if (route.viewport) {
        siteLastRouteBounds = route.viewport;
      } else {
        const bounds = new LatLngBounds();
        bounds.extend(originCoords);
        bounds.extend(destPos);
        siteLastRouteBounds = bounds;
      }

      const distLabel = formatDistanceMeters(route.distanceMeters);
      const etaLabel = formatDurationMs(route.durationMillis);
      if (runtime.selectedSiteId && mode === "DRIVING" && distLabel) {
        runtime.siteDistances[String(runtime.selectedSiteId)] = {
          status: "ready",
          distanceMeters: route.distanceMeters,
          durationMillis: route.durationMillis,
          distanceText: distLabel,
          durationText: etaLabel,
        };
        hooks.renderSites();
      }
      const steps: any[] = route.legs?.[0]?.steps || [];
      const stepsHtml = steps
        .slice(0, 12)
        .map((st: any, idx: number) => {
          const instr = st?.navigationInstruction?.instructions || st?.localizedValues?.distance?.text || "Continue";
          const dText = st?.localizedValues?.distance?.text || formatDistanceMeters(st?.distanceMeters);
          return `<div class="pv-row" style="align-items:flex-start;gap:8px;"><span>${idx + 1}. ${esc(instr)}</span><small class="muted" style="white-space:nowrap;">${esc(dText)}</small></div>`;
        })
        .join("");

      if (statusEl) {
        statusEl.textContent = `📍 ${resolved.displayName || siteTitle} · ${distLabel || "Route ready"}${etaLabel ? " · ETA " + etaLabel : ""}`;
      }
      if (dirBox) {
        dirBox.innerHTML =
          modeTabsHtml +
          `<div class="item" style="margin-top:0;">` +
          `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">` +
          `<div><b>🚗 ${esc(distLabel || "Route")}</b>${etaLabel ? ` <span class="badge">${esc(etaLabel)}</span>` : ""}</div>` +
          `<div class="inline-actions" style="margin-top:0;">` +
          `<button class="gray small-btn" type="button" onclick="centerSiteMapOnSelected()">🎯 Center on Site</button>` +
          `<button class="gray small-btn" type="button" onclick="fitSiteMapRoute()">🗺 Fit Route</button>` +
          `<a class="btn small-btn" style="text-decoration:none;display:inline-flex;align-items:center;" href="${esc(gmapsExternalUrl)}" target="_blank" rel="noopener">🧭 Open in Google Maps ↗</a>` +
          `</div></div>` +
          (resolved.formattedAddress ? `<div class="muted" style="margin-top:4px;font-size:12px;">Destination: ${esc(resolved.formattedAddress)}</div>` : "") +
          (stepsHtml ? `<div style="margin-top:8px;max-height:190px;overflow:auto;border-top:1px solid var(--border);padding-top:6px;">${stepsHtml}</div>` : "") +
          `</div>`;
      }
    } else {
      const straightMeters = Math.round(spherical.computeDistanceBetween(originCoords, destPos));
      const approxLabel = formatDistanceMeters(straightMeters);
      try {
        const refLine = new google.maps.Polyline({
          path: [originCoords, destPos],
          strokeColor: "#2f8cff",
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map: siteMapInstance,
        });
        siteMapPolylines.push(refLine);
      } catch {}
      const bounds = new LatLngBounds();
      bounds.extend(originCoords);
      bounds.extend(destPos);
      siteLastRouteBounds = bounds;
      if (runtime.selectedSiteId && !runtime.siteDistances[String(runtime.selectedSiteId)]?.distanceMeters) {
        runtime.siteDistances[String(runtime.selectedSiteId)] = {
          status: "ready",
          distanceMeters: straightMeters,
          distanceText: `~${approxLabel} (est.)`,
          straightKm: straightMeters / 1000,
        };
        hooks.renderSites();
      }
      if (statusEl) {
        statusEl.textContent = "📍 " + (resolved.formattedAddress || resolved.displayName || siteTitle) + (approxLabel ? " · ~" + approxLabel + " away" : " · Centered on site");
      }
      if (dirBox) {
        dirBox.innerHTML =
          modeTabsHtml +
          `<div class="muted" style="font-size:12px;margin-bottom:8px;">Map centered on selected site (~${esc(approxLabel || "—")} straight-line from your GPS). Tap below for turn-by-turn navigation in Google Maps.</div>` +
          `<div class="inline-actions" style="margin-top:0;">` +
          `<button class="gray small-btn" type="button" onclick="centerSiteMapOnSelected()">🎯 Center on Site</button>` +
          `<button class="gray small-btn" type="button" onclick="fitSiteMapRoute()">🗺 Fit Both Pins</button>` +
          `<a class="btn small-btn" style="text-decoration:none;display:inline-flex;align-items:center;" href="${esc(gmapsExternalUrl)}" target="_blank" rel="noopener">🧭 Open Directions in Google Maps ↗</a>` +
          `</div>`;
      }
    }
  } catch (err: any) {
    const gSearch = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(query);
    if (statusEl) statusEl.textContent = "Unable to load site map right now: " + (err?.message || err);
    if (dirBox) {
      dirBox.innerHTML = `<a class="btn small-btn" style="text-decoration:none;display:inline-flex;align-items:center;" href="${esc(gSearch)}" target="_blank" rel="noopener">🧭 Open Directions in Google Maps ↗</a>`;
    }
  }
}

export async function focusSiteMapCoordinates(
  destPos: { lat: number; lng: number },
  title: string,
  formattedAddress = ""
): Promise<void> {
  const statusEl = $("siteMapStatus");
  const dirBox = $("siteMapDirections");
  const ttl = $("siteMapTitle");
  if (ttl) ttl.textContent = title || "Sites Map";
  clearSiteMapPolylines();

  const setup = await ensureSiteMapInstance("siteGoogleMap");
  if (!setup || !siteMapInstance) return;
  const { InfoWindow, AdvancedMarkerElement, LatLngBounds, Route, spherical } = setup;
  if (!siteMapInfoWindow) siteMapInfoWindow = new InfoWindow();

  siteLastDestPos = destPos;
  try { google.maps.event.trigger(siteMapInstance, "resize"); } catch {}
  siteMapInstance.setCenter(destPos);
  siteMapInstance.panTo(destPos);
  siteMapInstance.setZoom(16);
  requestAnimationFrame(() => {
    if (siteMapInstance) {
      try { google.maps.event.trigger(siteMapInstance, "resize"); } catch {}
      siteMapInstance.setCenter(destPos);
      siteMapInstance.setZoom(16);
    }
  });

  if (!siteMapMarker) {
    siteMapMarker = new AdvancedMarkerElement({
      map: siteMapInstance,
      position: destPos,
      title,
      content: buildSitePinElement(title, true),
      zIndex: 999,
    });
  } else {
    siteMapMarker.map = siteMapInstance;
    siteMapMarker.position = destPos;
    siteMapMarker.title = title;
    siteMapMarker.content = buildSitePinElement(title, true);
    siteMapMarker.zIndex = 999;
  }

  siteMapInfoWindow.setContent(
    `<div style="font-size:13px;line-height:1.4;"><b>${esc(title)}</b>` +
    (formattedAddress ? `<br><span>${esc(formattedAddress)}</span>` : "") +
    `</div>`
  );
  siteMapInfoWindow.open({ map: siteMapInstance, anchor: siteMapMarker });

  const originCoords = await getCurrentOriginLatLng();
  const gmapsExternalUrl = originCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCoords.lat + "," + originCoords.lng)}&destination=${encodeURIComponent(destPos.lat + "," + destPos.lng)}&travelmode=${runtime.siteMapTravelMode === "WALKING" ? "walking" : "driving"}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destPos.lat + "," + destPos.lng)}&travelmode=${runtime.siteMapTravelMode === "WALKING" ? "walking" : "driving"}`;

  if (!originCoords) {
    if (siteOriginMarker) siteOriginMarker.map = null;
    if (statusEl) statusEl.textContent = `📍 ${formattedAddress || title} · Turn on GPS for live route`;
    if (dirBox) {
      dirBox.innerHTML =
        `<div class="inline-actions" style="margin-top:0;">` +
        `<button class="gray small-btn" type="button" onclick="centerSiteMapOnSelected()">🎯 Center on Site</button>` +
        `<a class="btn small-btn" style="text-decoration:none;display:inline-flex;align-items:center;" href="${esc(gmapsExternalUrl)}" target="_blank" rel="noopener">🧭 Open Directions in Google Maps ↗</a>` +
        `</div>`;
    }
    return;
  }

  if (!siteOriginMarker) {
    siteOriginMarker = new AdvancedMarkerElement({
      map: siteMapInstance,
      position: originCoords,
      title: "Your Current Location",
      content: buildOriginPinElement(),
    });
  } else {
    siteOriginMarker.map = siteMapInstance;
    siteOriginMarker.position = originCoords;
  }

  let route: any = null;
  try {
    const res = await Route.computeRoutes({
      origin: originCoords,
      destination: destPos,
      travelMode: runtime.siteMapTravelMode || "DRIVING",
      fields: ["path", "distanceMeters", "durationMillis", "viewport", "legs"],
      internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
    } as any);
    route = res.routes?.[0] || null;
  } catch {
    route = null;
  }

  if (route) {
    try {
      const polylines = route.createPolylines({
        map: siteMapInstance,
        polylineOptions: { strokeColor: "#2f8cff", strokeWeight: 6, strokeOpacity: 0.9 },
      } as any);
      if (Array.isArray(polylines)) siteMapPolylines.push(...polylines);
      else if (polylines) siteMapPolylines.push(polylines as any);
    } catch {}
    if (route.viewport) siteLastRouteBounds = route.viewport;
    const distLabel = formatDistanceMeters(route.distanceMeters);
    const etaLabel = formatDurationMs(route.durationMillis);
    if (statusEl) statusEl.textContent = `📍 ${title} · ${distLabel || "Route ready"}${etaLabel ? " · ETA " + etaLabel : ""}`;
    if (dirBox) {
      dirBox.innerHTML =
        `<div class="item" style="margin-top:0;"><b>🚗 ${esc(distLabel || "Route")}</b>${etaLabel ? ` <span class="badge">${esc(etaLabel)}</span>` : ""}` +
        `<div class="inline-actions" style="margin-top:8px;">` +
        `<button class="gray small-btn" type="button" onclick="centerSiteMapOnSelected()">🎯 Center on Pin</button>` +
        `<button class="gray small-btn" type="button" onclick="fitSiteMapRoute()">🗺 Fit Route</button>` +
        `<a class="btn small-btn" style="text-decoration:none;display:inline-flex;align-items:center;" href="${esc(gmapsExternalUrl)}" target="_blank" rel="noopener">🧭 Open in Google Maps ↗</a>` +
        `</div></div>`;
    }
  } else {
    const straightMeters = Math.round(spherical.computeDistanceBetween(originCoords, destPos));
    const approxLabel = formatDistanceMeters(straightMeters);
    try {
      const refLine = new google.maps.Polyline({
        path: [originCoords, destPos],
        strokeColor: "#2f8cff",
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map: siteMapInstance,
      });
      siteMapPolylines.push(refLine);
    } catch {}
    const bounds = new LatLngBounds();
    bounds.extend(originCoords);
    bounds.extend(destPos);
    siteLastRouteBounds = bounds;
    if (statusEl) statusEl.textContent = `📍 ${formattedAddress || title}${approxLabel ? " · ~" + approxLabel + " away" : ""}`;
    if (dirBox) {
      dirBox.innerHTML =
        `<div class="inline-actions" style="margin-top:0;">` +
        `<button class="gray small-btn" type="button" onclick="centerSiteMapOnSelected()">🎯 Center on Pin</button>` +
        `<button class="gray small-btn" type="button" onclick="fitSiteMapRoute()">🗺 Fit Both Pins</button>` +
        `<a class="btn small-btn" style="text-decoration:none;display:inline-flex;align-items:center;" href="${esc(gmapsExternalUrl)}" target="_blank" rel="noopener">🧭 Open Directions in Google Maps ↗</a>` +
        `</div>`;
    }
  }
}

let siteMapControlsWired = false;
let placesAutocompleteDenied = false;

export function initSiteMapControls(): void {
  if (siteMapControlsWired) return;
  siteMapControlsWired = true;

  document.querySelectorAll<HTMLElement>("[data-site-map-layer]").forEach(btn => {
    btn.addEventListener("click", () => {
      const layer = btn.dataset.siteMapLayer === "satellite" ? "satellite" : "roadmap";
      setSiteMapLayer(layer);
      if (!siteMapInstance) void initSitesMapOverview();
    });
  });

  const input = $("siteMapSearchInput") as HTMLInputElement | null;
  const clearBtn = $("siteMapSearchClearBtn");
  const resultsBox = $("siteMapSearchResults");
  if (!input || !resultsBox) return;

  let debounceTimer: any = null;
  let searchSeq = 0;
  let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;
  let activeEntries: Array<{
    kind: "site" | "google" | "geocode";
    label: string;
    sublabel: string;
    siteId?: string;
    prediction?: google.maps.places.PlacePrediction;
    coords?: { lat: number; lng: number };
    query?: string;
  }> = [];

  const hideResults = () => {
    resultsBox.classList.add("hidden");
  };

  const renderSuggestions = () => {
    if (!activeEntries.length) {
      resultsBox.innerHTML = "";
      resultsBox.classList.add("hidden");
      return;
    }
    resultsBox.innerHTML = activeEntries
      .map((item, idx) =>
        `<button type="button" class="site-map-search-item" role="option" data-map-suggest-idx="${idx}">` +
        `${item.kind === "site" ? "🏢 " : "📍 "}${esc(item.label)}` +
        (item.sublabel ? `<small>${esc(item.sublabel)}</small>` : "") +
        `</button>`
      )
      .join("");
    resultsBox.classList.remove("hidden");
  };

  const selectEntry = async (idx: number) => {
    const item = activeEntries[idx];
    if (!item) return;
    hideResults();
    input.value = item.label;
    clearBtn?.classList.remove("hidden");

    if (item.kind === "site" && item.siteId) {
      sessionToken = null;
      hooks.openSiteOnMap?.(item.siteId);
      return;
    }

    if (item.kind === "google" && item.prediction) {
      const statusEl = $("siteMapStatus");
      if (statusEl) statusEl.textContent = `Locating ${item.label}…`;
      try {
        const place = item.prediction.toPlace();
        await place.fetchFields({ fields: ["location", "displayName", "formattedAddress"] });
        sessionToken = null;
        if (place.location) {
          const lat = typeof place.location.lat === "function" ? place.location.lat() : Number((place.location as any).lat);
          const lng = typeof place.location.lng === "function" ? place.location.lng() : Number((place.location as any).lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            runtime.selectedSiteId = null;
            hooks.renderSites();
            await focusSiteMapCoordinates(
              { lat, lng },
              place.displayName || item.label,
              place.formattedAddress || item.sublabel
            );
            return;
          }
        }
      } catch {}
    }

    if (item.coords) {
      runtime.selectedSiteId = null;
      hooks.renderSites();
      await focusSiteMapCoordinates(item.coords, item.label, item.sublabel);
      return;
    }

    const q = item.query || item.label;
    const fb = await fetchFallbackGeocode([q, `${q}, Philippines`], item.label);
    if (fb) {
      runtime.selectedSiteId = null;
      hooks.renderSites();
      await focusSiteMapCoordinates({ lat: fb.lat, lng: fb.lng }, fb.displayName || item.label, fb.formattedAddress);
    } else {
      toast("Could not locate that address on the map.");
    }
  };

  const runAutocomplete = async (term: string) => {
    const q = term.trim();
    const mySeq = ++searchSeq;
    if (!q) {
      activeEntries = [];
      hideResults();
      return;
    }

    const ql = q.toLowerCase();
    const localMatches = state.sites
      .filter(s => [s.name, s.address, s.city, s.region].some(v => String(v || "").toLowerCase().includes(ql)))
      .slice(0, 4)
      .map(s => ({
        kind: "site" as const,
        label: String(s.name || "Work Site"),
        sublabel: [s.address, s.city, s.region].filter(Boolean).join(" · "),
        siteId: String(s.id),
      }));

    activeEntries = [...localMatches];
    if (localMatches.length) renderSuggestions();

    if (q.length < 2) return;

    if (!placesAutocompleteDenied) {
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await loadGoogleMapsLibraries();
        if (mySeq !== searchSeq) return;
        if (!sessionToken) sessionToken = new AutocompleteSessionToken();
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken,
          includedRegionCodes: ["ph"],
          internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
        } as any);
        if (mySeq !== searchSeq) return;
        const googleEntries = (suggestions || [])
          .map(s => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => Boolean(p))
          .slice(0, 5)
          .map(p => ({
            kind: "google" as const,
            label: p.mainText?.text || p.text?.text || q,
            sublabel: p.secondaryText?.text || p.text?.text || "",
            prediction: p,
          }));
        activeEntries = [...localMatches, ...googleEntries];
        renderSuggestions();
        return;
      } catch (err: any) {
        const msg = err?.message || String(err || "");
        if (/PERMISSION_DENIED|Permission denied|not activated|API_KEY/i.test(msg)) {
          placesAutocompleteDenied = true;
        }
      }
    }

    const fb = await fetchFallbackGeocode([q, `${q}, Philippines`], q);
    if (mySeq !== searchSeq) return;
    if (fb) {
      activeEntries = [
        ...localMatches,
        {
          kind: "geocode",
          label: fb.displayName || q,
          sublabel: fb.formattedAddress,
          coords: { lat: fb.lat, lng: fb.lng },
          query: q,
        },
      ];
    }
    renderSuggestions();
  };

  input.addEventListener("input", () => {
    const val = input.value;
    clearBtn?.classList.toggle("hidden", !val.length);
    clearTimeout(debounceTimer);
    if (!val.trim()) {
      activeEntries = [];
      hideResults();
      sessionToken = null;
      return;
    }
    debounceTimer = setTimeout(() => { void runAutocomplete(val); }, 260);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim() && activeEntries.length) resultsBox.classList.remove("hidden");
  });

  input.addEventListener("keydown", async e => {
    if (e.key === "Escape") {
      hideResults();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeEntries.length) {
        await selectEntry(0);
      } else if (input.value.trim()) {
        await runAutocomplete(input.value);
        if (activeEntries.length) {
          await selectEntry(0);
        } else {
          const q = input.value.trim();
          const fb = await fetchFallbackGeocode([q, `${q}, Philippines`], q);
          if (fb) {
            runtime.selectedSiteId = null;
            hooks.renderSites();
            await focusSiteMapCoordinates({ lat: fb.lat, lng: fb.lng }, fb.displayName || q, fb.formattedAddress);
          } else {
            toast("No matching address found.");
          }
        }
      }
    }
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    activeEntries = [];
    sessionToken = null;
    clearBtn.classList.add("hidden");
    hideResults();
    input.focus();
  });

  resultsBox.addEventListener("click", e => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-map-suggest-idx]");
    if (!btn) return;
    const idx = Number(btn.dataset.mapSuggestIdx);
    if (Number.isInteger(idx)) void selectEntry(idx);
  });

  document.addEventListener("click", e => {
    const wrap = $("siteMapSearchWrap");
    if (wrap && e.target instanceof Node && !wrap.contains(e.target)) {
      hideResults();
    }
  });
}

let addSiteMapInstance: google.maps.Map | null = null;
let addSiteMapContainerEl: HTMLElement | null = null;
let addSiteMarker: google.maps.marker.AdvancedMarkerElement | null = null;
let addSiteWired = false;
let addSiteAddressTouched = false;
let addSiteCoordsTouched = false;
let addSiteLastCustomPreviewUrl = "";

function setAddSiteThumbPreviewUi(url: string, noteText: string): void {
  const img = $("addSiteThumbPreview") as HTMLImageElement | null;
  const note = $("addSiteThumbNote");
  if (img) {
    if (url) {
      img.src = url;
      img.classList.remove("hidden");
    } else {
      img.removeAttribute("src");
      img.classList.add("hidden");
    }
  }
  if (note && noteText) note.textContent = noteText;
}

async function refreshAddSiteAutoPhotoPreview(opts: {
  name: string;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  placesPhotoUrl?: string | null;
}): Promise<void> {
  const fileInp = $("siteAddThumb") as HTMLInputElement | null;
  if (fileInp?.files?.[0]) return;
  const found = await resolveSiteAutoPhotoUrl(opts);
  if (fileInp?.files?.[0]) return;
  if (found?.photoUrl) {
    setVal("siteAutoThumbUrl", found.photoUrl);
    const label =
      found.source === "google_places"
        ? "Auto-picked from Google Places photo."
        : found.source === "osm_tile"
          ? "Auto-generated from work site map pin."
          : "Auto-picked landmark picture for this work site.";
    setAddSiteThumbPreviewUi(found.photoUrl, label);
  }
}

export function resetAddSitePinPicker(): void {
  addSiteAddressTouched = false;
  addSiteCoordsTouched = false;
  if (addSiteLastCustomPreviewUrl) {
    URL.revokeObjectURL(addSiteLastCustomPreviewUrl);
    addSiteLastCustomPreviewUrl = "";
  }
  setVal("siteAutoThumbUrl", "");
  setAddSiteThumbPreviewUi("", "A picture is automatically added from Places / landmark photo or map pin when you enter a site name.");
  const st = $("addSitePinStatus");
  if (st) st.textContent = "Type a site name or address to auto-fill address & drop pin (tap or drag pin on map to adjust).";
  $("addSiteSearchResults")?.classList.add("hidden");
  if (addSiteMarker) addSiteMarker.map = null;
}

async function ensureAddSitePreviewMap(): Promise<{
  map: google.maps.Map;
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
} | null> {
  const el = $("addSitePinMap");
  if (!el) return null;
  const libs = await loadGoogleMapsLibraries();
  if (!addSiteMapInstance || addSiteMapContainerEl !== el) {
    addSiteMapContainerEl = el;
    addSiteMapInstance = new libs.Map(el, {
      center: { lat: 10.3157, lng: 123.8854 },
      zoom: 12,
      mapId: "DEMO_MAP_ID",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
    } as any);
    addSiteMarker = null;

    addSiteMapInstance.addListener("click", async (ev: google.maps.MapMouseEvent) => {
      if (!ev.latLng) return;
      const lat = ev.latLng.lat();
      const lng = ev.latLng.lng();
      addSiteCoordsTouched = true;
      await setAddSitePinCoords({ lat, lng }, { reverseFillAddress: true, label: val("siteName").trim() || "New Work Site" });
    });
  } else {
    try {
      google.maps.event.trigger(addSiteMapInstance, "resize");
    } catch {}
  }
  return { map: addSiteMapInstance, AdvancedMarkerElement: libs.AdvancedMarkerElement };
}

async function setAddSitePinCoords(
  pos: { lat: number; lng: number },
  opts: { reverseFillAddress?: boolean; label?: string; zoom?: number } = {}
): Promise<void> {
  const latStr = pos.lat.toFixed(6);
  const lngStr = pos.lng.toFixed(6);
  setVal("siteLat", latStr);
  setVal("siteLng", lngStr);
  const st = $("addSitePinStatus");
  const label = opts.label || val("siteName").trim() || "New Work Site";

  try {
    const setup = await ensureAddSitePreviewMap();
    if (setup) {
      const { map, AdvancedMarkerElement } = setup;
      map.panTo(pos);
      map.setCenter(pos);
      map.setZoom(opts.zoom || 16);
      const pinEl = buildSitePinElement(label, true);
      if (!addSiteMarker) {
        addSiteMarker = new AdvancedMarkerElement({
          map,
          position: pos,
          title: label,
          content: pinEl,
          gmpDraggable: true,
        });
        addSiteMarker.addListener("dragend", async () => {
          const p = addSiteMarker?.position as any;
          const dLat = typeof p?.lat === "function" ? p.lat() : Number(p?.lat);
          const dLng = typeof p?.lng === "function" ? p.lng() : Number(p?.lng);
          if (Number.isFinite(dLat) && Number.isFinite(dLng)) {
            addSiteCoordsTouched = true;
            await setAddSitePinCoords({ lat: dLat, lng: dLng }, { reverseFillAddress: true, label: val("siteName").trim() || "New Work Site" });
          }
        });
      } else {
        addSiteMarker.map = map;
        addSiteMarker.position = pos;
        addSiteMarker.title = label;
        addSiteMarker.content = pinEl;
      }
    }
  } catch {}

  if (opts.reverseFillAddress) {
    if (st) st.textContent = `📍 Pin at ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} · Looking up address…`;
    const rev = await fetchReverseGeocode(pos.lat, pos.lng);
    if (rev) {
      if (rev.formattedAddress) {
        setVal("siteAddress", rev.formattedAddress);
        addSiteAddressTouched = true;
      }
      if (rev.city) setVal("siteCity", rev.city);
      setVal("siteRegion", rev.regionHint);
      if (st) st.textContent = `✅ Pinned ${rev.city || "site"} (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)})`;
      void refreshAddSiteAutoPhotoPreview({
        name: val("siteName").trim() || rev.city || "Work Site",
        city: rev.city,
        lat: pos.lat,
        lng: pos.lng,
      });
    } else if (st) {
      st.textContent = `📍 Pinned at ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    }
  } else if (st) {
    st.textContent = `✅ Pinned ${label} (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)})`;
  }
}

export function initAddSitePinPicker(): void {
  void ensureAddSitePreviewMap();
  if (addSiteWired) return;
  addSiteWired = true;

  const nameInput = $("siteName") as HTMLInputElement | null;
  const addrInput = $("siteAddress") as HTMLInputElement | null;
  const latInput = $("siteLat") as HTMLInputElement | null;
  const lngInput = $("siteLng") as HTMLInputElement | null;
  const thumbInput = $("siteAddThumb") as HTMLInputElement | null;
  const resultsBox = $("addSiteSearchResults");
  const autoBtn = $("autoLocateSiteBtn");
  const gpsBtn = $("useMyGpsSiteBtn");
  const statusEl = $("addSitePinStatus");
  if (!nameInput || !addrInput || !resultsBox) return;

  let nameTimer: any = null;
  let addrTimer: any = null;
  let searchSeq = 0;
  let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;
  let suggestionsList: Array<{
    kind: "google" | "geocode";
    label: string;
    sublabel: string;
    prediction?: google.maps.places.PlacePrediction;
    coords?: { lat: number; lng: number };
    city?: string;
    regionHint?: string;
    formattedAddress?: string;
  }> = [];

  const hideDrop = () => resultsBox.classList.add("hidden");

  const renderDrop = () => {
    if (!suggestionsList.length) {
      resultsBox.innerHTML = "";
      hideDrop();
      return;
    }
    resultsBox.innerHTML = suggestionsList
      .map((item, idx) =>
        `<button type="button" class="site-map-search-item" role="option" data-add-site-suggest="${idx}">` +
        `📍 ${esc(item.label)}` +
        (item.sublabel ? `<small>${esc(item.sublabel)}</small>` : "") +
        `</button>`
      )
      .join("");
    resultsBox.classList.remove("hidden");
  };

  const applyResolvedResult = async (res: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    region: "Luzon" | "Visayas" | "Mindanao";
    label: string;
    placesPhotoUrl?: string;
  }) => {
    if (res.address) setVal("siteAddress", res.address);
    if (res.city) setVal("siteCity", res.city);
    setVal("siteRegion", res.region);
    await setAddSitePinCoords({ lat: res.lat, lng: res.lng }, { reverseFillAddress: false, label: res.label });
    void refreshAddSiteAutoPhotoPreview({
      name: res.label,
      city: res.city,
      lat: res.lat,
      lng: res.lng,
      placesPhotoUrl: res.placesPhotoUrl,
    });
  };

  const pickSuggestion = async (idx: number) => {
    const item = suggestionsList[idx];
    if (!item) return;
    hideDrop();
    addSiteAddressTouched = true;
    addSiteCoordsTouched = true;
    if (statusEl) statusEl.textContent = `Resolving ${item.label}…`;

    if (item.kind === "google" && item.prediction) {
      try {
        const place = item.prediction.toPlace();
        await place.fetchFields({ fields: ["location", "displayName", "formattedAddress", "addressComponents", "photos"] });
        sessionToken = null;
        if (place.location) {
          const lat = typeof place.location.lat === "function" ? place.location.lat() : Number((place.location as any).lat);
          const lng = typeof place.location.lng === "function" ? place.location.lng() : Number((place.location as any).lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const addr = place.formattedAddress || [item.label, item.sublabel].filter(Boolean).join(", ");
            const city = extractCityFromAddressComponents(place.addressComponents, addr);
            const region = inferPhRegionFromTextOrCoords(`${place.displayName || ""} ${addr} ${city}`, lat, lng);
            let placesPhotoUrl = "";
            try {
              const p0: any = Array.isArray((place as any).photos) ? (place as any).photos[0] : null;
              if (p0 && typeof p0.getURI === "function") placesPhotoUrl = String(p0.getURI({ maxWidth: 800, maxHeight: 600 }) || "");
            } catch {}
            await applyResolvedResult({
              lat,
              lng,
              address: addr,
              city,
              region,
              label: val("siteName").trim() || place.displayName || item.label,
              placesPhotoUrl,
            });
            return;
          }
        }
      } catch {}
    }

    if (item.coords) {
      const addr = item.formattedAddress || item.label;
      const city = item.city || extractCityFromAddressComponents(null, addr);
      const region = (item.regionHint as any) || inferPhRegionFromTextOrCoords(`${addr} ${city}`, item.coords.lat, item.coords.lng);
      await applyResolvedResult({
        lat: item.coords.lat,
        lng: item.coords.lng,
        address: addr,
        city,
        region,
        label: val("siteName").trim() || item.label,
      });
    }
  };

  const runAddressSuggestions = async (term: string) => {
    const q = term.trim();
    const mySeq = ++searchSeq;
    if (q.length < 2) {
      suggestionsList = [];
      hideDrop();
      return;
    }

    if (!placesAutocompleteDenied) {
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await loadGoogleMapsLibraries();
        if (mySeq !== searchSeq) return;
        if (!sessionToken) sessionToken = new AutocompleteSessionToken();
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken,
          includedRegionCodes: ["ph"],
          internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
        } as any);
        if (mySeq !== searchSeq) return;
        suggestionsList = (suggestions || [])
          .map(s => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => Boolean(p))
          .slice(0, 5)
          .map(p => ({
            kind: "google" as const,
            label: p.mainText?.text || p.text?.text || q,
            sublabel: p.secondaryText?.text || p.text?.text || "",
            prediction: p,
          }));
        renderDrop();
        return;
      } catch (err: any) {
        const msg = err?.message || String(err || "");
        if (/PERMISSION_DENIED|Permission denied|not activated|API_KEY/i.test(msg)) {
          placesAutocompleteDenied = true;
        }
      }
    }

    const fb = await fetchFallbackGeocode([q, `${q}, Philippines`], q);
    if (mySeq !== searchSeq) return;
    suggestionsList = fb
      ? [{
          kind: "geocode",
          label: fb.displayName || q,
          sublabel: fb.formattedAddress,
          coords: { lat: fb.lat, lng: fb.lng },
          city: fb.city,
          regionHint: fb.regionHint,
          formattedAddress: fb.formattedAddress,
        }]
      : [];
    renderDrop();
  };

  let autoResolveSeq = 0;
  const autoResolveFromNameOrAddress = async (forceOverride = false, fromName = false) => {
    const sName = val("siteName").trim();
    const sAddr = val("siteAddress").trim();
    const sCity = val("siteCity").trim();
    const sReg = val("siteRegion");
    const querySeed = fromName ? sName : (forceOverride ? (sAddr || sName) : sName);
    if (!querySeed || querySeed.length < 3) return;
    const seq = ++autoResolveSeq;
    if (statusEl) statusEl.textContent = `🔍 Auto-detecting address & pin for "${querySeed}"…`;
    const resolved = await resolveSiteAddressAndPin({
      name: fromName ? sName : (sName || sAddr),
      address: fromName ? (addSiteAddressTouched ? sAddr : "") : (forceOverride ? sAddr : ""),
      city: fromName ? "" : (forceOverride ? sCity : ""),
      region: sReg,
    });
    if (seq !== autoResolveSeq) return;
    if (!resolved || resolved.lat === null || resolved.lng === null) {
      if (statusEl) statusEl.textContent = "Pin not matched automatically — search an address above or tap the map.";
      return;
    }
    if (!addSiteAddressTouched || forceOverride || !val("siteAddress").trim()) {
      if (resolved.address) setVal("siteAddress", resolved.address);
    }
    if (resolved.city && (!addSiteAddressTouched || forceOverride || !val("siteCity").trim())) {
      setVal("siteCity", resolved.city);
    }
    setVal("siteRegion", resolved.region);
    if (!addSiteCoordsTouched || forceOverride || !val("siteLat").trim() || !val("siteLng").trim()) {
      await setAddSitePinCoords({ lat: resolved.lat, lng: resolved.lng }, {
        reverseFillAddress: false,
        label: sName || resolved.displayName || "Work Site",
      });
    }
    void refreshAddSiteAutoPhotoPreview({
      name: sName || resolved.displayName || querySeed,
      city: resolved.city,
      lat: resolved.lat,
      lng: resolved.lng,
      placesPhotoUrl: resolved.photoUrl,
    });
  };

  nameInput.addEventListener("input", () => {
    clearTimeout(nameTimer);
    const v = nameInput.value.trim();
    if (v.length < 3) return;
    nameTimer = setTimeout(() => {
      void autoResolveFromNameOrAddress(false, true);
    }, 450);
  });

  nameInput.addEventListener("blur", () => {
    const v = nameInput.value.trim();
    if (v.length >= 3 && (!val("siteLat").trim() || !val("siteLng").trim() || !val("siteAddress").trim())) {
      clearTimeout(nameTimer);
      void autoResolveFromNameOrAddress(false, true);
    }
  });

  addrInput.addEventListener("input", () => {
    addSiteAddressTouched = Boolean(addrInput.value.trim());
    clearTimeout(addrTimer);
    if (!addrInput.value.trim()) {
      suggestionsList = [];
      hideDrop();
      sessionToken = null;
      return;
    }
    addrTimer = setTimeout(() => { void runAddressSuggestions(addrInput.value); }, 260);
  });

  addrInput.addEventListener("keydown", async e => {
    if (e.key === "Escape") {
      hideDrop();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestionsList.length) {
        await pickSuggestion(0);
      } else {
        await autoResolveFromNameOrAddress(true);
      }
    }
  });

  resultsBox.addEventListener("click", e => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-add-site-suggest]");
    if (!btn) return;
    const idx = Number(btn.dataset.addSiteSuggest);
    if (Number.isInteger(idx)) void pickSuggestion(idx);
  });

  document.addEventListener("click", e => {
    const wrap = $("addSiteSearchWrap");
    if (wrap && e.target instanceof Node && !wrap.contains(e.target)) hideDrop();
  });

  autoBtn?.addEventListener("click", () => {
    hideDrop();
    void autoResolveFromNameOrAddress(true);
  });

  gpsBtn?.addEventListener("click", async () => {
    hideDrop();
    if (statusEl) statusEl.textContent = "📡 Acquiring your current GPS location…";
    const coords = await getCurrentOriginLatLng();
    if (!coords) {
      toast("Turn on device GPS permission to pin your current location.");
      if (statusEl) statusEl.textContent = "GPS unavailable — search an address or tap on the map.";
      return;
    }
    addSiteCoordsTouched = true;
    await setAddSitePinCoords(coords, { reverseFillAddress: true, label: val("siteName").trim() || "New Work Site" });
  });

  thumbInput?.addEventListener("change", () => {
    if (addSiteLastCustomPreviewUrl) {
      URL.revokeObjectURL(addSiteLastCustomPreviewUrl);
      addSiteLastCustomPreviewUrl = "";
    }
    const f = thumbInput.files?.[0];
    if (f) {
      addSiteLastCustomPreviewUrl = URL.createObjectURL(f);
      setAddSiteThumbPreviewUi(addSiteLastCustomPreviewUrl, "Custom uploaded work site picture.");
    } else {
      const existingAuto = val("siteAutoThumbUrl").trim();
      setAddSiteThumbPreviewUi(
        existingAuto,
        existingAuto
          ? "Using auto-fetched work site picture."
          : "A picture is automatically added from Places / landmark photo or map pin when you enter a site name."
      );
    }
  });

  const syncManualCoords = () => {
    const la = Number(val("siteLat"));
    const lo = Number(val("siteLng"));
    if (Number.isFinite(la) && Number.isFinite(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180) {
      addSiteCoordsTouched = true;
      void setAddSitePinCoords({ lat: la, lng: lo }, { reverseFillAddress: false, label: val("siteName").trim() || "New Work Site" });
      void refreshAddSiteAutoPhotoPreview({
        name: val("siteName").trim() || "Work Site",
        city: val("siteCity").trim(),
        lat: la,
        lng: lo,
      });
    }
  };
  latInput?.addEventListener("change", syncManualCoords);
  lngInput?.addEventListener("change", syncManualCoords);
}

export function initDataListeners(): void {
  let scrollSaveTimer: any = null;

  window.addEventListener("online", () => {
    updateNetworkStatus();
    toast("Internet connection restored.");
    if (state.userId) { startLive(); reloadEverything(); }
  });
  window.addEventListener("offline", () => {
    updateNetworkStatus();
    setLive(false);
    toast("You are offline. Please check your connection.");
  });
  updateNetworkStatus();

  window.addEventListener("scroll", () => {
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => saveLastView(), 250);
  }, { passive: true });
  window.addEventListener("pagehide", () => saveLastView());

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !state.userId) return;
    if (!runtime.dbReady) startLive();
    hooks.checkShiftReminders?.();
    void loadUnread();
  });

  setInterval(() => {
    if (runtime.currentPage === "live-map" && isManager()) loadLiveMap();
  }, LIVE_REFRESH_MS);
}
