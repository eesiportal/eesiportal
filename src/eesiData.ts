import {
  $,
  esc,
  fmtDate,
  fmtDay,
  getDeletedForMeSet,
  hooks,
  isAdmin,
  isManager,
  isMissingTableError,
  isWithinSelfActionWindow,
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
    if (saved.unitsRegion && ["Luzon", "Visayas", "Mindanao"].includes(saved.unitsRegion)) {
      runtime.unitsRegion = saved.unitsRegion;
      document.querySelectorAll<HTMLElement>("[data-units-region]").forEach(b =>
        b.classList.toggle("active", b.dataset.unitsRegion === runtime.unitsRegion)
      );
    }
    if (saved.unitsTab === "manual" || saved.unitsTab === "list") {
      hooks.switchUnitsTab?.(saved.unitsTab);
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
    hooks.go(saved.page, { skipScrollReset: true });
    if (saved.page === "chat" && saved.activeThread && state.threads.some(t => String(t.id) === String(saved.activeThread))) {
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

export function resetDataLoadFlags(): void {
  appNotificationsLoaded = false;
  approvalNotificationsLoaded = false;
  announcementsLoaded = false;
  reportsLoaded = false;
  schedulesLoaded = false;
  leaveLoaded = false;
  dtrTimeLogsLoaded = false;
  runtime.dtrTimeLogsTableMissing = false;
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
  const { data, error } = await runtime.client.from("sites").select("id,name,address,city,region").order("name");
  if (error) { setupError("Could not load sites", error); return; }
  state.sites = data || [];
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
  if (runtime.dtrTimeLogsTableMissing) {
    syncTimeLogsFromAppNotices();
  }
  hooks.renderNotices();
  hooks.renderHome();
  if (newItems.length && !isWithinSelfActionWindow()) {
    const firstTitle = newItems[0].title || "Report";
    const cleanBody = stripTimeLogMeta(newItems[0].body);
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
  const { data, error } = await runtime.client
    .from("dtr_entries")
    .select("id,user_id,work_date,location,job,time_in,time_out,overtime_approved")
    .order("work_date", { ascending: true });
  if (error) { setupError("Could not load DTR", error); return; }
  state.dtrs = data || [];
  hooks.renderDtr();
  hooks.renderHome();
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
      hooks.renderAll();
      if (runtime.currentPage === "admin") hooks.renderAdmin();
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
  ]);
  await loadUnread();
  await loadRecentChatNotices();
  hooks.renderAll();
  if (state.activeThread) await loadMessages(state.activeThread);
}

/* ==================== LIVE MAP & GPS LOCATION SHARING ==================== */
let locationHeartbeatTimer: any = null;
let lastLocationUploadAt = 0;

async function uploadEmployeeCoordinates(pos: GeolocationPosition, isInitial = false): Promise<void> {
  if (!state.userId || !runtime.client) return;
  const statusEl = $("locationStatus");
  const acc = Math.round(pos.coords.accuracy || 0);
  const maxAcc = isInitial ? 350 : 150;
  if (acc > maxAcc) {
    if (statusEl) statusEl.textContent = "Refining GPS signal (±" + acc + " m)…";
    return;
  }
  const now = Date.now();
  if (!isInitial && now - lastLocationUploadAt < 5000) return;
  lastLocationUploadAt = now;

  const { latitude, longitude } = pos.coords;
  if (statusEl) {
    statusEl.textContent = "Live GPS: " + latitude.toFixed(5) + ", " + longitude.toFixed(5) + " (±" + acc + " m)";
  }
  if (Math.abs(latitude - runtime.lastWeatherLat) > 0.02 || Math.abs(longitude - runtime.lastWeatherLon) > 0.02) {
    updateLiveWeather(latitude, longitude);
  }
  await runtime.client
    .from("employee_locations")
    .upsert({ user_id: state.userId, latitude, longitude, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

export function startEmployeeLocationSharing(): void {
  const statusEl = $("locationStatus");
  if (!navigator.geolocation) {
    if (statusEl) {
      statusEl.classList.remove("hidden");
      statusEl.textContent = "This device cannot share location.";
    }
    return;
  }
  if (!state.userId || runtime.locationWatchId != null) return;
  if (statusEl) {
    statusEl.classList.remove("hidden");
    statusEl.textContent = "Acquiring accurate GPS location…";
  }

  // Immediate first GPS fix so Live Map shows user right away
  navigator.geolocation.getCurrentPosition(
    pos => { uploadEmployeeCoordinates(pos, true); },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );

  runtime.locationWatchId = navigator.geolocation.watchPosition(
    pos => { uploadEmployeeCoordinates(pos, false); },
    err => { if (statusEl) statusEl.textContent = "Location error: " + err.message; },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
  );

  if (locationHeartbeatTimer) clearInterval(locationHeartbeatTimer);
  locationHeartbeatTimer = setInterval(() => {
    if (!state.userId || !navigator.onLine || document.visibilityState !== "visible") return;
    navigator.geolocation.getCurrentPosition(
      pos => { uploadEmployeeCoordinates(pos, false); },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, 15000);
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
  Place: typeof google.maps.places.Place;
}> {
  const apiKey = getGoogleMapsKey();
  if (!apiKey) {
    throw new Error("Google Maps API key (VITE_GOOGLE_MAPS_API_KEY) is not configured.");
  }
  if (!mapsConfigured) {
    setOptions({ key: apiKey, v: "weekly" });
    mapsConfigured = true;
  }
  const [mapsLib, markerLib, coreLib, placesLib] = await Promise.all([
    importLibrary("maps") as Promise<google.maps.MapsLibrary>,
    importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
    importLibrary("core") as Promise<google.maps.CoreLibrary>,
    importLibrary("places") as Promise<google.maps.PlacesLibrary>,
  ]);
  return {
    Map: mapsLib.Map,
    InfoWindow: mapsLib.InfoWindow,
    AdvancedMarkerElement: markerLib.AdvancedMarkerElement,
    LatLngBounds: coreLib.LatLngBounds,
    Place: placesLib.Place,
  };
}

let liveMapInstance: google.maps.Map | null = null;
let liveInfoWindow: google.maps.InfoWindow | null = null;
let liveFitted = false;
let liveBusy = false;
let liveLastPoints: Array<{ lat: number; lng: number }> = [];
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

export function focusLiveEmployee(userId: string): void {
  const entry = liveMarkers.get(userId);
  if (!entry || !liveMapInstance) return;
  liveMapInstance.setCenter(entry.position);
  liveMapInstance.setZoom(17);
  if (liveInfoWindow) {
    liveInfoWindow.setContent(entry.infoHtml);
    liveInfoWindow.open({ map: liveMapInstance, anchor: entry.marker });
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
  if (!$("liveMap") || !isAdmin() || liveBusy) return;
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
  } finally {
    liveBusy = false;
  }
}

let siteMapInstance: google.maps.Map | null = null;
let siteMapContainerEl: HTMLElement | null = null;
let siteMapMarker: google.maps.marker.AdvancedMarkerElement | null = null;
let siteMapInfoWindow: google.maps.InfoWindow | null = null;

export async function openSiteGoogleMap(
  containerId: string,
  query: string,
  siteTitle: string,
  statusElId?: string
): Promise<void> {
  const container = $(containerId);
  const statusEl = statusElId ? $(statusElId) : null;
  if (!container) return;
  if (statusEl) statusEl.textContent = "Locating site on Google Maps…";
  try {
    const { Map, InfoWindow, AdvancedMarkerElement, Place } = await loadGoogleMapsLibraries();
    if (!siteMapInstance || siteMapContainerEl !== container) {
      siteMapContainerEl = container;
      siteMapInstance = new Map(container, {
        center: { lat: 14.5995, lng: 120.9842 },
        zoom: 12,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
      } as any);
      siteMapInfoWindow = new InfoWindow();
      siteMapMarker = null;
    }

    const { places } = await Place.searchByText({
      textQuery: query,
      fields: ["displayName", "location", "formattedAddress"],
      maxResultCount: 1,
      internalUsageAttributionIds: [MAPS_ATTRIBUTION_ID],
    } as any);

    const match = places?.[0];
    if (match && match.location && siteMapInstance) {
      const pos = match.location;
      siteMapInstance.setCenter(pos);
      siteMapInstance.setZoom(16);
      if (!siteMapMarker) {
        siteMapMarker = new AdvancedMarkerElement({
          map: siteMapInstance,
          position: pos,
          title: match.displayName || siteTitle,
        });
      } else {
        siteMapMarker.map = siteMapInstance;
        siteMapMarker.position = pos;
        siteMapMarker.title = match.displayName || siteTitle;
      }
      const infoContent =
        `<div style="font-size:13px;line-height:1.4;"><b>${esc(match.displayName || siteTitle)}</b>` +
        (match.formattedAddress ? `<br><span>${esc(match.formattedAddress)}</span>` : "") +
        `</div>`;
      if (siteMapInfoWindow) {
        siteMapInfoWindow.setContent(infoContent);
        siteMapInfoWindow.open({ map: siteMapInstance, anchor: siteMapMarker });
      }
      if (statusEl) {
        statusEl.textContent = match.formattedAddress
          ? "📍 " + match.formattedAddress
          : "📍 Centered on " + (match.displayName || siteTitle);
      }
    } else {
      if (siteMapMarker) siteMapMarker.map = null;
      if (statusEl) {
        statusEl.textContent = "Exact pin not found in Places for \"" + query + "\". Showing Philippines map.";
      }
    }
  } catch (err: any) {
    if (statusEl) statusEl.textContent = "Unable to load site map: " + (err?.message || err);
  }
}

export function initDataListeners(): void {
  let scrollSaveTimer: any = null;
  let lastVisibleReload = Date.now();

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
    scrollSaveTimer = setTimeout(() => saveLastView(), 200);
  }, { passive: true });
  window.addEventListener("pagehide", () => saveLastView());

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !state.userId) return;
    if (!runtime.dbReady) startLive();
    if (Date.now() - lastVisibleReload < 15000) return;
    lastVisibleReload = Date.now();
    reloadEverything();
  });

  setInterval(() => {
    if (runtime.currentPage === "live-map" && isAdmin()) loadLiveMap();
  }, LIVE_REFRESH_MS);
}
