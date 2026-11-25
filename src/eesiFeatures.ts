import {
  $,
  BLANK_IMG,
  PMS_ITEMS,
  PayslipRecord,
  REGULAR_WORKING_HOURS_PER_DAY,
  SITE_STATUS_OPTIONS,
  TimeLogNoticeMeta,
  UNIT_MANUAL_DEFAULTS,
  applyRandomOpenStyle,
  avatarHtml,
  buildDtrJobWithApproval,
  buildLeaveReasonWithMeta,
  buildPayslipAppNoticeBody,
  buildRecReasonWithMeta,
  buildReportDetailsWithUnit,
  buildSiteMetaAppNoticeBody,
  buildTimeLogAppNoticeBody,
  buildUnitNotesWithManual,
  calculateDtrHours,
  calculateDtrMinutes,
  calculateOtMinutes,
  calculateShiftBreakdown,
  canCommentOnRec,
  capDtrTimeOut,
  checkNetwork,
  closeSheet,
  compressImageToDataUrl,
  confirmDialog,
  deleteStorageFile,
  esc,
  extractReportPhotoUrls,
  extractSignatureStrokeOnly,
  face,
  filterDtrRowsByCutoff,
  fmtDate,
  fmtDay,
  fmtHalfSheetDate,
  fmtTableDate,
  fmtTime12h,
  formatDtrDuration,
  getDtrCutoffForDate,
  getSiteEffectiveStatus,
  getSiteThumbnailUrl,
  hooks,
  isAdmin,
  isHiddenSystemNotice,
  isImageFile,
  isImageUrl,
  isManager,
  isMissingTableError,
  isSundayDate,
  isVideoUrl,
  leaveDaysCount,
  listAvailableDtrCutoffs,
  localDateKey,
  openPhotoPreview,
  openSheet,
  parseDtrJobMeta,
  parseLeaveMeta,
  parseRecMeta,
  parseReportUnit,
  parseTimeToMinutes,
  parseUnitManualMeta,
  parseUnitSideTag,
  prepareImageFile,
  profileName,
  profileOf,
  renderUserLeaveBalanceHtml,
  resolvePayrollDtrWindow,
  roleLabel,
  runtime,
  safeUrl,
  setVal,
  sheetClose,
  state,
  stripReportPhotos,
  stripTimeLogMeta,
  suppressNotifications,
  toast,
  todayIso,
  val,
} from "./eesiTypes";
import {
  createSiteAutoSnapshotFile,
  fetchReverseGeocode,
  getCachedUserGpsCoords,
  getLocalPayslipsKey,
  haversineMeters,
  initAddSitePinPicker,
  initSitesMapOverview,
  isCurrentUserMentioned,
  isNoticeDeleted,
  isNoticeMarkedRead,
  loadAnnouncements,
  loadAppNotifications,
  loadApprovalNotifications,
  loadDtrs,
  loadLeaveRequests,
  loadLiveMap,
  loadNotes,
  loadPayslips,
  loadPending,
  loadPmsRecords,
  loadProfiles,
  loadRecentChatNotices,
  loadRecs,
  loadReports,
  loadRoles,
  loadSchedules,
  loadSites,
  loadTimeLogs,
  loadUnits,
  markNoticeDeleted,
  markNoticeRead,
  markNoticesReadBulk,
  onlineIds,
  openSiteGoogleMap,
  pushLiveCoordsSample,
  refreshVisibleSiteDistances,
  resetAddSitePinPicker,
  resolveSiteAddressAndPin,
  resolveSiteAutoPhotoUrl,
  resolveSiteCoordinatesByName,
  saveLastView,
  scheduleSiteMapLazyInit,
  timelineReports,
} from "./eesiData";
import {
  handleChatInfoAction,
  openDirect,
  openProfileView,
  openThread,
  removeMyReaction,
  renderChatList,
  renderMessages,
  threadTitle,
} from "./eesiChat";
import { exportPayslipPdf, exportPayslipXlsx } from "./eesiExport";
import { phHolidays, PhHolidayItem, triggerAlert, triggerAndroidHapticTap, triggerShiftAlert } from "./eesiSettings";

const SYSTEM_ANNOUNCEMENTS = [
  { title: "✨ GOOD VIBES", body: "Great teamwork builds great results. Stay positive, stay sharp, and have a safe, productive shift!" },
  { title: "🙌 GOOD VIBES", body: "Every safe job well done protects lives. Keep smiling and support your teammates today!" },
  { title: "🦺 PPE SAFETY", body: "Always wear your complete PPE: hard hat, safety shoes, gloves, safety glasses, and high-visibility vest." },
  { title: "⚡ LOCKOUT / TAGOUT (LOTO)", body: "Always lock out, tag out, and verify zero energy before servicing any elevator or escalator." },
  { title: "🪢 FALL PROTECTION", body: "Wear and anchor your full-body safety harness when working in hoistways, car tops, or elevated areas." },
  { title: "🚧 BARRICADES & PUBLIC SAFETY", body: "Set up clear warning signs and safety barricades before opening any elevator door or escalator unit." },
  { title: "🔌 ELECTRICAL SAFETY", body: "Use insulated tools, test for live circuits, and never bypass safety switches or door interlocks." },
  { title: "🛗 HOISTWAY & PIT SAFETY", body: "Confirm the pit stop switch is engaged and communicate clearly before entering the pit or car top." },
  { title: "⚙️ ESCALATOR SAFETY", body: "Keep hands, clothing, and tools clear of moving steps, chains, handrails, and comb plates until fully locked out." },
  { title: "🧯 MACHINE ROOM & FIRE SAFETY", body: "Keep machine rooms clean, dry, ventilated, and free of obstructions; know your fire extinguisher location." },
  { title: "🧰 TOOL & HOUSEKEEPING SAFETY", body: "Secure tools against drops, inspect gear before use, and keep work areas neat and trip-free." },
  { title: "💧 HEALTH & WELLNESS", body: "Stay hydrated, take mindful breaks, and report fatigue or unsafe conditions immediately." },
  { title: "🌟 EESI CORE VALUES", body: "Honesty, integrity, respect, and excellence in every task—be honest all the time." },
];

/* ==================== ACCESS / NAVIGATION ==================== */
export function updateAccess(): void {
  const canCreateChecklist = !isManager();
  document.querySelector('[data-report-type="service"]')?.classList.remove("hidden");
  document.querySelector('[data-report-type="delivery"]')?.classList.remove("hidden");
  document.querySelector('[data-report-type="checklist"]')?.classList.toggle("hidden", !canCreateChecklist);
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", !isAdmin()));
  document.querySelectorAll(".manager-only").forEach(el => el.classList.toggle("hidden", !isManager()));
  document.querySelectorAll<HTMLElement>('[onclick*="go(\'members\')"]').forEach(el => el.classList.toggle("hidden", !isManager()));
  if (!isManager() && ["members", "pending"].includes(runtime.currentPage)) {
    runtime.currentPage = "home";
    $("page-members")?.classList.add("hidden");
    $("page-pending")?.classList.add("hidden");
    $("page-home")?.classList.remove("hidden");
  }
  if (isManager() && state.reportType === "checklist") state.reportType = "service";
  renderPmsChecklist();
}

export function go(p: string, opts: { skipScrollReset?: boolean } = {}): void {
  if (["members", "pending"].includes(p) && !isManager()) { toast("Admin or Representative access only"); return; }
  if (p === "admin" && !isAdmin()) { toast("Administrator only"); return; }
  if (p === "live-map" && !isManager()) { toast("Admin or Representative access only"); return; }
  const pageEl = $("page-" + p);
  if (!pageEl) { toast("Page not found"); return; }
  document.querySelectorAll(".page").forEach(el => el.classList.add("hidden"));
  pageEl.classList.remove("hidden");
  applyRandomOpenStyle(pageEl);
  triggerAndroidHapticTap();
  runtime.currentPage = p;
  $("settingsMenu")?.classList.add("hidden");
  document.querySelectorAll<HTMLElement>("nav.bottom button").forEach(btn => btn.classList.toggle("active", btn.dataset.page === p));
  renderHome();
  if (p === "members") renderMembers();
  else if (p === "online") renderOnline();
  else if (p === "pending") renderPending();
  else if (p === "announcements") renderAnnouncements();
  else if (p === "schedule") { renderScheduleSiteOptions(); renderAssigneesPicker(); renderSchedules(); }
  else if (p === "sites") { renderSites(); scheduleSiteMapLazyInit(); }
  else if (p === "units") { void ensureAmcbUnitsSeeded(); renderUnitSiteOptions(); renderUnits(); }
  else if (p === "reports") { renderReportSites(); renderReports(); if (runtime.reportsViewMode === "search") runSearch(); }
  else if (p === "dtr") { renderConnectedPickers(); renderDtr(); autoFillDtrFromSchedule(false); renderTimeLog(); }
  else if (p === "payroll") { renderPayroll(); }
  else if (p === "notes") { renderConnectedPickers(); renderNotes(); renderRecs(); }
  else if (p === "leave") { renderLeave(); renderLeaveBalances(); }
  else if (p === "notices") { renderNotices(); loadAppNotifications(); loadApprovalNotifications(); loadRecentChatNotices(); }
  else if (p === "chat") { renderChatList(); renderMessages(); }
  else if (p === "live-map") { setTimeout(() => { hooks.renderLiveOnlineMembers?.(); loadLiveMap({ fit: true }); }, 40); }
  else if (p === "profile") renderProfile();
  else if (p === "admin") renderAdmin();
  if (!opts.skipScrollReset) window.scrollTo(0, 0);
  saveLastView(opts.skipScrollReset ? undefined : 0);
}

export function renderAll(): void {
  renderHome();
  renderMembers();
  renderOnline();
  renderPending();
  renderAnnouncements();
  renderSchedules();
  renderSites();
  renderUnits();
  renderDtr();
  renderPayroll();
  renderNotes();
  renderRecs();
  renderNotices();
  renderChatList();
  renderLeave();
  renderLeaveBalances();
  renderReports();
  renderPmsRecords();
  renderConnectedPickers();
}

/* ==================== SCHEDULES VISIBILITY & 30-MIN SHIFT PUSH REMINDERS ==================== */
const SHIFT_REMINDER_WINDOW_MS = 30 * 60 * 1000;

function parseScheduleTimeToken(raw: string): { hours: number; minutes: number; timeLabel: string; time24: string } | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const match = s.match(/(\d{1,2})(?::([0-5]\d))?\s*([ap]m)?/i);
  if (!match) return null;
  if (!match[2] && !match[3]) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const ampm = match[3] ? match[3].toLowerCase() : "";
  if (ampm === "pm" && hours < 12) hours += 12;
  else if (ampm === "am" && hours === 12) hours = 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const h12 = hours % 12 || 12;
  const suffix = hours >= 12 ? "PM" : "AM";
  return {
    hours,
    minutes,
    timeLabel: `${h12}:${String(minutes).padStart(2, "0")} ${suffix}`,
    time24: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  };
}

function formatScheduleTimeDisplay(raw: string): string {
  const parsed = parseScheduleTimeToken(raw);
  return parsed ? parsed.timeLabel : String(raw || "").trim();
}

function parseScheduleTags(rawNotes: unknown): {
  assigned: string[];
  dutyLabel: string;
  seq: number | null;
  cleanNotes: string;
} {
  let text = String(rawNotes || "").trim();
  let assigned: string[] = [];
  let dutyLabel = "";
  let seq: number | null = null;

  const assignMatch = text.match(/\[ASSIGNED:\s*([^\]]+)\]/i);
  if (assignMatch) {
    assigned = assignMatch[1].split(",").map(s => s.trim()).filter(Boolean);
    text = text.replace(assignMatch[0], " ");
  }
  const seqMatch = text.match(/\[SEQ:\s*(\d+)\]/i);
  if (seqMatch) {
    seq = Number(seqMatch[1]);
    text = text.replace(seqMatch[0], " ");
  }
  const dutyMatch = text.match(/\[DUTY:\s*([^\]]+)\]/i);
  if (dutyMatch) {
    dutyLabel = dutyMatch[1].trim();
    text = text.replace(dutyMatch[0], " ");
  }
  return {
    assigned,
    dutyLabel,
    seq: Number.isFinite(seq) ? seq : null,
    cleanNotes: text.replace(/^[ \t]+|[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim(),
  };
}

function doesAssignedTokenMatchUser(token: string, myName: string): boolean {
  const tok = String(token || "").trim().toLowerCase();
  const me = String(myName || "").trim().toLowerCase();
  if (!tok || !me) return false;
  if (tok === me) return true;
  const myWords = me.split(/\s+/).filter(Boolean);
  if (!tok.includes(" ")) {
    if (myWords.includes(tok)) return true;
    const initials = myWords.map(w => w[0]).join("");
    if (tok.length >= 2 && initials === tok) return true;
  }
  return false;
}

function parseScheduleStartMs(s: any): { startMs: number; timeLabel: string } | null {
  const dateStr = String(s?.scheduled_date || "").trim();
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;
  const parsedTime = parseScheduleTimeToken(s?.time_in || s?.scheduled_time || "");
  if (!parsedTime) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const startDate = new Date(year, month - 1, day, parsedTime.hours, parsedTime.minutes, 0, 0);
  if (isNaN(startDate.getTime())) return null;
  return { startMs: startDate.getTime(), timeLabel: parsedTime.timeLabel };
}

function shiftReminderStorageKey(): string {
  return "eesi-shift-reminded:" + (state.userId || "anon");
}

function getRemindedShiftMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(shiftReminderStorageKey()) || "{}") || {};
  } catch {
    return {};
  }
}

function saveRemindedShiftMap(map: Record<string, number>): void {
  const cutoff = Date.now() - 7 * 86400000;
  const pruned = Object.fromEntries(
    Object.entries(map).filter(([, ts]) => typeof ts === "number" && ts >= cutoff)
  );
  try {
    localStorage.setItem(shiftReminderStorageKey(), JSON.stringify(pruned));
  } catch {}
}

function sessionState(s: any): "" | "now" | "imminent" | "soon" {
  const parsed = parseScheduleStartMs(s);
  if (!parsed) return "";
  const startMs = parsed.startMs;
  let endMs = startMs + 3600000;
  if (s.scheduled_date && s.time_out) {
    const outTime = parseScheduleTimeToken(s.time_out);
    const dMatch = String(s.scheduled_date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (outTime && dMatch) {
      const endCandidate = new Date(
        Number(dMatch[1]),
        Number(dMatch[2]) - 1,
        Number(dMatch[3]),
        outTime.hours,
        outTime.minutes,
        0,
        0
      ).getTime();
      if (!isNaN(endCandidate) && endCandidate > startMs) endMs = endCandidate;
    }
  }
  const now = Date.now();
  if (now >= startMs && now <= endMs) return "now";
  if (startMs > now && startMs - now <= SHIFT_REMINDER_WINDOW_MS) return "imminent";
  const dayOk = s.scheduled_date === localDateKey(new Date()) || s.scheduled_date === localDateKey(new Date(now + 86400000));
  if (startMs > now && startMs - now <= 86400000 && dayOk) return "soon";
  return "";
}
function sessionBadge(s: any): string {
  const st = sessionState(s);
  if (st === "now") return '<span class="sess-badge now">● NOW</span>';
  if (st === "imminent") {
    const parsed = parseScheduleStartMs(s);
    const mins = parsed ? Math.max(1, Math.ceil((parsed.startMs - Date.now()) / 60000)) : 30;
    return '<span class="sess-badge soon">⏰ IN ' + mins + "M</span>";
  }
  if (st === "soon") return '<span class="sess-badge soon">⏳ UPCOMING</span>';
  return "";
}
export function isCurrentUserMentionedInSchedule(s: any): boolean {
  if (!s || !state.userId) return false;
  const tags = parseScheduleTags(s.notes);
  const myName = (state.profile?.full_name || "").trim().toLowerCase();
  if (myName && tags.assigned.some(n => doesAssignedTokenMatchUser(n, myName))) {
    return true;
  }
  const combined = [s.title || "", tags.cleanNotes, tags.assigned.join(" ")].filter(Boolean).join(" ");
  return isCurrentUserMentioned(combined);
}

export function visibleSchedules(): any[] {
  const list = isAdmin()
    ? [...state.schedules]
    : state.schedules.filter(isCurrentUserMentionedInSchedule);

  return list.sort((a, b) => {
    const da = String(a.scheduled_date || "9999-12-31");
    const db = String(b.scheduled_date || "9999-12-31");
    if (da !== db) return da.localeCompare(db);
    const sa = parseScheduleTags(a.notes).seq;
    const sb = parseScheduleTags(b.notes).seq;
    if (sa !== null && sb !== null && sa !== sb) return sa - sb;
    if (sa !== null && sb === null) return -1;
    if (sa === null && sb !== null) return 1;
    const ta = String(a.time_in || "99:99");
    const tb = String(b.time_in || "99:99");
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
}

export function checkUpcomingShiftReminders(): void {
  if (!state.userId || !state.schedules?.length) return;
  const list = (state.schedules || []).filter(isCurrentUserMentionedInSchedule);
  if (!list.length) return;

  const now = Date.now();
  const reminded = getRemindedShiftMap();
  let updated = false;

  for (const s of list) {
    const parsed = parseScheduleStartMs(s);
    if (!parsed) continue;
    const diffMs = parsed.startMs - now;
    if (diffMs <= 0 || diffMs > SHIFT_REMINDER_WINDOW_MS) continue;

    const dedupKey = `${s.id}:${s.scheduled_date}:${parsed.timeLabel}`;
    if (reminded[dedupKey]) continue;

    reminded[dedupKey] = now;
    updated = true;

    const minsLeft = Math.max(1, Math.ceil(diffMs / 60000));
    const title = `⏰ Shift Reminder (${minsLeft} min)`;
    const body = [
      s.title || "Scheduled Shift",
      `Starts ${parsed.timeLabel} (${fmtDay(s.scheduled_date)})`,
      s.region || "",
    ].filter(Boolean).join(" · ");

    triggerShiftAlert(title, body, String(s.id), [300, 120, 300, 120, 300]);
    toast(`⏰ ${s.title || "Shift"} starts in ${minsLeft} min (${parsed.timeLabel})`);
  }

  if (updated) saveRemindedShiftMap(reminded);
}

/* ==================== HOME & NOTICES ==================== */
export function getNoticeItems(): any[] {
  const items: any[] = [];
  state.announcements.forEach(a => items.push({
    key: "ann:" + a.id, date: a.created_at, icon: "📢",
    title: a.title || "Announcement", body: a.body || "",
    label: "Announcement", act: "go-announcements",
    isMention: isCurrentUserMentioned(`${a.title || ""} ${a.body || ""}`),
    isRead: isNoticeMarkedRead("ann:" + a.id),
  }));
  (state.schedules || []).filter(isCurrentUserMentionedInSchedule).forEach(s => {
    const tags = parseScheduleTags(s.notes);
    const timeRange = s.time_in && s.time_out
      ? `${formatScheduleTimeDisplay(s.time_in)}–${formatScheduleTimeDisplay(s.time_out)}`
      : (s.time_in ? formatScheduleTimeDisplay(s.time_in) : "");
    items.push({
      key: "sched:" + s.id, date: (s.scheduled_date || "1970-01-01") + "T" + (s.time_in || "00:00"), icon: "📅",
      title: s.title || "Schedule",
      body: [
        s.scheduled_date ? fmtDay(s.scheduled_date) : "",
        s.region,
        timeRange,
        tags.assigned.length ? "Assigned: " + tags.assigned.join(", ") : "",
        s.priority && s.priority !== "Normal" ? s.priority : "",
      ].filter(Boolean).join(" · "),
      label: "Schedule (Mentioned)", act: "go-schedule",
      isMention: true,
      isRead: isNoticeMarkedRead("sched:" + s.id),
    });
  });
  state.leaveRequests.forEach(r => {
    if (String(r.user_id) === String(state.userId) && (r.status === "approved" || r.status === "rejected")) {
      const key = "leave:" + r.id + ":" + r.status;
      items.push({
        key, date: r.reviewed_at || r.created_at, icon: r.status === "approved" ? "✅" : "❌",
        title: "Leave " + r.status + " (" + r.leave_type + ")",
        body: fmtDay(r.start_date) + " – " + fmtDay(r.end_date) + (r.review_note ? " · " + r.review_note : ""),
        label: "Leave", act: "go-leave",
        isRead: isNoticeMarkedRead(key),
      });
    } else if (isManager() && r.status === "pending" && String(r.user_id) !== String(state.userId)) {
      const key = "leave-req:" + r.id;
      items.push({
        key, date: r.created_at, icon: "🌴",
        title: "Leave request from " + profileName(r.user_id),
        body: r.leave_type + " · " + fmtDay(r.start_date) + " – " + fmtDay(r.end_date),
        label: "Leave", act: "go-leave",
        isRead: isNoticeMarkedRead(key),
      });
    }
  });
  state.recentChatNotices.forEach(m => {
    const t = state.threads.find(x => String(x.id) === String(m.thread_id));
    const key = "chat:" + m.id;
    const bodyText = m.attachment_type?.startsWith("image/") ? "📷 Sent a photo" : (m.attachment_name ? "📎 " + m.attachment_name : (m.body || ""));
    items.push({
      key, date: m.created_at, icon: "💬",
      title: (m.sender_name || (t ? threadTitle(t) : "Chat")) + (t && t.kind === "group" ? " (" + threadTitle(t) + ")" : ""),
      body: bodyText,
      label: "Chat", chatId: m.thread_id,
      isMention: isCurrentUserMentioned(m.body || ""),
      isRead: isNoticeMarkedRead(key),
    });
  });
  state.approvalNotifications.forEach(n => items.push({
    key: "appr:" + n.id, date: n.created_at, icon: "🔔", title: n.title, body: n.body,
    label: "Notification", approvalId: n.id,
    isMention: isCurrentUserMentioned(`${n.title || ""} ${n.body || ""}`),
    isRead: !!n.is_read || isNoticeMarkedRead("appr:" + n.id),
  }));
  state.appNotifications.forEach(n => {
    if (isHiddenSystemNotice(n)) return;
    const isDtrNotice = !n.report_id && /Time In|Time Out/i.test(String(n.title || ""));
    const isOut = /Time Out|🔴/i.test(String(n.title || ""));
    items.push({
      key: "app:" + n.id,
      date: n.created_at,
      icon: isDtrNotice ? (isOut ? "🔴" : "🟢") : "📄",
      title: n.title,
      body: stripTimeLogMeta(n.body),
      label: isDtrNotice ? "DTR Time Log" : "Report",
      appId: n.id,
      reportId: n.report_id,
      isDtrNotice,
      isRead: !!n.is_read || isNoticeMarkedRead("app:" + n.id),
    });
  });
  const appReportIds = new Set(state.appNotifications.map(n => String(n.report_id)));
  timelineReports().forEach(r => {
    if (appReportIds.has(String(r.id))) return;
    const site = state.sites.find(s => String(s.id) === String(r.site_id));
    const typeLbl = r.report_type === "delivery" ? "Delivery Report" : "Service Report";
    const parsedUnit = parseReportUnit(r.details);
    const bodyText = stripReportPhotos(r.details);
    const key = "rep:" + r.id;
    items.push({
      key, date: r.created_at || (r.report_date + "T00:00:00"),
      icon: r.report_type === "delivery" ? "📦" : "📄",
      title: typeLbl + ": " + (r.title || ""),
      body: [profileName(r.created_by), site ? site.name : "", parsedUnit.unitName, bodyText.slice(0, 120)].filter(Boolean).join(" · "),
      label: typeLbl, reportNoticeId: r.id, reportId: r.id,
      isRead: String(r.created_by) === String(state.userId) || isNoticeMarkedRead(key),
    });
  });
  if (isManager()) {
    state.pending.forEach(p => items.push({
      key: "pend:" + p.id, date: p.created_at, icon: "⏳",
      title: "Pending: " + p.full_name, body: p.email || "",
      label: "Registration", act: "go-pending",
      isRead: isNoticeMarkedRead("pend:" + p.id),
    }));
  }
  const activeItems = items.filter(it => {
    if (isNoticeDeleted(it.key)) return false;
    if (it.reportId && isNoticeDeleted("rep:" + it.reportId)) return false;
    return true;
  });
  activeItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return activeItems;
}

let tickerAnimListenerAttached = false;
function buildTickerQueue(): string[] {
  const statements: string[] = [];
  (state.announcements || []).forEach(a => {
    const line = `📢 ${a.title || "Announcement"}${a.body ? " — " + a.body : ""}`.replace(/\s+/g, " ").trim();
    if (line) statements.push(line);
  });
  timelineReports().slice(0, 15).forEach(r => {
    const site = state.sites.find(s => String(s.id) === String(r.site_id));
    const icon = r.report_type === "delivery" ? "📦 Delivery Report" : "📄 Service Report";
    const line = `${icon}: ${r.title || "Report"}${site ? " (" + site.name + ")" : ""}`.replace(/\s+/g, " ").trim();
    if (line) statements.push(line);
  });
  (state.recs || []).slice(0, 15).forEach(r => {
    const meta = parseRecMeta(r.reason);
    const line = `📌 Recommendation: ${[r.site, r.part, r.condition ? "(" + r.condition + ")" : ""].filter(Boolean).join(" ")}${meta.cleanReason ? " — " + meta.cleanReason.slice(0, 110) : ""}`.replace(/\s+/g, " ").trim();
    if (line) statements.push(line);
  });
  if (!statements.length) {
    SYSTEM_ANNOUNCEMENTS.forEach(a => {
      statements.push(`📢 ${a.title} — ${a.body}`);
    });
  }
  return statements;
}

export function updateAnnouncementTicker(): void {
  const text = $("tickerText");
  if (!text) return;
  const queue = buildTickerQueue();
  if (!queue.length) return;
  const queueKey = queue.join("||");
  if (runtime.tickerQueueKey !== queueKey) {
    runtime.tickerQueueKey = queueKey;
    runtime.tickerIndex = 0;
  } else if (runtime.tickerIndex >= queue.length) {
    runtime.tickerIndex = 0;
  }

  const runCurrent = () => {
    const latestQueue = buildTickerQueue();
    if (!latestQueue.length) return;
    if (runtime.tickerIndex >= latestQueue.length) runtime.tickerIndex = 0;
    const stmt = latestQueue[runtime.tickerIndex];
    const secs = Math.max(28, Math.min(72, Math.round(stmt.length * 0.34) + 14));
    text.style.animation = "none";
    text.textContent = stmt;
    void text.offsetWidth;
    text.style.animation = `marqueeSingle ${secs}s linear 1`;
  };

  if (!tickerAnimListenerAttached) {
    tickerAnimListenerAttached = true;
    text.addEventListener("animationend", () => {
      const latestQueue = buildTickerQueue();
      if (!latestQueue.length) return;
      runtime.tickerIndex = (runtime.tickerIndex + 1) % latestQueue.length;
      runCurrent();
    });
  }

  if (!text.textContent || text.style.animation === "none" || !text.style.animation) {
    runCurrent();
  }
}

export function openQuickTimeAction(mode: "time_in" | "time_out"): void {
  setTimeLogMode(mode);
  go("dtr");
  dtrTab("time_log");
}

function getLiveDtrTodaySummary(): {
  todayStr: string;
  nowMins: number;
  activeEntry: any | null;
  latestClosed: any | null;
  closedMins: number;
  liveMins: number;
  totalMins: number;
  hasNightshiftRepair: boolean;
  activeNightshiftRepair: boolean;
} {
  const now = new Date();
  const todayStr = localDateKey(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const myToday = (state.dtrs || []).filter(
    d => String(d.user_id) === String(state.userId) && String(d.work_date) === String(todayStr)
  );
  const activeEntry = myToday.find(d => d.time_in && (!d.time_out || d.time_out === d.time_in)) || null;
  const closedRows = myToday.filter(d => d.time_in && d.time_out && d.time_out !== d.time_in);
  const latestClosed = closedRows.length ? closedRows[closedRows.length - 1] : null;
  const closedMins = closedRows.reduce(
    (sum, d) => {
      const m = parseDtrJobMeta(d.job, d.approved_by);
      return sum + calculateDtrMinutes(d.time_in, d.time_out, null, { workDate: todayStr, nightshiftRepair: m.nightshiftRepair });
    },
    0
  );
  const activeMeta = activeEntry ? parseDtrJobMeta(activeEntry.job, activeEntry.approved_by) : null;
  const activeNightshiftRepair = Boolean(activeMeta?.nightshiftRepair);
  const hasNightshiftRepair = myToday.some(d => parseDtrJobMeta(d.job, d.approved_by).nightshiftRepair);
  const liveMins = activeEntry
    ? calculateDtrMinutes(activeEntry.time_in, null, nowMins, { workDate: todayStr, nightshiftRepair: activeNightshiftRepair })
    : 0;
  return {
    todayStr,
    nowMins,
    activeEntry,
    latestClosed,
    closedMins,
    liveMins,
    totalMins: closedMins + liveMins,
    hasNightshiftRepair,
    activeNightshiftRepair,
  };
}

export function renderDtrLiveStatus(): void {
  const summary = getLiveDtrTodaySummary();
  const formHint = $("dtrFormDurationHint");
  if (formHint) {
    const inVal = val("dtrIn").trim();
    const outVal = val("dtrOut").trim();
    const dateVal = val("dtrDate").trim() || summary.todayStr;
    const isFormNsRepair = Boolean(($("dtrNightshiftOrRepair") as HTMLInputElement | null)?.checked);
    const formRuleOpts = { workDate: dateVal, nightshiftRepair: isFormNsRepair };
    const dayTag = isSundayDate(dateVal) ? "Sun 10AM–7PM" : "Mon–Sat";
    const nsTag = isFormNsRepair ? " · 🌙 Nightshift/Repair" : "";
    if (inVal && outVal) {
      const cappedOutVal = capDtrTimeOut(inVal, outVal, formRuleOpts);
      const outLbl = fmtTime12h(cappedOutVal) || cappedOutVal;
      const wasCapped = cappedOutVal !== outVal && !!outVal;
      const bd = calculateShiftBreakdown(inVal, cappedOutVal, null, formRuleOpts);
      const capNote = wasCapped ? " (7:00 PM max without Nightshift/Repair)" : "";
      const sundayNoOtNote = bd.isSunday && !bd.nightshiftRepair && bd.workedMins > bd.regularMins && bd.finalOtMins === 0
        ? " (Sunday O.T. needs <10:00 AM start or Operations Fix/Install/Repair)"
        : "";
      if (bd.lackingMins > 0 && bd.grossOtMins > 0 && bd.finalOtMins >= 0 && (!bd.isSunday || bd.nightshiftRepair || bd.finalOtMins > 0)) {
        formHint.innerHTML =
          `⏱ [${esc(dayTag)}${nsTag}] Worked: <b>${esc(formatDtrDuration(bd.workedMins))}</b> (${(bd.workedMins / 60).toFixed(2)} hrs)` +
          ` · Std 9h (${esc(bd.shiftStartLabel)}–${esc(bd.shiftEndLabel)}): <b>${esc(formatDtrDuration(bd.inShiftWorkedMins))}</b>` +
          ` <span class="muted">(Lacking ${esc(formatDtrDuration(bd.lackingMins))})</span>` +
          ` · O.T.: <b>${esc(formatDtrDuration(bd.grossOtMins))}</b> − <b>${esc(formatDtrDuration(bd.lackingMins))}</b> = Final O.T.: <b>${esc(formatDtrDuration(bd.finalOtMins))}</b>` +
          ` · Time Out: <b>${esc(outLbl)}</b>${capNote}`;
      } else if (bd.lackingMins > 0) {
        formHint.innerHTML =
          `⏱ [${esc(dayTag)}${nsTag}] Worked: <b>${esc(formatDtrDuration(bd.workedMins))}</b> (${(bd.workedMins / 60).toFixed(2)} hrs)` +
          ` · Std 9h (${esc(bd.shiftStartLabel)}–${esc(bd.shiftEndLabel)}): Lacking <b>${esc(formatDtrDuration(bd.lackingMins))}</b>` +
          ` · Final O.T.: <b>${esc(formatDtrDuration(bd.finalOtMins))}</b>${sundayNoOtNote} · Time Out: <b>${esc(outLbl)}</b>${capNote}`;
      } else {
        formHint.innerHTML =
          `⏱ [${esc(dayTag)}${nsTag}] Worked: <b>${esc(formatDtrDuration(bd.workedMins))}</b> (${(bd.workedMins / 60).toFixed(2)} hrs)` +
          ` · Reg: <b>${esc(formatDtrDuration(bd.regularMins))}</b> · Final O.T.: <b>${esc(formatDtrDuration(bd.finalOtMins))}</b>${sundayNoOtNote}` +
          ` · Time Out: <b>${esc(outLbl)}</b>${capNote}`;
      }
    } else if (inVal && dateVal === summary.todayStr) {
      const liveMins = calculateDtrMinutes(inVal, null, summary.nowMins, formRuleOpts);
      const bd = calculateShiftBreakdown(inVal, null, liveMins, formRuleOpts);
      const cappedAt7Pm = !isFormNsRepair && summary.nowMins >= 19 * 60 && liveMins > 0;
      formHint.innerHTML =
        `🟢 [${esc(dayTag)}${nsTag}] Counting from <b>${esc(fmtTime12h(inVal) || inVal)}</b>: <b>${esc(formatDtrDuration(liveMins))}</b>` +
        ` (${(liveMins / 60).toFixed(2)} hrs) · Reg: ${esc(formatDtrDuration(bd.regularMins))} / 9h 00m, Final O.T.: ${esc(formatDtrDuration(bd.finalOtMins))}` +
        (cappedAt7Pm ? " · <b>Stopped at 7:00 PM Time Out</b>" : "");
    } else {
      formHint.textContent = isSundayDate(dateVal)
        ? `📅 Sunday rule: Regular 10:00 AM–7:00 PM (9h). O.T. applies if starting before 10:00 AM or past 7:00 PM with Operations Fix/Install/Repair.`
        : `📅 Mon–Sat rule: Regular 8:00 AM–5:00 PM (9h). O.T. 5:01–7:00 PM (7:01 PM+ requires Nightshift/Operations Repair).`;
    }
  }

  let statusHtml = "";
  if (summary.activeEntry) {
    const inLbl = fmtTime12h(summary.activeEntry.time_in) || summary.activeEntry.time_in;
    const activeOpts = { workDate: summary.todayStr, nightshiftRepair: summary.hasNightshiftRepair };
    const bd = calculateShiftBreakdown(summary.activeEntry.time_in, null, summary.totalMins, activeOpts);
    const cappedAt7Pm = !summary.activeNightshiftRepair && summary.nowMins >= 19 * 60 && summary.liveMins > 0;
    statusHtml =
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">` +
      `<div><span class="sess-badge now" style="margin-left:0;margin-right:6px;">${cappedAt7Pm ? "🔴 Stopped 7:00 PM" : "● Live Counting"}</span>` +
      `<b>${esc(formatDtrDuration(summary.liveMins))}</b> <span class="muted">(${(summary.liveMins / 60).toFixed(2)} hrs) since <b>${esc(inLbl)}</b>${summary.activeNightshiftRepair ? " · 🌙 Nightshift/Repair" : ""}</span></div>` +
      `<div class="muted" style="font-size:12px;">Today: <b>${esc(formatDtrDuration(summary.totalMins))}</b> · Reg ${esc(formatDtrDuration(bd.regularMins))} / 9h · O.T. ${esc(formatDtrDuration(bd.finalOtMins))}</div>` +
      `</div>`;
  } else if (summary.latestClosed) {
    const inLbl = fmtTime12h(summary.latestClosed.time_in) || summary.latestClosed.time_in;
    const closedMeta = parseDtrJobMeta(summary.latestClosed.job, summary.latestClosed.approved_by);
    const cappedClosedOut = capDtrTimeOut(summary.latestClosed.time_in, summary.latestClosed.time_out, {
      workDate: summary.todayStr,
      nightshiftRepair: closedMeta.nightshiftRepair,
    });
    const outLbl = fmtTime12h(cappedClosedOut) || cappedClosedOut;
    const bd = calculateShiftBreakdown(summary.latestClosed.time_in, cappedClosedOut, summary.totalMins, {
      workDate: summary.todayStr,
      nightshiftRepair: summary.hasNightshiftRepair,
    });
    const breakdownPart = bd.lackingMins > 0 && bd.grossOtMins > 0 && (!bd.isSunday || bd.nightshiftRepair || bd.finalOtMins > 0)
      ? ` · OT ${esc(formatDtrDuration(bd.grossOtMins))} − ${esc(formatDtrDuration(bd.lackingMins))} lacking = Final O.T. <b>${esc(formatDtrDuration(bd.finalOtMins))}</b>`
      : bd.lackingMins > 0
        ? ` · Lacking ${esc(formatDtrDuration(bd.lackingMins))} · Final O.T. <b>${esc(formatDtrDuration(bd.finalOtMins))}</b>`
        : ` · Reg ${esc(formatDtrDuration(bd.regularMins))} · Final O.T. <b>${esc(formatDtrDuration(bd.finalOtMins))}</b>`;
    statusHtml =
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">` +
      `<div><span class="badge" style="margin-left:0;margin-right:6px;">🔴 Time Out Locked</span>` +
      `<b>${esc(inLbl)} – ${esc(outLbl)}</b> <span class="muted">(Stopped at ${esc(outLbl)}${summary.hasNightshiftRepair ? " · 🌙 NS/Repair" : ""})</span></div>` +
      `<div class="muted" style="font-size:12px;">Total: <b>${esc(formatDtrDuration(summary.totalMins))}</b> (${(summary.totalMins / 60).toFixed(2)}h)${breakdownPart}</div>` +
      `</div>`;
  }

  ["dtrLiveStatusCard", "timeLogLiveCard"].forEach(id => {
    const el = $(id);
    if (!el) return;
    if (!statusHtml) {
      el.classList.add("hidden");
      el.innerHTML = "";
    } else {
      el.classList.remove("hidden");
      el.innerHTML = statusHtml;
    }
  });
}

export function renderHomeDtrStatus(): void {
  const card = $("homeDtrStatusCard");
  if (!card) return;
  if (!state.userId) {
    card.classList.add("hidden");
    return;
  }
  const summary = getLiveDtrTodaySummary();
  const activeEntry = summary.activeEntry;
  const latestClosed = summary.latestClosed;
  const totalMins = summary.totalMins;
  const totalHours = totalMins / 60;
  const hasAnyToday = Boolean(activeEntry || latestClosed);
  const statusBadge = activeEntry
    ? '<span class="sess-badge now" style="margin-left:0;">● Clocked In</span>'
    : (hasAnyToday
      ? '<span class="badge">🔴 Timed Out</span>'
      : '<span class="badge">⚪ Not Clocked In</span>');
  const closedMeta = latestClosed ? parseDtrJobMeta(latestClosed.job, latestClosed.approved_by) : null;
  const homeClosedOut = latestClosed
    ? capDtrTimeOut(latestClosed.time_in, latestClosed.time_out, {
        workDate: summary.todayStr,
        nightshiftRepair: Boolean(closedMeta?.nightshiftRepair),
      })
    : "";
  const homeCapped7Pm = Boolean(activeEntry && !summary.activeNightshiftRepair && summary.nowMins >= 19 * 60 && summary.liveMins > 0);
  const detailText = activeEntry
    ? `Live: <b>${esc(formatDtrDuration(totalMins))}</b> (${totalHours.toFixed(2)} hrs) · Since <b>${esc(fmtTime12h(activeEntry.time_in) || activeEntry.time_in)}</b>` +
      (homeCapped7Pm ? " · <b>Stopped at 7:00 PM</b>" : (summary.activeNightshiftRepair ? " · 🌙 Nightshift/Repair" : "")) +
      (activeEntry.location ? ` · 📍 ${esc(activeEntry.location)}` : "")
    : (latestClosed
      ? `Total today: <b>${esc(formatDtrDuration(totalMins))}</b> (${totalHours.toFixed(2)} hrs) · Stopped at <b>${esc(fmtTime12h(homeClosedOut) || homeClosedOut)}</b>`
      : `Total today: <b>0 mins</b> · Tap Time In to start`);
  const actionBtn = activeEntry
    ? '<button class="red small-btn" type="button" onclick="openQuickTimeAction(\'time_out\')">🔴 Time Out</button>'
    : '<button class="green small-btn" type="button" onclick="openQuickTimeAction(\'time_in\')">🟢 Time In</button>';

  card.classList.remove("hidden");
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">' +
    '<div style="min-width:0;">' +
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;"><b>⏱️ DTR Status</b>' + statusBadge + "</div>" +
    '<div class="muted" style="font-size:12px;">' + detailText + "</div>" +
    "</div>" +
    '<div style="flex:0 0 auto;">' + actionBtn + "</div>" +
    "</div>";
}

function isScheduleWithinTimelineDuration(s: any, nowMs: number, todayStr: string): boolean {
  const dateStr = String(s?.scheduled_date || "").trim();
  if (!dateStr) return false;
  if (dateStr === todayStr) return true;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const dayStartMs = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime();
  const oneDayMs = 86400000;
  if (Number.isFinite(dayStartMs) && nowMs >= dayStartMs && nowMs < dayStartMs + oneDayMs) {
    return true;
  }
  const parsed = parseScheduleStartMs(s);
  if (parsed && parsed.startMs >= nowMs && parsed.startMs - nowMs <= oneDayMs) {
    return true;
  }
  return false;
}

let lastGeofenceAlertKey = "";
let lastGeofenceAlertAt = 0;

export async function evaluateDailySiteGeofence(): Promise<void> {
  const alertEl = $("homeGeofenceAlert");
  if (!alertEl) return;
  if (!state.userId) {
    alertEl.classList.add("hidden");
    alertEl.innerHTML = "";
    return;
  }
  const todayStr = todayIso();
  const sched = findScheduledWorkForUser(todayStr);
  const userCoords = getCachedUserGpsCoords();
  if (!sched || !sched.siteName || !userCoords) {
    alertEl.classList.add("hidden");
    alertEl.innerHTML = "";
    return;
  }
  const siteCoords = await resolveSiteCoordinatesByName(sched.siteName);
  if (!siteCoords) {
    alertEl.classList.add("hidden");
    alertEl.innerHTML = "";
    return;
  }
  const rawMeters = haversineMeters(userCoords.lat, userCoords.lng, siteCoords.lat, siteCoords.lng);
  const accMargin = Math.min(Math.max(0, userCoords.acc || 0), 200);
  const effectiveMeters = Math.max(0, rawMeters - accMargin);
  const distLabel = formatProximityDist(rawMeters);
  const matchedSite = state.sites.find(s => String(s.name || "").trim().toLowerCase() === siteCoords.name.toLowerCase());
  const viewBtn = matchedSite
    ? `<button class="gray small-btn" type="button" onclick="openSiteOnMap('${esc(matchedSite.id)}')">📍 View Site Map</button>`
    : `<button class="gray small-btn" type="button" onclick="go('sites')">📍 Sites</button>`;

  if (effectiveMeters > TIMEMARK_FAR_SITE_THRESHOLD_METERS) {
    alertEl.classList.remove("hidden");
    alertEl.style.borderColor = "rgba(239,68,68,.55)";
    alertEl.style.background = "linear-gradient(180deg,rgba(127,29,29,.32),rgba(9,21,44,.95))";
    alertEl.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">` +
      `<div style="min-width:0;flex:1;">` +
      `<div style="font-weight:800;color:#fca5a5;">⚠️ GPS Far From Today's Assigned Site</div>` +
      `<div style="font-size:12.5px;margin-top:3px;">You are currently <b>~${esc(distLabel)}</b> away from <b>${esc(siteCoords.name)}</b> (outside ${TIMEMARK_FAR_SITE_THRESHOLD_METERS} m work-site radius).</div>` +
      `</div>` +
      `<div style="flex:0 0 auto;">${viewBtn}</div>` +
      `</div>`;

    const key = `${todayStr}:${siteCoords.name}`;
    if (key !== lastGeofenceAlertKey || Date.now() - lastGeofenceAlertAt > 15 * 60 * 1000) {
      lastGeofenceAlertKey = key;
      lastGeofenceAlertAt = Date.now();
      triggerAlert(
        "⚠️ Far From Assigned Site",
        `You are ~${distLabel} away from ${siteCoords.name}.`,
        [300, 120, 300]
      );
    }
  } else {
    alertEl.classList.remove("hidden");
    alertEl.style.borderColor = "rgba(34,197,94,.42)";
    alertEl.style.background = "";
    alertEl.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">` +
      `<div style="font-size:12.5px;">✅ <b>On-Site GPS Verified:</b> ${esc(siteCoords.name)} <span class="muted">(~${esc(distLabel)} from pin)</span></div>` +
      `<div>${viewBtn}</div>` +
      `</div>`;
  }
}

export function renderHomeShareFeed(): void {
  const box = $("homeShareFeed");
  if (!box) return;
  const logs = [...(state.dtrTimeLogs || [])]
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 8);
  if (!logs.length) {
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">' +
      '<span class="muted">No Time In / Out uploads yet. Upload a photo so the team sees who timed in or out.</span>' +
      '<div class="inline-actions" style="margin-top:0;">' +
      '<button class="green small-btn" type="button" onclick="openQuickTimeAction(\'time_in\')">🟢 Time In</button>' +
      '<button class="red small-btn" type="button" onclick="openQuickTimeAction(\'time_out\')">🔴 Time Out</button>' +
      "</div></div>";
    return;
  }
  box.innerHTML = logs.map((l: any) => {
    const isOut = l.mode === "time_out";
    const modeBadge = isOut ? '<span class="badge" style="border-color:rgba(239,68,68,.5);color:#fca5a5;">🔴 Time Out</span>' : '<span class="sess-badge now" style="margin-left:0;">🟢 Time In</span>';
    const who = l.sender_name || profileName(l.user_id);
    const safeImg = safeUrl(l.image_url);
    const timeTxt = l.time_12 || l.time_24 || "";
    const metaStr = [
      timeTxt ? "⏰ " + timeTxt : "",
      l.work_date ? fmtDay(l.work_date) : "",
      l.location ? "📍 " + l.location : "",
      l.unit ? "🛗 " + l.unit : "",
    ].filter(Boolean).join(" · ");
    return (
      '<div class="item" style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">' +
      avatarHtml(l.user_id, who) +
      '<div style="flex:1;min-width:0;">' +
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
      "<b>" + esc(who) + "</b> " + modeBadge +
      "</div>" +
      '<div class="muted" style="font-size:12px;margin-top:2px;">' + esc(metaStr || fmtDate(l.created_at)) + "</div>" +
      (l.note ? '<div style="font-size:12.5px;margin-top:2px;">' + esc(l.note) + "</div>" : "") +
      "</div>" +
      (safeImg
        ? '<img src="' + esc(safeImg) + '" alt="Time photo" data-preview-url="' + esc(safeImg) + '" data-preview-label="' + esc(who + " — " + (isOut ? "Time Out" : "Time In")) + '" style="width:52px;height:52px;border-radius:10px;object-fit:cover;flex:0 0 52px;cursor:pointer;border:1px solid rgba(47,140,255,.35);">'
        : "") +
      "</div>"
    );
  }).join("");
}

export function openHolidayCalendarSheet(filter: "all" | "National" | "Christian" | "Regional" = "all"): void {
  const now = new Date();
  const year = now.getFullYear();
  const todayStr = localDateKey(now);
  const all = [...phHolidays(year), ...phHolidays(year + 1)].filter(h => h.date >= `${year}-01-01`);
  const filtered = filter === "all" ? all : all.filter(h => h.category === filter);
  const tabs: Array<{ id: "all" | "National" | "Christian" | "Regional"; label: string }> = [
    { id: "all", label: "All (" + all.length + ")" },
    { id: "National", label: "🇵🇭 National" },
    { id: "Christian", label: "✝️ Christian" },
    { id: "Regional", label: "🏝️ Regional" },
  ];
  const tabsHtml =
    `<div class="tabs" style="margin-bottom:10px;">` +
    tabs.map(t => `<button type="button" class="tab${filter === t.id ? " active" : ""}" onclick="openHolidayCalendarSheet('${t.id}')">${esc(t.label)}</button>`).join("") +
    `</div>`;
  const rowsHtml = filtered.map((h: PhHolidayItem) => {
    const isToday = h.date === todayStr;
    const isPast = h.date < todayStr;
    const catIcon = h.category === "Christian" ? "✝️" : (h.category === "Regional" ? "🏝️" : "🇵🇭");
    return (
      `<div class="item" style="margin-bottom:8px;opacity:${isPast ? "0.62" : "1"};">` +
      `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">` +
      `<div><b>${catIcon} ${esc(h.name)}</b>` +
      (isToday ? ` <span class="sess-badge now">TODAY</span>` : "") +
      `<div class="muted" style="font-size:12px;">${esc(fmtDay(h.date))} · ${esc(h.kind)}${h.region ? " · " + esc(h.region) : ""}</div></div>` +
      `<span class="badge">${esc(h.category)}</span>` +
      `</div></div>`
    );
  }).join("") || '<p class="muted">No holidays in this category.</p>';

  openSheet(
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">` +
    `<h2 style="margin:0;">📅 Philippine National, Christian &amp; Regional Holidays</h2>` +
    `<button class="gray small-btn" type="button" onclick="closeSheet()">✕ Close</button>` +
    `</div>` +
    tabsHtml +
    `<div style="max-height:60dvh;overflow-y:auto;">${rowsHtml}</div>`
  );
}

export function renderHomeTodayShift(): void {
  const card = $("homeTodayShiftCard");
  if (!card) return;
  const todayStr = localDateKey(new Date());
  const myToday = (state.schedules || [])
    .filter(s => String(s.scheduled_date || "") === todayStr && isCurrentUserMentionedInSchedule(s))
    .sort((a, b) => String(a.time_in || "99:99").localeCompare(String(b.time_in || "99:99")));
  if (!myToday.length) {
    card.classList.add("hidden");
    card.innerHTML = "";
    return;
  }
  const rowsHtml = myToday.map(s => {
    const tags = parseScheduleTags(s.notes);
    const timeStr = s.time_in && s.time_out
      ? `${formatScheduleTimeDisplay(s.time_in)} – ${formatScheduleTimeDisplay(s.time_out)}`
      : (s.time_in ? formatScheduleTimeDisplay(s.time_in) : "Time TBA");
    const stBadge = sessionBadge(s);
    return (
      '<div style="padding:8px 10px;border-radius:10px;background:rgba(30,108,242,.08);border:1px solid rgba(56,189,248,.22);margin-top:6px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">' +
      '<b>' + esc(s.title || "Scheduled Duty") + '</b>' +
      '<span>' + stBadge + ' <span class="badge">' + esc(timeStr) + '</span></span>' +
      '</div>' +
      '<div class="muted" style="margin-top:2px;">' +
      [s.region, tags.assigned.length ? "Team: " + tags.assigned.join(", ") : ""].filter(Boolean).map(esc).join(" · ") +
      '</div>' +
      '</div>'
    );
  }).join("");

  const nextHtml =
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
    '<b>📅 Your Shift Today (' + esc(fmtDay(todayStr)) + ')</b>' +
    '<div class="inline-actions" style="margin:0;">' +
    '<button class="btn small-btn" type="button" onclick="autoFillDtrFromSchedule(true);go(\'dtr\')">⏰ Fill DTR</button>' +
    '<button class="gray small-btn" type="button" onclick="go(\'schedule\')">View Schedule</button>' +
    '</div></div>' +
    rowsHtml;
  card.classList.remove("hidden");
  if (card.innerHTML !== nextHtml) card.innerHTML = nextHtml;
}

export function renderHome(): void {
  if (!state.userId) return;
  const online = onlineIds().size;
  const myDtr = state.dtrs.filter(d => String(d.user_id) === String(state.userId)).length;
  const unreadNoticeCount = getNoticeItems().filter(item => !item.isRead).length;
  const setTxt = (id: string, v: string | number) => { const e = $(id); if (e) e.textContent = String(v); };
  setTxt("memberCount", state.profiles.length);
  setTxt("onlineCount", online);
  setTxt("pendingCount", state.pending.length);
  setTxt("siteCount", state.sites.length);
  setTxt("dtrCount", isManager() ? state.dtrs.length : myDtr);
  setTxt("noticeCount", unreadNoticeCount);
  setTxt("bell", unreadNoticeCount ? String(unreadNoticeCount) : "");
  setTxt("welcome", state.profile?.full_name || state.email || "");
  setTxt("roleLabel", roleLabel(state.role));
  updateAnnouncementTicker();
  renderHomeDtrStatus();
  renderHomeTodayShift();
  renderHomeShareFeed();
  void evaluateDailySiteGeofence();

  const box = $("homeTimeline");
  if (!box) return;
  const now = new Date();
  const nowMs = now.getTime();
  const year = now.getFullYear();
  const todayStr = localDateKey(now);
  const upcomingHolidays = [...phHolidays(year), ...phHolidays(year + 1)].filter(h => h.date >= todayStr).slice(0, 6);

  const recentItems = [
    ...state.announcements.map(a => ({
      date: a.created_at,
      icon: "📢",
      title: a.title || "Announcement",
      detail: a.body || "",
      label: "Announcement",
      attr: 'data-act="go-announcements"',
    })),
    ...visibleSchedules()
      .filter(s => isScheduleWithinTimelineDuration(s, nowMs, todayStr))
      .map(s => ({
        date: s.scheduled_date + "T" + (s.time_in || "00:00"),
        icon: "📅",
        title: s.title || "Schedule",
        detail: [s.region, s.time_in && s.time_out ? `${formatScheduleTimeDisplay(s.time_in)}–${formatScheduleTimeDisplay(s.time_out)}` : (s.time_in ? formatScheduleTimeDisplay(s.time_in) : "")].filter(Boolean).join(" · "),
        label: "Schedule (1-day)",
        attr: 'data-act="go-schedule"',
      })),
    ...timelineReports().map(r => {
      const site = state.sites.find(s => String(s.id) === String(r.site_id));
      const typeLbl = r.report_type === "delivery" ? "Delivery Report" : "Service Report";
      const parsedUnit = parseReportUnit(r.details);
      const bodyText = stripReportPhotos(r.details);
      return {
        date: r.created_at || (r.report_date + "T00:00:00"),
        icon: r.report_type === "delivery" ? "📦" : "📄",
        title: r.title || typeLbl,
        detail: [profileName(r.created_by), site ? site.name : "", parsedUnit.unitName, bodyText.slice(0, 140)].filter(Boolean).join(" · "),
        label: typeLbl,
        attr: 'data-report-notice="' + esc(r.id) + '"',
      };
    }),
  ].filter(item => item.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

  const upcomingHtml = upcomingHolidays.map(h => {
    const diffDays = Math.round((new Date(h.date + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000);
    const badge = diffDays === 0 ? '<span class="sess-badge now">TODAY</span>' : '<span class="sess-badge soon">In ' + diffDays + " day(s)</span>";
    const catIcon = h.category === "Christian" ? "✝️" : (h.category === "Regional" ? "🏝️" : "🇵🇭");
    const catMeta = [h.category, h.region].filter(Boolean).join(" · ");
    return '<div class="pv-row"><span>' + catIcon + " <b>" + esc(fmtDay(h.date)) + "</b> — " + esc(h.name) + " " + badge + '</span><span class="muted">' + esc(h.kind + " · " + catMeta) + "</span></div>";
  }).join("") || '<p class="muted">No upcoming holidays.</p>';

  const recentHtml = recentItems.map(item =>
    '<div class="item clickable" ' + item.attr + '><b>' + item.icon + " " + esc(item.title) + '</b><div class="muted">' + esc(item.label) + " · " + esc(fmtDate(item.date)) + "</div><div>" + esc(item.detail) + "</div></div>"
  ).join("") || '<p class="muted">No recent timeline items yet.</p>';

  const nextHtml =
    '<div style="margin-bottom:14px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
    '<h3 style="margin:0;">🇵🇭 Upcoming Holidays (National, Christian &amp; Regional)</h3>' +
    '<button class="gray small-btn" type="button" onclick="openHolidayCalendarSheet(\'all\')">📅 Full Calendar</button>' +
    "</div>" +
    '<div class="item sess-soon">' + upcomingHtml + "</div></div>" +
    '<div><h3 style="margin:0 0 8px;">🕒 Recent Timeline</h3>' + recentHtml + "</div>";
  if (box.innerHTML !== nextHtml) box.innerHTML = nextHtml;
}

export async function deleteSingleNotice(opts: {
  key: string;
  appId?: string;
  approvalId?: string;
  reportId?: string;
}): Promise<void> {
  if (!state.userId || !opts.key) return;
  const keysToDismiss = [opts.key];
  if (opts.reportId) keysToDismiss.push("rep:" + opts.reportId);

  if (opts.appId) {
    state.appNotifications = (state.appNotifications || []).filter(n => String(n.id) !== String(opts.appId));
    if (navigator.onLine) {
      const { error } = await runtime.client.from("app_notifications").delete().eq("id", opts.appId);
      if (error) console.warn("Could not delete app_notification:", error.message);
    }
  }
  if (opts.approvalId) {
    state.approvalNotifications = (state.approvalNotifications || []).filter(n => String(n.id) !== String(opts.approvalId));
    if (navigator.onLine) {
      const { error } = await runtime.client.from("approval_notifications").delete().eq("id", opts.approvalId);
      if (error) console.warn("Could not delete approval_notification:", error.message);
    }
  }
  await markNoticeDeleted(keysToDismiss);
  renderNotices();
  renderHome();
  toast("Notification deleted");
}

export async function markAllNoticesRead(): Promise<void> {
  const items = getNoticeItems();
  const unread = items.filter(i => !i.isRead);
  if (!unread.length) {
    toast("All notifications are already read");
    return;
  }
  const appIds = unread.map(i => i.appId).filter(Boolean).map(String);
  const apprIds = unread.map(i => i.approvalId).filter(Boolean).map(String);

  state.appNotifications = (state.appNotifications || []).map(n =>
    appIds.includes(String(n.id)) ? { ...n, is_read: true } : n
  );
  state.approvalNotifications = (state.approvalNotifications || []).map(n =>
    apprIds.includes(String(n.id)) ? { ...n, is_read: true } : n
  );

  if (navigator.onLine) {
    if (appIds.length) {
      await runtime.client.from("app_notifications").update({ is_read: true }).in("id", appIds);
    }
    if (apprIds.length) {
      await runtime.client.from("approval_notifications").update({ is_read: true }).in("id", apprIds);
    }
  }
  await markNoticesReadBulk(items.map(i => String(i.key)));
  renderNotices();
  renderHome();
  toast("All notifications marked as read");
}

export async function deleteAllNotices(): Promise<void> {
  const items = getNoticeItems();
  if (!items.length) {
    toast("No notifications to delete");
    return;
  }
  if (!(await confirmDialog(`Delete all ${items.length} notification(s)? This removes them from your notifications list.`, "Delete All Notifications"))) {
    return;
  }
  const appIds = items.map(i => i.appId).filter(Boolean).map(String);
  const apprIds = items.map(i => i.approvalId).filter(Boolean).map(String);
  const keysToDismiss = items.flatMap(i => (i.reportId ? [String(i.key), "rep:" + String(i.reportId)] : [String(i.key)]));

  if (appIds.length) {
    state.appNotifications = (state.appNotifications || []).filter(n => !appIds.includes(String(n.id)));
    if (navigator.onLine) {
      await runtime.client.from("app_notifications").delete().in("id", appIds);
    }
  }
  if (apprIds.length) {
    state.approvalNotifications = (state.approvalNotifications || []).filter(n => !apprIds.includes(String(n.id)));
    if (navigator.onLine) {
      await runtime.client.from("approval_notifications").delete().in("id", apprIds);
    }
  }
  await markNoticeDeleted(keysToDismiss);
  renderNotices();
  renderHome();
  toast("All notifications deleted");
}

export function setNoticesFilter(f: "all" | "unread" | "mentions"): void {
  runtime.noticesFilter = f === "unread" || f === "mentions" ? f : "all";
  renderNotices();
}

export function renderNotices(): void {
  const box = $("noticeList");
  if (!box) return;
  const allItems = getNoticeItems();
  const unreadCount = allItems.filter(i => !i.isRead).length;
  const filter = runtime.noticesFilter || "all";
  document.querySelectorAll<HTMLElement>("#noticeFilterTabs .tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.noticeFilter === filter);
  });

  const items = allItems.filter(i => {
    if (filter === "unread") return !i.isRead;
    if (filter === "mentions") return !!i.isMention;
    return true;
  });

  const markAllBtn = $("markAllNoticesReadBtn") as HTMLButtonElement | null;
  const delAllBtn = $("deleteAllNoticesBtn") as HTMLButtonElement | null;
  if (markAllBtn) markAllBtn.disabled = unreadCount === 0;
  if (delAllBtn) delAllBtn.disabled = allItems.length === 0;

  const emptyMsg =
    filter === "unread"
      ? "No unread notifications."
      : filter === "mentions"
        ? "No mentions or scheduled shifts for your name yet."
        : "No notifications yet.";

  box.innerHTML = items.map(item => {
    let attr = ' data-act="noop"';
    if (item.approvalId) attr = ' data-approval-notice="' + esc(item.approvalId) + '"';
    else if (item.appId) attr = ' data-app-notice="' + esc(item.appId) + '"';
    else if (item.reportNoticeId) attr = ' data-report-notice="' + esc(item.reportNoticeId) + '"';
    else if (item.chatId) attr = ' data-chat-notice="' + esc(item.chatId) + '"';
    else if (item.act) attr = ' data-act="' + esc(item.act) + '"';
    const unreadClass = !item.isRead ? " unread-notice" : "";
    const statusBadge = !item.isRead
      ? '<button class="btn small-btn" type="button" data-mark-notice-read="' + esc(item.key) + '" data-db-app="' + esc(item.appId || "") + '" data-db-appr="' + esc(item.approvalId || "") + '">✓ Read</button>'
      : '<span class="badge">✓ Read</span>';
    const delBtn = '<button class="red small-btn" type="button" data-del-notice="' + esc(item.key) + '" data-db-app="' + esc(item.appId || "") + '" data-db-appr="' + esc(item.approvalId || "") + '" data-report-id="' + esc(item.reportId || "") + '" aria-label="Delete notification">🗑</button>';
    return '<div class="item clickable' + unreadClass + '"' + attr + ' data-notice-key="' + esc(item.key) + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;"><div style="flex:1;min-width:0;"><b>' + item.icon + " " + esc(item.title) +
      '</b><div class="muted">' + esc(item.label) + " · " + esc(fmtDate(item.date)) + '</div></div><div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' + statusBadge + delBtn + '</div></div><div style="margin-top:4px">' + esc(item.body) + "</div></div>";
  }).join("") || '<p class="muted">' + emptyMsg + '</p>';
  const bell = $("bell");
  if (bell) {
    bell.textContent = unreadCount ? String(unreadCount) : "";
  }
}

/* ==================== MEMBERS / ONLINE / PENDING / ADMIN ==================== */
function memberRow(p: any): string {
  const uid = String(p.user_id || "");
  const online = onlineIds().has(uid);
  const role = state.roles[p.user_id];
  const appRole = role?.app_role || "employee";
  const label = role ? roleLabel(appRole) : (p.team || "Member");
  const canSetDesignation = isManager() && (isAdmin() || (appRole !== "admin" && appRole !== "representative"));
  return '<div class="person"><span class="tap" data-act="person-menu" data-id="' + esc(uid) + '">' + face(p) +
    '</span><span class="person-info"><button type="button" class="text-button" data-act="person-menu" data-id="' + esc(uid) + '">' + esc(p.full_name || "Member") +
    '</button><span class="muted"><span class="online-dot ' + (online ? "on" : "") + '"></span>' + (online ? "Online" : "Offline") + " · " + esc(label) + (p.area ? " · " + esc(p.area) : "") +
    "</span></span>" +
    '<div class="inline-actions" style="margin-top:0;flex-wrap:wrap;justify-content:flex-end;">' +
    (canSetDesignation ? '<button class="gray small-btn" type="button" data-act="admin-edit" data-id="' + esc(uid) + '">⚙️ Designation</button>' : "") +
    (uid !== String(state.userId) ? '<button class="btn small-btn" type="button" data-act="open-dm" data-id="' + esc(uid) + '">Chat</button>' : "") +
    "</div></div>";
}
export function renderMembers(): void {
  const box = $("members");
  if (!state.userId || !box) return;
  if (!isManager()) { box.innerHTML = ""; return; }
  box.innerHTML = state.profiles.map(memberRow).join("") || '<p class="muted">No members yet.</p>';
}
export function renderOnline(): void {
  if (!state.userId) return;
  const ids = onlineIds();
  const on = state.profiles.filter(p => ids.has(String(p.user_id)));
  const off = state.profiles.filter(p => !ids.has(String(p.user_id)));
  const onEl = $("online");
  const offEl = $("offline");
  if (onEl) onEl.innerHTML = on.map(memberRow).join("") || '<p class="muted">Nobody is online.</p>';
  if (offEl) offEl.innerHTML = off.map(memberRow).join("") || '<p class="muted">Nobody is offline.</p>';
  hooks.renderLiveOnlineMembers?.();
}
export function renderPending(): void {
  const box = $("pending");
  if (!isManager() || !box) return;
  const assignableRoles = isAdmin() ? ["employee", "technician", "representative", "admin"] : ["employee", "technician"];
  box.innerHTML = state.pending.map(r => {
    const reqRole = assignableRoles.includes(String(r.requested_role || "")) ? String(r.requested_role) : "employee";
    const optsHtml = assignableRoles.map(roleVal =>
      '<option value="' + esc(roleVal) + '"' + (roleVal === reqRole ? " selected" : "") + ">" + esc(roleLabel(roleVal)) + "</option>"
    ).join("");
    return '<div class="item"><b>' + esc(r.full_name) + "</b> — " + esc(roleLabel(r.requested_role || "employee")) +
      '<div class="muted">' + esc(r.email || "") + " · requested " + esc(fmtDate(r.created_at)) + '</div>' +
      '<div class="field" style="margin:8px 0 4px;"><label for="pendingRole_' + esc(r.id) + '" style="font-size:12px;">Assign designation</label>' +
      '<select id="pendingRole_' + esc(r.id) + '">' + optsHtml + "</select></div>" +
      '<div class="inline-actions"><button class="green small-btn" type="button" data-act="approve" data-id="' + esc(r.id) + '">Approve</button>' +
      '<button class="red small-btn" type="button" data-act="decline" data-id="' + esc(r.id) + '">Decline</button></div></div>';
  }).join("") || '<p class="muted">No pending registrations.</p>';
}
export function setAdminRoleFilter(filter: string): void {
  runtime.adminRoleFilter = filter || "all";
  document.querySelectorAll<HTMLElement>("#adminRoleTabs [data-admin-role]").forEach(btn =>
    btn.classList.toggle("active", (btn.dataset.adminRole || "all") === runtime.adminRoleFilter)
  );
  renderAdmin();
}
export function renderAdmin(): void {
  const box = $("adminList");
  if (!box) return;
  if (!isAdmin()) { box.innerHTML = '<p class="muted">Admin only.</p>'; return; }
  const activeFilter = runtime.adminRoleFilter || "all";
  document.querySelectorAll<HTMLElement>("#adminRoleTabs [data-admin-role]").forEach(btn =>
    btn.classList.toggle("active", (btn.dataset.adminRole || "all") === activeFilter)
  );
  const filtered = state.profiles.filter(p => {
    const role = state.roles[p.user_id];
    if (role?.approval_status === "declined") return false;
    const appRole = role?.app_role || "employee";
    if (activeFilter !== "all" && appRole !== activeFilter) return false;
    return true;
  });
  box.innerHTML = filtered.map(p => {
    const uid = String(p.user_id || "");
    const role = state.roles[p.user_id];
    const roleText = role ? roleLabel(role.app_role) : "—";
    const isSelf = uid === String(state.userId);
    return '<div class="person">' + face(p) + '<span class="person-info"><b>' + esc(p.full_name || "Member") + '</b><span class="muted">' +
      esc(roleText) + (p.area ? " · " + esc(p.area) : "") + (p.team ? " · " + esc(p.team) : "") + '</span></span>' +
      '<div class="inline-actions" style="margin-top:0;flex-wrap:wrap;justify-content:flex-end;">' +
      '<button class="gray small-btn" type="button" data-act="admin-edit" data-id="' + esc(uid) + '">⚙️ Manage</button>' +
      (!isSelf
        ? '<button class="gray small-btn" type="button" onclick="removeAdminMember(\'' + esc(uid) + '\')">Remove</button>' +
          '<button class="red small-btn" type="button" onclick="deleteAdminMember(\'' + esc(uid) + '\')">Delete</button>'
        : "") +
      "</div></div>";
  }).join("") || '<p class="muted">No members in this category.</p>';
}

async function approveRequest(id: string, approve: boolean): Promise<void> {
  if (!isManager()) { toast("Admin or Representative access only"); return; }
  const req = state.pending.find(r => String(r.id) === String(id));
  if (!req) return;
  if (approve) {
    const allowedRoles = isAdmin() ? ["employee", "technician", "representative", "admin"] : ["employee", "technician"];
    const pickedRole = val("pendingRole_" + String(id)) || req.requested_role || "employee";
    const assignedRole = allowedRoles.includes(pickedRole) ? pickedRole : "employee";
    const { error: roleErr } = await runtime.client
      .from("user_roles")
      .upsert(
        { user_id: req.user_id, app_role: assignedRole, approval_status: "approved", area: req.area || null },
        { onConflict: "user_id" }
      );
    if (roleErr) { toast("Could not approve: " + roleErr.message); return; }
    const { error: profErr } = await runtime.client.from("profiles").upsert({
      user_id: req.user_id, full_name: req.full_name, email: req.email,
      id_no: req.id_no, address: req.address, team: req.team, phone: req.phone, area: req.area,
    }, { onConflict: "user_id" });
    if (profErr) {
      await runtime.client.from("profiles").upsert({
        user_id: req.user_id, full_name: req.full_name, email: req.email,
      }, { onConflict: "user_id" });
    }
  }
  const reqUpdateQuery = runtime.client
    .from("registration_requests")
    .update({ status: approve ? "approved" : "declined" });
  const { error } = req.user_id
    ? await reqUpdateQuery.eq("user_id", req.user_id)
    : await reqUpdateQuery.eq("id", id);
  if (error) { toast("Could not update: " + error.message); return; }
  await runtime.client.from("approval_notifications").insert({
    recipient_user_id: req.user_id,
    title: approve ? "Account approved" : "Registration declined",
    body: approve ? "You can now sign in to EESI Ops." : "Contact an administrator for details.",
  });
  suppressNotifications();
  await loadPending();
  if (approve) {
    await Promise.all([loadProfiles(), loadRoles()]);
    renderMembers();
    renderOnline();
    renderAdmin();
  }
  toast(approve ? "Approved" : "Declined");
}

export function closeAdminMemberOverlay(): void {
  $("adminMemberOverlay")?.classList.add("hidden");
}

async function openAdminEdit(userId: string): Promise<void> {
  if (!isManager()) { toast("Admin or Representative access only"); return; }
  const p = profileOf(userId);
  const role = state.roles[userId];
  if (!p) return;
  const uid = String(userId);
  const currentRole = role?.app_role || "employee";
  if (!isAdmin() && (currentRole === "admin" || currentRole === "representative")) {
    toast("Only Administrator can manage Admin or Selective Representative accounts.");
    return;
  }
  const isSelf = uid === String(state.userId);
  const ttl = $("adminMemberOverlayTitle");
  const body = $("adminMemberOverlayBody");
  if (!body) return;
  const roleChoices = isAdmin() ? ["admin", "representative", "technician", "employee"] : ["employee", "technician"];
  const selectedRole = roleChoices.includes(currentRole) ? currentRole : "employee";
  if (ttl) ttl.textContent = (isAdmin() ? "⚙️ Manage " : "⚙️ Set Designation: ") + (p.full_name || "Member");
  body.innerHTML =
    '<div class="field"><label for="admName">Full name</label><input id="admName" value="' + esc(p.full_name || "") + '"></div>' +
    '<div class="field"><label for="admId">ID No.</label><input id="admId" value="' + esc(p.id_no || "") + '"></div>' +
    '<div class="field"><label for="admTeam">Team</label><input id="admTeam" value="' + esc(p.team || "") + '"></div>' +
    '<div class="field"><label for="admArea">Area</label><select id="admArea">' +
    ["", "Visayas", "Luzon", "Mindanao"].map(a => '<option value="' + a + '"' + (p.area === a ? " selected" : "") + ">" + (a || "—") + "</option>").join("") +
    '</select></div><div class="field"><label for="admRole">Designation</label><select id="admRole">' +
    roleChoices.map(r => '<option value="' + r + '"' + (selectedRole === r ? " selected" : "") + ">" + esc(roleLabel(r)) + "</option>").join("") +
    '</select>' +
    (!isAdmin() ? '<p class="muted" style="font-size:11px;margin-top:4px;">Selective Representatives can assign Employee or Technician. Only Admin can assign Selective Representative.</p>' : "") +
    "</div>" +
    '<div class="inline-actions" style="justify-content:space-between;flex-wrap:wrap;margin-top:12px;">' +
    '<button class="btn" type="button" style="flex:1;" onclick="saveAdminEdit(\'' + esc(uid) + '\')">💾 Save Changes</button>' +
    '<button class="gray" type="button" onclick="closeAdminMemberOverlay()">Cancel</button>' +
    "</div>" +
    (isAdmin() && !isSelf
      ? '<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--border);display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button class="gray small-btn" style="flex:1;" type="button" onclick="removeAdminMember(\'' + esc(uid) + '\')">🚫 Remove Access</button>' +
        '<button class="red small-btn" style="flex:1;" type="button" onclick="deleteAdminMember(\'' + esc(uid) + '\')">🗑 Delete Member</button>' +
        "</div>"
      : "");
  $("adminMemberOverlay")?.classList.remove("hidden");
}

export async function saveAdminEdit(userId: string): Promise<void> {
  if (!isManager()) { toast("Admin or Representative access only"); return; }
  const currentRole = state.roles[userId]?.app_role || "employee";
  if (!isAdmin() && (currentRole === "admin" || currentRole === "representative")) {
    toast("Only Administrator can modify Admin or Selective Representative accounts.");
    return;
  }
  const allowedRoles = isAdmin() ? ["admin", "representative", "technician", "employee"] : ["employee", "technician"];
  const pickedRole = val("admRole");
  if (!allowedRoles.includes(pickedRole)) {
    toast("Only Administrator can assign Selective Representative or Administrator.");
    return;
  }
  const { error: pe } = await runtime.client.from("profiles").update({
    full_name: val("admName").trim(), id_no: val("admId").trim() || null, team: val("admTeam").trim() || null, area: val("admArea") || null,
  }).eq("user_id", userId);
  if (pe) { toast("Profile update failed: " + pe.message); return; }
  const { error: re } = await runtime.client.from("user_roles").upsert({
    user_id: userId, app_role: pickedRole, approval_status: state.roles[userId]?.approval_status || "approved",
  }, { onConflict: "user_id" });
  if (re) { toast("Role update failed: " + re.message); return; }
  closeAdminMemberOverlay();
  suppressNotifications();
  await Promise.all([loadProfiles(), loadRoles()]);
  renderAdmin();
  renderMembers();
  renderOnline();
  toast("Member updated");
}

export async function removeAdminMember(userId: string): Promise<void> {
  if (!isAdmin() || !checkNetwork()) return;
  const uid = String(userId || "");
  if (!uid || uid === String(state.userId)) { toast("You cannot remove your own account."); return; }
  const name = profileName(uid);
  if (!(await confirmDialog(`Remove "${name}" from active company access? They will no longer be able to sign in.`, "Remove Member"))) return;
  const { error: roleErr } = await runtime.client
    .from("user_roles")
    .update({ approval_status: "declined" })
    .eq("user_id", uid);
  if (roleErr) { toast("Remove failed: " + roleErr.message); return; }
  await runtime.client.from("profiles").update({ team: null, area: null }).eq("user_id", uid);
  closeAdminMemberOverlay();
  suppressNotifications();
  await Promise.all([loadProfiles(), loadRoles(), loadPending()]);
  renderAdmin();
  toast(`${name} removed`);
}

export async function deleteAdminMember(userId: string): Promise<void> {
  if (!isAdmin() || !checkNetwork()) return;
  const uid = String(userId || "");
  if (!uid || uid === String(state.userId)) { toast("You cannot delete your own account."); return; }
  const name = profileName(uid);
  if (!(await confirmDialog(`Permanently delete "${name}" and their access records? This cannot be undone.`, "Delete Member"))) return;
  await runtime.client.from("employee_locations").delete().eq("user_id", uid);
  await runtime.client.from("registration_requests").delete().eq("user_id", uid);
  const { error: roleErr } = await runtime.client.from("user_roles").delete().eq("user_id", uid);
  if (roleErr) { toast("Could not delete role record: " + roleErr.message); return; }
  const { error: profErr } = await runtime.client.from("profiles").delete().eq("user_id", uid);
  closeAdminMemberOverlay();
  suppressNotifications();
  await Promise.all([loadProfiles(), loadRoles(), loadPending()]);
  renderAdmin();
  if (profErr) {
    toast(`${name} access removed (profile kept for historical records)`);
  } else {
    toast(`${name} deleted`);
  }
}

/* ==================== ANNOUNCEMENTS / SCHEDULES / SITES ==================== */
export function renderAnnouncements(): void {
  const box = $("annList");
  if (!box) return;
  box.innerHTML = state.announcements.map(a =>
    '<div class="item"><b>' + esc(a.title) + '</b><div class="muted">' + esc(a.author_name || "Admin") + " · " + esc(fmtDate(a.created_at)) +
    "</div><div>" + esc((a.body || "").slice(0, 200)) + ((a.body || "").length > 200 ? "…" : "") +
    '</div><div class="inline-actions"><button class="gray small-btn" type="button" data-act="view-ann" data-id="' + esc(a.id) + '">View</button>' +
    (isManager() ? '<button class="btn small-btn" type="button" data-act="edit-ann" data-id="' + esc(a.id) + '">Edit</button><button class="red small-btn" type="button" data-act="del-ann" data-id="' + esc(a.id) + '">Delete</button>' : "") +
    "</div></div>"
  ).join("") || '<p class="muted">No announcements yet.</p>';
}
export async function postAnnouncement(): Promise<void> {
  const title = val("annTitle").trim();
  const body = val("annBody").trim();
  if (!title) { toast("Enter a title"); return; }
  const payload = { title, body, author_id: state.userId, author_name: state.profile?.full_name || state.email };
  const q = runtime.editingAnnouncementId
    ? runtime.client.from("announcements").update({ title, body }).eq("id", runtime.editingAnnouncementId)
    : runtime.client.from("announcements").insert(payload);
  const { error } = await q;
  if (error) { toast("Could not save: " + error.message); return; }
  cancelEditAnnouncement();
  suppressNotifications();
  await loadAnnouncements();
  toast("Announcement saved");
}
export function cancelEditAnnouncement(): void {
  runtime.editingAnnouncementId = null;
  setVal("annTitle", "");
  setVal("annBody", "");
  const btn = $("postAnnouncementBtn");
  if (btn) btn.textContent = "Post announcement";
  $("cancelAnnouncementBtn")?.classList.add("hidden");
}

export function renderScheduleSiteOptions(): void {
  const sSel = $("schSite") as HTMLSelectElement | null;
  if (!sSel) return;
  const cur = sSel.value;
  const region = val("schRegion");
  const filtered = state.sites.filter(s => !region || s.region === region);
  sSel.innerHTML = '<option value="">Select work site (optional)</option>' +
    filtered.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + (s.city ? " · " + esc(s.city) : "") + "</option>").join("");
  if (filtered.some(s => String(s.id) === cur)) sSel.value = cur;
  renderScheduleUnitOptions();
}

export function renderScheduleUnitOptions(): void {
  const uSel = $("schUnit") as HTMLSelectElement | null;
  if (!uSel) return;
  const siteId = val("schSite");
  const cur = uSel.value;
  const list = siteId ? state.units.filter(u => String(u.site_id) === String(siteId)) : [];
  uSel.innerHTML = '<option value="">General / All Units</option>' +
    list.map(u => '<option value="' + esc(u.id) + '">' + esc(u.unit_name) + " (" + esc(u.unit_type) + ")</option>").join("");
  if (list.some(u => String(u.id) === cur)) uSel.value = cur;
}

export function syncScheduleTitleFromSelection(): void {
  const site = state.sites.find(s => String(s.id) === String(val("schSite")));
  const unit = state.units.find(u => String(u.id) === String(val("schUnit")));
  if (site) {
    const parts = [site.name, unit?.unit_name].filter(Boolean);
    setVal("schTitle", parts.join(" — "));
  }
}

export function renderAssigneesPicker(): void {
  const box = $("assigneesPicker");
  if (!box) return;
  const region = val("schRegion");
  const grouped: Record<string, any[]> = {};
  state.profiles.forEach(p => {
    const r = state.roles[p.user_id]?.app_role || "technician";
    if (r === "admin") return;
    const area = p.area || "Unassigned";
    if (region && area !== region) return;
    const team = p.team || "No team";
    const key = area + " / " + team;
    (grouped[key] = grouped[key] || []).push(p);
  });
  const keys = Object.keys(grouped).sort();
  let html = keys.map(key =>
    '<div class="person-group-title">' + esc(key) + "</div>" +
    grouped[key].map(p =>
      '<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" name="schPersonnel" data-name="' + esc(p.full_name) + '" value="' + esc(p.user_id) + '" style="width:auto">' + esc(p.full_name) + "</label>"
    ).join("")
  ).join("");

  const customList = (runtime.editingScheduleMeta?.customAssigned || []).filter(Boolean);
  if (customList.length) {
    html +=
      '<div class="person-group-title">Other Assigned Names</div>' +
      customList.map(name =>
        '<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" name="schPersonnel" data-name="' + esc(name) + '" value="" checked style="width:auto">' + esc(name) + " (Custom)</label>"
      ).join("");
  }

  box.innerHTML = html || '<p class="muted">No personnel in this area.</p>';
}

interface ParsedScheduleItem {
  assignees: string[];
  matchedUserIds: string[];
  timeIn: string;
  timeOut: string;
  timeLabel: string;
  taskTitle: string;
  isRestDay: boolean;
}

interface ParsedScheduleStatement {
  scheduledDate: string;
  dutyLabel: string;
  items: ParsedScheduleItem[];
}

const MONTH_NAME_MAP: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
  april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
  august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};

function parseDateFromHeaderLine(line: string): string {
  const s = String(line || "").replace(/\s+/g, " ").trim();
  const iso = s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const mdy = s.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  const monthPat = s.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (monthPat) {
    const m = MONTH_NAME_MAP[monthPat[1].toLowerCase()];
    if (m) {
      return `${monthPat[3]}-${String(m).padStart(2, "0")}-${String(Number(monthPat[2])).padStart(2, "0")}`;
    }
  }
  return "";
}

function formatPersonTokenLabel(raw: string): string {
  const clean = String(raw || "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  if (clean.length <= 3 && /^[a-z]+$/i.test(clean) && !/^(joe|jan|joy|jay|rey|roy|leo|ben|dan|ken|sam|tom|max|ray|tim|jon|ron|kim|ana|mae)$/i.test(clean)) {
    return clean.toUpperCase();
  }
  return clean.replace(/\b[a-z]/g, ch => ch.toUpperCase());
}

function resolveSchedulePersonnel(rawGroup: string): { displayNames: string[]; matchedUserIds: string[] } {
  const tokens = String(rawGroup || "")
    .split(/\s*(?:\/|,|&|\+|\band\b)\s*/i)
    .map(t => t.trim())
    .filter(Boolean);

  const displayNames: string[] = [];
  const matchedUserIds: string[] = [];
  const candidates = (state.profiles || []).filter(p => (state.roles[p.user_id]?.app_role || "employee") !== "admin");
  const allProfiles = candidates.length ? candidates : (state.profiles || []);

  for (const tok of tokens) {
    const low = tok.toLowerCase();
    const matched =
      allProfiles.find(p => String(p.full_name || "").trim().toLowerCase() === low) ||
      allProfiles.find(p => {
        const words = String(p.full_name || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
        return words[0] === low || words.includes(low);
      }) ||
      allProfiles.find(p => {
        const words = String(p.full_name || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
        const initials = words.map(w => w[0]).join("");
        return low.length >= 2 && initials === low;
      }) ||
      (low.length >= 3
        ? allProfiles.find(p =>
            String(p.full_name || "").trim().toLowerCase().split(/\s+/).some(w => w.startsWith(low))
          )
        : undefined);

    if (matched) {
      if (!displayNames.includes(matched.full_name)) displayNames.push(matched.full_name);
      if (!matchedUserIds.includes(String(matched.user_id))) matchedUserIds.push(String(matched.user_id));
    } else {
      const formatted = formatPersonTokenLabel(tok);
      if (formatted && !displayNames.includes(formatted)) displayNames.push(formatted);
    }
  }
  return { displayNames, matchedUserIds };
}

function extractLeadingTimeSpan(text: string): {
  timeIn: string;
  timeOut: string;
  timeLabel: string;
  rest: string;
} | null {
  const s = String(text || "").trim();
  if (!s) return null;

  const rangeMatch = s.match(/^(\d{1,2}(?::[0-5]\d)?\s*(?:am|pm)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?::[0-5]\d)?\s*(?:am|pm))\b(?:\s*[-–:]\s*|\s+)?([\s\S]*)$/i);
  if (rangeMatch) {
    const tInRaw = /\b(?:am|pm)\b/i.test(rangeMatch[1]) || rangeMatch[1].includes(":")
      ? rangeMatch[1]
      : rangeMatch[1] + (rangeMatch[2].match(/am|pm/i)?.[0] || "am");
    const pIn = parseScheduleTimeToken(tInRaw);
    const pOut = parseScheduleTimeToken(rangeMatch[2]);
    if (pIn && pOut) {
      return {
        timeIn: pIn.time24,
        timeOut: pOut.time24,
        timeLabel: `${pIn.timeLabel} – ${pOut.timeLabel}`,
        rest: (rangeMatch[3] || "").replace(/^[-–—:\s]+/, "").trim(),
      };
    }
  }

  const singleMatch = s.match(/^(\d{1,2}(?::[0-5]\d)?\s*(?:am|pm)|(?:[01]?\d|2[0-3]):[0-5]\d)\b(?:\s*[-–—:]\s*|\s+)?([\s\S]*)$/i);
  if (singleMatch) {
    const pIn = parseScheduleTimeToken(singleMatch[1]);
    if (pIn) {
      return {
        timeIn: pIn.time24,
        timeOut: "",
        timeLabel: pIn.timeLabel,
        rest: (singleMatch[2] || "").replace(/^[-–—:\s]+/, "").trim(),
      };
    }
  }
  return null;
}

function normalizeTaskDisplayText(text: string): string {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function parseScheduleStatement(rawText: string): ParsedScheduleStatement {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*(?:\d+[.)]\s*|[-•*]\s+)/, "").trim())
    .filter(Boolean);

  let scheduledDate = "";
  let dutyLabel = "";
  const items: ParsedScheduleItem[] = [];
  let lastAssignees: string[] = [];
  let lastMatchedUserIds: string[] = [];

  for (const rawLine of lines) {
    const normLine = rawLine.replace(/\s+/g, " ").trim();
    const detectedDate = parseDateFromHeaderLine(normLine);
    const isHeaderLike =
      /^schedule\b/i.test(normLine) ||
      /^date\s*:/i.test(normLine) ||
      (!!detectedDate && !extractLeadingTimeSpan(normLine) && !/\s[-–—]\s/.test(normLine));

    if (detectedDate && isHeaderLike) {
      scheduledDate = detectedDate;
      const paren = normLine.match(/\(([^)]+)\)/);
      if (paren && paren[1]) dutyLabel = paren[1].trim();
      continue;
    }

    // Continuation line starting directly with time (e.g. "1pm- PMS Epldt vitro cebu")
    const directTime = extractLeadingTimeSpan(normLine);
    if (directTime && directTime.rest) {
      items.push({
        assignees: [...lastAssignees],
        matchedUserIds: [...lastMatchedUserIds],
        timeIn: directTime.timeIn,
        timeOut: directTime.timeOut,
        timeLabel: directTime.timeLabel,
        taskTitle: normalizeTaskDisplayText(directTime.rest),
        isRestDay: false,
      });
      continue;
    }

    // Line split by separator dash ("Joe / luigi - 8am Ayala...", "Rest day - arnold / rodel")
    const dashMatch = normLine.match(/^(.+?)\s+[-–—]\s+(.+)$/) || normLine.match(/^([a-zA-Z\s/,&+.]+?)\s*[-–—]\s+(.+)$/);
    if (dashMatch) {
      const left = dashMatch[1].trim();
      const right = dashMatch[2].trim();
      const restLeft = /^(?:rest\s*day|day\s*off|off\s*duty|off)$/i.test(left);
      const restRight = /^(?:rest\s*day|day\s*off|off\s*duty|off)$/i.test(right);

      if (restLeft || restRight) {
        const peoplePart = restLeft ? right : left;
        const resolved = resolveSchedulePersonnel(peoplePart);
        lastAssignees = resolved.displayNames;
        lastMatchedUserIds = resolved.matchedUserIds;
        items.push({
          assignees: resolved.displayNames,
          matchedUserIds: resolved.matchedUserIds,
          timeIn: "",
          timeOut: "",
          timeLabel: "",
          taskTitle: "Rest Day",
          isRestDay: true,
        });
        continue;
      }

      const resolved = resolveSchedulePersonnel(left);
      lastAssignees = resolved.displayNames;
      lastMatchedUserIds = resolved.matchedUserIds;
      const rightTime = extractLeadingTimeSpan(right);
      const taskTitle = normalizeTaskDisplayText(rightTime ? (rightTime.rest || right) : right);
      items.push({
        assignees: resolved.displayNames,
        matchedUserIds: resolved.matchedUserIds,
        timeIn: rightTime?.timeIn || "",
        timeOut: rightTime?.timeOut || "",
        timeLabel: rightTime?.timeLabel || "",
        taskTitle: taskTitle || "Scheduled Duty",
        isRestDay: false,
      });
      continue;
    }

    // Fallback plain task line
    items.push({
      assignees: [...lastAssignees],
      matchedUserIds: [...lastMatchedUserIds],
      timeIn: "",
      timeOut: "",
      timeLabel: "",
      taskTitle: normalizeTaskDisplayText(normLine),
      isRestDay: /^(?:rest\s*day|day\s*off|off\s*duty)$/i.test(normLine),
    });
  }

  return { scheduledDate, dutyLabel, items };
}

export function updateScheduleStatementPreview(): void {
  const raw = val("schStatement");
  const clearBtn = $("clearSchStatementBtn");
  const prevBox = $("schEnumPreview");
  const hasText = !!raw.trim();
  clearBtn?.classList.toggle("hidden", !hasText);
  if (!prevBox) return;
  if (!hasText) {
    prevBox.classList.add("hidden");
    prevBox.innerHTML = "";
    return;
  }

  const parsed = parseScheduleStatement(raw);
  if (parsed.scheduledDate) setVal("schDate", parsed.scheduledDate);

  // Sync matching personnel checkboxes cleanly
  const matchedIds = new Set(parsed.items.flatMap(it => it.matchedUserIds));
  if (matchedIds.size) {
    document.querySelectorAll<HTMLInputElement>('input[name="schPersonnel"]').forEach(cb => {
      cb.checked = matchedIds.has(String(cb.value));
    });
  }

  if (!parsed.items.length) {
    prevBox.classList.remove("hidden");
    prevBox.innerHTML = '<div class="muted">Type or paste task lines below the date header to auto-enumerate…</div>';
    return;
  }

  const headerText = [
    parsed.scheduledDate ? fmtDay(parsed.scheduledDate) : "",
    parsed.dutyLabel || "",
    `${parsed.items.length} item${parsed.items.length === 1 ? "" : "s"}`,
  ].filter(Boolean).join(" · ");

  prevBox.classList.remove("hidden");
  prevBox.innerHTML =
    `<div style="font-weight:700;margin-bottom:6px;">📋 Enumerated Preview (${esc(headerText)})</div>` +
    `<ol style="margin:0;padding-left:20px;display:grid;gap:4px;">` +
    parsed.items.map(it => {
      const who = it.assignees.length ? `<b>${esc(it.assignees.join(" / "))}</b>` : `<span class="muted">Unassigned</span>`;
      const tm = it.timeLabel ? ` · <span class="badge">${esc(it.timeLabel)}</span>` : "";
      const task = it.isRestDay ? `<span class="badge">Rest Day</span>` : esc(it.taskTitle);
      return `<li>${who}${tm} — ${task}</li>`;
    }).join("") +
    `</ol>`;
}

export function clearScheduleStatement(): void {
  setVal("schStatement", "");
  updateScheduleStatementPreview();
}

function getFilteredSchedules(): any[] {
  const base = visibleSchedules();
  const filter = runtime.scheduleFilter || "all";
  const q = String(runtime.scheduleSearch || "").trim().toLowerCase();
  const todayStr = localDateKey(new Date());

  return base.filter(s => {
    if (filter === "mentioned" && !isCurrentUserMentionedInSchedule(s)) return false;
    if (filter === "today" && String(s.scheduled_date || "") !== todayStr) return false;
    if (filter === "upcoming" && String(s.scheduled_date || "9999-12-31") < todayStr) return false;
    if (q) {
      const tags = parseScheduleTags(s.notes);
      const hay = [
        s.title,
        s.region,
        s.scheduled_date,
        s.priority,
        tags.dutyLabel,
        tags.assigned.join(" "),
        tags.cleanNotes,
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function setScheduleFilter(f: "all" | "mentioned" | "today" | "upcoming"): void {
  runtime.scheduleFilter = f === "mentioned" || f === "today" || f === "upcoming" ? f : "all";
  renderSchedules();
}

export function setScheduleSearch(q: string): void {
  runtime.scheduleSearch = String(q || "");
  renderSchedules();
}

export async function copyDailyScheduleSummary(): Promise<void> {
  const list = getFilteredSchedules();
  if (!list.length) {
    toast("No schedules in current view to copy.");
    return;
  }
  const byDate = new Map<string, any[]>();
  list.forEach(s => {
    const dk = String(s.scheduled_date || "Unscheduled");
    if (!byDate.has(dk)) byDate.set(dk, []);
    byDate.get(dk)!.push(s);
  });

  const lines: string[] = [];
  for (const [dk, items] of byDate.entries()) {
    const firstDuty = items.map(x => parseScheduleTags(x.notes).dutyLabel).find(Boolean) || "";
    const header = dk !== "Unscheduled"
      ? `📅 Schedule ${fmtDay(dk)}${firstDuty ? ` (${firstDuty})` : ""}`
      : `📅 Upcoming Schedule`;
    lines.push(header);
    items.forEach((s, idx) => {
      const tags = parseScheduleTags(s.notes);
      const who = tags.assigned.length ? tags.assigned.join(" / ") : "Unassigned";
      const tm = s.time_in && s.time_out
        ? `${formatScheduleTimeDisplay(s.time_in)}–${formatScheduleTimeDisplay(s.time_out)}`
        : (s.time_in ? formatScheduleTimeDisplay(s.time_in) : "");
      lines.push(`${idx + 1}. ${who}${tm ? " - " + tm : ""} ${s.title || ""}${s.region ? " [" + s.region + "]" : ""}`.trim());
    });
    lines.push("");
  }

  const text = lines.join("\n").trim();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      toast("📋 Daily schedule copied to clipboard");
      return;
    }
  } catch {}
  openSheet(
    `<h2>📋 Daily Schedule Summary</h2>` +
    `<textarea readonly rows="10" style="width:100%;margin-top:8px;">${esc(text)}</textarea>` +
    sheetClose()
  );
}

export function renderSchedules(): void {
  const box = $("scheduleList");
  if (!box) return;
  const filter = runtime.scheduleFilter || "all";
  document.querySelectorAll<HTMLElement>("#scheduleFilterTabs .tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.schFilter === filter);
  });

  const filtered = getFilteredSchedules();
  if (!filtered.length) {
    box.innerHTML = `<p class="muted">${
      runtime.scheduleSearch || filter !== "all"
        ? "No schedules match the selected filter."
        : "No schedules assigned to you."
    }</p>`;
    return;
  }

  const groups: Array<{ dateKey: string; dutyLabel: string; items: any[] }> = [];
  const byKey = new Map<string, { dateKey: string; dutyLabel: string; items: any[] }>();

  for (const s of filtered) {
    const tags = parseScheduleTags(s.notes);
    const dk = String(s.scheduled_date || "unscheduled");
    let g = byKey.get(dk);
    if (!g) {
      g = { dateKey: dk, dutyLabel: tags.dutyLabel, items: [] };
      byKey.set(dk, g);
      groups.push(g);
    } else if (!g.dutyLabel && tags.dutyLabel) {
      g.dutyLabel = tags.dutyLabel;
    }
    g.items.push(s);
  }

  box.innerHTML = groups.map(group => {
    const dateHeader = group.dateKey !== "unscheduled"
      ? fmtDay(group.dateKey) + (group.dutyLabel ? ` (${group.dutyLabel})` : "")
      : (group.dutyLabel || "Upcoming Schedule");

    const rowsHtml = group.items.map((s, idx) => {
      const tags = parseScheduleTags(s.notes);
      const assigned = tags.assigned.join(", ");
      const notes = tags.cleanNotes;
      const noteLines = notes.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const notesHtml = noteLines.length > 1
        ? '<ol style="margin:6px 0 0;padding-left:20px;">' + noteLines.map(nl => `<li>${esc(nl)}</li>`).join("") + "</ol>"
        : (notes ? "<div>" + esc(notes) + "</div>" : "");
      const timeStr = s.time_in && s.time_out
        ? `${formatScheduleTimeDisplay(s.time_in)} – ${formatScheduleTimeDisplay(s.time_out)}`
        : (s.time_in ? formatScheduleTimeDisplay(s.time_in) : "");
      const sst = sessionState(s);
      const isMine = isCurrentUserMentionedInSchedule(s);
      const canEditOrDel = isManager() || (state.userId && String(s.created_by || "") === String(state.userId));
      const actionsHtml = [
        canEditOrDel ? `<button class="gray small-btn" type="button" data-act="edit-sched" data-id="${esc(s.id)}">✏️ Edit</button>` : "",
        isMine ? `<button class="btn small-btn" type="button" data-act="sched-to-dtr" data-id="${esc(s.id)}">⏰ Fill DTR</button>` : "",
        canEditOrDel ? `<button class="red small-btn" type="button" data-act="del-sched" data-id="${esc(s.id)}">🗑 Delete</button>` : "",
      ].filter(Boolean).join("");

      return '<div class="item' + (sst ? " sess-" + sst : "") + '">' +
        '<div style="display:flex;align-items:flex-start;gap:8px;">' +
        '<span class="badge" style="min-width:26px;text-align:center;font-weight:800;">' + (idx + 1) + '.</span>' +
        '<div style="flex:1;min-width:0;">' +
        '<b>' + esc(s.title) + "</b> " + sessionBadge(s) +
        (isMine ? ' <span class="badge">👤 You</span>' : "") +
        ' <span class="badge">' + esc(s.priority || "Normal") + '</span>' +
        '<div class="muted">' + esc(fmtDay(s.scheduled_date)) +
        (s.region ? " · " + esc(s.region) : "") + (timeStr ? " · " + esc(timeStr) : "") +
        "</div>" + (assigned ? "<div><b>Assigned:</b> " + esc(assigned) + "</div>" : "") + notesHtml +
        (actionsHtml ? '<div class="inline-actions">' + actionsHtml + "</div>" : "") +
        '</div></div></div>';
    }).join("");

    return `<div style="margin-bottom:14px;">` +
      `<div style="font-weight:800;font-size:13.5px;margin:6px 0 8px;display:flex;align-items:center;gap:6px;">📅 ${esc(dateHeader)} <span class="badge">${group.items.length}</span></div>` +
      rowsHtml +
      `</div>`;
  }).join("");
}

function resetScheduleFormState(): void {
  runtime.editingScheduleId = null;
  runtime.editingScheduleMeta = null;
  const titleEl = $("scheduleFormTitle");
  if (titleEl) titleEl.textContent = "📅 Add Schedule";
  const saveBtn = $("saveScheduleBtn");
  if (saveBtn) saveBtn.textContent = "Save schedule";
  const metaNote = $("scheduleEditMetaNote");
  if (metaNote) {
    metaNote.textContent = "";
    metaNote.classList.add("hidden");
  }
  $("schStatementWrap")?.classList.remove("hidden");
}

function clearScheduleFormFields(): void {
  clearScheduleStatement();
  setVal("schSite", "");
  setVal("schUnit", "");
  setVal("schTitle", "");
  setVal("schDate", "");
  setVal("schPriority", "Normal");
  setVal("schIn", "");
  setVal("schOut", "");
  setVal("schNotes", "");
  document.querySelectorAll<HTMLInputElement>('input[name="schPersonnel"]:checked').forEach(i => { i.checked = false; });
}

export function editSchedule(id: string): void {
  const s = (state.schedules || []).find(x => String(x.id) === String(id));
  if (!s) {
    toast("Schedule not found.");
    return;
  }
  const canEdit = isManager() || (state.userId && String(s.created_by || "") === String(state.userId));
  if (!canEdit) return;

  const tags = parseScheduleTags(s.notes);
  runtime.editingScheduleId = String(s.id);
  runtime.editingScheduleMeta = {
    seq: tags.seq,
    dutyLabel: tags.dutyLabel,
    customAssigned: [],
  };

  setVal("schStatement", "");
  updateScheduleStatementPreview();
  $("schStatementWrap")?.classList.add("hidden");

  const titleEl = $("scheduleFormTitle");
  if (titleEl) titleEl.textContent = "✏️ Edit Schedule";
  const saveBtn = $("saveScheduleBtn");
  if (saveBtn) saveBtn.textContent = "💾 Update Schedule";
  const metaNote = $("scheduleEditMetaNote");
  if (metaNote) {
    metaNote.textContent =
      `Editing schedule item${tags.seq ? " #" + tags.seq : ""}${tags.dutyLabel ? " (" + tags.dutyLabel + ")" : ""}. Updating notifies mentioned personnel.`;
    metaNote.classList.remove("hidden");
  }

  setVal("schRegion", s.region || "Visayas");
  renderScheduleSiteOptions();
  renderAssigneesPicker();

  const checkboxes = [...document.querySelectorAll<HTMLInputElement>('input[name="schPersonnel"]')];
  const matchedCheckboxes = new Set<HTMLInputElement>();
  const customUnmatched: string[] = [];

  for (const tok of tags.assigned) {
    const matchCb = checkboxes.find(cb => doesAssignedTokenMatchUser(tok, String(cb.dataset.name || "")));
    if (matchCb) matchedCheckboxes.add(matchCb);
    else customUnmatched.push(tok);
  }

  if (customUnmatched.length) {
    runtime.editingScheduleMeta.customAssigned = customUnmatched;
    renderAssigneesPicker();
  }

  const allCheckboxes = [...document.querySelectorAll<HTMLInputElement>('input[name="schPersonnel"]')];
  allCheckboxes.forEach(cb => {
    const cbName = String(cb.dataset.name || "");
    cb.checked =
      tags.assigned.some(tok => doesAssignedTokenMatchUser(tok, cbName)) ||
      customUnmatched.some(name => name.toLowerCase() === cbName.toLowerCase());
  });

  setVal("schSite", "");
  setVal("schUnit", "");
  setVal("schTitle", s.title || "");
  setVal("schDate", s.scheduled_date || "");
  setVal("schPriority", s.priority || "Normal");
  const parsedIn = parseScheduleTimeToken(s.time_in || "");
  const parsedOut = parseScheduleTimeToken(s.time_out || "");
  setVal("schIn", parsedIn ? parsedIn.time24 : (/^\d{2}:\d{2}/.test(String(s.time_in || "")) ? String(s.time_in).slice(0, 5) : ""));
  setVal("schOut", parsedOut ? parsedOut.time24 : (/^\d{2}:\d{2}/.test(String(s.time_out || "")) ? String(s.time_out).slice(0, 5) : ""));
  setVal("schNotes", tags.cleanNotes);

  $("scheduleFormOverlay")?.classList.remove("hidden");
  setTimeout(() => ($("schTitle") as HTMLInputElement | null)?.focus(), 40);
}

export function openScheduleFormOverlay(): void {
  if (!isManager()) return;
  if (runtime.editingScheduleId) {
    clearScheduleFormFields();
  }
  resetScheduleFormState();
  renderScheduleSiteOptions();
  renderAssigneesPicker();
  updateScheduleStatementPreview();
  $("scheduleFormOverlay")?.classList.remove("hidden");
  setTimeout(() => ($("schStatement") as HTMLTextAreaElement | null)?.focus(), 40);
}

export function closeScheduleFormOverlay(): void {
  $("scheduleFormOverlay")?.classList.add("hidden");
  if (runtime.editingScheduleId) {
    clearScheduleFormFields();
  }
  resetScheduleFormState();
}

export async function saveSchedule(): Promise<void> {
  const isEditing = !!runtime.editingScheduleId;
  if (!isEditing && !isManager()) return;

  const statementRaw = isEditing ? "" : val("schStatement").trim();
  const region = val("schRegion");
  const priority = val("schPriority") || "Normal";
  const extraNotes = val("schNotes").trim();

  if (statementRaw) {
    const parsed = parseScheduleStatement(statementRaw);
    if (!parsed.items.length) {
      toast("No schedule items found in the statement.");
      return;
    }
    const schDate = parsed.scheduledDate || val("schDate") || null;
    const rows = parsed.items.map((it, idx) => {
      const noteParts: string[] = [];
      if (it.assignees.length) noteParts.push(`[ASSIGNED: ${it.assignees.join(", ")}]`);
      noteParts.push(`[SEQ:${idx + 1}]`);
      if (parsed.dutyLabel) noteParts.push(`[DUTY:${parsed.dutyLabel}]`);
      if (extraNotes) noteParts.push(extraNotes);
      return {
        title: it.taskTitle,
        region,
        scheduled_date: schDate,
        priority: it.isRestDay ? "Normal" : priority,
        time_in: it.timeIn || null,
        time_out: it.timeOut || null,
        notes: noteParts.join(" ").trim(),
        created_by: state.userId || null,
      };
    });

    const { error } = await runtime.client.from("schedules").insert(rows);
    if (error) { toast("Could not save: " + error.message); return; }

    clearScheduleFormFields();
    resetScheduleFormState();
    suppressNotifications();
    await loadSchedules();
    closeScheduleFormOverlay();
    toast(`${rows.length} enumerated schedule item${rows.length === 1 ? "" : "s"} saved`);
    return;
  }

  const title = val("schTitle").trim();
  if (!title) { toast("Enter a schedule statement or job / site"); return; }
  const picked = [...document.querySelectorAll<HTMLInputElement>('input[name="schPersonnel"]:checked')];
  const names = [...new Set(picked.map(i => String(i.dataset.name || "").trim()).filter(Boolean))];
  const noteParts: string[] = [];
  if (names.length) noteParts.push(`[ASSIGNED: ${names.join(", ")}]`);
  if (isEditing && runtime.editingScheduleMeta?.seq !== null && runtime.editingScheduleMeta?.seq !== undefined) {
    noteParts.push(`[SEQ:${runtime.editingScheduleMeta.seq}]`);
  }
  if (isEditing && runtime.editingScheduleMeta?.dutyLabel) {
    noteParts.push(`[DUTY:${runtime.editingScheduleMeta.dutyLabel}]`);
  }
  if (extraNotes) noteParts.push(extraNotes);
  const note = noteParts.join(" ").trim();

  if (isEditing && runtime.editingScheduleId) {
    const basePayload = {
      title,
      region,
      scheduled_date: val("schDate") || null,
      priority,
      time_in: val("schIn") || null,
      time_out: val("schOut") || null,
      notes: note,
    };
    let res = await runtime.client
      .from("schedules")
      .update({
        ...basePayload,
        updated_at: new Date().toISOString(),
        updated_by: state.userId || null,
      })
      .eq("id", runtime.editingScheduleId);
    if (res.error && /updated_at|updated_by|column|schema cache|42703/i.test(String(res.error.message || ""))) {
      res = await runtime.client
        .from("schedules")
        .update(basePayload)
        .eq("id", runtime.editingScheduleId);
    }
    if (res.error) { toast("Could not update: " + res.error.message); return; }

    clearScheduleFormFields();
    resetScheduleFormState();
    suppressNotifications();
    await loadSchedules();
    closeScheduleFormOverlay();
    toast("Schedule updated");
    return;
  }

  const { error } = await runtime.client.from("schedules").insert({
    title,
    region,
    scheduled_date: val("schDate") || null,
    priority,
    time_in: val("schIn") || null,
    time_out: val("schOut") || null,
    notes: note,
    created_by: state.userId || null,
  });
  if (error) { toast("Could not save: " + error.message); return; }

  clearScheduleFormFields();
  resetScheduleFormState();
  suppressNotifications();
  await loadSchedules();
  closeScheduleFormOverlay();
  toast("Schedule saved");
}

let pendingSiteThumbTargetId: string | null = null;

export function getFilteredSites(): any[] {
  const reg = String(runtime.sitesRegionFilter || "ALL");
  const st = String(runtime.sitesStatusFilter || "ALL");
  return state.sites.filter(s => {
    if (reg !== "ALL" && String(s.region || "").toLowerCase() !== reg.toLowerCase()) return false;
    if (st !== "ALL" && getSiteEffectiveStatus(s, state.units) !== st) return false;
    return true;
  });
}

async function persistSiteMetaFallback(
  siteId: string,
  patch: { thumbnail_url?: string | null; status?: string | null; latitude?: number | null; longitude?: number | null }
): Promise<void> {
  const sid = String(siteId);
  const now = new Date().toISOString();
  const prev = runtime.siteMetaNotices[sid] || {};
  const nextMeta = {
    site_id: sid,
    thumbnail_url: patch.thumbnail_url !== undefined ? patch.thumbnail_url : prev.thumbnail_url,
    status: patch.status !== undefined ? patch.status : prev.status,
    latitude: patch.latitude !== undefined ? patch.latitude : prev.latitude,
    longitude: patch.longitude !== undefined ? patch.longitude : prev.longitude,
    updated_at: now,
  };
  runtime.siteMetaNotices[sid] = nextMeta;
  const site = state.sites.find(x => String(x.id) === sid);
  if (site) {
    if (patch.thumbnail_url !== undefined) site.thumbnail_url = patch.thumbnail_url;
    if (patch.status !== undefined) site.status = patch.status;
    if (patch.latitude !== undefined) site.latitude = patch.latitude;
    if (patch.longitude !== undefined) site.longitude = patch.longitude;
  }
  suppressNotifications();
  const body = buildSiteMetaAppNoticeBody(nextMeta);
  const { error } = await runtime.client.from("app_notifications").insert({
    title: "Site Metadata",
    body,
    is_read: true,
  });
  if (error) {
    console.warn("persistSiteMetaFallback failed:", error.message);
  }
}

async function uploadSiteThumbnailFile(siteId: string, rawFile: File, opts: { silent?: boolean } = {}): Promise<string | null> {
  if (!isManager()) { toast("Managers only"); return null; }
  if (!checkNetwork()) return null;
  if (!isImageFile(rawFile)) { toast("Please select an image file."); return null; }

  const sid = String(siteId);
  const site = state.sites.find(x => String(x.id) === sid);
  const oldUrl = site ? getSiteThumbnailUrl(site) : null;
  if (!opts.silent) toast("Uploading site thumbnail…");

  const prepared = await prepareImageFile(rawFile, 1280, 0.85);
  const safeName = prepared.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `sites/${sid}/${Date.now()}-${safeName}`;
  const { error: upErr } = await runtime.client.storage.from("reports").upload(path, prepared, {
    upsert: false,
    contentType: prepared.type || "image/jpeg",
  });
  if (upErr) {
    toast("Thumbnail upload failed: " + upErr.message);
    return null;
  }
  const { data: pub } = runtime.client.storage.from("reports").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  let persistedDirect = false;
  if (!runtime.sitesExtraColsMissing) {
    const { error } = await runtime.client.from("sites").update({ thumbnail_url: publicUrl }).eq("id", sid);
    if (!error) {
      persistedDirect = true;
    } else if (/thumbnail_url|42703|PGRST204/i.test(error.message || "")) {
      runtime.sitesExtraColsMissing = true;
    } else {
      toast("Could not save thumbnail: " + error.message);
      return null;
    }
  }
  if (!persistedDirect) {
    await persistSiteMetaFallback(sid, { thumbnail_url: publicUrl });
  }
  if (oldUrl && oldUrl.includes("/storage/v1/object/")) {
    await deleteStorageFile("reports", oldUrl);
  }
  if (site) site.thumbnail_url = publicUrl;
  suppressNotifications();
  await loadSites();
  if (!opts.silent) toast("Site thumbnail updated");
  return publicUrl;
}

async function updateSiteStatus(siteId: string, nextStatus: string): Promise<void> {
  if (!isManager()) return;
  if (!checkNetwork()) return;
  const sid = String(siteId);
  const site = state.sites.find(x => String(x.id) === sid);
  if (site) site.status = nextStatus;

  let persistedDirect = false;
  if (!runtime.sitesExtraColsMissing) {
    const { error } = await runtime.client.from("sites").update({ status: nextStatus }).eq("id", sid);
    if (!error) {
      persistedDirect = true;
    } else if (/status|42703|PGRST204/i.test(error.message || "")) {
      runtime.sitesExtraColsMissing = true;
    } else {
      toast("Status update failed: " + error.message);
      return;
    }
  }
  if (!persistedDirect) {
    await persistSiteMetaFallback(sid, { status: nextStatus });
  }
  suppressNotifications();
  await loadSites();
  toast("Site status updated to " + nextStatus);
}

function formatSiteDistanceBadge(siteId: string): string {
  const d = runtime.siteDistances[String(siteId)];
  if (!d || d.status === "idle") {
    return '<span class="site-dist-badge muted-dist">🚗 Distance pending…</span>';
  }
  if (d.status === "loading") {
    return '<span class="site-dist-badge muted-dist">⏳ Calculating distance…</span>';
  }
  if (d.status === "ready") {
    const parts = [d.distanceText, d.durationText ? d.durationText + " drive" : ""].filter(Boolean).join(" · ");
    return '<span class="site-dist-badge">🚗 ' + esc(parts) + "</span>";
  }
  if (d.status === "no_gps") {
    return '<span class="site-dist-badge muted-dist">📍 Enable GPS for distance</span>';
  }
  if (d.status === "no_route") {
    return '<span class="site-dist-badge muted-dist">🛣️ ' + esc(d.message || "No driving route") + "</span>";
  }
  return '<span class="site-dist-badge muted-dist">⚠️ ' + esc(d.message || "Distance unavailable") + "</span>";
}

export function openAddSiteModal(): void {
  runtime.editingSiteId = null;
  const ttl = $("addSiteTitle");
  const btn = $("submitAddSiteBtn") as HTMLButtonElement | null;
  if (ttl) ttl.textContent = "Add work site";
  if (btn) btn.textContent = "Add site";
  setVal("siteName", "");
  setVal("siteAddress", "");
  setVal("siteRegion", "Visayas");
  setVal("siteCity", "");
  setVal("siteLat", "");
  setVal("siteLng", "");
  setVal("siteStatus", "Operational");
  setVal("siteAutoThumbUrl", "");
  const thumbInput = $("siteAddThumb") as HTMLInputElement | null;
  if (thumbInput) thumbInput.value = "";
  const preview = $("addSiteThumbPreview") as HTMLImageElement | null;
  if (preview) { preview.src = ""; preview.classList.add("hidden"); }
  const noteEl = $("addSiteThumbNote");
  if (noteEl) noteEl.textContent = "A picture is automatically added from Places / landmark photo or map pin when you enter a site name.";
  $("addSiteOverlay")?.classList.remove("hidden");
  resetAddSitePinPicker();
  initAddSitePinPicker();
}

export function openEditSiteOverlay(siteId: string): void {
  if (!isManager()) { toast("Managers only"); return; }
  const s = state.sites.find(x => String(x.id) === String(siteId));
  if (!s) return;
  runtime.editingSiteId = String(s.id);
  const ttl = $("addSiteTitle");
  const btn = $("submitAddSiteBtn") as HTMLButtonElement | null;
  if (ttl) ttl.textContent = "Edit work site";
  if (btn) btn.textContent = "Save changes";

  setVal("siteName", s.name || "");
  setVal("siteAddress", s.address || "");
  const regSel = $("siteRegion") as HTMLSelectElement | null;
  const siteReg = String(s.region || "Visayas").trim() || "Visayas";
  if (regSel && ![...regSel.options].some(o => o.value.toLowerCase() === siteReg.toLowerCase())) {
    const opt = document.createElement("option");
    opt.value = siteReg;
    opt.textContent = siteReg;
    regSel.appendChild(opt);
  }
  if (regSel) {
    const matchedOpt = [...regSel.options].find(o => o.value.toLowerCase() === siteReg.toLowerCase());
    regSel.value = matchedOpt ? matchedOpt.value : siteReg;
  }
  setVal("siteCity", s.city || "");
  setVal("siteLat", s.latitude !== null && s.latitude !== undefined && Number.isFinite(Number(s.latitude)) ? String(s.latitude) : "");
  setVal("siteLng", s.longitude !== null && s.longitude !== undefined && Number.isFinite(Number(s.longitude)) ? String(s.longitude) : "");
  setVal("siteStatus", getSiteEffectiveStatus(s, state.units) || "Operational");
  const existingThumb = getSiteThumbnailUrl(s) || "";
  setVal("siteAutoThumbUrl", existingThumb);
  const thumbInput = $("siteAddThumb") as HTMLInputElement | null;
  if (thumbInput) thumbInput.value = "";
  const preview = $("addSiteThumbPreview") as HTMLImageElement | null;
  if (preview) {
    if (existingThumb) {
      preview.src = existingThumb;
      preview.classList.remove("hidden");
    } else {
      preview.src = "";
      preview.classList.add("hidden");
    }
  }
  const noteEl = $("addSiteThumbNote");
  if (noteEl) noteEl.textContent = "Edit details, drag the map pin, or upload a new site photo.";

  $("addSiteOverlay")?.classList.remove("hidden");
  resetAddSitePinPicker();
  initAddSitePinPicker();
  const pinEl = $("addSitePinStatus");
  if (pinEl && s.latitude !== null && s.latitude !== undefined && s.longitude !== null && s.longitude !== undefined) {
    pinEl.textContent = `📍 Current pin: ${Number(s.latitude).toFixed(5)}, ${Number(s.longitude).toFixed(5)} (drag pin or Auto-Fill to update)`;
  }
}

export function renderSites(): void {
  const regionRow = $("sitesRegionTabs");
  if (regionRow) {
    const baseRegions = ["ALL", "Luzon", "Visayas", "Mindanao", "NCR"];
    const extraRegions = [...new Set(
      state.sites.map(s => String(s.region || "").trim()).filter(r => r && !baseRegions.some(b => b.toLowerCase() === r.toLowerCase()))
    )].sort((a, b) => a.localeCompare(b));
    const allRegions = [...baseRegions, ...extraRegions];
    regionRow.innerHTML = allRegions.map(r => {
      const label = r === "ALL" ? "All Regions" : r;
      const isAct = runtime.sitesRegionFilter.toLowerCase() === r.toLowerCase();
      return `<button class="chip${isAct ? " active" : ""}" type="button" data-sites-region="${esc(r)}">${esc(label)}</button>`;
    }).join("");
  }

  document.querySelectorAll<HTMLElement>("[data-sites-status]").forEach(btn => {
    btn.classList.toggle("active", (btn.dataset.sitesStatus || "ALL") === runtime.sitesStatusFilter);
  });

  const filtered = getFilteredSites();
  const cnt = $("siteFilterCount");
  if (cnt) {
    cnt.textContent = filtered.length === state.sites.length
      ? `(${state.sites.length})`
      : `(${filtered.length} of ${state.sites.length})`;
  }

  const box = $("siteList");
  if (!box) return;
  if (!filtered.length) {
    box.innerHTML = '<p class="muted">' + (state.sites.length ? "No sites match the selected region/status filters." : "No sites yet.") + "</p>";
    return;
  }

  const regionOrder = ["Luzon", "Visayas", "Mindanao", "NCR"];
  const grouped = new Map<string, any[]>();
  filtered.forEach(s => {
    const reg = String(s.region || "").trim() || "Unassigned Region";
    const canonical = regionOrder.find(r => r.toLowerCase() === reg.toLowerCase()) || reg;
    if (!grouped.has(canonical)) grouped.set(canonical, []);
    grouped.get(canonical)!.push(s);
  });
  const sortedRegions = [...grouped.keys()].sort((a, b) => {
    const ia = regionOrder.indexOf(a);
    const ib = regionOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  box.innerHTML = sortedRegions.map(reg => {
    const list = (grouped.get(reg) || []).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    const cardsHtml = list.map(s => {
      const sid = String(s.id);
      const isSel = runtime.selectedSiteId && String(runtime.selectedSiteId) === sid;
      const thumbUrl = getSiteThumbnailUrl(s);
      const effStatus = getSiteEffectiveStatus(s, state.units);
      const thumbHtml = thumbUrl
        ? '<img class="site-thumb" src="' + esc(thumbUrl) + '" alt="' + esc(s.name) + '" data-act="preview-site-thumb" data-id="' + esc(sid) + '">'
        : '<div class="site-thumb-empty">📷<span>No photo</span></div>';

      const statusOptionsHtml = SITE_STATUS_OPTIONS.map(opt =>
        '<option value="' + esc(opt) + '"' + (opt === effStatus ? " selected" : "") + ">" + esc(opt) + "</option>"
      ).join("");

      return '<div class="item' + (isSel ? " site-selected" : "") + '">' +
        '<div class="site-card-row">' +
          thumbHtml +
          '<div class="site-card-body">' +
            '<b>' + esc(s.name) + '</b>' +
            '<div class="muted">' + esc([s.address, s.city, s.region].filter(Boolean).join(" · ")) + '</div>' +
            '<div class="site-meta-badges">' +
              '<span class="badge">' + esc(effStatus) + '</span>' +
              formatSiteDistanceBadge(sid) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="inline-actions">' +
          '<button class="btn small-btn" type="button" data-act="map" data-id="' + esc(sid) + '">📍 View on Map</button>' +
          (isManager()
            ? '<button class="gray small-btn" type="button" data-act="edit-site" data-id="' + esc(sid) + '">✏️ Edit</button>' +
              '<button class="gray small-btn" type="button" data-act="upload-site-thumb" data-id="' + esc(sid) + '">' + (thumbUrl ? "📷 Photo" : "📷 Upload Photo") + '</button>' +
              '<select class="site-status-select" data-site-status-select="' + esc(sid) + '" aria-label="Status for ' + esc(s.name) + '">' + statusOptionsHtml + '</select>' +
              '<button class="red small-btn" type="button" data-act="del-site" data-id="' + esc(sid) + '">Delete</button>'
            : "") +
        '</div>' +
      '</div>';
    }).join("");

    return `<div style="margin-bottom:14px;">` +
      `<div style="font-weight:800;font-size:13.5px;margin:8px 0;display:flex;align-items:center;gap:6px;">📍 ${esc(reg)} <span class="badge">${list.length}</span></div>` +
      cardsHtml +
      `</div>`;
  }).join("");
}

export async function addSite(): Promise<void> {
  const name = val("siteName").trim();
  if (!name) { toast("Enter a site name"); return; }

  const editingId = runtime.editingSiteId ? String(runtime.editingSiteId) : null;
  const submitBtn = $("submitAddSiteBtn") as HTMLButtonElement | null;
  const pinStatusEl = $("addSitePinStatus");
  if (submitBtn?.disabled) return;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = editingId ? "Saving changes…" : "Locating & Saving…";
  }

  try {
    let address = val("siteAddress").trim() || null;
    let region = val("siteRegion");
    let city = val("siteCity").trim() || null;
    const status = val("siteStatus") || "Operational";
    const rawLat = val("siteLat").trim();
    const rawLng = val("siteLng").trim();
    const parsedLat = rawLat ? Number(rawLat) : null;
    const parsedLng = rawLng ? Number(rawLng) : null;
    let latitude = parsedLat !== null && Number.isFinite(parsedLat) ? parsedLat : null;
    let longitude = parsedLng !== null && Number.isFinite(parsedLng) ? parsedLng : null;
    const thumbInput = $("siteAddThumb") as HTMLInputElement | null;
    const rawThumb = thumbInput?.files?.[0] || null;
    let autoPlacesPhotoUrl = "";

    if (!address || !city || latitude === null || longitude === null) {
      if (pinStatusEl) pinStatusEl.textContent = `🔍 Auto-resolving address & map pin for "${name}"…`;
      const auto = await resolveSiteAddressAndPin({
        name,
        address,
        city,
        region,
        lat: latitude,
        lng: longitude,
      });
      if (auto) {
        if (!address && auto.address) {
          address = auto.address;
          setVal("siteAddress", auto.address);
        }
        if (!city && auto.city) {
          city = auto.city;
          setVal("siteCity", auto.city);
        }
        if (auto.region) {
          region = auto.region;
          setVal("siteRegion", auto.region);
        }
        if (latitude === null && auto.lat !== null) {
          latitude = auto.lat;
          setVal("siteLat", auto.lat.toFixed(6));
        }
        if (longitude === null && auto.lng !== null) {
          longitude = auto.lng;
          setVal("siteLng", auto.lng.toFixed(6));
        }
        if (auto.photoUrl) {
          autoPlacesPhotoUrl = auto.photoUrl;
        }
      }
    }

    let autoExternalThumbUrl = "";
    let autoSnapshotUrlFallback = "";
    if (!rawThumb) {
      const preResolvedUrl = val("siteAutoThumbUrl").trim();
      if (preResolvedUrl.startsWith("http") || preResolvedUrl.startsWith("/")) {
        autoExternalThumbUrl = preResolvedUrl;
      } else {
        const photoFound = await resolveSiteAutoPhotoUrl({
          name,
          city,
          lat: latitude,
          lng: longitude,
          placesPhotoUrl: autoPlacesPhotoUrl,
        });
        if (photoFound?.photoUrl) {
          if (photoFound.photoUrl.startsWith("http") && photoFound.source !== "osm_tile") {
            autoExternalThumbUrl = photoFound.photoUrl;
          } else {
            autoSnapshotUrlFallback = photoFound.photoUrl;
          }
        }
      }
    }

    let savedSite: any = null;
    let usedFallback = false;

    if (editingId) {
      if (!runtime.sitesExtraColsMissing) {
        const payload: Record<string, any> = { name, address, region, city, status };
        if (latitude !== null && longitude !== null) {
          payload.latitude = latitude;
          payload.longitude = longitude;
        } else {
          payload.latitude = null;
          payload.longitude = null;
        }
        if (autoExternalThumbUrl) {
          payload.thumbnail_url = autoExternalThumbUrl;
        }
        const res = await runtime.client
          .from("sites")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();
        if (!res.error) {
          savedSite = res.data;
        } else if (/status|thumbnail_url|latitude|longitude|42703|PGRST204/i.test(res.error.message || "")) {
          runtime.sitesExtraColsMissing = true;
          usedFallback = true;
        } else {
          toast("Could not update site: " + res.error.message);
          return;
        }
      } else {
        usedFallback = true;
      }
      if (usedFallback) {
        const res = await runtime.client
          .from("sites")
          .update({ name, address, region, city })
          .eq("id", editingId)
          .select()
          .single();
        if (res.error) { toast("Could not update site: " + res.error.message); return; }
        savedSite = res.data;
        await persistSiteMetaFallback(editingId, {
          status: status || "Operational",
          latitude,
          longitude,
          ...(autoExternalThumbUrl ? { thumbnail_url: autoExternalThumbUrl } : {}),
        });
      }
    } else {
      if (!runtime.sitesExtraColsMissing) {
        const payload: Record<string, any> = { name, address, region, city, status };
        if (latitude !== null && longitude !== null) {
          payload.latitude = latitude;
          payload.longitude = longitude;
        }
        if (autoExternalThumbUrl) {
          payload.thumbnail_url = autoExternalThumbUrl;
        }
        const res = await runtime.client
          .from("sites")
          .insert(payload)
          .select()
          .single();
        if (!res.error) {
          savedSite = res.data;
        } else if (/status|thumbnail_url|latitude|longitude|42703|PGRST204/i.test(res.error.message || "")) {
          runtime.sitesExtraColsMissing = true;
          usedFallback = true;
        } else {
          toast("Could not add: " + res.error.message);
          return;
        }
      } else {
        usedFallback = true;
      }

      if (usedFallback) {
        const res = await runtime.client
          .from("sites")
          .insert({ name, address, region, city })
          .select()
          .single();
        if (res.error) { toast("Could not add: " + res.error.message); return; }
        savedSite = res.data;
        if (savedSite?.id && ((status && status !== "Operational") || (latitude !== null && longitude !== null) || autoExternalThumbUrl)) {
          await persistSiteMetaFallback(String(savedSite.id), {
            status: status || "Operational",
            latitude,
            longitude,
            ...(autoExternalThumbUrl ? { thumbnail_url: autoExternalThumbUrl } : {}),
          });
        }
      }
    }

    if (savedSite?.id) {
      const sid = String(savedSite.id);
      if (rawThumb && isManager()) {
        await uploadSiteThumbnailFile(sid, rawThumb, { silent: true });
      } else if (!autoExternalThumbUrl) {
        const snapFile = await createSiteAutoSnapshotFile(name, city || region || "", latitude, longitude);
        let uploadedSnap: string | null = null;
        if (snapFile && isManager()) {
          uploadedSnap = await uploadSiteThumbnailFile(sid, snapFile, { silent: true });
        }
        if (!uploadedSnap && autoSnapshotUrlFallback) {
          if (!runtime.sitesExtraColsMissing) {
            await runtime.client.from("sites").update({ thumbnail_url: autoSnapshotUrlFallback }).eq("id", sid);
          }
          await persistSiteMetaFallback(sid, { thumbnail_url: autoSnapshotUrlFallback });
        }
      }
    }

    runtime.editingSiteId = null;
    $("addSiteOverlay")?.classList.add("hidden");
    setVal("siteName", "");
    setVal("siteAddress", "");
    setVal("siteCity", "");
    setVal("siteLat", "");
    setVal("siteLng", "");
    setVal("siteStatus", "Operational");
    setVal("siteAutoThumbUrl", "");
    if (thumbInput) thumbInput.value = "";
    resetAddSitePinPicker();
    suppressNotifications();
    await loadSites();
    toast(editingId ? "Work site updated" : (latitude !== null && longitude !== null ? "Site added with picture & map pin" : "Site added with picture"));
    if (!editingId && savedSite?.id) {
      openSiteOnMap(String(savedSite.id));
    }
    void refreshVisibleSiteDistances(getFilteredSites());
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = runtime.editingSiteId ? "Save changes" : "Add site";
    }
  }
}

export function closeSiteMapOverlay(): void {
  $("siteMapOverlay")?.classList.add("hidden");
}

export function openSiteOnMap(siteId: string): void {
  const s = state.sites.find(x => String(x.id) === String(siteId));
  if (!s) return;
  runtime.selectedSiteId = String(s.id);
  const unitsOverlayOpen = !$("siteUnitsOverlay")?.classList.contains("hidden");
  if (!unitsOverlayOpen && runtime.currentPage !== "sites") {
    go("sites", { skipScrollReset: true });
  } else if (runtime.currentPage === "sites") {
    renderSites();
  }
  $("siteMapOverlay")?.classList.remove("hidden");
  $("siteMapCard")?.classList.remove("hidden");
  const ttl = $("siteMapTitle");
  if (ttl) ttl.textContent = s.name;
  const cleanName = String(s.name || "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const query = [s.name, s.address, s.city, "Philippines"].filter(Boolean).join(", ");
  const fallbackQueries = [...new Set([
    [cleanName, s.address, s.city, "Philippines"].filter(Boolean).join(", "),
    [cleanName, s.city, "Philippines"].filter(Boolean).join(", "),
    [s.address, s.city, "Philippines"].filter(Boolean).join(", "),
    cleanName ? `${cleanName}, Philippines` : "",
    s.name ? `${s.name}, Philippines` : "",
    s.city ? `${s.city}, Philippines` : "",
  ].filter(Boolean))];
  void openSiteGoogleMap("siteGoogleMap", query, s.name, "siteMapStatus", fallbackQueries);
}

/* ==================== UNITS & MANUALS ==================== */
const AMCB_UNIT_SEED: Array<{
  unit_name: string;
  unit_type: "escalator" | "elevator";
  brand_model: string;
  capacity_floors: string;
  notes: string;
}> = [
  // SEDA SIDE (12)
  { unit_name: "Esc. No. 19 B2-B3", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "B2-B3 · DOWN", notes: "[SIDE: SEDA SIDE]" },
  { unit_name: "Esc. No. 20 B3-B2", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "B3-B2 · UP", notes: "[SIDE: SEDA SIDE]" },
  { unit_name: "Esc. No. 21 B1-B2", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "B1-B2 · DOWN", notes: "[SIDE: SEDA SIDE]" },
  { unit_name: "Esc. No. 22 B2-B1", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "B2-B1 · UP", notes: "[SIDE: SEDA SIDE]" },
  { unit_name: "Esc. No. 3 G-B1", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "G-B1 · DOWN", notes: "[SIDE: SEDA SIDE]" },
  { unit_name: "Esc. No. 4 B1-G", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "B1-G · UP", notes: "[SIDE: SEDA SIDE]" },
  { unit_name: "Esc. No. 26 2-G", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "2-G · DOWN", notes: "[SIDE: SEDA SIDE] 2 Lgt. Newel Guide Roller (Leftside), 2 Lgt. Newel Guide Roller (Rightside)" },
  { unit_name: "Esc. No. 25 G-2", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "G-2 · UP", notes: "[SIDE: SEDA SIDE]" },
  { unit_name: "Esc. No. 27 3-2", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "3-2 · DOWN", notes: "[SIDE: SEDA SIDE]" },
  { unit_name: "Esc. No. 28 2-3", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "2-3 · UP", notes: "[SIDE: SEDA SIDE]" },
  { unit_name: "Esc. No. 17 4-3", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "4-3 · DOWN", notes: "[SIDE: SEDA SIDE]" },
  { unit_name: "Esc. No. 18 3-4", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "3-4 · UP", notes: "[SIDE: SEDA SIDE]" },
  // IVILLA SIDE (15)
  { unit_name: "Esc. No. 2 B1-B2", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "B1-B2 · DOWN", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "Esc. No. 1 B2-B1", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "B2-B1 · UP", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "Esc. No. 23 (G-B1)", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "G-B1 · DOWN", notes: "[SIDE: IVILLA SIDE] 1 lgt. Rubber Handrail (Leftside), 2pcs. Newel Guide Roller (Leftside), 1 Lot. Flywheel (Leftside)" },
  { unit_name: "Esc. No. 24 B1-G", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "B1-G · UP", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "Esc. No. 6 2-G", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "2-G · DOWN", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "Esc. No. 5 G-2", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "G-2 · UP", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "Esc. No. 7 3-2", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "3-2 · DOWN", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "Esc. No. 8 2-3", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "2-3 · UP", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "Esc. No. 9 4-3", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "4-3 · DOWN", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "Esc. No. 10 3-4", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "3-4 · UP", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "Esc. No. 12 5-4", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "5-4 · DOWN", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "Esc. No. 11 4-5", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "4-5 · UP", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "PE1", unit_type: "elevator", brand_model: "Mitsubishi", capacity_floors: "Passenger Elevator", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "PE2", unit_type: "elevator", brand_model: "Mitsubishi", capacity_floors: "Passenger Elevator", notes: "[SIDE: IVILLA SIDE]" },
  { unit_name: "PE3", unit_type: "elevator", brand_model: "Mitsubishi", capacity_floors: "Passenger Elevator", notes: "[SIDE: IVILLA SIDE]" },
  // PADRIGA SIDE (7)
  { unit_name: "Esc. No. 14 2-G", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "2-G · DOWN", notes: "[SIDE: PADRIGA SIDE]" },
  { unit_name: "Esc. No. 13 G-2", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "G-2 · UP", notes: "[SIDE: PADRIGA SIDE]" },
  { unit_name: "Esc. No. 30 3-2", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "3-2 · DOWN", notes: "[SIDE: PADRIGA SIDE]" },
  { unit_name: "Esc. No. 29 2-3", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "2-3 · UP", notes: "[SIDE: PADRIGA SIDE]" },
  { unit_name: "Esc. No. 16 4-3", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "4-3 · DOWN", notes: "[SIDE: PADRIGA SIDE]" },
  { unit_name: "Esc. No. 15 3-4", unit_type: "escalator", brand_model: "Mitsubishi", capacity_floors: "3-4 · UP", notes: "[SIDE: PADRIGA SIDE]" },
  { unit_name: "CARGO", unit_type: "elevator", brand_model: "Mitsubishi", capacity_floors: "Cargo / Service Elevator", notes: "[SIDE: PADRIGA SIDE]" },
];

export async function ensureAmcbUnitsSeeded(): Promise<void> {
  if (runtime.amcbSeedAttempted || !state.userId || !runtime.client || !navigator.onLine) return;
  runtime.amcbSeedAttempted = true;
  try {
    let amcbSite = state.sites.find(s =>
      /ayala\s*malls?\s*central\s*bloc|\bamcb\b/i.test(String(s.name || ""))
    );
    if (!amcbSite) {
      const { data: insertedSite, error: siteErr } = await runtime.client
        .from("sites")
        .insert({
          name: "Ayala Malls Central Bloc (AMCB)",
          address: "Cebu IT Park, Apas",
          city: "Cebu City",
          region: "Visayas",
        })
        .select("*")
        .maybeSingle();
      if (siteErr) return;
      amcbSite = insertedSite;
      if (amcbSite) await loadSites();
    }
    if (!amcbSite) return;

    const existingForAmcb = state.units.filter(u => String(u.site_id) === String(amcbSite.id));
    const existingNames = new Set(
      existingForAmcb.map(u => String(u.unit_name || "").trim().toLowerCase())
    );
    const missing = AMCB_UNIT_SEED.filter(
      seed => !existingNames.has(seed.unit_name.trim().toLowerCase())
    );
    if (!missing.length) return;

    const rows = missing.map(m => ({
      site_id: amcbSite.id,
      unit_name: m.unit_name,
      unit_type: m.unit_type,
      status: "Operational",
      brand_model: m.brand_model,
      capacity_floors: m.capacity_floors,
      notes: m.notes,
      created_by: state.userId,
    }));
    const { error } = await runtime.client.from("site_units").insert(rows);
    if (!error) {
      suppressNotifications();
      await loadUnits();
    }
  } catch {}
}

function parseFloorTokenLevel(rawTok: string): number {
  const t = String(rawTok || "").trim().toUpperCase();
  if (!t) return 999;
  const bMatch = t.match(/^B(\d+)$/);
  if (bMatch) return -Number(bMatch[1]);
  if (t === "G" || t === "GF" || t === "GROUND") return 0;
  if (t === "M" || t === "MZ" || t === "MEZZ") return 0.5;
  const lMatch = t.match(/^(?:L|F)?(\d+)(?:F)?$/);
  if (lMatch) return Number(lMatch[1]);
  return 999;
}

function formatFloorBadge(lvl: number, raw: string): string {
  if (lvl < 0) return `B${Math.abs(lvl)}`;
  if (lvl === 0) return "G";
  if (lvl === 0.5) return "MZ";
  if (lvl < 100 && Number.isInteger(lvl)) return lvl === 1 ? "1F" : `${lvl}F`;
  return String(raw || "").trim().toUpperCase();
}

function extractUnitTaxonomy(u: any): {
  side: string;
  floorLabel: string;
  floorRank: number;
  direction: "UP" | "DOWN" | "ELEVATOR";
  directionRank: number;
  cleanNotes: string;
} {
  const manualMeta = parseUnitManualMeta(u.notes);
  const sideMeta = parseUnitSideTag(manualMeta.cleanNotes);
  let side = sideMeta.side;
  const combined = [u.unit_name, u.capacity_floors, sideMeta.cleanNotes].filter(Boolean).join(" ");
  if (!side) {
    const inlineSide = combined.match(/\b([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)?\s+SIDE)\b/i);
    if (inlineSide) side = inlineSide[1].trim().toUpperCase();
  }
  side = side || "GENERAL SIDE";

  // Extract floor transition pair (e.g. B2-B3, G-B1, 2-G, 3-4)
  const pairMatch = combined.match(/\b(B\d+|GF|G|MZ|M|L?\d+F?)\s*[-–/]\s*(B\d+|GF|G|MZ|M|L?\d+F?)\b/i);
  let floorLabel = "General Floor";
  let floorRank = 500;
  let inferredDir: "UP" | "DOWN" | null = null;

  if (pairMatch) {
    const aLvl = parseFloorTokenLevel(pairMatch[1]);
    const bLvl = parseFloorTokenLevel(pairMatch[2]);
    if (aLvl < 999 && bLvl < 999) {
      const lowLvl = Math.min(aLvl, bLvl);
      const highLvl = Math.max(aLvl, bLvl);
      const lowName = formatFloorBadge(lowLvl, aLvl <= bLvl ? pairMatch[1] : pairMatch[2]);
      const highName = formatFloorBadge(highLvl, bLvl >= aLvl ? pairMatch[2] : pairMatch[1]);
      floorLabel = lowLvl === highLvl ? lowName : `${lowName} ↔ ${highName}`;
      floorRank = lowLvl * 10 + highLvl;
      if (bLvl > aLvl) inferredDir = "UP";
      else if (bLvl < aLvl) inferredDir = "DOWN";
    }
  } else if (u.unit_type === "elevator") {
    floorLabel = /cargo|service/i.test(combined) ? "Cargo / Service Elevators" : "Passenger Elevators";
    floorRank = 700;
  } else if (u.capacity_floors) {
    floorLabel = String(u.capacity_floors).replace(/\s*·\s*(UP|DOWN)\b/gi, "").trim() || "General Floor";
  }

  let direction: "UP" | "DOWN" | "ELEVATOR" = "ELEVATOR";
  if (/\bUP\b/i.test(combined)) direction = "UP";
  else if (/\bDOWN\b/i.test(combined)) direction = "DOWN";
  else if (inferredDir) direction = inferredDir;
  else if (u.unit_type !== "elevator") direction = "UP";

  const directionRank = direction === "UP" ? 1 : direction === "DOWN" ? 2 : 3;
  return {
    side,
    floorLabel,
    floorRank,
    direction,
    directionRank,
    cleanNotes: sideMeta.cleanNotes,
  };
}

function buildSiteUnitsHtml(site: any, siteUnits: any[]): string {
  if (!siteUnits.length) {
    return '<p class="muted" style="margin:8px 0 0;">No units added for this site yet.</p>';
  }

  const sideOrder = ["SEDA SIDE", "IVILLA SIDE", "PADRIGA SIDE"];
  const bySide: Record<string, Array<{ unit: any; tax: ReturnType<typeof extractUnitTaxonomy> }>> = {};

  siteUnits.forEach(u => {
    const tax = extractUnitTaxonomy(u);
    (bySide[tax.side] = bySide[tax.side] || []).push({ unit: u, tax });
  });

  const orderedSides = [
    ...sideOrder.filter(k => bySide[k]?.length),
    ...Object.keys(bySide).filter(k => !sideOrder.includes(k)).sort(),
  ];

  return orderedSides.map(sideName => {
    const sideItems = bySide[sideName];
    const byFloor = new Map<string, { rank: number; items: Array<{ unit: any; tax: ReturnType<typeof extractUnitTaxonomy> }> }>();

    sideItems.forEach(entry => {
      const fKey = entry.tax.floorLabel;
      let fg = byFloor.get(fKey);
      if (!fg) {
        fg = { rank: entry.tax.floorRank, items: [] };
        byFloor.set(fKey, fg);
      }
      fg.items.push(entry);
    });

    const orderedFloors = [...byFloor.entries()].sort((a, b) => a[1].rank - b[1].rank || a[0].localeCompare(b[0]));

    const floorsHtml = orderedFloors.map(([floorLabel, fg]) => {
      const sortedEntries = [...fg.items].sort(
        (a, b) => a.tax.directionRank - b.tax.directionRank || String(a.unit.unit_name || "").localeCompare(String(b.unit.unit_name || ""))
      );
      const upCount = sortedEntries.filter(e => e.tax.direction === "UP").length;
      const downCount = sortedEntries.filter(e => e.tax.direction === "DOWN").length;
      const dirSummary = [
        upCount ? `⬆️ ${upCount} UP` : "",
        downCount ? `⬇️ ${downCount} DOWN` : "",
      ].filter(Boolean).join(" · ");

      return `<div style="margin:8px 0 6px;padding-left:6px;border-left:2px solid rgba(30,108,242,.35);">` +
        `<div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">` +
        `<span>🪜 Floor: ${esc(floorLabel)}</span>` +
        (dirSummary ? `<span class="badge">${esc(dirSummary)}</span>` : "") +
        `</div>` +
        sortedEntries.map(e => renderUnitCardRow(e.unit, site, e.tax)).join("") +
        `</div>`;
    }).join("");

    return `<div style="margin-top:10px;">` +
      `<div class="person-group-title" style="margin-top:0;">📐 ${esc(sideName)} (${sideItems.length})</div>` +
      floorsHtml +
      `</div>`;
  }).join("");
}

export function openSiteUnitsOverlay(siteId: string): void {
  const site = state.sites.find(s => String(s.id) === String(siteId));
  if (!site) return;
  runtime.selectedUnitsSiteId = String(site.id);
  const siteUnits = state.units.filter(u => String(u.site_id) === String(site.id));
  const loc = [site.address, site.city, site.region].filter(Boolean).join(" · ");
  const siteReportsCount = state.reports.filter(r => String(r.site_id) === String(site.id)).length;
  const sitePmsCount = state.pmsRecords.filter(r => String(r.site_id) === String(site.id)).length;

  const ttl = $("siteUnitsOverlayTitle");
  if (ttl) ttl.textContent = `🛗 ${site.name} (${siteUnits.length})`;
  const meta = $("siteUnitsOverlayMeta");
  if (meta) {
    meta.textContent = `📍 ${loc || site.name} · ${siteReportsCount} report(s) · ${sitePmsCount} PMS`;
  }
  const mapBtn = $("siteUnitsOverlayMapBtn") as HTMLButtonElement | null;
  if (mapBtn) mapBtn.onclick = () => openSiteOnMap(String(site.id));
  const addBtn = $("siteUnitsOverlayAddBtn") as HTMLButtonElement | null;
  if (addBtn) addBtn.onclick = () => openAddUnitForSite(String(site.id));
  const body = $("siteUnitsOverlayBody");
  if (body) body.innerHTML = buildSiteUnitsHtml(site, siteUnits);

  $("siteUnitsOverlay")?.classList.remove("hidden");
}

export function closeSiteUnitsOverlay(): void {
  $("siteUnitsOverlay")?.classList.add("hidden");
  runtime.selectedUnitsSiteId = null;
}

export function toggleUnitSiteCard(siteId: string): void {
  openSiteUnitsOverlay(siteId);
}

export function switchUnitsTab(_tab: "list" | "manual"): void {
  runtime.unitsTab = "list";
  renderUnits();
}

function renderUnitManualOverlayBody(u: any): void {
  const site = state.sites.find(s => String(s.id) === String(u.site_id));
  const meta = parseUnitManualMeta(u.notes);
  const sideInfo = parseUnitSideTag(meta.cleanNotes);
  const std = UNIT_MANUAL_DEFAULTS[u.unit_type] || UNIT_MANUAL_DEFAULTS.elevator;
  const canEditManual = isManager() || String(u.created_by) === String(state.userId);
  const fileUrl = safeUrl(meta.manualUrl);

  const ttl = $("unitManualOverlayTitle");
  if (ttl) ttl.textContent = `📖 ${u.unit_name} — Manual`;

  const metaEl = $("unitManualOverlayMeta");
  if (metaEl) {
    metaEl.textContent =
      "📍 " +
      [
        site?.name,
        site?.address || site?.name,
        site?.city,
        site?.region,
        u.unit_type,
        u.brand_model,
        u.capacity_floors,
      ]
        .filter(Boolean)
        .join(" · ");
  }

  const statusEl = $("unitManualOverlayStatus");
  if (statusEl) {
    statusEl.textContent = u.status || "Operational";
    statusEl.style.background =
      u.status === "Needs Repair" || u.status === "Shutdown" ? "var(--red)" : "";
    statusEl.style.color =
      u.status === "Needs Repair" || u.status === "Shutdown" ? "#fff" : "";
  }

  const bodyEl = $("unitManualOverlayBody");
  if (!bodyEl) return;
  bodyEl.innerHTML =
    (sideInfo.side || sideInfo.cleanNotes
      ? `<div class="muted" style="margin-bottom:8px;">${sideInfo.side ? `<b>${esc(sideInfo.side)}</b>` : ""}${sideInfo.side && sideInfo.cleanNotes ? " · " : ""}${esc(sideInfo.cleanNotes)}</div>`
      : "") +
    (fileUrl
      ? '<div class="item" style="margin-top:8px;"><b>📎 Attached Unit Manual Document</b><div class="inline-actions"><a class="btn small-btn" href="' +
        esc(fileUrl) +
        '" target="_blank" rel="noopener" style="text-decoration:none;">Open Manual File ↗</a></div></div>'
      : "") +
    (meta.manualText
      ? '<div class="item" style="margin-top:8px;border-left:3px solid var(--cyan);"><b>📝 Site-Specific Manual / Wiring / Controller Notes</b><div style="white-space:pre-wrap;margin-top:6px;line-height:1.5;">' +
        esc(meta.manualText) +
        "</div></div>"
      : "") +
    `<div style="margin-top:10px;"><h3 style="margin:0 0 8px;">${esc(std.title)}</h3>` +
    std.sections
      .map(
        sec =>
          `<div class="item"><b>${esc(sec.heading)}</b><ul style="margin:6px 0 0;padding-left:18px;line-height:1.5;">` +
          sec.steps.map(st => `<li>${esc(st)}</li>`).join("") +
          "</ul></div>"
      )
      .join("") +
    "</div>" +
    (canEditManual
      ? '<div class="card" style="margin-top:12px;background:rgba(0,0,0,0.2);">' +
        '<h3 style="margin:0 0 8px;">Update Custom Unit Manual</h3>' +
        '<div class="field"><label for="manualUrlInput_' + esc(u.id) + '">Manual File / PDF URL</label><input id="manualUrlInput_' + esc(u.id) + '" value="' + esc(meta.manualUrl) + '" placeholder="https://… or upload below"></div>' +
        '<div class="field"><label for="manualCustomText_' + esc(u.id) + '">Unit-Specific Instructions / Fault Codes / Notes</label><textarea id="manualCustomText_' + esc(u.id) + '" rows="3" placeholder="Enter controller fault codes, key switches, emergency rescue steps…">' + esc(meta.manualText) + "</textarea></div>" +
        '<div class="inline-actions">' +
        '<button class="btn small-btn" type="button" onclick="saveUnitManual(\'' + esc(u.id) + '\')">💾 Save Manual</button>' +
        '<button class="gray small-btn" type="button" onclick="triggerUnitManualUpload(\'' + esc(u.id) + '\')">📎 Upload PDF / Photo Manual</button>' +
        "</div></div>"
      : "");
}

export function openUnitManual(unitId: string): void {
  const u = state.units.find(x => String(x.id) === String(unitId));
  if (!u) return;
  runtime.manualUnitId = String(u.id);
  renderUnitManualOverlayBody(u);
  $("unitManualOverlay")?.classList.remove("hidden");
}

export function closeUnitManualOverlay(): void {
  $("unitManualOverlay")?.classList.add("hidden");
  runtime.manualUnitId = null;
}

export async function saveUnitManual(unitId: string): Promise<void> {
  if (!checkNetwork()) return;
  const u = state.units.find(x => String(x.id) === String(unitId));
  if (!u) return;
  const meta = parseUnitManualMeta(u.notes);
  const manualText = val("manualCustomText_" + unitId).trim();
  const manualUrl = val("manualUrlInput_" + unitId).trim() || meta.manualUrl;
  const nextNotes = buildUnitNotesWithManual(meta.cleanNotes, manualUrl, manualText);
  const { error } = await runtime.client.from("site_units").update({ notes: nextNotes || null }).eq("id", unitId);
  if (error) { toast("Failed to save manual: " + error.message); return; }
  suppressNotifications();
  await loadUnits();
  const updated = state.units.find(x => String(x.id) === String(unitId));
  if (updated && !$("unitManualOverlay")?.classList.contains("hidden")) {
    renderUnitManualOverlayBody(updated);
  }
  toast("Unit manual updated");
}

let pendingManualUploadUnitId: string | null = null;
export function triggerUnitManualUpload(unitId: string): void {
  pendingManualUploadUnitId = unitId;
  $("unitManualFile")?.click();
}

export function openUnitReport(siteId: string, unitName: string, unitId = ""): void {
  closeSiteUnitsOverlay();
  state.reportType = "service";
  runtime.reportsViewMode = "list";
  document.querySelectorAll<HTMLElement>("#reportTypeTabs .tab").forEach(x => x.classList.toggle("active", x.dataset.reportType === "service"));
  $("reportContent")?.classList.remove("hidden");
  $("pmsReportContent")?.classList.add("hidden");
  $("pmsChecklistPanel")?.classList.add("hidden");
  $("searchView")?.classList.add("hidden");
  renderReportSites();
  setVal("reportSite", siteId);
  renderReportUnits();
  if (unitId) setVal("reportUnit", unitId);
  if (!val("reportDate")) setVal("reportDate", new Date().toISOString().slice(0, 10));
  if (unitName) setVal("reportTitle", unitName + " — ");
  go("reports");
  if (!isAdmin()) {
    $("reportFormCard")?.classList.remove("hidden");
    $("reportFormCard")?.scrollIntoView({ behavior: "smooth" });
  }
}

export function openUnitPms(siteId: string, region: string, unitType: string, unitId = ""): void {
  closeSiteUnitsOverlay();
  if (isManager()) {
    runtime.reportsViewMode = "pms-records";
    $("pmsRecordsTab")?.click();
    setTimeout(() => {
      if ($("pmsRecordsSite")) { setVal("pmsRecordsSite", siteId); renderPmsRecords(); }
    }, 80);
    go("reports");
    return;
  }
  state.reportType = "checklist";
  runtime.reportsViewMode = "checklist";
  document.querySelectorAll<HTMLElement>("#reportTypeTabs .tab").forEach(x => x.classList.toggle("active", x.dataset.reportType === "checklist"));
  $("reportContent")?.classList.add("hidden");
  $("searchView")?.classList.add("hidden");
  $("pmsReportContent")?.classList.remove("hidden");
  $("pmsRecordsView")?.classList.add("hidden");
  $("pmsChecklistView")?.classList.remove("hidden");
  runtime.pmsRegion = region || "Luzon";
  runtime.pmsUnit = (unitType === "escalator" || unitType === "moving-walkway") ? "escalator" : "elevator";
  runtime.pmsSiteId = siteId;
  document.querySelectorAll<HTMLElement>("[data-pms-region]").forEach(x => x.classList.toggle("active", x.dataset.pmsRegion === runtime.pmsRegion));
  document.querySelectorAll<HTMLElement>("[data-pms-unit]").forEach(x => x.classList.toggle("active", x.dataset.pmsUnit === runtime.pmsUnit));
  go("reports");
  openPmsChecklist(unitId);
}

export function renderUnitSiteOptions(): void {
  const sel = $("unitSite") as HTMLSelectElement | null;
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML =
    '<option value="">Select a work site</option>' +
    state.sites
      .map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + (s.region ? " (" + esc(s.region) + ")" : "") + "</option>")
      .join("");
  if (state.sites.some(s => String(s.id) === cur)) sel.value = cur;
}

export function openAddUnitForSite(siteId = ""): void {
  if (runtime.currentPage !== "units") {
    go("units", { skipScrollReset: true });
  }
  runtime.editingUnitId = null;
  const ttl = $("unitFormTitle");
  if (ttl) ttl.textContent = "➕ Add unit";
  renderUnitSiteOptions();
  if (siteId) {
    setVal("unitSite", siteId);
  } else {
    const firstInRegion = runtime.unitsRegion === "ALL"
      ? state.sites[0]
      : state.sites.find(s => s.region === runtime.unitsRegion);
    if (firstInRegion) setVal("unitSite", String(firstInRegion.id));
  }
  setVal("unitName", "");
  setVal("unitType", "elevator");
  setVal("unitStatus", "Operational");
  setVal("unitBrand", "");
  setVal("unitSerial", "");
  setVal("unitCapacity", "");
  setVal("unitNotes", "");
  $("unitFormOverlay")?.classList.remove("hidden");
  setTimeout(() => ($("unitName") as HTMLInputElement | null)?.focus(), 40);
}

export function editUnit(unitId: string): void {
  const u = state.units.find(x => String(x.id) === String(unitId));
  if (!u) return;
  runtime.editingUnitId = String(u.id);
  const ttl = $("unitFormTitle");
  if (ttl) ttl.textContent = "✏️ Edit unit";
  renderUnitSiteOptions();
  setVal("unitSite", String(u.site_id || ""));
  setVal("unitName", u.unit_name || "");
  setVal("unitType", u.unit_type || "elevator");
  setVal("unitStatus", u.status || "Operational");
  setVal("unitBrand", u.brand_model || "");
  setVal("unitSerial", u.serial_no || "");
  setVal("unitCapacity", u.capacity_floors || "");
  setVal("unitNotes", parseUnitManualMeta(u.notes).cleanNotes || "");
  $("unitFormOverlay")?.classList.remove("hidden");
  setTimeout(() => ($("unitName") as HTMLInputElement | null)?.focus(), 40);
}

export function cancelUnitForm(): void {
  runtime.editingUnitId = null;
  const ttl = $("unitFormTitle");
  if (ttl) ttl.textContent = "➕ Add unit";
  setVal("unitName", "");
  setVal("unitBrand", "");
  setVal("unitSerial", "");
  setVal("unitCapacity", "");
  setVal("unitNotes", "");
  $("unitFormOverlay")?.classList.add("hidden");
}

export async function saveUnit(): Promise<void> {
  if (!checkNetwork()) return;
  const siteId = val("unitSite").trim();
  const unitName = val("unitName").trim();
  if (!siteId || !unitName) { toast("Select a work site and enter a unit name"); return; }
  const cleanNotes = val("unitNotes").trim();
  const existing = runtime.editingUnitId
    ? state.units.find(x => String(x.id) === String(runtime.editingUnitId))
    : null;
  const prevMeta = existing ? parseUnitManualMeta(existing.notes) : { manualUrl: "", manualText: "" };
  const notesWithManual = buildUnitNotesWithManual(cleanNotes, prevMeta.manualUrl, prevMeta.manualText);
  const payload: any = {
    site_id: siteId,
    unit_name: unitName,
    unit_type: val("unitType") || "elevator",
    status: val("unitStatus") || "Operational",
    brand_model: val("unitBrand").trim() || null,
    serial_no: val("unitSerial").trim() || null,
    capacity_floors: val("unitCapacity").trim() || null,
    notes: notesWithManual || null,
  };
  let error: any = null;
  if (runtime.editingUnitId) {
    ({ error } = await runtime.client.from("site_units").update(payload).eq("id", runtime.editingUnitId));
  } else {
    payload.created_by = state.userId;
    ({ error } = await runtime.client.from("site_units").insert(payload));
  }
  if (error) { toast("Failed to save unit: " + error.message); return; }
  runtime.expandedUnitSiteIds[String(siteId)] = true;
  suppressNotifications();
  cancelUnitForm();
  await loadUnits();
  toast(existing ? "Unit updated" : "Unit added");
}

export async function deleteUnit(unitId: string): Promise<void> {
  if (!checkNetwork()) return;
  const u = state.units.find(x => String(x.id) === String(unitId));
  const site = u ? state.sites.find(s => String(s.id) === String(u.site_id)) : null;
  const unitLabel = u?.unit_name ? `"${u.unit_name}"` : "this unit";
  const siteSuffix = site?.name ? ` from ${site.name}` : "";
  if (!(await confirmDialog(`Are you sure you want to delete ${unitLabel}${siteSuffix}? This action cannot be undone.`, "Confirm Delete Unit"))) return;
  const { error } = await runtime.client.from("site_units").delete().eq("id", unitId);
  if (error) { toast("Failed to delete unit: " + error.message); return; }
  suppressNotifications();
  await loadUnits();
  toast("Unit deleted");
}

function renderUnitCardRow(u: any, site: any, taxOpt?: ReturnType<typeof extractUnitTaxonomy>): string {
  const canManage = isManager() || String(u.created_by) === String(state.userId);
  const statusBadge = u.status === "Operational" ? "now" : (u.status === "Needs Repair" || u.status === "Shutdown" ? "" : "soon");
  const badgeStyle = (u.status === "Needs Repair" || u.status === "Shutdown") ? ' style="background:var(--red);color:#fff;"' : "";
  const tax = taxOpt || extractUnitTaxonomy(u);
  const dirBadge = tax.direction === "UP"
    ? '<span class="badge" style="background:rgba(16,185,129,.18);color:#10b981;font-weight:700;">⬆️ UP</span>'
    : (tax.direction === "DOWN"
        ? '<span class="badge" style="background:rgba(245,166,35,.18);color:#f59e0b;font-weight:700;">⬇️ DOWN</span>'
        : '<span class="badge">🛗 ELEVATOR</span>');
  const specs = [u.unit_type, u.brand_model, u.serial_no ? "S/N: " + u.serial_no : "", tax.floorLabel].filter(Boolean).join(" · ");
  return '<div class="item" style="margin-top:6px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">' +
    '<div><b>🛗 ' + esc(u.unit_name) + '</b> ' + dirBadge + ' <span class="sess-badge ' + statusBadge + '"' + badgeStyle + ">" + esc(u.status || "Operational") + "</span></div>" +
    '<span class="muted" style="font-size:12px;">📍 ' + esc(site.name + (site.city ? " · " + site.city : "")) + "</span></div>" +
    '<div class="muted">' + esc(specs) + "</div>" +
    (tax.cleanNotes ? '<div style="margin-top:4px;font-size:12px;">' + esc(tax.cleanNotes) + "</div>" : "") +
    '<div class="inline-actions">' +
    '<button class="btn small-btn" type="button" onclick="openUnitManual(\'' + esc(u.id) + '\')">📖 Manual</button>' +
    '<button class="gray small-btn" type="button" onclick="openUnitPms(\'' + esc(site.id) + "','" + esc(site.region) + "','" + esc(u.unit_type) + "','" + esc(u.id) + '\')">✅ PMS</button>' +
    '<button class="gray small-btn" type="button" onclick="openUnitReport(\'' + esc(site.id) + "','" + esc(u.unit_name) + "','" + esc(u.id) + '\')">📄 Report</button>' +
    (canManage ? '<button class="gray small-btn" type="button" onclick="editUnit(\'' + esc(u.id) + '\')">Edit</button><button class="red small-btn" type="button" onclick="deleteUnit(\'' + esc(u.id) + '\')">Delete</button>' : "") +
    "</div></div>";
}

function syncUnitsTaxonomyFilterOptions(regionSites: any[]): void {
  const locSel = $("unitsLocationFilter") as HTMLSelectElement | null;
  const sideSel = $("unitsSideFilter") as HTMLSelectElement | null;
  const floorSel = $("unitsFloorFilter") as HTMLSelectElement | null;
  const dirSel = $("unitsDirFilter") as HTMLSelectElement | null;
  const resetBtn = $("unitsResetFiltersBtn");
  const expandBtn = $("unitsShowAllBtn");

  const regionSiteIds = new Set(regionSites.map(s => String(s.id)));
  const regionUnits = state.units.filter(u => regionSiteIds.has(String(u.site_id)));

  if (locSel) {
    const prev = runtime.unitsLocationFilter || "ALL";
    locSel.innerHTML = '<option value="ALL">All Locations &amp; Sites</option>' +
      regionSites
        .map(s => `<option value="${esc(s.id)}">${esc(s.name)}${s.city ? " · " + esc(s.city) : ""}</option>`)
        .join("");
    locSel.value = (prev === "ALL" || regionSites.some(s => String(s.id) === prev)) ? prev : "ALL";
    runtime.unitsLocationFilter = locSel.value;
  }

  const scopedUnits = runtime.unitsLocationFilter !== "ALL"
    ? regionUnits.filter(u => String(u.site_id) === String(runtime.unitsLocationFilter))
    : regionUnits;
  const taxList = scopedUnits.map(u => extractUnitTaxonomy(u));

  if (sideSel) {
    const prev = runtime.unitsSideFilter || "ALL";
    const sideOrder = ["SEDA SIDE", "IVILLA SIDE", "PADRIGA SIDE"];
    const uniqueSides = [...new Set(taxList.map(t => t.side))];
    const sortedSides = [
      ...sideOrder.filter(s => uniqueSides.includes(s)),
      ...uniqueSides.filter(s => !sideOrder.includes(s)).sort(),
    ];
    sideSel.innerHTML = '<option value="ALL">All Sides</option>' +
      sortedSides.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    sideSel.value = (prev === "ALL" || sortedSides.includes(prev)) ? prev : "ALL";
    runtime.unitsSideFilter = sideSel.value;
  }

  if (floorSel) {
    const prev = runtime.unitsFloorFilter || "ALL";
    const floorMap = new Map<string, number>();
    taxList.forEach(t => {
      if (!floorMap.has(t.floorLabel)) floorMap.set(t.floorLabel, t.floorRank);
    });
    const sortedFloors = [...floorMap.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([lbl]) => lbl);
    floorSel.innerHTML = '<option value="ALL">All Floors</option>' +
      sortedFloors.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join("");
    floorSel.value = (prev === "ALL" || sortedFloors.includes(prev)) ? prev : "ALL";
    runtime.unitsFloorFilter = floorSel.value;
  }

  if (dirSel) dirSel.value = runtime.unitsDirFilter || "ALL";

  const hasFilters =
    runtime.unitsLocationFilter !== "ALL" ||
    runtime.unitsSideFilter !== "ALL" ||
    runtime.unitsFloorFilter !== "ALL" ||
    runtime.unitsDirFilter !== "ALL";
  resetBtn?.classList.toggle("hidden", !hasFilters);
  if (expandBtn) {
    expandBtn.textContent = runtime.unitsShowAllInline
      ? "📂 Collapse Site Cards"
      : "📋 Expand All Units Inline";
  }
}

export function renderUnits(): void {
  const box = $("unitsList");
  if (!box) return;

  const regFilter = runtime.unitsRegion || "ALL";
  const baseRegions = ["Luzon", "Visayas", "Mindanao"];
  const extraRegions = [...new Set(state.sites.map(s => String(s.region || "").trim()).filter(r => r && !baseRegions.includes(r)))].sort();
  const targetRegions = regFilter === "ALL" ? [...baseRegions, ...extraRegions] : [regFilter];
  const allTargetSites = state.sites.filter(s => targetRegions.includes(String(s.region || "Unassigned")));

  syncUnitsTaxonomyFilterOptions(allTargetSites);

  const locFilter = runtime.unitsLocationFilter || "ALL";
  const sideFilter = runtime.unitsSideFilter || "ALL";
  const floorFilter = runtime.unitsFloorFilter || "ALL";
  const dirFilter = runtime.unitsDirFilter || "ALL";
  const hasDetailFilter = sideFilter !== "ALL" || floorFilter !== "ALL" || dirFilter !== "ALL";
  const showInlineUnits = runtime.unitsShowAllInline || hasDetailFilter || locFilter !== "ALL";

  const html = targetRegions.map(region => {
    const regionSites = state.sites
      .filter(s => String(s.region || "Unassigned") === region)
      .filter(s => locFilter === "ALL" || String(s.id) === String(locFilter))
      .sort((a, b) => String(a.city || a.address || a.name || "").localeCompare(String(b.city || b.address || b.name || "")) || String(a.name || "").localeCompare(String(b.name || "")));
    if (!regionSites.length) return "";

    const byArea: Record<string, any[]> = {};
    regionSites.forEach(s => {
      const area = String(s.city || s.address || "General Area").trim();
      (byArea[area] = byArea[area] || []).push(s);
    });

    const areasHtml = Object.keys(byArea).sort().map(area => {
      const sitesHtml = byArea[area].map(site => {
        const rawSiteUnits = state.units.filter(u => String(u.site_id) === String(site.id));
        const filteredSiteUnits = rawSiteUnits.filter(u => {
          const tax = extractUnitTaxonomy(u);
          if (sideFilter !== "ALL" && tax.side !== sideFilter) return false;
          if (floorFilter !== "ALL" && tax.floorLabel !== floorFilter) return false;
          if (dirFilter !== "ALL" && tax.direction !== dirFilter) return false;
          return true;
        });

        if (hasDetailFilter && !filteredSiteUnits.length) return "";

        const loc = [site.address, site.city, site.region].filter(Boolean).join(" · ");
        const siteReportsCount = state.reports.filter(r => String(r.site_id) === String(site.id)).length;
        const sitePmsCount = state.pmsRecords.filter(r => String(r.site_id) === String(site.id)).length;
        const upCount = filteredSiteUnits.filter(u => extractUnitTaxonomy(u).direction === "UP").length;
        const downCount = filteredSiteUnits.filter(u => extractUnitTaxonomy(u).direction === "DOWN").length;
        const elevCount = filteredSiteUnits.filter(u => extractUnitTaxonomy(u).direction === "ELEVATOR").length;
        const countsLine = [
          `${filteredSiteUnits.length} unit${filteredSiteUnits.length === 1 ? "" : "s"}`,
          upCount ? `⬆️ ${upCount} UP` : "",
          downCount ? `⬇️ ${downCount} DOWN` : "",
          elevCount ? `🛗 ${elevCount} Elev` : "",
        ].filter(Boolean).join(" · ");

        return '<div class="card" style="margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
          '<div class="clickable" style="flex:1;min-width:0;" onclick="toggleUnitSiteCard(\'' + esc(site.id) + '\')">' +
          '<h2 style="margin:0 0 4px;font-size:16px;">▸ ' + esc(site.name) +
          ' <span class="badge">' + esc(countsLine) + "</span></h2>" +
          '<div class="muted">📍 ' + esc(loc) + ' · ' + siteReportsCount + ' report(s) · ' + sitePmsCount + ' PMS</div>' +
          '<div class="muted" style="font-size:11px;margin-top:2px;">Tap site to open popup · Organized by Side → Floor → UP / DOWN</div>' +
          "</div>" +
          '<button class="gray small-btn" type="button" onclick="openSiteOnMap(\'' + esc(site.id) + '\')">📍 Map</button>' +
          "</div>" +
          (showInlineUnits ? `<div style="margin-top:8px;">${buildSiteUnitsHtml(site, filteredSiteUnits)}</div>` : "") +
          "</div>";
      }).filter(Boolean).join("");

      if (!sitesHtml) return "";
      return `<div class="person-group-title">📍 Location: ${esc(area)}</div>${sitesHtml}`;
    }).filter(Boolean).join("");

    if (!areasHtml) return "";
    return `<div style="margin-bottom:16px;"><h2 style="margin:8px 0 6px;color:var(--cyan);">🗺️ ${esc(region)}</h2>${areasHtml}</div>`;
  }).filter(Boolean).join("");

  box.innerHTML = html || '<p class="muted">No matching units found for the selected Region / Location / Side / Floor / Direction.</p>';
  if (!$("siteUnitsOverlay")?.classList.contains("hidden") && runtime.selectedUnitsSiteId) {
    openSiteUnitsOverlay(runtime.selectedUnitsSiteId);
  }
}

/* ==================== REPORTS, PMS & SEARCH ==================== */
export function renderReportUnits(): void {
  const uSel = $("reportUnit") as HTMLSelectElement | null;
  if (!uSel) return;
  const siteId = val("reportSite");
  const cur = uSel.value;
  const list = siteId ? state.units.filter(u => String(u.site_id) === String(siteId)) : state.units;
  uSel.innerHTML =
    '<option value="">General / All Units on Site</option>' +
    list.map(u => {
      const s = state.sites.find(x => String(x.id) === String(u.site_id));
      return '<option value="' + esc(u.id) + '">' + esc(u.unit_name) + (siteId || !s ? "" : " (" + esc(s.name) + ")") + " · " + esc(u.unit_type) + "</option>";
    }).join("");
  if (list.some(u => String(u.id) === cur)) uSel.value = cur;
}

export function renderReportSites(): void {
  const opts = state.sites.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + "</option>").join("");
  const sel = $("reportSite") as HTMLSelectElement | null;
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">Select a site</option>' + opts;
    if (state.sites.some(s => String(s.id) === cur)) sel.value = cur;
  }
  renderReportUnits();
  renderSearchSiteOptions();
}

export function renderSearchSiteOptions(): void {
  const sSel = $("searchSite") as HTMLSelectElement | null;
  if (!sSel) return;
  const reg = val("searchRegion");
  const cur = sSel.value;
  const filtered = state.sites.filter(s => !reg || s.region === reg);
  sSel.innerHTML = '<option value="">All sites</option>' + filtered.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + "</option>").join("");
  if (filtered.some(s => String(s.id) === cur)) sSel.value = cur;
}

export function renderDtrSiteOptions(): void {
  const list = $("dtrSiteDatalist");
  if (list) list.innerHTML = state.sites.map(s => '<option value="' + esc(s.name) + '">').join("");
  renderDtrUnitOptions();
}

export function renderDtrUnitOptions(): void {
  const uSel = $("dtrUnit") as HTMLSelectElement | null;
  const locName = val("dtrLocation").trim().toLowerCase();
  const matchedSite = state.sites.find(s => String(s.name || "").trim().toLowerCase() === locName);
  const units = matchedSite ? state.units.filter(u => String(u.site_id) === String(matchedSite.id)) : state.units;
  if (uSel) {
    const cur = uSel.value;
    uSel.innerHTML = '<option value="">General / All Units</option>' +
      units.map(u => {
        const s = state.sites.find(x => String(x.id) === String(u.site_id));
        return '<option value="' + esc(u.unit_name) + '">' + esc(u.unit_name) + (!matchedSite && s ? " — " + esc(s.name) : "") + "</option>";
      }).join("");
    if (units.some(u => u.unit_name === cur)) uSel.value = cur;
  }
}

export function renderRecPickers(): void {
  const rSite = $("recSite") as HTMLSelectElement | null;
  if (rSite) {
    const cur = rSite.value;
    rSite.innerHTML = '<option value="">Select work site</option>' +
      state.sites.map(s => '<option value="' + esc(s.name) + '">' + esc(s.name) + (s.city ? " (" + esc(s.city) + ")" : "") + "</option>").join("");
    if (state.sites.some(s => s.name === cur)) rSite.value = cur;
  }
  const rUnit = $("recUnit") as HTMLSelectElement | null;
  if (rUnit) {
    const siteName = val("recSite").trim().toLowerCase();
    const sObj = state.sites.find(s => String(s.name || "").trim().toLowerCase() === siteName);
    const list = sObj ? state.units.filter(u => String(u.site_id) === String(sObj.id)) : state.units;
    const curU = rUnit.value;
    rUnit.innerHTML = '<option value="">General / All Units</option>' +
      list.map(u => {
        const s = state.sites.find(x => String(x.id) === String(u.site_id));
        return '<option value="' + esc(u.unit_name) + '">' + esc(u.unit_name) + (!sObj && s ? " (" + esc(s.name) + ")" : "") + "</option>";
      }).join("");
    if (list.some(u => u.unit_name === curU)) rUnit.value = curU;
  }
  const box = $("recAssignees");
  if (box) {
    const prevChecked = new Set([...box.querySelectorAll<HTMLInputElement>('input[name="recPersonnel"]:checked')].map(i => i.value));
    const list = state.profiles.filter(p => String(p.user_id) !== String(state.userId));
    box.innerHTML = list.map(p => {
      const r = state.roles[p.user_id]?.app_role || "technician";
      const checked = prevChecked.has(String(p.user_id)) ? " checked" : "";
      return '<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" name="recPersonnel" data-name="' + esc(p.full_name) + '" value="' + esc(p.user_id) + '"' + checked + ' style="width:auto">' + esc(p.full_name) + ' <span class="muted">(' + esc(roleLabel(r)) + ")</span></label>";
    }).join("") || '<p class="muted">No personnel loaded yet.</p>';
  }
}

export function renderTimeLogSitePickers(): void {
  const sSel = $("timeLogSite") as HTMLSelectElement | null;
  const uSel = $("timeLogUnit") as HTMLSelectElement | null;
  if (sSel) {
    const cur = sSel.value;
    sSel.innerHTML = '<option value="">Auto-detect or select site</option>' +
      state.sites.map(s => '<option value="' + esc(s.name) + '">' + esc(s.name) + (s.city ? " (" + esc(s.city) + ")" : "") + "</option>").join("");
    if (state.sites.some(s => s.name === cur)) sSel.value = cur;
  }
  if (uSel) {
    const sName = (sSel?.value || "").trim().toLowerCase();
    const sObj = state.sites.find(s => String(s.name || "").trim().toLowerCase() === sName);
    const units = sObj ? state.units.filter(u => String(u.site_id) === String(sObj.id)) : state.units;
    const curU = uSel.value;
    uSel.innerHTML = '<option value="">Unit (optional)</option>' +
      units.map(u => '<option value="' + esc(u.unit_name) + '">' + esc(u.unit_name) + "</option>").join("");
    if (units.some(u => u.unit_name === curU)) uSel.value = curU;
  }
}

export function renderConnectedPickers(): void {
  renderScheduleSiteOptions();
  renderReportSites();
  renderUnitSiteOptions();
  renderPmsSiteOptions();
  renderPmsChecklistUnits();
  renderDtrSiteOptions();
  renderRecPickers();
  renderTimeLogSitePickers();
  autoFillDtrFromSchedule(false);
}

function buildUrlAttachmentHtml(urls: string[]): string {
  return urls.map(safeUrl).filter((u): u is string => !!u).map(u => {
    if (isImageUrl(u)) return '<img src="' + esc(u) + '" alt="Photo" data-preview-url="' + esc(u) + '" data-preview-label="Attachment Photo">';
    const fname = decodeURIComponent((u.split("/").pop() || "File").replace(/^\d+-\d+-[a-z0-9]+-/, ""));
    return '<a class="report-att-item" href="' + esc(u) + '" target="_blank" rel="noopener" style="text-decoration:none;"><span class="report-att-file">📎 ' + esc(fname) + "</span></a>";
  }).join("");
}

function buildReportAttachmentHtml(details: string | null | undefined): string {
  return buildUrlAttachmentHtml(extractReportPhotoUrls(details));
}

export function renderReports(): void {
  if (!$("reportList")) return;
  if (state.reportType === "checklist") return;
  const type = state.reportType;
  const typeLabel = type === "service" ? "Service Reports" : "Delivery Reports";
  const rlt = $("reportListTitle");
  if (rlt) rlt.textContent = typeLabel;
  const listOnly = isAdmin();
  $("managerReportListOnly")?.classList.toggle("hidden", !listOnly);
  $("reportHeaderRow")?.classList.toggle("hidden", listOnly);
  $("reportList")?.classList.toggle("hidden", listOnly);
  if (listOnly) $("reportFormCard")?.classList.add("hidden");
  const mrl = $("managerReportListTitle");
  if (listOnly && mrl) mrl.textContent = typeLabel;

  const reports = state.reports.filter(report => report.report_type === type);
  const target = $(listOnly ? "managerReportList" : "reportList");
  if (!target) return;
  target.innerHTML = reports.map(report => {
    const site = state.sites.find(item => String(item.id) === String(report.site_id));
    const isOwner = String(report.created_by) === String(state.userId);
    const parsedUnit = parseReportUnit(report.details);
    const bodyText = stripReportPhotos(report.details);
    const photosHtml = buildReportAttachmentHtml(report.details);
    const exportBtns =
      '<button class="gray small-btn" type="button" onclick="exportData(\'reports\',{format:\'xlsx\',id:\'' + esc(report.id) + '\'})">📊 XLSX</button>' +
      '<button class="gray small-btn" type="button" onclick="exportReports(\'doc\',\'' + esc(report.id) + '\')">📝 DOC</button>';
    const ownerBtns = (isOwner && !isAdmin())
      ? '<button class="btn small-btn" type="button" data-report-edit="' + esc(report.id) + '">Edit</button><button class="red small-btn" type="button" data-report-delete="' + esc(report.id) + '">Delete</button>'
      : "";
    return '<div class="item"><b>' + esc(report.title) + '</b>' +
      (parsedUnit.unitName ? ' <span class="badge">🛗 ' + esc(parsedUnit.unitName) + "</span>" : "") +
      '<div class="muted">' + esc(typeLabel) + " · " + esc(fmtDay(report.report_date)) + " · " +
      esc(profileName(report.created_by)) + " · " + esc(site ? [site.name, site.city, site.region].filter(Boolean).join(" · ") : "Unknown site") +
      '</div><div style="white-space:pre-wrap;margin-top:6px;">' + esc(bodyText) + "</div>" +
      (photosHtml ? '<div class="media-grid" style="margin-top:8px;">' + photosHtml + "</div>" : "") +
      '<div class="inline-actions">' + exportBtns + ownerBtns + "</div></div>";
  }).join("") || '<p class="muted">No matching ' + typeLabel + ".</p>";
}

export function clearPendingReportFiles(): void {
  runtime.pendingReportFiles.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  runtime.pendingReportFiles = [];
  const rp = $("reportPhotos") as HTMLInputElement | null;
  if (rp) rp.value = "";
}

export function renderReportAttachmentPreview(): void {
  const box = $("reportPhotoPreview");
  if (!box) return;
  const existingHtml = runtime.editingExistingUrls.map((u, idx) => {
    const inner = isImageUrl(u)
      ? '<img src="' + esc(u) + '" alt="Attachment">'
      : '<span class="report-att-file">📎 ' + esc(decodeURIComponent((u.split("/").pop() || "File").replace(/^\d+-\d+-[a-z0-9]+-/, ""))) + "</span>";
    return '<div class="report-att-item">' + inner + '<button class="report-att-del" type="button" data-remove-existing-att="' + idx + '" aria-label="Remove">✕</button></div>';
  }).join("");
  const pendingHtml = runtime.pendingReportFiles.map((item, idx) => {
    const inner = item.previewUrl
      ? '<img src="' + esc(item.previewUrl) + '" alt="' + esc(item.file.name) + '">'
      : '<span class="report-att-file">📎 ' + esc(item.file.name) + "</span>";
    return '<div class="report-att-item">' + inner + '<button class="report-att-del" type="button" data-remove-pending-att="' + idx + '" aria-label="Remove">✕</button></div>';
  }).join("");
  box.innerHTML = existingHtml + pendingHtml;
}

async function submitReport(): Promise<void> {
  if (!checkNetwork()) return;
  const siteId = val("reportSite");
  const unitSel = $("reportUnit") as HTMLSelectElement | null;
  const unitId = unitSel?.value || "";
  const unitObj = state.units.find(u => String(u.id) === String(unitId));
  const unitName = unitObj?.unit_name || "";
  const date = val("reportDate");
  const title = val("reportTitle").trim();
  const details = val("reportDetails").trim();
  if (!siteId || !date || !title) { toast("Site, date and title are required"); return; }
  const btn = $("submitReportButton") as HTMLButtonElement | null;
  const statusEl = $("reportStatus");
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = "Uploading…";
  try {
    const urls = runtime.editingReportId ? [...runtime.editingExistingUrls] : [];
    for (let i = 0; i < runtime.pendingReportFiles.length; i++) {
      const f = runtime.pendingReportFiles[i].file;
      if (f.size > 25 * 1024 * 1024) throw new Error(f.name + " is larger than 25MB");
      const safeName = (f.name || ("file-" + i)).replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = state.userId + "/" + Date.now() + "-" + i + "-" + Math.random().toString(36).slice(2, 7) + "-" + safeName;
      const { error: up } = await runtime.client.storage.from("reports").upload(path, f, { upsert: false, contentType: f.type || undefined });
      if (up) throw up;
      const { data: pub } = runtime.client.storage.from("reports").getPublicUrl(path);
      urls.push(pub.publicUrl);
    }
    const detailsWithUnit = buildReportDetailsWithUnit(unitId, unitName, details);
    const full = detailsWithUnit + (urls.length ? "\n\nPhotos:\n" + urls.join("\n") : "");
    const payload = {
      report_type: state.reportType === "delivery" ? "delivery" : "service",
      site_id: siteId, report_date: date, title, details: full, created_by: state.userId,
    };
    const q = runtime.editingReportId
      ? runtime.client.from("service_delivery_reports").update(payload).eq("id", runtime.editingReportId)
      : runtime.client.from("service_delivery_reports").insert(payload);
    const { error } = await q;
    if (error) throw error;
    runtime.editingReportId = null;
    runtime.editingExistingUrls = [];
    setVal("reportTitle", "");
    setVal("reportDetails", "");
    setVal("reportUnit", "");
    clearPendingReportFiles();
    renderReportAttachmentPreview();
    if (btn) btn.textContent = "Submit report";
    $("reportFormCard")?.classList.add("hidden");
    suppressNotifications();
    await loadReports();
    if (statusEl) statusEl.textContent = "Saved.";
    toast("Report saved");
  } catch (err: any) {
    if (statusEl) statusEl.textContent = "Failed: " + err.message;
    toast("Report failed: " + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

export function renderPmsSiteOptions(): void {
  const box = $("pmsSitePickerOptions");
  if (!box) return;
  const sites = state.sites.filter(s => s.region === runtime.pmsRegion);
  box.innerHTML = sites.map(s => '<button class="filter" type="button" data-pms-site="' + esc(s.id) + '">' + esc(s.name) + "</button>").join("") || '<p class="muted">No sites in this region yet.</p>';
  document.querySelectorAll<HTMLElement>("[data-pms-site]").forEach(b =>
    b.addEventListener("click", () => { runtime.pmsSiteId = b.dataset.pmsSite || null; openPmsChecklist(); })
  );
}
export function renderPmsChecklistUnits(selectedUnitId = ""): void {
  const uSel = $("pmsChecklistUnit") as HTMLSelectElement | null;
  if (!uSel) return;
  const cur = selectedUnitId || uSel.value;
  const list = runtime.pmsSiteId ? state.units.filter(u => String(u.site_id) === String(runtime.pmsSiteId)) : [];
  uSel.innerHTML = '<option value="">General / Site-wide Unit</option>' +
    list.map(u => '<option value="' + esc(u.id) + '">' + esc(u.unit_name) + " (" + esc(u.unit_type) + ")</option>").join("");
  if (cur && list.some(u => String(u.id) === String(cur))) uSel.value = String(cur);
}
export function renderPmsChecklist(): void { renderPmsSiteOptions(); renderPmsChecklistUnits(); }

export function clearPendingPmsFiles(): void {
  runtime.pendingPmsFiles.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  runtime.pendingPmsFiles = [];
  const inp = $("pmsChecklistFiles") as HTMLInputElement | null;
  if (inp) inp.value = "";
}

export function renderPmsAttachmentPreview(): void {
  const box = $("pmsChecklistPreview");
  if (!box) return;
  box.innerHTML = runtime.pendingPmsFiles.map((item, idx) => {
    const inner = item.previewUrl
      ? '<img src="' + esc(item.previewUrl) + '" alt="' + esc(item.file.name) + '">'
      : '<span class="report-att-file">📎 ' + esc(item.file.name) + "</span>";
    return '<div class="report-att-item">' + inner + '<button class="report-att-del" type="button" data-remove-pms-att="' + idx + '" aria-label="Remove">✕</button></div>';
  }).join("");
}

export function openPmsChecklist(selectedUnitId = ""): void {
  const site = state.sites.find(s => String(s.id) === String(runtime.pmsSiteId));
  $("pmsSitePicker")?.classList.add("hidden");
  $("pmsChecklistPanel")?.classList.remove("hidden");
  const ttl = $("pmsSelectedSite");
  if (ttl) ttl.textContent = site ? site.name : "Site";
  renderPmsChecklistUnits(selectedUnitId);
  setVal("pmsChecklistDate", new Date().toISOString().slice(0, 10));
  clearPendingPmsFiles();
  renderPmsAttachmentPreview();
  const st = $("pmsRecordStatus");
  if (st) st.textContent = "";
  const sections = PMS_ITEMS[runtime.pmsUnit] || PMS_ITEMS.elevator;
  const catBox = $("pmsCategories");
  if (catBox) {
    catBox.innerHTML = sections.map(([heading, items]) =>
      '<div class="card"><h2 style="margin-top:0">' + esc(heading) + "</h2>" +
      items.map(it => '<label class="check-row"><input type="checkbox"> ' + esc(it) + "</label>").join("") +
      "</div>"
    ).join("");
  }
}

export function renderPmsRecordsFilters(): void {
  const teamSel = $("pmsRecordsTeam") as HTMLSelectElement | null;
  const locSel = $("pmsRecordsLocation") as HTMLSelectElement | null;
  const siteSel = $("pmsRecordsSite") as HTMLSelectElement | null;
  if (!teamSel || !locSel || !siteSel) return;
  const teams = [...new Set(state.profiles.map(p => p.team).filter(Boolean))].sort();
  const locs = [...new Set(state.sites.map(s => s.region).filter(Boolean))].sort();
  const tCur = teamSel.value;
  const lCur = locSel.value;
  const sCur = siteSel.value;
  teamSel.innerHTML = '<option value="">All teams</option>' + teams.map(t => "<option>" + esc(t) + "</option>").join("");
  locSel.innerHTML = '<option value="">All locations</option>' + locs.map(l => "<option>" + esc(l) + "</option>").join("");
  siteSel.innerHTML = '<option value="">All sites</option>' + state.sites.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + "</option>").join("");
  if (teams.includes(tCur)) teamSel.value = tCur;
  if (locs.includes(lCur)) locSel.value = lCur;
  if (state.sites.some(s => String(s.id) === sCur)) siteSel.value = sCur;
}

export function renderPmsRecords(): void {
  const box = $("pmsRecordsList");
  if (!box) return;
  const team = val("pmsRecordsTeam");
  const loc = val("pmsRecordsLocation");
  const siteId = val("pmsRecordsSite");
  const list = state.pmsRecords.filter(r => {
    const p = profileOf(r.user_id);
    const site = state.sites.find(s => String(s.id) === String(r.site_id));
    if (team && (!p || p.team !== team)) return false;
    if (loc && (!site || site.region !== loc)) return false;
    if (siteId && String(r.site_id) !== siteId) return false;
    return true;
  });
  box.innerHTML = list.map(r => {
    const site = state.sites.find(s => String(s.id) === String(r.site_id));
    let parsed: any = {};
    try { parsed = JSON.parse(r.details || "{}"); } catch {}
    const uTag = parsed.unitName ? " (" + parsed.unitName + ")" : "";
    return '<div class="item clickable" data-pms-record="' + esc(r.id) + '"><b>' + esc(site ? site.name : "Site") + esc(uTag) + " — " +
      esc((r.unit_type || "").toUpperCase()) + '</b><div class="muted">' + esc(fmtDay(r.checklist_date)) + " · " +
      esc(profileName(r.user_id)) + " · " + r.items_passed + "/" + r.items_total + " passed</div></div>";
  }).join("") || '<p class="muted">No PMS records found.</p>';
}

export function runSearch(): void {
  const q = val("searchQuery").toLowerCase().trim();
  const region = val("searchRegion");
  const equip = val("searchEquipment");
  const type = val("searchType");
  const site = val("searchSite");
  const from = val("searchDateFrom");
  const to = val("searchDateTo");
  const uploadsOnly = !!($("searchUploadsOnly") as HTMLInputElement | null)?.checked;
  const hits: Array<{ kind: string; title: string; date: string; body: string; photosHtml?: string }> = [];

  // Search ONLY shows postings & uploads (Service Reports, Delivery Reports, and PMS Checklist Records)
  if (!type || type === "service-report" || type === "delivery-report") {
    state.reports.forEach(r => {
      if (type === "service-report" && r.report_type !== "service") return;
      if (type === "delivery-report" && r.report_type !== "delivery") return;
      const attUrls = extractReportPhotoUrls(r.details);
      if (uploadsOnly && !attUrls.length) return;
      const sObj = state.sites.find(s => String(s.id) === String(r.site_id));
      if (region && (!sObj || sObj.region !== region)) return;
      if (site && String(r.site_id) !== site) return;
      if (from && r.report_date < from) return;
      if (to && r.report_date > to) return;
      const parsedUnit = parseReportUnit(r.details);
      const bodyText = stripReportPhotos(r.details);
      const hay = ((r.title || "") + " " + bodyText + " " + parsedUnit.unitName + " " + (sObj?.name || "")).toLowerCase();
      if (equip && !hay.includes(equip)) return;
      if (q && !hay.includes(q)) return;
      hits.push({
        kind: (r.report_type === "delivery" ? "Delivery" : "Service") + " Report" + (parsedUnit.unitName ? " · 🛗 " + parsedUnit.unitName : ""),
        title: r.title,
        date: fmtDay(r.report_date) + (sObj ? " · " + sObj.name : "") + " · " + profileName(r.created_by),
        body: bodyText.slice(0, 260),
        photosHtml: buildReportAttachmentHtml(r.details),
      });
    });
  }
  if (!type || type === "pms") {
    state.pmsRecords.forEach(r => {
      if (equip && r.unit_type !== equip) return;
      const sObj = state.sites.find(s => String(s.id) === String(r.site_id));
      if (region && (!sObj || sObj.region !== region)) return;
      if (site && String(r.site_id) !== site) return;
      if (from && r.checklist_date < from) return;
      if (to && r.checklist_date > to) return;
      let parsed: any = {};
      try { parsed = JSON.parse(r.details || "{}"); } catch {}
      const attUrls: string[] = Array.isArray(parsed.attachments) ? parsed.attachments : [];
      if (uploadsOnly && !attUrls.length) return;
      const hay = ((sObj?.name || "") + " " + (r.unit_type || "") + " " + (parsed.unitName || "") + " " + (r.details || "")).toLowerCase();
      if (q && !hay.includes(q)) return;
      hits.push({
        kind: "PMS (" + r.unit_type + ")" + (parsed.unitName ? " · 🛗 " + parsed.unitName : ""),
        title: sObj ? sObj.name : "Site",
        date: fmtDay(r.checklist_date) + " · " + profileName(r.user_id),
        body: r.items_passed + "/" + r.items_total + " passed",
        photosHtml: buildUrlAttachmentHtml(attUrls),
      });
    });
  }
  const resEl = $("searchResults");
  if (resEl) {
    resEl.innerHTML = hits.map(h =>
      '<div class="item"><b>' + esc(h.title) + '</b><div class="muted">' + esc(h.kind) + " · " + esc(h.date) + "</div><div>" + esc(h.body) + "</div>" +
      (h.photosHtml ? '<div class="media-grid" style="margin-top:8px;">' + h.photosHtml + "</div>" : "") + "</div>"
    ).join("") || '<p class="muted">No matching posted reports or uploaded records.</p>';
  }
}

/* ==================== DTR & AI TIME IN / TIME OUT CHAT ==================== */
let signaturePhotoDataUrl = "";
let drawnSigDataUrl = "";

function employeeDisplayName(uid?: string): string {
  return String((uid ? profileName(uid) : (state.profile?.full_name || profileOf(state.userId)?.full_name)) || "").trim().toUpperCase();
}

function renderDtrPreviewEmployeeOptions(): void {
  const sel = $("dtrPreviewEmployee") as HTMLSelectElement | null;
  if (!sel) return;
  const cur = sel.value || String(state.userId || "");
  const ids = new Set<string>();
  if (state.userId) ids.add(String(state.userId));
  (state.dtrs || []).forEach(d => {
    if (d.user_id) ids.add(String(d.user_id));
  });
  (state.profiles || []).forEach(p => {
    if (p.user_id) ids.add(String(p.user_id));
  });
  const sorted = [...ids].sort((a, b) => {
    if (a === String(state.userId)) return -1;
    if (b === String(state.userId)) return 1;
    return employeeDisplayName(a).localeCompare(employeeDisplayName(b));
  });
  sel.innerHTML = sorted
    .map(uid => '<option value="' + esc(uid) + '">' + esc(employeeDisplayName(uid) || profileName(uid)) + "</option>")
    .join("");
  if (cur && ids.has(cur)) sel.value = cur;
  else if (state.userId) sel.value = String(state.userId);
}

function getActiveDtrCutoffKey(): string {
  if (!runtime.dtrCutoffKey) {
    runtime.dtrCutoffKey = getDtrCutoffForDate(localDateKey(new Date())).key;
  }
  return runtime.dtrCutoffKey;
}

function renderDtrCutoffOptions(): void {
  const periods = listAvailableDtrCutoffs(state.dtrs || []);
  const activeKey = getActiveDtrCutoffKey();
  const optionsHtml =
    periods
      .map(p => `<option value="${esc(p.key)}">${esc(p.label)}</option>`)
      .join("") + '<option value="all">All Dates (Previous → Newest)</option>';

  ["dtrCutoffFilter", "dtrPreviewCutoff"].forEach(id => {
    const sel = $(id) as HTMLSelectElement | null;
    if (!sel) return;
    sel.innerHTML = optionsHtml;
    const hasActive = activeKey === "all" || periods.some(p => p.key === activeKey);
    sel.value = hasActive ? activeKey : (periods[0]?.key || "all");
  });
}

export function renderDtr(): void {
  const tbody = $("dtrRows");
  if (!tbody) return;
  const tfoot = $("dtrRowsFoot");
  renderDtrCutoffOptions();
  renderDtrPreviewEmployeeOptions();
  const baseRows = isManager() ? state.dtrs : state.dtrs.filter(d => String(d.user_id) === String(state.userId));
  const activeKey = getActiveDtrCutoffKey();
  const { period, rows } = filterDtrRowsByCutoff(baseRows, activeKey);

  // Group chronologically by (work_date, user_id) so each working day computes total hours (9h regular + rest OT)
  const dayGroups: Array<{ workDate: string; userId: string; entries: any[] }> = [];
  const dayMap = new Map<string, { workDate: string; userId: string; entries: any[] }>();
  for (const d of rows) {
    const workDate = String(d.work_date || "");
    const uid = String(d.user_id || "");
    const key = `${workDate}::${uid}`;
    let grp = dayMap.get(key);
    if (!grp) {
      grp = { workDate, userId: uid, entries: [] };
      dayMap.set(key, grp);
      dayGroups.push(grp);
    }
    grp.entries.push(d);
  }

  const now = new Date();
  const todayStr = localDateKey(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  let workingDaysCount = 0;
  let allDaysTotalMins = 0;
  let allDaysRegMins = 0;
  const empOtStats = new Map<string, { grossOtMins: number; uncoveredLackingMins: number }>();
  const bodyHtmlParts: string[] = [];

  for (const grp of dayGroups) {
    let dayTotalMins = 0;
    let dayNsRepair = false;
    for (const d of grp.entries) {
      const meta = parseDtrJobMeta(d.job, d.approved_by, d.nightshift_repair);
      if (meta.nightshiftRepair) dayNsRepair = true;
      const rowOpts = { workDate: d.work_date, nightshiftRepair: meta.nightshiftRepair };
      const isOpenToday =
        String(d.work_date) === todayStr &&
        Boolean(d.time_in) &&
        (!d.time_out || d.time_out === d.time_in);
      const mins = isOpenToday
        ? calculateDtrMinutes(d.time_in, null, nowMins, rowOpts)
        : calculateDtrMinutes(d.time_in, d.time_out, null, rowOpts);
      const hrs = mins / 60;
      dayTotalMins += mins;
      const cappedOut = capDtrTimeOut(d.time_in, d.time_out, rowOpts);
      const entryOtMins = calculateShiftBreakdown(d.time_in, isOpenToday ? null : cappedOut, mins, rowOpts).finalOtMins;
      const canDelete = String(d.user_id) === String(state.userId) || isManager();
      const jobText = [
        meta.unitName ? `[${meta.unitName}]` : "",
        meta.cleanJob,
        meta.nightshiftRepair ? "[🌙 Nightshift/Repair]" : "",
        meta.approvedBy ? `(${meta.approvedBy})` : "",
      ].filter(Boolean).join(" ");
      const timeOutDisplay = isOpenToday
        ? '<span class="badge" style="margin-left:0;">⏱ Active</span>'
        : esc(cappedOut || "—");
      const hrsDisplay = mins > 0 || isOpenToday
        ? (isOpenToday ? "⏱ " : "") + esc(formatDtrDuration(mins)) +
          ` <span class="muted">(${hrs.toFixed(2)}h)</span>` +
          (entryOtMins > 0 ? ` (+${esc(formatDtrDuration(entryOtMins))} OT)` : "")
        : "0.00";
      bodyHtmlParts.push(
        "<tr><td>" + esc(fmtTableDate(d.work_date)) + "</td><td>" + esc(employeeDisplayName(d.user_id)) + "</td><td>" +
        esc([d.location, jobText].filter(Boolean).join(" · ")) + "</td><td><b>" + esc(d.time_in || "—") + "</b></td><td><b>" +
        timeOutDisplay + "</b></td><td>" + hrsDisplay + "</td><td>" +
        (canDelete ? '<button class="gray small-btn" type="button" onclick="openEditDtr(\'' + esc(d.id) + '\')" aria-label="Edit DTR">✏️</button> ' : "") +
        (canDelete ? '<button class="red small-btn" type="button" data-act="del-dtr" data-id="' + esc(d.id) + '">×</button>' : "") + "</td></tr>"
      );
    }
    if (dayTotalMins > 0) workingDaysCount++;
    const firstEntryIn = grp.entries.find((e: any) => e.time_in)?.time_in || null;
    const closedEntries = grp.entries.filter((e: any) => e.time_out && e.time_out !== e.time_in);
    const lastEntryOut = closedEntries.length ? closedEntries[closedEntries.length - 1].time_out : null;
    const dayBd = calculateShiftBreakdown(firstEntryIn, lastEntryOut, dayTotalMins, {
      workDate: grp.workDate,
      nightshiftRepair: dayNsRepair,
    });
    const dayRegMins = dayBd.regularMins;
    const dayOtMins = dayBd.finalOtMins;
    const isClosedDay = Boolean(lastEntryOut) || grp.workDate < todayStr;
    const dayUncoveredLackingMins = (dayTotalMins > 0 && isClosedDay)
      ? Math.max(0, dayBd.standardMins - dayBd.workedMins)
      : 0;
    allDaysTotalMins += dayTotalMins;
    allDaysRegMins += dayRegMins;
    const empStat = empOtStats.get(grp.userId) || { grossOtMins: 0, uncoveredLackingMins: 0 };
    empStat.grossOtMins += dayOtMins;
    empStat.uncoveredLackingMins += dayUncoveredLackingMins;
    empOtStats.set(grp.userId, empStat);

    const dayRuleBadge = dayBd.isSunday
      ? (dayBd.nightshiftRepair ? " · Sun 10AM–7PM + 🌙 NS/Repair" : " · Sun 10AM–7PM")
      : (dayBd.nightshiftRepair ? " · 🌙 NS/Repair" : "");
    const dayBreakdownSub = dayBd.isSunday && !dayBd.nightshiftRepair && dayBd.workedMins > dayBd.regularMins && dayOtMins === 0
      ? `(Sun 10AM–7PM: ${esc(formatDtrDuration(dayRegMins))} Reg · Final O.T.: 0 mins [Needs <10AM start or Ops Fix/Install/Repair])`
      : dayBd.lackingMins > 0 && dayBd.grossOtMins > 0 && dayUncoveredLackingMins === 0
        ? `(Std 9h${dayRuleBadge}: ${esc(formatDtrDuration(dayBd.inShiftWorkedMins))} [Lacking ${esc(formatDtrDuration(dayBd.lackingMins))}] · OT: ${esc(formatDtrDuration(dayBd.grossOtMins))} − ${esc(formatDtrDuration(dayBd.lackingMins))} = Final O.T.: ${esc(formatDtrDuration(dayOtMins))})`
        : dayUncoveredLackingMins > 0
          ? `(Reg: ${esc(formatDtrDuration(dayRegMins))} / 9h 00m${dayRuleBadge} · Lacking: ${esc(formatDtrDuration(dayUncoveredLackingMins))} [Deducted from overall O.T.] · Final O.T.: 0 mins)`
          : dayBd.lackingMins > 0 && lastEntryOut
            ? `(Reg: ${esc(formatDtrDuration(dayRegMins))} / 9h 00m${dayRuleBadge} · Lacking: ${esc(formatDtrDuration(dayBd.lackingMins))} · Final O.T.: 0 mins)`
            : `(Reg: ${esc(formatDtrDuration(dayRegMins))}${dayRuleBadge} · O.T.: ${esc(formatDtrDuration(dayOtMins))})`;

    bodyHtmlParts.push(
      '<tr class="dtr-day-total-row">' +
      '<td colspan="5"><b>📅 ' + esc(fmtTableDate(grp.workDate)) + " · " + esc(employeeDisplayName(grp.userId)) + " — Day Total</b>" +
      ' <span class="muted">' + dayBreakdownSub + "</span></td>" +
      "<td><b>" + esc(formatDtrDuration(dayTotalMins)) + "</b> <span class=\"muted\">(" + (dayTotalMins / 60).toFixed(2) + "h)</span></td>" +
      "<td>" + (dayOtMins > 0
        ? '<span class="badge">+' + esc(formatDtrDuration(dayOtMins)) + " OT</span>"
        : (dayUncoveredLackingMins > 0 ? '<span class="muted">−' + esc(formatDtrDuration(dayUncoveredLackingMins)) + "</span>" : '<span class="muted">Reg</span>')) +
      "</td>" +
      "</tr>"
    );
  }

  let allDaysGrossOtMins = 0;
  let allDaysUncoveredLackingMins = 0;
  let allDaysOtMins = 0;
  empOtStats.forEach(s => {
    allDaysGrossOtMins += s.grossOtMins;
    allDaysUncoveredLackingMins += s.uncoveredLackingMins;
    allDaysOtMins += Math.max(0, s.grossOtMins - s.uncoveredLackingMins);
  });

  const allDaysTotalHrs = allDaysTotalMins / 60;
  const allDaysOtHrs = allDaysOtMins / 60;

  const summaryEl = $("dtrCutoffSummary");
  if (summaryEl) {
    const periodText = period ? period.label : "All Dates";
    const lackingTag = allDaysUncoveredLackingMins > 0
      ? ` (after −${formatDtrDuration(allDaysUncoveredLackingMins)} lacking)`
      : "";
    summaryEl.textContent = `${periodText} · ${rows.length} ${rows.length === 1 ? "entry" : "entries"} · ${workingDaysCount} day(s) · ${formatDtrDuration(allDaysOtMins)} (${allDaysOtHrs.toFixed(2)}h) Final OT${lackingTag}`;
  }

  tbody.innerHTML = bodyHtmlParts.join("") || '<tr><td colspan="7" class="muted">No DTR entries for this cutoff period.</td></tr>';
  if (tfoot) {
    const otFormulaDesc = allDaysUncoveredLackingMins > 0
      ? `Day O.T.: ${esc(formatDtrDuration(allDaysGrossOtMins))} − Lacking: ${esc(formatDtrDuration(allDaysUncoveredLackingMins))} = Final Overall O.T.: ${esc(formatDtrDuration(allDaysOtMins))}`
      : `Mon–Sat Reg: 8AM–5PM, max 7PM · Sun Reg: 10AM–7PM · NS/Repair unlocks 7:01PM+`;
    tfoot.innerHTML = rows.length
      ? '<tr class="dtr-all-ot-row">' +
        '<td colspan="5"><b>⏱️ ' + (allDaysUncoveredLackingMins > 0 ? "Final Total Overall O.T." : "All Working Days O.T.") + '</b> <span class="muted">(' + otFormulaDesc + ")</span></td>" +
        "<td><b>" + esc(formatDtrDuration(allDaysOtMins)) + '</b> <span class="muted">(' + allDaysOtHrs.toFixed(2) + "h)</span></td>" +
        '<td><span class="badge">Final OT</span></td>' +
        "</tr>" +
        '<tr class="dtr-all-total-row">' +
        '<td colspan="5"><b>📊 All Working Days Total (' + workingDaysCount + " " + (workingDaysCount === 1 ? "day" : "days") + ')</b> <span class="muted">(Reg: ' + esc(formatDtrDuration(allDaysRegMins)) + " + Final O.T.: " + esc(formatDtrDuration(allDaysOtMins)) + ")</span></td>" +
        "<td><b>" + esc(formatDtrDuration(allDaysTotalMins)) + '</b> <span class="muted">(' + allDaysTotalHrs.toFixed(2) + "h)</span></td>" +
        "<td></td>" +
        "</tr>"
      : "";
  }
  renderDtrLiveStatus();
  if (!$("dtrPreview")?.classList.contains("hidden")) buildDtrPaper();
}

function isUserMentionedInSchedule(s: any, myName: string, myEmail: string): boolean {
  if (!s) return false;
  const tags = parseScheduleTags(s.notes);
  if (myName && tags.assigned.some(n => doesAssignedTokenMatchUser(n, myName))) return true;
  const combined = `${String(s.title || "")} ${tags.cleanNotes}`;
  if (myName) {
    const escaped = myName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp("(^|[^a-z0-9])" + escaped + "([^a-z0-9]|$)", "i").test(combined)) return true;
  }
  if (myEmail && combined.toLowerCase().includes(myEmail)) return true;
  return false;
}

function findScheduledWorkForUser(targetDate?: string): { siteName: string; unitName: string; jobDescription: string; schedule: any } | null {
  const myName = (state.profile?.full_name || "").trim().toLowerCase();
  const myEmail = (state.email || "").trim().toLowerCase();
  const candidateSchedules = isAdmin() ? [...(state.schedules || [])] : visibleSchedules();
  if (!candidateSchedules.length) return null;

  const todayStr = localDateKey(new Date());
  const dateGoal = targetDate || val("dtrDate").trim() || todayStr;

  const mentionedList = candidateSchedules.filter(s => isUserMentionedInSchedule(s, myName, myEmail));
  const pool = mentionedList.length ? mentionedList : (isAdmin() ? candidateSchedules : []);
  if (!pool.length) return null;

  const scoreSchedule = (s: any): number => {
    let score = 0;
    if (isUserMentionedInSchedule(s, myName, myEmail)) score += 120;
    if (s.scheduled_date === dateGoal) score += 80;
    else if (!targetDate && s.scheduled_date === todayStr) score += 40;
    const st = sessionState(s);
    if (st === "now") score += 25;
    else if (st === "imminent") score += 20;
    else if (st === "soon") score += 15;
    return score;
  };

  const ranked = [...pool].sort((a, b) => scoreSchedule(b) - scoreSchedule(a));
  const exactDateMatch = ranked.find(s => s.scheduled_date === dateGoal);
  const best = targetDate
    ? (exactDateMatch || (!val("dtrDate").trim() ? ranked[0] : null))
    : (exactDateMatch || ranked.find(s => !s.scheduled_date || s.scheduled_date === todayStr || sessionState(s) !== "") || ranked[0]);
  if (!best) return null;

  const rawTitle = String(best.title || "").trim();
  const titleLower = rawTitle.toLowerCase();
  const matchedSite = state.sites.find(site => {
    const n = String(site.name || "").trim().toLowerCase();
    return n && (
      titleLower === n ||
      titleLower.startsWith(n + " —") ||
      titleLower.startsWith(n + " -") ||
      titleLower.includes(n) ||
      (titleLower.length >= 4 && n.includes(titleLower))
    );
  });
  const splitParts = rawTitle ? rawTitle.split(/\s+—\s+|\s+-\s+/) : [];
  const siteName = matchedSite ? matchedSite.name : (splitParts[0] || best.region || rawTitle).trim();
  let unitName = "";
  if (matchedSite) {
    const siteUnits = state.units.filter(u => String(u.site_id) === String(matchedSite.id));
    const matchedUnit = siteUnits.find(u => titleLower.includes(String(u.unit_name || "").toLowerCase()));
    if (matchedUnit) unitName = matchedUnit.unit_name;
    else if (splitParts[1]) unitName = splitParts[1].trim();
  } else if (splitParts[1]) {
    unitName = splitParts[1].trim();
  }

  const cleanNotes = parseScheduleTags(best.notes).cleanNotes;
  const extraTitleTask = splitParts
    .slice(1)
    .map(p => p.trim())
    .filter(p => p && p.toLowerCase() !== unitName.toLowerCase())
    .join(" — ");
  const jobDescription =
    [cleanNotes, extraTitleTask].filter(Boolean).join(" · ") ||
    (unitName ? `${unitName} Service / PMS` : "") ||
    rawTitle;

  return { siteName, unitName, jobDescription, schedule: best };
}

export function autoFillDtrFromSchedule(force = false): void {
  const dtrDateEl = $("dtrDate") as HTMLInputElement | null;
  if (dtrDateEl && !dtrDateEl.value) {
    dtrDateEl.value = localDateKey(new Date());
  }
  const targetDate = val("dtrDate").trim() || localDateKey(new Date());
  const found = findScheduledWorkForUser(targetDate);

  const locEl = $("dtrLocation") as HTMLInputElement | null;
  if (locEl) {
    const canOverwrite = force || !locEl.value.trim() || locEl.dataset.autoFilled === "1";
    if (canOverwrite) {
      if (found?.siteName) {
        locEl.value = found.siteName;
        locEl.dataset.autoFilled = "1";
      } else if (locEl.dataset.autoFilled === "1") {
        locEl.value = "";
        delete locEl.dataset.autoFilled;
      }
    }
  }

  renderDtrUnitOptions();
  const unitEl = $("dtrUnit") as HTMLSelectElement | null;
  if (unitEl) {
    const canOverwrite = force || !unitEl.value || unitEl.dataset.autoFilled === "1";
    if (canOverwrite) {
      const hasOpt = found?.unitName && [...unitEl.options].some(o => o.value === found.unitName);
      if (hasOpt && found?.unitName) {
        unitEl.value = found.unitName;
        unitEl.dataset.autoFilled = "1";
      } else if (unitEl.dataset.autoFilled === "1") {
        unitEl.value = "";
        delete unitEl.dataset.autoFilled;
      }
    }
  }

  const jobEl = $("dtrJob") as HTMLInputElement | null;
  if (jobEl) {
    const canOverwrite = force || !jobEl.value.trim() || jobEl.dataset.autoFilled === "1";
    if (canOverwrite) {
      if (found?.jobDescription) {
        jobEl.value = found.jobDescription;
        jobEl.dataset.autoFilled = "1";
      } else if (jobEl.dataset.autoFilled === "1") {
        jobEl.value = "";
        delete jobEl.dataset.autoFilled;
      }
    }
  }

  const logSite = $("timeLogSite") as HTMLSelectElement | null;
  if (logSite && found?.siteName) {
    const hasOpt = [...logSite.options].some(o => o.value === found.siteName);
    if (hasOpt && (force || !logSite.value || logSite.dataset.autoFilled === "1")) {
      logSite.value = found.siteName;
      logSite.dataset.autoFilled = "1";
    }
  }
  renderTimeLogSitePickers();
  const logUnit = $("timeLogUnit") as HTMLSelectElement | null;
  if (logUnit && found?.unitName) {
    const hasOpt = [...logUnit.options].some(o => o.value === found.unitName);
    if (hasOpt && (force || !logUnit.value || logUnit.dataset.autoFilled === "1")) {
      logUnit.value = found.unitName;
      logUnit.dataset.autoFilled = "1";
    }
  }
}

export function dtrTab(tab: "fill" | "time_log" | "preview" | "time_in" | "time_out"): void {
  let normalized: "fill" | "time_log" | "preview" = "fill";
  if (tab === "time_in" || tab === "time_out") {
    setTimeLogMode(tab);
    normalized = "time_log";
  } else if (tab === "time_log" || tab === "preview") {
    normalized = tab;
  }
  runtime.currentDtrTab = normalized;
  $("dtrFill")?.classList.toggle("hidden", normalized !== "fill");
  $("dtrTimeLog")?.classList.toggle("hidden", normalized !== "time_log");
  $("dtrPreview")?.classList.toggle("hidden", normalized !== "preview");
  $("dtrFillTab")?.classList.toggle("active", normalized === "fill");
  $("dtrTimeLogTab")?.classList.toggle("active", normalized === "time_log");
  $("dtrPrevTab")?.classList.toggle("active", normalized === "preview");
  const activeDtrPanel = normalized === "fill" ? $("dtrFill") : normalized === "time_log" ? $("dtrTimeLog") : $("dtrPreview");
  applyRandomOpenStyle(activeDtrPanel);
  triggerAndroidHapticTap();
  if (normalized === "fill") autoFillDtrFromSchedule(false);
  if (normalized === "preview") buildDtrPaper();
  if (normalized === "time_log") {
    renderTimeLogSitePickers();
    autoFillDtrFromSchedule(false);
    renderTimeLog();
    renderDtrLiveStatus();
  }
  if (normalized === "fill") renderDtrLiveStatus();
  saveLastView();
}

async function insertDtrEntrySafe(payload: {
  user_id: string | null;
  work_date: string;
  location: string | null;
  job: string | null;
  time_in: string | null;
  time_out: string | null;
  overtime_approved: boolean;
}): Promise<string | null> {
  const firstAttempt = await runtime.client
    .from("dtr_entries")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (!firstAttempt.error) {
    return firstAttempt.data?.id ? String(firstAttempt.data.id) : null;
  }

  const isNotNullErr =
    firstAttempt.error.code === "23502" ||
    /violates not-null constraint/i.test(firstAttempt.error.message || "");
  if (!isNotNullErr) throw firstAttempt.error;

  // Retry with empty strings for legacy TEXT NOT NULL columns
  const emptyStringAttempt = await runtime.client
    .from("dtr_entries")
    .insert({
      user_id: payload.user_id,
      work_date: payload.work_date,
      location: payload.location ?? "",
      job: payload.job ?? "",
      time_in: payload.time_in ?? "",
      time_out: payload.time_out ?? "",
      overtime_approved: payload.overtime_approved,
    })
    .select("id")
    .maybeSingle();
  if (!emptyStringAttempt.error) {
    return emptyStringAttempt.data?.id ? String(emptyStringAttempt.data.id) : null;
  }

  const isTimeTypeSyntaxErr =
    emptyStringAttempt.error.code === "22007" ||
    /invalid input syntax for type time/i.test(emptyStringAttempt.error.message || "");
  if (!isTimeTypeSyntaxErr) throw emptyStringAttempt.error;

  // Last-resort fallback if an older DB column used TIME NOT NULL
  const fallbackTime = payload.time_in || payload.time_out || "00:00";
  const timeFallbackAttempt = await runtime.client
    .from("dtr_entries")
    .insert({
      user_id: payload.user_id,
      work_date: payload.work_date,
      location: payload.location ?? "",
      job: payload.job ?? "",
      time_in: payload.time_in || fallbackTime,
      time_out: payload.time_out || fallbackTime,
      overtime_approved: payload.overtime_approved,
    })
    .select("id")
    .maybeSingle();
  if (timeFallbackAttempt.error) throw timeFallbackAttempt.error;
  return timeFallbackAttempt.data?.id ? String(timeFallbackAttempt.data.id) : null;
}

export async function addDtr(): Promise<void> {
  const date = val("dtrDate");
  if (!date) { toast("Choose a date"); return; }
  const unitName = val("dtrUnit").trim();
  const jobRaw = val("dtrJob").trim();
  const nsBox = $("dtrNightshiftOrRepair") as HTMLInputElement | null;
  const nightshiftRepair = Boolean(nsBox?.checked);
  const jobFull = buildDtrJobWithApproval(unitName, jobRaw, "", false, nightshiftRepair);
  const rawTimeIn = val("dtrIn") || null;
  const rawTimeOut = val("dtrOut") || null;
  const cappedTimeOut = rawTimeOut ? capDtrTimeOut(rawTimeIn, rawTimeOut, { workDate: date, nightshiftRepair }) : null;
  try {
    await insertDtrEntrySafe({
      user_id: state.userId,
      work_date: date,
      location: val("dtrLocation").trim() || null,
      job: jobFull || null,
      time_in: rawTimeIn,
      time_out: cappedTimeOut,
      overtime_approved: true,
    });
  } catch (err: any) {
    toast("Could not add: " + (err?.message || err));
    return;
  }
  if (runtime.dtrCutoffKey !== "all") {
    runtime.dtrCutoffKey = getDtrCutoffForDate(date).key;
  }
  const jobEl = $("dtrJob") as HTMLInputElement | null;
  if (jobEl) delete jobEl.dataset.autoFilled;
  setVal("dtrJob", "");
  setVal("dtrIn", "");
  setVal("dtrOut", "");
  if (nsBox) nsBox.checked = false;
  suppressNotifications();
  await loadDtrs();
  renderHomeDtrStatus();
  renderDtrLiveStatus();
  toast("Entry added");
}

export function clearDtrForm(): void {
  const locEl = $("dtrLocation") as HTMLInputElement | null;
  const unitEl = $("dtrUnit") as HTMLSelectElement | null;
  const jobEl = $("dtrJob") as HTMLInputElement | null;
  if (locEl) delete locEl.dataset.autoFilled;
  if (unitEl) delete unitEl.dataset.autoFilled;
  if (jobEl) delete jobEl.dataset.autoFilled;
  ["dtrDate", "dtrLocation", "dtrUnit", "dtrJob", "dtrIn", "dtrOut"].forEach(id => setVal(id, ""));
  const nsEl = $("dtrNightshiftOrRepair") as HTMLInputElement | null;
  if (nsEl) nsEl.checked = false;
  const otEl = $("dtrOvertimeApproved") as HTMLInputElement | null;
  if (otEl) otEl.checked = true;
  renderDtrLiveStatus();
}

export function setTimeLogMode(mode: "time_in" | "time_out", isManual = true): void {
  if (isManual) runtime.timeLogModeManual = true;
  runtime.timeLogMode = mode === "time_out" ? "time_out" : "time_in";
  document.querySelectorAll<HTMLElement>("#timeLogModeToggle [data-time-mode]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.timeMode === runtime.timeLogMode)
  );
  const badge = $("timeLogModeBadge");
  if (badge) {
    badge.textContent = runtime.timeLogMode === "time_in" ? "🟢 Time In Selected" : "🔴 Time Out Selected";
  }
  const qBtn = $("timemarkModeQuickBtn");
  if (qBtn) {
    qBtn.textContent = runtime.timeLogMode === "time_in" ? "🟢 TIME IN" : "🔴 TIME OUT";
  }
  if (!$("timemarkCamOverlay")?.classList.contains("hidden")) {
    updateTimemarkHud();
    void evaluateTimemarkSiteProximity();
  }
}

export function syncDefaultTimeLogModeFromHistory(force = false): void {
  if (runtime.timeLogModeManual && !force) return;
  const today = localDateKey(new Date());
  const myTodayLogs = (state.dtrTimeLogs || [])
    .filter((l: any) => String(l.user_id) === String(state.userId) && String(l.work_date || "").startsWith(today))
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  let nextMode: "time_in" | "time_out" = "time_in";
  if (myTodayLogs.length) {
    nextMode = myTodayLogs[0].mode === "time_in" ? "time_out" : "time_in";
  } else {
    try {
      const saved = state.userId ? localStorage.getItem("eesi-next-timelog-mode:" + state.userId) : null;
      if (saved === "time_in" || saved === "time_out") nextMode = saved;
    } catch {}
  }
  if (runtime.timeLogMode !== nextMode || force) {
    setTimeLogMode(nextMode, false);
  }
}

export function renderTimeLog(): void {
  syncDefaultTimeLogModeFromHistory(false);
  const box = $("timeLogMessages");
  if (!box) return;
  const logs = [...(state.dtrTimeLogs || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  if (!logs.length) {
    box.innerHTML =
      '<div class="item" style="text-align:center;">' +
      "<b>📸 Shared Time In / Out Feed</b>" +
      '<div class="muted" style="margin-top:4px;">Select <b>Time In</b> or <b>Time Out</b> above, then capture or upload a timestamped photo. All members can see every uploaded photo &amp; AI reading, receive notifications, and uploaded entries can be deleted anytime.</div></div>';
    return;
  }
  box.innerHTML = logs.map((m: any) => {
    const mine = String(m.user_id) === String(state.userId);
    const canDelete = mine || isManager();
    const isOut = m.mode === "time_out";
    const modeLabel = isOut ? "🔴 Time Out" : "🟢 Time In";
    const who = m.sender_name || profileName(m.user_id);
    const metaBadges = [
      modeLabel,
      m.work_date ? "📅 " + fmtDay(m.work_date) : "",
      m.time_12 || m.time_24 ? "⏰ " + (m.time_12 || m.time_24) : "",
      m.location ? "📍 " + m.location : "",
      m.unit ? "🛗 " + m.unit : "",
    ].filter(Boolean);
    const safeImg = safeUrl(m.image_url);
    return '<div class="msgr-row ' + (mine ? "mine" : "") + '" style="margin-bottom:10px;">' +
      '<div class="msgr-bub" style="max-width:92%;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">' +
      '<span style="font-weight:700;font-size:12px;">' + esc(who) + "</span>" +
      (canDelete ? '<button class="red small-btn" type="button" onclick="deleteTimeLog(\'' + esc(m.id) + '\')">🗑 Delete</button>' : "") +
      "</div>" +
      (safeImg ? '<img class="chat-img" style="margin-top:0;margin-bottom:6px;max-height:220px;object-fit:cover;cursor:pointer;" src="' + esc(safeImg) + '" alt="' + esc(modeLabel) + ' photo" data-preview-url="' + esc(safeImg) + '" data-preview-label="' + esc(who + " — " + modeLabel) + '"' + (canDelete ? ' data-preview-delete-id="' + esc(m.id) + '"' : "") + ">" : "") +
      (m.note ? '<div style="white-space:pre-wrap;margin-bottom:4px;">' + esc(m.note) + "</div>" : "") +
      (m.ai_summary ? '<div style="white-space:pre-wrap;font-size:12px;opacity:.95;">🤖 AI Reading: ' + esc(m.ai_summary) + "</div>" : "") +
      (metaBadges.length ? '<div style="margin-top:6px;font-size:12px;opacity:.92;">' + metaBadges.map(b => '<span class="badge" style="margin:2px 4px 0 0;">' + esc(b) + "</span>").join("") + "</div>" : "") +
      '<span class="msgr-time">' + esc(fmtDate(m.created_at)) + (m.dtr_entry_id ? " · ✅ Filled into DTR" : "") + "</span>" +
      "</div></div>";
  }).join("");
  box.scrollTop = box.scrollHeight;
}

async function insertTimeLogEntry(
  meta: TimeLogNoticeMeta,
  notifTitle: string,
  notifBody: string
): Promise<void> {
  if (!runtime.dtrTimeLogsTableMissing) {
    const { error } = await runtime.client.from("dtr_time_logs").insert(meta);
    if (!error) {
      await runtime.client.from("app_notifications").insert({
        title: notifTitle,
        body: notifBody,
      });
      return;
    }
    if (!isMissingTableError(error)) {
      throw error;
    }
    runtime.dtrTimeLogsTableMissing = true;
  }

  const { error: fallbackErr } = await runtime.client.from("app_notifications").insert({
    title: notifTitle,
    body: buildTimeLogAppNoticeBody(notifBody, meta),
  });
  if (fallbackErr) throw fallbackErr;
}

export async function deleteTimeLog(id: string): Promise<void> {
  if (!checkNetwork()) return;
  const log = (state.dtrTimeLogs || []).find((r: any) => String(r.id) === String(id));
  if (!log) return;
  if (String(log.user_id) !== String(state.userId) && !isManager()) {
    toast("You can only delete your own uploads.");
    return;
  }
  if (!(await confirmDialog("Delete this uploaded Time In / Out photo and record?", "Delete Time Log"))) return;
  try {
    if (log.image_url) {
      await deleteStorageFile("reports", log.image_url);
    }
    const noticeId = log.app_notification_id || (String(id).startsWith("notice:") ? String(id).slice("notice:".length) : "");
    if (noticeId) {
      const { error } = await runtime.client.from("app_notifications").delete().eq("id", noticeId);
      if (error) throw error;
    } else {
      const { error } = await runtime.client.from("dtr_time_logs").delete().eq("id", id);
      if (error && !isMissingTableError(error)) throw error;
      if (error && isMissingTableError(error)) runtime.dtrTimeLogsTableMissing = true;
    }
    suppressNotifications();
    state.dtrTimeLogs = (state.dtrTimeLogs || []).filter((r: any) => String(r.id) !== String(id));
    renderTimeLog();
    await loadAppNotifications();
    await loadTimeLogs();
    toast("Time In / Out entry deleted");
  } catch (err: any) {
    toast("Delete failed: " + (err?.message || err));
  }
}

export async function sendTimeLogNote(): Promise<void> {
  if (!checkNetwork()) return;
  const inp = $("timeLogNoteInput") as HTMLInputElement | null;
  const txt = inp?.value.trim() || "";
  if (!txt) { toast("Write a note or upload a timestamped photo"); return; }
  if (inp) inp.value = "";

  const mode = runtime.timeLogMode || "time_in";
  const modeLabel = mode === "time_in" ? "Time In" : "Time Out";
  const modeIcon = mode === "time_in" ? "🟢" : "🔴";
  const senderName = state.profile?.full_name || profileName(state.userId) || state.email || "Member";
  const selectedSite = val("timeLogSite").trim() || findScheduledWorkForUser()?.siteName || "";
  const selectedUnit = val("timeLogUnit").trim();

  try {
    await insertTimeLogEntry(
      {
        user_id: state.userId,
        sender_name: senderName,
        mode,
        work_date: localDateKey(new Date()),
        location: selectedSite || null,
        unit: selectedUnit || null,
        note: txt,
      },
      `${modeIcon} ${modeLabel} — ${senderName}`,
      [selectedSite, selectedUnit, txt].filter(Boolean).join(" · ")
    );
    suppressNotifications();
    await loadAppNotifications();
    await loadTimeLogs();
    toast(`${modeLabel} note posted`);
  } catch (err: any) {
    toast("Could not post note: " + (err?.message || err));
  }
}

async function writeAnalyzedTimeToDtr(
  mode: "time_in" | "time_out",
  workDate: string,
  time24: string,
  location: string,
  unit: string,
  summary: string,
  nightshiftRepair = false
): Promise<{ dtrEntryId: string | null; savedTimeIn: string; savedTimeOut: string; keptLockedTimeOut?: boolean }> {
  if (!state.userId) throw new Error("Sign in required before saving DTR.");
  const schedWork = findScheduledWorkForUser(workDate);
  const scheduledJob = schedWork?.jobDescription || "";
  const cleanJobDesc = [
    scheduledJob || (mode === "time_in" ? "Photo Time In" : "Photo Time Out"),
    summary ? `(${summary.slice(0, 70)})` : "",
  ].filter(Boolean).join(" ");
  const jobLabel = buildDtrJobWithApproval(unit, cleanJobDesc, "", false, nightshiftRepair);
  const myRowsForDate = (state.dtrs || []).filter(
    d => String(d.user_id) === String(state.userId) && String(d.work_date) === String(workDate)
  );
  const ruleOpts = { workDate, nightshiftRepair };

  let dtrEntryId: string | null = null;
  let savedTimeIn = mode === "time_in" ? time24 : "";
  let savedTimeOut = mode === "time_out" ? capDtrTimeOut(null, time24, ruleOpts) : "";
  let keptLockedTimeOut = false;

  if (mode === "time_in") {
    const existingNoIn = myRowsForDate.find(d => !d.time_in);
    if (existingNoIn) {
      const exMeta = parseDtrJobMeta(existingNoIn.job, existingNoIn.approved_by);
      const nextNs = nightshiftRepair || exMeta.nightshiftRepair;
      const nextJob = existingNoIn.job
        ? (nightshiftRepair && !exMeta.nightshiftRepair
            ? buildDtrJobWithApproval(exMeta.unitName, exMeta.cleanJob, exMeta.approvedBy, runtime.dtrApprovedByColMissing, true)
            : existingNoIn.job)
        : jobLabel;
      const { error } = await runtime.client
        .from("dtr_entries")
        .update({
          time_in: time24,
          ...(location && !existingNoIn.location ? { location } : {}),
          ...(nextJob ? { job: nextJob } : {}),
        })
        .eq("id", existingNoIn.id);
      if (error) throw error;
      dtrEntryId = String(existingNoIn.id);
      savedTimeOut = existingNoIn.time_out
        ? capDtrTimeOut(time24, existingNoIn.time_out, { workDate, nightshiftRepair: nextNs })
        : "";
    } else {
      dtrEntryId = await insertDtrEntrySafe({
        user_id: state.userId,
        work_date: workDate,
        location: location || null,
        job: jobLabel || null,
        time_in: time24,
        time_out: null,
        overtime_approved: true,
      });
    }
  } else {
    const openRow =
      myRowsForDate.find(d => d.time_in && (!d.time_out || d.time_out === d.time_in)) ||
      myRowsForDate.find(d => !d.time_out);
    const lockedClosedRow = !openRow
      ? [...myRowsForDate].reverse().find(d => d.time_in && d.time_out && d.time_out !== d.time_in)
      : null;

    if (openRow) {
      const openMeta = parseDtrJobMeta(openRow.job, openRow.approved_by);
      const rowNs = nightshiftRepair || openMeta.nightshiftRepair;
      const cappedOut = capDtrTimeOut(openRow.time_in, time24, { workDate, nightshiftRepair: rowNs });
      const updatedJob = nightshiftRepair && !openMeta.nightshiftRepair
        ? buildDtrJobWithApproval(openMeta.unitName, openMeta.cleanJob, openMeta.approvedBy, runtime.dtrApprovedByColMissing, true)
        : null;
      const { error } = await runtime.client
        .from("dtr_entries")
        .update({
          time_out: cappedOut,
          overtime_approved: true,
          ...(location && !openRow.location ? { location } : {}),
          ...(updatedJob ? { job: updatedJob } : {}),
        })
        .eq("id", openRow.id);
      if (error) throw error;
      dtrEntryId = String(openRow.id);
      savedTimeIn = openRow.time_in || "";
      savedTimeOut = cappedOut;
    } else if (lockedClosedRow) {
      // Preserve already-recorded Time Out (e.g. 7:00 PM stays 7:00 PM even if 7:01/7:21 PM arrives continuously)
      const lockedMeta = parseDtrJobMeta(lockedClosedRow.job, lockedClosedRow.approved_by);
      dtrEntryId = String(lockedClosedRow.id);
      savedTimeIn = lockedClosedRow.time_in || "";
      savedTimeOut = capDtrTimeOut(lockedClosedRow.time_in, lockedClosedRow.time_out, {
        workDate,
        nightshiftRepair: lockedMeta.nightshiftRepair,
      });
      keptLockedTimeOut = true;
    } else {
      const cappedOut = capDtrTimeOut(null, time24, ruleOpts);
      dtrEntryId = await insertDtrEntrySafe({
        user_id: state.userId,
        work_date: workDate,
        location: location || null,
        job: jobLabel || null,
        time_in: null,
        time_out: cappedOut,
        overtime_approved: true,
      });
      savedTimeOut = cappedOut;
    }
  }

  if (runtime.dtrCutoffKey !== "all") {
    runtime.dtrCutoffKey = getDtrCutoffForDate(workDate).key;
  }
  suppressNotifications();
  await loadDtrs();

  setVal("dtrDate", workDate);
  if (location && location !== "Field Site") setVal("dtrLocation", location);
  renderDtrUnitOptions();
  if (unit) setVal("dtrUnit", unit);
  if (scheduledJob) setVal("dtrJob", scheduledJob);
  if (savedTimeIn) setVal("dtrIn", savedTimeIn);
  if (savedTimeOut) setVal("dtrOut", savedTimeOut);
  const dtrNsEl = $("dtrNightshiftOrRepair") as HTMLInputElement | null;
  if (dtrNsEl) dtrNsEl.checked = nightshiftRepair;
  renderDtrLiveStatus();
  buildDtrPaper();

  return { dtrEntryId, savedTimeIn, savedTimeOut, keptLockedTimeOut };
}

export async function submitTimeLogPhoto(file: File): Promise<void> {
  if (!checkNetwork()) return;
  if (!isImageFile(file)) { toast("Please select an image file."); return; }
  const mode = runtime.timeLogMode || "time_in";
  const modeLabel = mode === "time_in" ? "Time In" : "Time Out";
  const modeIcon = mode === "time_in" ? "🟢" : "🔴";
  const senderName = state.profile?.full_name || profileName(state.userId) || state.email || "Technician";

  const schedWork = findScheduledWorkForUser(localDateKey(new Date()));
  const selectedSite = val("timeLogSite").trim() || schedWork?.siteName || "";
  const selectedUnit = val("timeLogUnit").trim() || schedWork?.unitName || "";
  const noteInp = $("timeLogNoteInput") as HTMLInputElement | null;
  const userNote = noteInp?.value.trim() || "";
  if (noteInp) noteInp.value = "";

  const statusEl = $("timeLogStatus");
  if (statusEl) statusEl.textContent = `Uploading & analyzing ${modeLabel} photo with AI…`;

  try {
    const imageDataUrl = await compressImageToDataUrl(file, 1024, 1024, 0.82);
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      throw new Error("Could not read selected image data.");
    }
    const mimeMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
    const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : (file.type || "image/jpeg");

    const payloadJson = JSON.stringify({
      imageBase64: imageDataUrl,
      imageDataUrl,
      mimeType,
      mode,
      expectedDate: localDateKey(new Date()),
      userName: senderName,
      selectedSite,
      selectedUnit,
    });

    const endpoints = ["/api/analyze-time-photo", "/.netlify/functions/analyze-time-photo"];
    let data: Record<string, any> | null = null;
    let lastErrorMessage = "";
    let gotHtmlFallback = false;

    for (const endpoint of endpoints) {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: payloadJson,
      });
      const rawText = await resp.text();
      const trimmed = rawText.trim();
      const looksLikeHtml = trimmed.startsWith("<") || /<!doctype/i.test(trimmed);
      let parsed: Record<string, any> | null = null;
      if (!looksLikeHtml && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          parsed = null;
        }
      }

      if (parsed && resp.ok && !parsed.error) {
        data = parsed;
        break;
      }

      if (looksLikeHtml || resp.status === 404 || resp.status === 405) {
        if (looksLikeHtml) gotHtmlFallback = true;
        lastErrorMessage = parsed?.error || `Endpoint ${endpoint} unavailable (HTTP ${resp.status}).`;
        continue;
      }

      throw new Error(parsed?.error || `Photo analysis failed (HTTP ${resp.status}).`);
    }

    if (!data) {
      if (gotHtmlFallback) {
        throw new Error(
          "Time-photo AI endpoint returned an HTML page instead of JSON. Ensure the Express server (`npm start`) or Netlify Functions with GEMINI_API_KEY are active."
        );
      }
      throw new Error(lastErrorMessage || "Photo analysis failed");
    }

    const isTimemarkHq = /^timemark-/i.test(file.name || "");
    const uploadFile = isTimemarkHq && file.size <= 10 * 1024 * 1024
      ? file
      : await prepareImageFile(file, 3840, 0.94);
    const safeName = (uploadFile.name || `${mode}.jpg`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${state.userId}/time-logs/${Date.now()}-${mode}-${safeName}`;
    const { error: upErr } = await runtime.client.storage
      .from("reports")
      .upload(storagePath, uploadFile, { upsert: false, contentType: uploadFile.type || "image/jpeg" });
    if (upErr) throw upErr;
    const { data: pubData } = runtime.client.storage.from("reports").getPublicUrl(storagePath);
    const publicImageUrl = pubData.publicUrl;

    const time24 = String(data.time24 || "").trim();
    const time12 = String(data.time12 || "").trim();
    const workDate = String(data.dateIso || "").trim() || localDateKey(new Date());
    const detectedLoc = selectedSite || String(data.locationText || "").trim() || "Field Site";
    const summary = String(data.summary || "").trim();

    if (!data.hasVisibleTime || !/^\d{2}:\d{2}$/.test(time24)) {
      await insertTimeLogEntry(
        {
          user_id: state.userId,
          sender_name: senderName,
          mode,
          work_date: workDate,
          location: detectedLoc || null,
          unit: selectedUnit || null,
          note: userNote || `Uploaded ${modeLabel} photo`,
          ai_summary: "⚠️ No clear timestamp visible on photo (" + (summary || "unreadable clock/watermark") + ")",
          image_url: publicImageUrl,
        },
        `${modeIcon} ${modeLabel} — ${senderName}`,
        `Uploaded ${modeLabel} photo at ${detectedLoc} (no clear timestamp detected by AI).`
      );
      const nextMode: "time_in" | "time_out" = mode === "time_in" ? "time_out" : "time_in";
      const nextLabel = nextMode === "time_out" ? "Time Out" : "Time In";
      if (tmCfg.autoFlipMode) {
        runtime.timeLogModeManual = false;
        setTimeLogMode(nextMode, false);
        try { if (state.userId) localStorage.setItem("eesi-next-timelog-mode:" + state.userId, nextMode); } catch {}
      }
      suppressNotifications();
      await loadAppNotifications();
      await loadTimeLogs();
      if (statusEl) {
        statusEl.textContent = `Uploaded to feed (no clear timestamp detected).${tmCfg.autoFlipMode ? ` Next upload ready: ${nextLabel}.` : ""}`;
      }
      toast(`Uploaded!${tmCfg.autoFlipMode ? ` Next upload switched to ${nextLabel}` : ""}`);
      return;
    }

    const timeLogNsRepair = Boolean(($("timeLogNightshiftOrRepair") as HTMLInputElement | null)?.checked);
    const slotResult = await writeAnalyzedTimeToDtr(mode, workDate, time24, detectedLoc, selectedUnit, summary, timeLogNsRepair);
    const slotText = `Time In: ${slotResult.savedTimeIn || "—"} | Time Out: ${slotResult.savedTimeOut || "—"}`;
    const lockedNote = slotResult.keptLockedTimeOut
      ? ` Time Out stayed locked at ${fmtTime12h(slotResult.savedTimeOut) || slotResult.savedTimeOut}.`
      : "";
    const aiReadingMsg = `Done reading! AI verified ${modeLabel}: ${time12 || time24} (${fmtDay(workDate)}) and updated DTR (${slotText}).${lockedNote}${summary ? " " + summary : ""}`;

    await insertTimeLogEntry(
      {
        user_id: state.userId,
        sender_name: senderName,
        mode,
        work_date: workDate,
        time_24: time24,
        time_12: time12 || time24,
        location: detectedLoc || null,
        unit: selectedUnit || null,
        note: userNote || null,
        ai_summary: aiReadingMsg,
        image_url: publicImageUrl,
        dtr_entry_id: slotResult.dtrEntryId,
      },
      `${modeIcon} ${modeLabel} — ${senderName}`,
      `AI Reading: ${time12 || time24} (${fmtDay(workDate)}) · Site: ${detectedLoc}${selectedUnit ? " (" + selectedUnit + ")" : ""} · ${slotResult.keptLockedTimeOut ? `Kept Time Out at ${fmtTime12h(slotResult.savedTimeOut) || slotResult.savedTimeOut}` : `Filled ${modeLabel} slot`}.`
    );

    const nextMode: "time_in" | "time_out" = mode === "time_in" ? "time_out" : "time_in";
    const nextLabel = nextMode === "time_out" ? "Time Out" : "Time In";
    if (tmCfg.autoFlipMode) {
      runtime.timeLogModeManual = false;
      setTimeLogMode(nextMode, false);
      try { if (state.userId) localStorage.setItem("eesi-next-timelog-mode:" + state.userId, nextMode); } catch {}
    }

    suppressNotifications();
    await loadAppNotifications();
    await loadTimeLogs();
    renderDtrLiveStatus();
    if (statusEl) {
      statusEl.textContent = slotResult.keptLockedTimeOut
        ? `✅ Uploaded! Time Out remained locked at ${fmtTime12h(slotResult.savedTimeOut) || slotResult.savedTimeOut} · ${slotText}`
        : `✅ Done reading! Filled ${modeLabel} (${time12 || time24}) · ${slotText}${tmCfg.autoFlipMode ? ` · Next upload: ${nextLabel}` : ""}`;
    }
    toast(
      slotResult.keptLockedTimeOut
        ? `🔴 Time Out kept at ${fmtTime12h(slotResult.savedTimeOut) || slotResult.savedTimeOut}`
        : `✅ ${modeLabel} (${time12 || time24}) saved!${tmCfg.autoFlipMode ? ` Next: ${nextLabel}` : ""}`
    );
  } catch (err: any) {
    const msg = err?.message || "Could not analyze photo";
    if (statusEl) statusEl.textContent = "Failed: " + msg;
    toast("Photo analysis error: " + msg);
  }
}

export function initSignature(): void {
  const c = $("signature") as HTMLCanvasElement | null;
  if (!c) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  let drawing = false;
  const pos = (e: MouseEvent | TouchEvent) => {
    const r = c.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) };
  };
  const start = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    drawing = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: MouseEvent | TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const stop = () => {
    if (!drawing) return;
    drawing = false;
    drawnSigDataUrl = c.toDataURL("image/png");
    try { localStorage.setItem("eesi-drawn-sig:" + state.userId, drawnSigDataUrl); } catch {}
  };
  c.addEventListener("mousedown", start);
  c.addEventListener("mousemove", move);
  window.addEventListener("mouseup", stop);
  c.addEventListener("touchstart", start, { passive: false });
  c.addEventListener("touchmove", move, { passive: false });
  c.addEventListener("touchend", stop);
}

export function clearSignature(): void {
  const c = $("signature") as HTMLCanvasElement | null;
  if (!c) return;
  c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  drawnSigDataUrl = "";
  if (state.userId) localStorage.removeItem("eesi-drawn-sig:" + state.userId);
}
export async function loadSavedDrawnSignature(): Promise<void> {
  const c = $("signature") as HTMLCanvasElement | null;
  if (!c || !state.userId) return;
  const saved = localStorage.getItem("eesi-drawn-sig:" + state.userId);
  if (!saved) return;
  const img = new Image();
  img.onload = () => { c.getContext("2d")?.drawImage(img, 0, 0); };
  img.src = saved;
  drawnSigDataUrl = saved;
}
export function loadSavedSignaturePhoto(): void {
  if (!state.userId) return;
  const saved = localStorage.getItem("eesi-sig-photo:" + state.userId);
  if (!saved) return;
  signaturePhotoDataUrl = saved;
  const img = $("signaturePhotoPreview") as HTMLImageElement | null;
  if (img) { img.src = saved; img.classList.remove("hidden"); }
}
export function clearSignaturePhoto(): void {
  signaturePhotoDataUrl = "";
  const img = $("signaturePhotoPreview") as HTMLImageElement | null;
  if (img) { img.removeAttribute("src"); img.classList.add("hidden"); }
  const sp = $("signaturePhoto") as HTMLInputElement | null;
  if (sp) sp.value = "";
  if (state.userId) localStorage.removeItem("eesi-sig-photo:" + state.userId);
}
export function resetSignatureState(): void {
  signaturePhotoDataUrl = "";
  drawnSigDataUrl = "";
  const img = $("signaturePhotoPreview") as HTMLImageElement | null;
  if (img) { img.removeAttribute("src"); img.classList.add("hidden"); }
  const c = $("signature") as HTMLCanvasElement | null;
  if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
}
export function openEditDtr(id: string): void {
  const row = (state.dtrs || []).find(d => String(d.id) === String(id));
  if (!row) return;
  if (String(row.user_id) !== String(state.userId) && !isManager()) {
    toast("You can only edit your own DTR entries.");
    return;
  }
  runtime.editingDtrId = String(row.id);
  const meta = parseDtrJobMeta(row.job, row.approved_by);
  setVal("editDtrDate", String(row.work_date || ""));
  setVal("editDtrLocation", String(row.location || ""));
  setVal("editDtrUnit", meta.unitName || "");
  setVal("editDtrJob", meta.cleanJob || "");
  setVal("editDtrIn", String(row.time_in || ""));
  setVal("editDtrOut", String(row.time_out || ""));
  setVal("editDtrApprovedBy", meta.approvedBy || "");
  const nsBox = $("editDtrNightshiftOrRepair") as HTMLInputElement | null;
  if (nsBox) nsBox.checked = meta.nightshiftRepair;
  const otWrap = $("editDtrOvertimeWrap");
  if (otWrap) otWrap.classList.remove("hidden");
  const otBox = $("editDtrOvertimeApproved") as HTMLInputElement | null;
  if (otBox) otBox.checked = true;
  $("dtrEditOverlay")?.classList.remove("hidden");
}

export function closeEditDtr(): void {
  $("dtrEditOverlay")?.classList.add("hidden");
  runtime.editingDtrId = null;
}

export async function saveEditedDtr(): Promise<void> {
  if (!runtime.editingDtrId || !checkNetwork()) return;
  const workDate = val("editDtrDate").trim();
  if (!workDate) { toast("Date is required"); return; }
  const location = val("editDtrLocation").trim();
  const unitName = val("editDtrUnit").trim();
  const cleanJob = val("editDtrJob").trim();
  const timeIn = val("editDtrIn").trim();
  const nightshiftRepair = Boolean(($("editDtrNightshiftOrRepair") as HTMLInputElement | null)?.checked);
  const timeOut = capDtrTimeOut(timeIn, val("editDtrOut").trim(), { workDate, nightshiftRepair });
  const approvedBy = val("editDtrApprovedBy").trim();

  const basePayload: Record<string, any> = {
    work_date: workDate,
    location: location || null,
    job: buildDtrJobWithApproval(unitName, cleanJob, approvedBy, runtime.dtrApprovedByColMissing, nightshiftRepair) || null,
    time_in: timeIn || null,
    time_out: timeOut || null,
    overtime_approved: true,
  };
  if (!runtime.dtrApprovedByColMissing) basePayload.approved_by = approvedBy || null;

  try {
    let { error } = await runtime.client.from("dtr_entries").update(basePayload).eq("id", runtime.editingDtrId);
    if (error && /approved_by|42703|schema cache/i.test(String(error.message || ""))) {
      runtime.dtrApprovedByColMissing = true;
      delete basePayload.approved_by;
      basePayload.job = buildDtrJobWithApproval(unitName, cleanJob, approvedBy, true, nightshiftRepair) || null;
      const retry = await runtime.client.from("dtr_entries").update(basePayload).eq("id", runtime.editingDtrId);
      error = retry.error;
    }
    if (error && (error.code === "23502" || /violates not-null constraint/i.test(error.message || ""))) {
      const retryNull = await runtime.client
        .from("dtr_entries")
        .update({
          ...basePayload,
          location: location || "",
          job: basePayload.job || "",
          time_in: timeIn || "",
          time_out: timeOut || "",
        })
        .eq("id", runtime.editingDtrId);
      error = retryNull.error;
    }
    if (error) throw error;
    closeEditDtr();
    suppressNotifications();
    await loadDtrs();
    renderHomeDtrStatus();
    renderDtrLiveStatus();
    buildDtrPaper();
    toast("DTR entry updated");
  } catch (err: any) {
    toast("Could not update DTR: " + (err?.message || err));
  }
}

function buildDtrPaper(): void {
  renderDtrCutoffOptions();
  const pickedUid = isManager() && val("dtrPreviewEmployee") ? val("dtrPreviewEmployee") : String(state.userId || "");
  const employeeRows = state.dtrs.filter(d => String(d.user_id) === String(pickedUid));
  const { rows } = filterDtrRowsByCutoff(employeeRows, getActiveDtrCutoffKey());
  const isOwn = String(pickedUid) === String(state.userId);
  const sigUrl = isOwn ? (signaturePhotoDataUrl || drawnSigDataUrl || "") : "";
  runtime.activeDtrSigDataUrl = sigUrl;
  const sig = sigUrl ? '<img src="' + esc(sigUrl) + '" alt="Signature">' : "";

  const dayMetaMap = new Map<string, { firstIn: string | null; lastOut: string | null; mins: number; nsRepair: boolean }>();
  rows.forEach(d => {
    const meta = parseDtrJobMeta(d.job, d.approved_by);
    const dayKey = `${String(d.work_date || "")}::${String(d.user_id || "")}`;
    const ruleOpts = { workDate: d.work_date, nightshiftRepair: meta.nightshiftRepair };
    const mins = calculateDtrMinutes(d.time_in, d.time_out, null, ruleOpts);
    const capped = capDtrTimeOut(d.time_in, d.time_out, ruleOpts);
    const cur = dayMetaMap.get(dayKey) || { firstIn: null, lastOut: null, mins: 0, nsRepair: false };
    if (!cur.firstIn && d.time_in) cur.firstIn = d.time_in;
    if (capped && capped !== d.time_in) cur.lastOut = capped;
    cur.mins += mins;
    if (meta.nightshiftRepair) cur.nsRepair = true;
    dayMetaMap.set(dayKey, cur);
  });

  const body = rows.map(d => {
    const meta = parseDtrJobMeta(d.job, d.approved_by);
    const isSunday = isSundayDate(d.work_date);
    const ruleOpts = { workDate: d.work_date, nightshiftRepair: meta.nightshiftRepair };
    const dayKey = `${String(d.work_date || "")}::${String(d.user_id || "")}`;
    const dayInfo = dayMetaMap.get(dayKey);
    const dayBd = dayInfo
      ? calculateShiftBreakdown(dayInfo.firstIn, dayInfo.lastOut, dayInfo.mins, {
          workDate: d.work_date,
          nightshiftRepair: dayInfo.nsRepair,
        })
      : null;
    const hasDailyOt = Boolean(dayBd && dayBd.finalOtMins > 0);
    const tIn = fmtTime12h(d.time_in);
    const tOut = fmtTime12h(capDtrTimeOut(d.time_in, d.time_out, ruleOpts));
    const timeRange = (tIn && tOut) ? `${tIn} - ${tOut}` : (tIn || tOut || "—");
    const desc = [meta.cleanJob, meta.unitName ? `(${meta.unitName})` : ""].filter(Boolean).join(" ") || meta.unitName || "";
    const approvedTxt = meta.approvedBy ||
      (isSunday ? "SUNDAY DUTY" : ((hasDailyOt || calculateOtMinutes(d.time_in, d.time_out, ruleOpts) > 0) ? "EXTEND" : ""));
    return '<tr class="clickable" data-edit-dtr="' + esc(d.id) + '" title="Tap to edit DTR entry">' +
      "<td>" + esc(fmtHalfSheetDate(d.work_date)) + "</td>" +
      "<td>" + esc(d.location || "") + "</td>" +
      '<td class="dp-desc-cell">' + esc(desc) + "</td>" +
      '<td class="dp-time-cell">' + esc(timeRange) + "</td>" +
      "<td>" + esc(approvedTxt) + "</td></tr>";
  }).join("") || '<tr><td colspan="5" class="dp-empty">No entries for this cutoff period. Tap Fill DTR to add logs.</td></tr>';
  const paper = $("dtrPaper");
  if (paper) {
    paper.innerHTML =
      '<table class="dp-table">' +
      '<tr><th colspan="5" class="dp-sheet-title">DAILY TIME RECORD &amp; AUTHORITY TO CONDUCT OVERTIME</th></tr>' +
      '<tr class="dp-col-head">' +
      '<th style="width:11%">DATE</th>' +
      '<th style="width:20%">LOCATION</th>' +
      '<th style="width:37%">WORK DESCRIPTION</th>' +
      '<th style="width:19%">TIME START/END</th>' +
      '<th style="width:13%">APPROVED BY:</th>' +
      "</tr>" +
      body +
      "</table>" +
      '<div class="dp-employee-sign">' + sig +
      '<div class="dp-employee-name">' + esc(employeeDisplayName(pickedUid).toUpperCase()) + "</div>" +
      '<div class="dp-employee-caption">Signature Over Printed Name of Employee</div>' +
      "</div>";
  }
  syncDtrThreeStepUi();
}

/* ==================== TIMEMARK CAMERA ==================== */
const TIMEMARK_FAR_SITE_THRESHOLD_METERS = 500;
let timemarkStream: MediaStream | null = null;
let timemarkFacing: "environment" | "user" = "environment";
let timemarkTimer: any = null;
let timemarkCoordsText = "GPS locating…";
let timemarkCurrentCoords: { lat: number; lng: number; acc: number; alt?: number | null; heading?: number | null } | null = null;
let timemarkProximityAlert: { rawMeters: number; effectiveMeters: number; distanceLabel: string; siteName: string } | null = null;
let timemarkProxCheckSeq = 0;
let timemarkZoomLevel = 1.0;
let timemarkFlashOn = false;
let timemarkCountdownTimer: any = null;
let timemarkFocusTimer: any = null;
let timemarkStreamSeq = 0;
let timemarkCapturing = false;
let timemarkLastPreviewUrl = "";
let timemarkPhotoCode = "";
let timemarkAddressText = "";
let timemarkRevGeocodeKey = "";
let timemarkMiniMapLoadedUrl = "";

type TimemarkTemplateId = "clock_in" | "time_loc" | "work_report" | "inspection" | "service" | "photo_code";
type TimemarkResolution = "720p" | "1080p" | "4k";

interface TimemarkConfig {
  templateId: TimemarkTemplateId;
  resolution: TimemarkResolution;
  showGrid: boolean;
  showLogo: boolean;
  showTitle: boolean;
  customTitle: string;
  showStyledNote: boolean;
  styledNoteText: string;
  styledNoteBoxed: boolean;
  styledNoteColor: string;
  showTime: boolean;
  showAddress: boolean;
  showCoordinate: boolean;
  showMap: boolean;
  showWeather: boolean;
  showAltitude: boolean;
  showCompass: boolean;
  showNotes: boolean;
  notesText: string;
  showPhotoCode: boolean;
  accentColor: string;
  ratio: "3:4" | "1:1" | "full";
  timerSeconds: 0 | 3 | 5;
  autoSaveOriginal: boolean;
  autoFlipMode: boolean;
}

const DEFAULT_TIMEMARK_CFG: TimemarkConfig = {
  templateId: "clock_in",
  resolution: "4k",
  showGrid: true,
  showLogo: true,
  showTitle: true,
  customTitle: "",
  showStyledNote: false,
  styledNoteText: "On Duty",
  styledNoteBoxed: true,
  styledNoteColor: "#ffffff",
  showTime: true,
  showAddress: true,
  showCoordinate: false,
  showMap: true,
  showWeather: false,
  showAltitude: false,
  showCompass: false,
  showNotes: false,
  notesText: "",
  showPhotoCode: true,
  accentColor: "#fbbf24",
  ratio: "3:4",
  timerSeconds: 0,
  autoSaveOriginal: false,
  autoFlipMode: true,
};

let tmCfg: TimemarkConfig = { ...DEFAULT_TIMEMARK_CFG };
let tmCfgLoadedForUser = "";

function getTimemarkResolutionSpec(res: TimemarkResolution = tmCfg.resolution) {
  if (res === "720p") {
    return { idealW: 1280, idealH: 720, portraitBase: 720, landscapeBase: 1280, quality: 0.91, label: "720P HD" };
  }
  if (res === "1080p") {
    return { idealW: 1920, idealH: 1080, portraitBase: 1080, landscapeBase: 1920, quality: 0.94, label: "1080P FHD" };
  }
  return { idealW: 3840, idealH: 2160, portraitBase: 2160, landscapeBase: 3840, quality: 0.96, label: "4K UHD" };
}

function generateTimemarkPhotoCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 14; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function loadTimemarkConfig(): void {
  const uid = String(state.userId || "anon");
  if (tmCfgLoadedForUser === uid) return;
  tmCfgLoadedForUser = uid;
  try {
    const raw = localStorage.getItem("eesi-timemark-cfg:" + uid);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        tmCfg = { ...DEFAULT_TIMEMARK_CFG, ...parsed };
        return;
      }
    }
  } catch {}
  tmCfg = { ...DEFAULT_TIMEMARK_CFG };
}

function saveTimemarkConfig(): void {
  const uid = String(state.userId || "anon");
  try {
    localStorage.setItem("eesi-timemark-cfg:" + uid, JSON.stringify(tmCfg));
  } catch {}
}

function formatProximityDist(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

function formatCompassHeading(heading: number | null | undefined): string {
  if (heading === null || heading === undefined || !Number.isFinite(heading)) return "N 0°";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(((heading % 360) + 360) % 360 / 45) % 8;
  return `${Math.round(((heading % 360) + 360) % 360)}° ${dirs[idx]}`;
}

async function resolveTimemarkAddressForCoords(lat: number, lng: number): Promise<void> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (timemarkRevGeocodeKey === key && timemarkAddressText) return;
  timemarkRevGeocodeKey = key;
  const rev = await fetchReverseGeocode(lat, lng);
  if (rev?.formattedAddress) {
    timemarkAddressText = rev.formattedAddress;
    updateTimemarkHud();
  }
}

function updateTimemarkMiniMap(lat: number, lng: number): void {
  const card = $("timemarkMiniMapCard");
  const img = $("timemarkMiniMapImg") as HTMLImageElement | null;
  if (!card || !img) return;
  if (!tmCfg.showMap || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  const url = `/api/site-photo?tile=1&sat=1&lat=${encodeURIComponent(lat.toFixed(5))}&lng=${encodeURIComponent(lng.toFixed(5))}&z=17`;
  if (timemarkMiniMapLoadedUrl !== url) {
    timemarkMiniMapLoadedUrl = url;
    img.src = url;
  }
}

async function evaluateTimemarkSiteProximity(): Promise<void> {
  const seq = ++timemarkProxCheckSeq;
  const warnEl = $("timemarkDistanceWarning");
  const warnTxtEl = $("timemarkDistanceWarningText");

  if (runtime.timeLogMode !== "time_in") {
    timemarkProximityAlert = null;
    warnEl?.classList.add("hidden");
    updateTimemarkHud();
    return;
  }

  const sched = findScheduledWorkForUser(localDateKey(new Date()));
  const siteName = val("timemarkSiteSelect").trim() || val("timeLogSite").trim() || sched?.siteName || "";
  const userCoords = timemarkCurrentCoords || getCachedUserGpsCoords();
  if (!siteName || !userCoords) {
    timemarkProximityAlert = null;
    warnEl?.classList.add("hidden");
    updateTimemarkHud();
    return;
  }

  const siteCoords = await resolveSiteCoordinatesByName(siteName);
  if (seq !== timemarkProxCheckSeq) return;
  if (!siteCoords) {
    timemarkProximityAlert = null;
    warnEl?.classList.add("hidden");
    updateTimemarkHud();
    return;
  }

  const rawMeters = haversineMeters(userCoords.lat, userCoords.lng, siteCoords.lat, siteCoords.lng);
  const accMargin = Math.min(Math.max(0, userCoords.acc || 0), 200);
  const effectiveMeters = Math.max(0, rawMeters - accMargin);

  if (effectiveMeters > TIMEMARK_FAR_SITE_THRESHOLD_METERS) {
    const distanceLabel = formatProximityDist(rawMeters);
    timemarkProximityAlert = {
      rawMeters,
      effectiveMeters,
      distanceLabel,
      siteName: siteCoords.name,
    };
    if (warnTxtEl) {
      warnTxtEl.textContent =
        `Far from work site: You are ~${distanceLabel} away from ${siteCoords.name} (outside ${TIMEMARK_FAR_SITE_THRESHOLD_METERS} m Time-In radius). Move closer or verify the selected work site.`;
    }
    warnEl?.classList.remove("hidden");
  } else {
    timemarkProximityAlert = null;
    warnEl?.classList.add("hidden");
  }
  updateTimemarkHud();
}

function getTimemarkStampData() {
  const now = new Date();
  const isOut = runtime.timeLogMode === "time_out";
  const sched = findScheduledWorkForUser(localDateKey(now));
  const selectedSite = val("timemarkSiteSelect").trim() || val("timeLogSite").trim() || sched?.siteName || "";
  const unit = val("timeLogUnit").trim() || sched?.unitName || "";
  const siteObj = selectedSite ? state.sites.find(s => String(s.name || "").trim().toLowerCase() === selectedSite.toLowerCase()) : null;
  const siteFull = [selectedSite, siteObj?.address, siteObj?.city].filter(Boolean).join(", ");
  const addressDisplay = timemarkAddressText || siteFull || "EESI Field Site";
  const timeShort = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateDisplay = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit", year: "numeric" });
  const titleText = tmCfg.customTitle.trim() || (isOut ? "TIME OUT" : "TIME IN");
  const coordDisplay = timemarkCurrentCoords
    ? `${timemarkCurrentCoords.lat.toFixed(5)}°, ${timemarkCurrentCoords.lng.toFixed(5)}°`
    : timemarkCoordsText;
  const weatherElText = ($("weather")?.textContent || "").trim() || "29°C · Clear";
  const altText = timemarkCurrentCoords?.alt !== null && timemarkCurrentCoords?.alt !== undefined && Number.isFinite(timemarkCurrentCoords.alt)
    ? `${Math.round(timemarkCurrentCoords.alt)} m`
    : "14 m";
  const compassText = formatCompassHeading(timemarkCurrentCoords?.heading);
  const whoStr = state.profile?.full_name || state.email || "EESI Technician";
  return {
    now,
    isOut,
    selectedSite,
    unit,
    addressDisplay,
    timeShort,
    dateDisplay,
    titleText,
    coordDisplay,
    weatherElText,
    altText,
    compassText,
    whoStr,
  };
}

function buildTimemarkStampHtml(compact = false): string {
  const d = getTimemarkStampData();
  if (!timemarkPhotoCode) timemarkPhotoCode = generateTimemarkPhotoCode();

  const logoSvg = tmCfg.showLogo
    ? `<span class="tm-stamp-logo"><svg viewBox="0 0 356 196" aria-hidden="true"><use href="#eesiLogo"/></svg></span>`
    : "";

  const styledNoteHtml = tmCfg.showStyledNote && tmCfg.styledNoteText.trim()
    ? `<div class="tm-stamp-styled-note" style="${
        tmCfg.styledNoteBoxed
          ? `background:${esc(tmCfg.styledNoteColor)};color:${tmCfg.styledNoteColor.toLowerCase() === "#ffffff" ? "#0f172a" : "#ffffff"};`
          : `background:transparent;color:${esc(tmCfg.styledNoteColor)};text-shadow:0 1px 4px rgba(0,0,0,.95);padding:0;`
      }">${esc(tmCfg.styledNoteText)}</div>`
    : "";

  const extraLines: string[] = [];
  if (tmCfg.showCoordinate) extraLines.push(`🧭 ${d.coordDisplay}`);
  if (tmCfg.showWeather) extraLines.push(`🌤️ ${d.weatherElText}`);
  if (tmCfg.showAltitude) extraLines.push(`⛰️ Alt: ${d.altText}`);
  if (tmCfg.showCompass) extraLines.push(`🧭 ${d.compassText}`);
  if (tmCfg.showNotes && tmCfg.notesText.trim()) extraLines.push(`📝 ${tmCfg.notesText.trim()}`);
  if (runtime.timeLogMode === "time_in" && timemarkProximityAlert && !compact) {
    extraLines.push(`<span style="color:#fecaca;font-weight:800;">⚠️ ~${esc(timemarkProximityAlert.distanceLabel)} from ${esc(timemarkProximityAlert.siteName)}</span>`);
  }

  const codeLine = tmCfg.showPhotoCode
    ? `<div class="tm-stamp-code"><span style="display:inline-grid;place-items:center;width:15px;height:15px;border-radius:50%;background:#38bdf8;color:#0f172a;font-size:10px;font-weight:900;">✓</span> Photo Code: ${esc(timemarkPhotoCode)}</div>`
    : "";

  if (tmCfg.templateId === "work_report" || tmCfg.templateId === "service") {
    const hdrBg = tmCfg.templateId === "service" ? "#1e6cf2" : tmCfg.accentColor;
    const hdrCol = tmCfg.templateId === "service" ? "#ffffff" : "#111827";
    const hdrLabel = tmCfg.templateId === "service" ? "EESI Service Report" : "Work Report";
    return `<div class="tm-stamp-card-report">` +
      `<div class="tm-rep-head" style="background:${esc(hdrBg)};color:${hdrCol};"><span>${esc(hdrLabel)} · ${esc(d.titleText)}</span>${logoSvg}</div>` +
      `<div class="tm-rep-body">` +
      styledNoteHtml +
      (tmCfg.showTime ? `<div><b>${esc(d.timeShort)}</b> · ${esc(d.dateDisplay)}</div>` : "") +
      `<div><b>Tech:</b> ${esc(d.whoStr)}${d.unit ? ` · ${esc(d.unit)}` : ""}</div>` +
      (tmCfg.showAddress ? `<div><b>Site:</b> ${esc(d.selectedSite ? `${d.selectedSite} — ` : "")}${esc(d.addressDisplay)}</div>` : "") +
      (extraLines.length ? `<div>${extraLines.join(" · ")}</div>` : "") +
      (tmCfg.showPhotoCode ? `<div style="margin-top:3px;color:#0369a1;font-weight:700;">🛡️ Photo Code: ${esc(timemarkPhotoCode)}</div>` : "") +
      `</div></div>`;
  }

  if (tmCfg.templateId === "inspection") {
    return `<div class="tm-stamp-card-dark" style="border-left-color:${esc(tmCfg.accentColor)};">` +
      styledNoteHtml +
      `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">` +
        `<span style="background:${esc(tmCfg.accentColor)};color:#111827;font-weight:900;font-size:11px;padding:2px 7px;border-radius:5px;" onclick="toggleTimemarkModeInsideCam()">${esc(d.titleText)}</span>` +
        logoSvg +
      `</div>` +
      (tmCfg.showTime ? `<div style="font-size:18px;font-weight:900;">${esc(d.timeShort)} <span style="font-size:11px;font-weight:600;opacity:.85;">${esc(d.dateDisplay)}</span></div>` : "") +
      (tmCfg.showAddress ? `<div style="font-size:11.5px;margin-top:3px;">${esc(d.selectedSite ? `${d.selectedSite} · ` : "")}${esc(d.addressDisplay)}</div>` : "") +
      `<div style="font-size:11px;opacity:.9;margin-top:3px;">🧭 ${esc(d.compassText)} · ⛰️ ${esc(d.altText)}</div>` +
      (extraLines.length ? `<div style="font-size:11px;margin-top:2px;">${extraLines.join(" · ")}</div>` : "") +
      codeLine +
      `</div>`;
  }

  if (tmCfg.templateId === "time_loc") {
    return `${styledNoteHtml}` +
      `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">` +
      (tmCfg.showTime ? `<span style="font-size:28px;font-weight:900;letter-spacing:-.02em;">${esc(d.timeShort)}</span>` : "") +
      `<span style="font-size:12px;font-weight:700;">${esc(d.dateDisplay)}</span>` +
      (tmCfg.showLogo ? logoSvg : "") +
      `</div>` +
      `<div class="tm-stamp-lines">` +
      (tmCfg.showTitle ? `<span style="background:${esc(tmCfg.accentColor)};color:#111827;padding:1px 6px;border-radius:4px;font-weight:800;margin-right:5px;" onclick="toggleTimemarkModeInsideCam()">${esc(d.titleText)}</span>` : "") +
      (tmCfg.showAddress ? esc((d.selectedSite ? `${d.selectedSite} · ` : "") + d.addressDisplay) : "") +
      (extraLines.length ? `<div>${extraLines.join(" · ")}</div>` : "") +
      `</div>` + codeLine;
  }

  // Default "clock_in" & "photo_code" matching the exact video stamp
  const showHeaderBar = tmCfg.showTitle || tmCfg.showTime || tmCfg.showLogo;
  const headerBar = showHeaderBar
    ? `<div class="tm-stamp-bar">` +
      (tmCfg.showTitle
        ? `<span class="tm-stamp-badge${d.isOut ? " is-out" : ""}" style="background:${esc(tmCfg.accentColor)};" onclick="toggleTimemarkModeInsideCam()" title="Tap to switch Time In / Time Out">${esc(d.titleText)}</span>`
        : "") +
      (tmCfg.showTime ? `<span class="tm-stamp-clock">${esc(d.timeShort)}</span>` : "") +
      logoSvg +
      `</div>`
    : "";

  const addressFull = d.selectedSite && !d.addressDisplay.toLowerCase().includes(d.selectedSite.toLowerCase())
    ? `${d.selectedSite} · ${d.addressDisplay}`
    : d.addressDisplay;

  return `${styledNoteHtml}${headerBar}` +
    `<div class="tm-stamp-lines">` +
      (tmCfg.showTime || tmCfg.templateId === "clock_in" ? `<div>${esc(d.dateDisplay)}</div>` : "") +
      (tmCfg.showAddress ? `<div>${esc(addressFull)}${d.unit ? ` · ${esc(d.unit)}` : ""}</div>` : "") +
      (extraLines.length ? `<div>${extraLines.join(" · ")}</div>` : "") +
    `</div>` +
    codeLine;
}

function syncTimemarkSiteSelectOptions(): void {
  const sel = $("timemarkSiteSelect") as HTMLSelectElement | null;
  if (!sel) return;
  const current = val("timemarkSiteSelect") || val("timeLogSite") || findScheduledWorkForUser(localDateKey(new Date()))?.siteName || "";
  const names = [...new Set(state.sites.map(s => String(s.name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  sel.innerHTML = '<option value="">Auto / Detect Site…</option>' +
    names.map(n => `<option value="${esc(n)}"${n === current ? " selected" : ""}>${esc(n)}</option>`).join("");
  if (current && names.includes(current)) sel.value = current;
}

function updateTimemarkResReadout(): void {
  const el = $("timemarkResReadout");
  if (!el) return;
  const spec = getTimemarkResolutionSpec();
  const vid = $("timemarkVideo") as HTMLVideoElement | null;
  const vw = vid?.videoWidth || 0;
  const vh = vid?.videoHeight || 0;
  el.textContent = vw > 0 && vh > 0 ? `${spec.label} · ${vw}×${vh}` : spec.label;
}

function updateTimemarkHud(): void {
  const stampEl = $("timemarkStamp");
  if (stampEl) {
    const nextHtml = buildTimemarkStampHtml(false);
    if (stampEl.dataset.lastHtml !== nextHtml) {
      stampEl.innerHTML = nextHtml;
      stampEl.dataset.lastHtml = nextHtml;
    }
  }

  const stage = $("timemarkStage");
  if (stage) {
    stage.classList.remove("ratio-3-4", "ratio-1-1", "ratio-full");
    stage.classList.add(tmCfg.ratio === "1:1" ? "ratio-1-1" : tmCfg.ratio === "full" ? "ratio-full" : "ratio-3-4");
  }

  const gridEl = $("timemarkGridOverlay");
  if (gridEl) gridEl.classList.toggle("hidden", !tmCfg.showGrid);

  updateTimemarkResReadout();

  const qBtn = $("timemarkModeQuickBtn");
  if (qBtn) {
    qBtn.textContent = runtime.timeLogMode === "time_out" ? "🔴 TIME OUT" : "🟢 TIME IN";
  }

  if (timemarkCurrentCoords) {
    updateTimemarkMiniMap(timemarkCurrentCoords.lat, timemarkCurrentCoords.lng);
  } else {
    $("timemarkMiniMapCard")?.classList.add("hidden");
  }

  const editPrev = $("timemarkEditPreviewWrap");
  if (editPrev && !$("timemarkEditDrawer")?.classList.contains("hidden")) {
    const nextPrev = `<div style="position:relative;pointer-events:none;">${buildTimemarkStampHtml(true)}</div>`;
    if (editPrev.dataset.lastHtml !== nextPrev) {
      editPrev.innerHTML = nextPrev;
      editPrev.dataset.lastHtml = nextPrev;
    }
  }
}

function syncTimemarkControlUi(): void {
  const vid = $("timemarkVideo") as HTMLVideoElement | null;
  if (vid) {
    vid.classList.toggle("is-mirrored", timemarkFacing === "user");
    vid.style.transform = timemarkFacing === "user"
      ? `scaleX(-1) scale(${timemarkZoomLevel})`
      : `scale(${timemarkZoomLevel})`;
  }
  const zBtn = $("timemarkZoomBtn");
  if (zBtn) zBtn.textContent = `${timemarkZoomLevel.toFixed(1)}x`;
  $("timemarkFlashBtn")?.classList.toggle("active", timemarkFlashOn);
  $("timemarkGridBtn")?.classList.toggle("active", tmCfg.showGrid);
  $("timemarkGridOverlay")?.classList.toggle("hidden", !tmCfg.showGrid);

  document.querySelectorAll<HTMLElement>("[data-tm-res]").forEach(b =>
    b.classList.toggle("active", b.dataset.tmRes === (tmCfg.resolution || "4k"))
  );
  document.querySelectorAll<HTMLElement>("[data-tm-ratio]").forEach(b =>
    b.classList.toggle("active", b.dataset.tmRatio === tmCfg.ratio)
  );
  document.querySelectorAll<HTMLElement>("[data-tm-timer]").forEach(b =>
    b.classList.toggle("active", Number(b.dataset.tmTimer) === tmCfg.timerSeconds)
  );
  const gridT = $("tmMenuGridToggle") as HTMLInputElement | null;
  const logoT = $("tmMenuLogoToggle") as HTMLInputElement | null;
  const saveOrigT = $("tmMenuSaveOrigToggle") as HTMLInputElement | null;
  const autoFlipT = $("tmMenuAutoFlipToggle") as HTMLInputElement | null;
  if (gridT) gridT.checked = tmCfg.showGrid;
  if (logoT) logoT.checked = tmCfg.showLogo;
  if (saveOrigT) saveOrigT.checked = tmCfg.autoSaveOriginal;
  if (autoFlipT) autoFlipT.checked = tmCfg.autoFlipMode;

  const capBtn = $("timemarkCaptureBtn") as HTMLButtonElement | null;
  if (capBtn) capBtn.disabled = timemarkCapturing;

  const prevThumb = $("timemarkPreviewThumb");
  if (prevThumb) {
    prevThumb.innerHTML = timemarkLastPreviewUrl
      ? `<img src="${esc(timemarkLastPreviewUrl)}" alt="Last captured photo">`
      : "🖼️";
  }
  updateTimemarkResReadout();
}

export function toggleTimemarkSideMenu(force?: boolean): void {
  const el = $("timemarkSideMenu");
  if (!el) return;
  const nextOpen = typeof force === "boolean" ? force : el.classList.contains("hidden");
  el.classList.toggle("hidden", !nextOpen);
  if (nextOpen) syncTimemarkControlUi();
}

export function setTimemarkResolution(res: TimemarkResolution): void {
  if (tmCfg.resolution === res && timemarkStream) {
    syncTimemarkControlUi();
    return;
  }
  tmCfg.resolution = res;
  saveTimemarkConfig();
  syncTimemarkControlUi();
  updateTimemarkHud();
  toast(`Camera quality: ${getTimemarkResolutionSpec(res).label}`);
  if (!$("timemarkCamOverlay")?.classList.contains("hidden")) {
    void startTimemarkCameraStream();
  }
}

export function setTimemarkGridEnabled(on: boolean): void {
  tmCfg.showGrid = !!on;
  saveTimemarkConfig();
  syncTimemarkControlUi();
}

export function toggleTimemarkGrid(): void {
  setTimemarkGridEnabled(!tmCfg.showGrid);
}

export async function focusTimemarkAt(ev: MouseEvent): Promise<void> {
  const wrap = $("timemarkVideoWrap");
  const ring = $("timemarkFocusRing");
  if (!wrap || !ring) return;
  const rect = wrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = Math.max(24, Math.min(rect.width - 24, ev.clientX - rect.left));
  const y = Math.max(24, Math.min(rect.height - 24, ev.clientY - rect.top));
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.classList.remove("show");
  void ring.offsetWidth;
  ring.classList.add("show");
  clearTimeout(timemarkFocusTimer);
  timemarkFocusTimer = setTimeout(() => ring.classList.remove("show"), 900);

  const track = timemarkStream?.getVideoTracks?.()[0];
  if (track && typeof track.applyConstraints === "function") {
    try {
      const caps = (track.getCapabilities?.() as any) || {};
      const nx = Math.max(0, Math.min(1, x / rect.width));
      const ny = Math.max(0, Math.min(1, y / rect.height));
      if (caps.focusMode && Array.isArray(caps.focusMode)) {
        const mode = caps.focusMode.includes("single-shot") ? "single-shot" : (caps.focusMode.includes("continuous") ? "continuous" : null);
        if (mode) {
          await track.applyConstraints({ advanced: [{ focusMode: mode, ...(caps.pointsOfInterest ? { pointsOfInterest: [{ x: nx, y: ny }] } : {}) } as any] });
        }
      }
    } catch {}
  }
}

export function setTimemarkRatio(ratio: "3:4" | "1:1" | "full"): void {
  tmCfg.ratio = ratio;
  saveTimemarkConfig();
  syncTimemarkControlUi();
  updateTimemarkHud();
}

export function setTimemarkTimer(sec: 0 | 3 | 5): void {
  tmCfg.timerSeconds = sec;
  saveTimemarkConfig();
  syncTimemarkControlUi();
  toast(sec ? `Timer set to ${sec}s` : "Timer off");
}

export function setTimemarkLogoEnabled(on: boolean): void {
  tmCfg.showLogo = !!on;
  saveTimemarkConfig();
  updateTimemarkHud();
}

export function setTimemarkAutoSaveOriginal(on: boolean): void {
  tmCfg.autoSaveOriginal = !!on;
  saveTimemarkConfig();
}

export function setTimemarkAutoFlip(on: boolean): void {
  tmCfg.autoFlipMode = !!on;
  saveTimemarkConfig();
}

export async function toggleTimemarkFlash(): Promise<void> {
  timemarkFlashOn = !timemarkFlashOn;
  syncTimemarkControlUi();
  const track = timemarkStream?.getVideoTracks?.()[0];
  if (track && typeof track.applyConstraints === "function") {
    try {
      const caps = (track.getCapabilities?.() as any) || {};
      if (caps.torch) {
        await track.applyConstraints({ advanced: [{ torch: timemarkFlashOn } as any] });
        return;
      }
    } catch {}
  }
  toast(timemarkFlashOn ? "Flash ready" : "Flash off");
}

export async function cycleTimemarkZoom(): Promise<void> {
  const steps = [1.0, 1.5, 2.0];
  const idx = steps.findIndex(z => Math.abs(z - timemarkZoomLevel) < 0.05);
  timemarkZoomLevel = steps[(idx + 1) % steps.length];
  syncTimemarkControlUi();
  const track = timemarkStream?.getVideoTracks?.()[0];
  if (track && typeof track.applyConstraints === "function") {
    try {
      const caps = (track.getCapabilities?.() as any) || {};
      if (caps.zoom) {
        const target = Math.min(caps.zoom.max || 2, Math.max(caps.zoom.min || 1, timemarkZoomLevel));
        await track.applyConstraints({ advanced: [{ zoom: target } as any] });
      }
    } catch {}
  }
}

export function toggleTimemarkModeInsideCam(): void {
  const next: "time_in" | "time_out" = runtime.timeLogMode === "time_in" ? "time_out" : "time_in";
  setTimeLogMode(next, true);
  toast(next === "time_in" ? "Switched to 🟢 TIME IN" : "Switched to 🔴 TIME OUT");
}

export function toggleTimemarkSitePicker(): void {
  const bar = $("timemarkSiteBar");
  const sel = $("timemarkSiteSelect") as HTMLSelectElement | null;
  if (bar) bar.scrollIntoView({ behavior: "smooth", block: "nearest" });
  sel?.focus();
}

export function showTimemarkVerifyInfo(): void {
  if (!timemarkPhotoCode) timemarkPhotoCode = generateTimemarkPhotoCode();
  toast(`🛡️ Verified Photo Code: ${timemarkPhotoCode}`);
}

export function openLastTimemarkPreview(): void {
  if (!timemarkLastPreviewUrl) {
    toast("Capture a photo first to preview it");
    return;
  }
  openPhotoPreview(timemarkLastPreviewUrl, "Timemark Photo Preview");
}

const TIMEMARK_TEMPLATE_LIST: Array<{ id: TimemarkTemplateId; title: string; subtitle: string; badge: string }> = [
  { id: "clock_in", title: "Clock in", subtitle: "Time In/Out · EESI Logo · Address · Map", badge: "TIME IN / OUT" },
  { id: "time_loc", title: "Time&Location", subtitle: "Large Clock · Date · Location", badge: "CLEAN STAMP" },
  { id: "work_report", title: "Work Report", subtitle: "Amber Header · Site · Technician · Code", badge: "REPORT" },
  { id: "inspection", title: "Inspection", subtitle: "Compass · Altitude · Coordinates · Stamp", badge: "INSPECT" },
  { id: "service", title: "Service", subtitle: "EESI Blue Header · Unit · Address", badge: "SERVICE" },
  { id: "photo_code", title: "Photo Code", subtitle: "Verified Authenticity Stamp · Address", badge: "VERIFIED" },
];

export function renderTimemarkTemplatesGrid(): void {
  const grid = $("timemarkTemplatesGrid");
  if (!grid) return;
  const q = val("tmTemplateSearch").trim().toLowerCase();
  const filtered = TIMEMARK_TEMPLATE_LIST.filter(t =>
    !q || t.title.toLowerCase().includes(q) || t.subtitle.toLowerCase().includes(q)
  );
  grid.innerHTML = filtered.map(t => {
    const active = tmCfg.templateId === t.id;
    return `<div class="tm-tpl-card${active ? " active" : ""}" onclick="selectTimemarkTemplate('${t.id}')">` +
      `<div class="tm-tpl-mini">` +
        `<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">` +
          `<span style="background:#fbbf24;color:#111827;font-weight:900;font-size:9.5px;padding:2px 5px;border-radius:4px;">${esc(t.badge)}</span>` +
          `<span style="font-size:13px;font-weight:900;">06:35 PM</span>` +
        `</div>` +
        `<div style="opacity:.88;font-size:10px;line-height:1.25;">${esc(t.subtitle)}</div>` +
      `</div>` +
      `<div style="font-weight:800;font-size:13px;">${esc(t.title)}</div>` +
      (active
        ? `<div class="tm-tpl-actions"><button type="button" style="background:#2563eb;color:#fff;border:0;font-weight:800;" onclick="event.stopPropagation();openTimemarkEditDrawer()">Edit</button></div>`
        : `<div class="tm-tpl-actions"><button type="button" style="background:#e2e8f0;color:#0f172a;border:0;font-weight:700;" onclick="event.stopPropagation();selectTimemarkTemplate('${t.id}')">Use</button></div>`) +
      `</div>`;
  }).join("") || '<p class="muted">No matching templates.</p>';
}

export function openTimemarkTemplatesDrawer(): void {
  renderTimemarkTemplatesGrid();
  $("timemarkTemplatesDrawer")?.classList.remove("hidden");
}

export function closeTimemarkTemplatesDrawer(): void {
  $("timemarkTemplatesDrawer")?.classList.add("hidden");
}

export function selectTimemarkTemplate(id: TimemarkTemplateId): void {
  tmCfg.templateId = id;
  if (id === "inspection") {
    tmCfg.showCompass = true;
    tmCfg.showAltitude = true;
    tmCfg.showCoordinate = true;
  } else if (id === "photo_code") {
    tmCfg.showPhotoCode = true;
  }
  saveTimemarkConfig();
  renderTimemarkTemplatesGrid();
  updateTimemarkHud();
}

export function renderTimemarkEditFields(): void {
  const wrap = $("timemarkEditFields");
  if (!wrap) return;
  const rows: Array<{ key: keyof TimemarkConfig; label: string; extra?: string }> = [
    { key: "showLogo", label: "Logo (EESI Elevators)" },
    {
      key: "showTitle",
      label: "Title",
      extra: `<input id="tmCustomTitleInput" type="text" value="${esc(tmCfg.customTitle)}" placeholder="${runtime.timeLogMode === "time_out" ? "TIME OUT" : "TIME IN"}" oninput="setTimemarkCustomTitle(this.value)" style="width:130px;padding:4px 8px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;font-size:12px;">`
    },
    {
      key: "showStyledNote",
      label: `Styled Note${tmCfg.styledNoteText ? ": " + tmCfg.styledNoteText : ""}`,
      extra: `<button type="button" class="tm-icon-btn" style="min-height:28px!important;font-size:11px!important;" onclick="openTimemarkStyledNoteModal()">Aa</button>`
    },
    { key: "showTime", label: `Time (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})` },
    { key: "showAddress", label: "Address & Work Site" },
    { key: "showCoordinate", label: "Coordinate (Lat / Lng)" },
    { key: "showMap", label: "Map: Mini-Map Pin" },
    { key: "showWeather", label: "Weather" },
    { key: "showAltitude", label: "Altitude" },
    { key: "showCompass", label: "Compass Heading" },
    {
      key: "showNotes",
      label: "Notes",
      extra: `<input id="tmNotesTextInput" type="text" value="${esc(tmCfg.notesText)}" placeholder="Add stamp note…" oninput="setTimemarkNotesText(this.value)" style="width:140px;padding:4px 8px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;font-size:12px;">`
    },
    { key: "showPhotoCode", label: "Photo Code: verify authenticity" },
  ];

  wrap.innerHTML = rows.map(r => {
    const checked = Boolean(tmCfg[r.key]);
    return `<div class="tm-edit-row">` +
      `<div class="tm-edit-row-left"><span>${esc(r.label)}</span>${r.extra || ""}</div>` +
      `<input type="checkbox" class="tm-switch" ${checked ? "checked" : ""} onchange="toggleTimemarkConfigField('${r.key}', this.checked)">` +
      `</div>`;
  }).join("");

  const swatches = ["#fbbf24", "#22c55e", "#2563eb", "#ef4444", "#8b5cf6", "#0f172a"];
  const swWrap = $("timemarkAccentSwatches");
  if (swWrap) {
    swWrap.innerHTML = swatches.map(col =>
      `<button type="button" class="tm-swatch${tmCfg.accentColor === col ? " active" : ""}" style="background:${col};" onclick="setTimemarkAccentColor('${col}')" aria-label="Color ${col}"></button>`
    ).join("");
  }
}

export function openTimemarkEditDrawer(): void {
  closeTimemarkTemplatesDrawer();
  renderTimemarkEditFields();
  $("timemarkEditDrawer")?.classList.remove("hidden");
  updateTimemarkHud();
}

export function closeTimemarkEditDrawer(): void {
  $("timemarkEditDrawer")?.classList.add("hidden");
  updateTimemarkHud();
}

export function toggleTimemarkConfigField(key: keyof TimemarkConfig, checked: boolean): void {
  (tmCfg as any)[key] = !!checked;
  saveTimemarkConfig();
  if (key === "showStyledNote" && checked && !tmCfg.styledNoteText.trim()) {
    openTimemarkStyledNoteModal();
  }
  updateTimemarkHud();
  renderTimemarkEditFields();
}

export function setTimemarkAccentColor(color: string): void {
  tmCfg.accentColor = color;
  saveTimemarkConfig();
  renderTimemarkEditFields();
  updateTimemarkHud();
}

export function setTimemarkCustomTitle(next: string): void {
  tmCfg.customTitle = String(next || "").trim();
  saveTimemarkConfig();
  updateTimemarkHud();
}

export function setTimemarkNotesText(next: string): void {
  tmCfg.notesText = String(next || "").trim();
  if (tmCfg.notesText && !tmCfg.showNotes) {
    tmCfg.showNotes = true;
    renderTimemarkEditFields();
    const inp = $("tmNotesTextInput") as HTMLInputElement | null;
    if (inp) {
      inp.focus();
      const len = inp.value.length;
      inp.setSelectionRange(len, len);
    }
  }
  saveTimemarkConfig();
  updateTimemarkHud();
}

export function promptTimemarkTitle(): void {
  ($("tmCustomTitleInput") as HTMLInputElement | null)?.focus();
}

export function editTimemarkNotesText(): void {
  ($("tmNotesTextInput") as HTMLInputElement | null)?.focus();
}

export function updateStyledNotePreviewText(): void {
  const prev = $("tmStyledNoteLivePreview");
  if (!prev) return;
  const txt = val("tmStyledNoteInput").trim() || "On Duty";
  prev.textContent = txt;
  if (tmCfg.styledNoteBoxed) {
    prev.style.background = tmCfg.styledNoteColor;
    prev.style.color = tmCfg.styledNoteColor.toLowerCase() === "#ffffff" ? "#0f172a" : "#ffffff";
    prev.style.padding = "4px 10px";
  } else {
    prev.style.background = "transparent";
    prev.style.color = tmCfg.styledNoteColor;
    prev.style.padding = "0";
  }
}

export function openTimemarkStyledNoteModal(): void {
  setVal("tmStyledNoteInput", tmCfg.styledNoteText || "");
  const swWrap = $("tmStyledNoteSwatches");
  const cols = ["#ffffff", "#0f172a", "#ef4444", "#f59e0b", "#22c55e", "#2563eb"];
  if (swWrap) {
    swWrap.innerHTML = cols.map(c =>
      `<button type="button" class="tm-swatch${tmCfg.styledNoteColor === c ? " active" : ""}" style="background:${c};" onclick="setTimemarkStyledNoteColor('${c}')"></button>`
    ).join("");
  }
  updateStyledNotePreviewText();
  $("timemarkStyledNoteModal")?.classList.remove("hidden");
  setTimeout(() => ($("tmStyledNoteInput") as HTMLInputElement | null)?.focus(), 40);
}

export function closeTimemarkStyledNoteModal(): void {
  $("timemarkStyledNoteModal")?.classList.add("hidden");
}

export function setTimemarkStyledNoteBoxed(boxed: boolean): void {
  tmCfg.styledNoteBoxed = boxed;
  saveTimemarkConfig();
  updateStyledNotePreviewText();
}

export function setTimemarkStyledNoteColor(color: string): void {
  tmCfg.styledNoteColor = color;
  saveTimemarkConfig();
  openTimemarkStyledNoteModal();
}

export function saveTimemarkStyledNote(): void {
  tmCfg.styledNoteText = val("tmStyledNoteInput").trim();
  tmCfg.showStyledNote = !!tmCfg.styledNoteText;
  saveTimemarkConfig();
  closeTimemarkStyledNoteModal();
  renderTimemarkEditFields();
  updateTimemarkHud();
}

async function startTimemarkCameraStream(): Promise<void> {
  const seq = ++timemarkStreamSeq;
  if (timemarkStream) {
    timemarkStream.getTracks().forEach(t => t.stop());
    timemarkStream = null;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    closeTimemarkCamera();
    toast("Live camera unavailable — opening device camera.");
    $("timeLogCam")?.click();
    return;
  }

  const spec = getTimemarkResolutionSpec();
  const candidates: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: timemarkFacing }, width: { ideal: spec.idealW }, height: { ideal: spec.idealH } }, audio: false },
    { video: { facingMode: { ideal: timemarkFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
    { video: { facingMode: { ideal: timemarkFacing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: timemarkFacing }, audio: false },
    { video: true, audio: false },
  ];

  let acquired: MediaStream | null = null;
  for (const constraints of candidates) {
    try {
      acquired = await navigator.mediaDevices.getUserMedia(constraints);
      break;
    } catch {}
  }

  if (seq !== timemarkStreamSeq || $("timemarkCamOverlay")?.classList.contains("hidden")) {
    acquired?.getTracks().forEach(t => t.stop());
    return;
  }

  if (!acquired) {
    closeTimemarkCamera();
    toast("Camera permission needed — using standard camera picker.");
    $("timeLogCam")?.click();
    return;
  }

  timemarkStream = acquired;
  const vid = $("timemarkVideo") as HTMLVideoElement | null;
  if (vid) {
    vid.onloadedmetadata = () => {
      if (seq === timemarkStreamSeq) updateTimemarkResReadout();
    };
    vid.srcObject = timemarkStream;
    await vid.play().catch(() => {});
  }
  syncTimemarkControlUi();
}

export function openTimemarkCamera(): void {
  loadTimemarkConfig();
  const overlay = $("timemarkCamOverlay");
  if (!overlay) {
    $("timeLogCam")?.click();
    return;
  }
  overlay.classList.remove("hidden");
  timemarkCapturing = false;
  timemarkPhotoCode = generateTimemarkPhotoCode();
  timemarkProximityAlert = null;
  timemarkZoomLevel = 1.0;
  timemarkFlashOn = false;
  $("timemarkDistanceWarning")?.classList.add("hidden");
  syncTimemarkSiteSelectOptions();
  syncTimemarkControlUi();

  const cached = getCachedUserGpsCoords();
  if (cached) {
    timemarkCurrentCoords = cached;
    timemarkCoordsText = `${cached.lat.toFixed(5)}, ${cached.lng.toFixed(5)}`;
    void resolveTimemarkAddressForCoords(cached.lat, cached.lng);
    void evaluateTimemarkSiteProximity();
  } else {
    timemarkCurrentCoords = null;
    timemarkCoordsText = "GPS locating…";
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        pushLiveCoordsSample(pos);
        timemarkCurrentCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy || 0),
          alt: pos.coords.altitude,
          heading: pos.coords.heading,
        };
        timemarkCoordsText = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        void resolveTimemarkAddressForCoords(pos.coords.latitude, pos.coords.longitude);
        updateTimemarkHud();
        void evaluateTimemarkSiteProximity();
      },
      () => {
        if (!timemarkCurrentCoords) {
          timemarkCoordsText = `${runtime.lastWeatherLat.toFixed(4)}, ${runtime.lastWeatherLon.toFixed(4)} (Approx)`;
          updateTimemarkHud();
        }
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  }
  updateTimemarkHud();
  clearInterval(timemarkTimer);
  timemarkTimer = setInterval(updateTimemarkHud, 1000);
  void startTimemarkCameraStream();
}

export function closeTimemarkCamera(): void {
  timemarkStreamSeq++;
  timemarkCapturing = false;
  clearInterval(timemarkTimer);
  timemarkTimer = null;
  clearInterval(timemarkCountdownTimer);
  timemarkCountdownTimer = null;
  clearTimeout(timemarkFocusTimer);
  timemarkFocusTimer = null;
  $("timemarkCountdown")?.classList.add("hidden");
  $("timemarkFocusRing")?.classList.remove("show");
  $("timemarkShutterFlash")?.classList.remove("flash");
  if (timemarkStream) {
    timemarkStream.getTracks().forEach(t => t.stop());
    timemarkStream = null;
  }
  const vid = $("timemarkVideo") as HTMLVideoElement | null;
  if (vid) {
    vid.onloadedmetadata = null;
    vid.srcObject = null;
  }
  $("timemarkSideMenu")?.classList.add("hidden");
  $("timemarkTemplatesDrawer")?.classList.add("hidden");
  $("timemarkEditDrawer")?.classList.add("hidden");
  $("timemarkStyledNoteModal")?.classList.add("hidden");
  $("timemarkDistanceWarning")?.classList.add("hidden");
  $("timemarkCamOverlay")?.classList.add("hidden");
}

export function flipTimemarkCamera(): void {
  timemarkFacing = timemarkFacing === "environment" ? "user" : "environment";
  syncTimemarkControlUi();
  void startTimemarkCameraStream();
}

export function triggerTimemarkCapture(): void {
  if (timemarkCapturing) return;
  const sec = Number(tmCfg.timerSeconds || 0);
  if (!sec) {
    void captureTimemarkPhoto();
    return;
  }
  const cdEl = $("timemarkCountdown");
  let rem = sec;
  if (cdEl) {
    cdEl.textContent = String(rem);
    cdEl.classList.remove("hidden");
  }
  clearInterval(timemarkCountdownTimer);
  timemarkCountdownTimer = setInterval(() => {
    rem--;
    if (rem <= 0) {
      clearInterval(timemarkCountdownTimer);
      timemarkCountdownTimer = null;
      cdEl?.classList.add("hidden");
      void captureTimemarkPhoto();
    } else if (cdEl) {
      cdEl.textContent = String(rem);
    }
  }, 1000);
}

function drawRoundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawEesiLogoVector(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const sx = w / 356;
  const sy = h / 196;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);

  ctx.beginPath();
  ctx.moveTo(10, 58);
  ctx.lineTo(178, 14);
  ctx.lineTo(346, 58);
  ctx.closePath();
  ctx.fillStyle = "#1e6cf2";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111111";
  ctx.stroke();

  ctx.fillStyle = "#ffe500";
  ctx.fillRect(3, 58, 350, 134);
  ctx.strokeRect(3, 58, 350, 134);

  ctx.fillStyle = "#1e6cf2";
  [11, 96.75, 182.5, 268.25].forEach(rx => ctx.fillRect(rx, 66, 76.75, 118));

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 96px Arial Black, Helvetica Neue, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const letters = ["E", "E", "S", "I"];
  const xs = [49.4, 135.1, 220.9, 306.6];
  letters.forEach((ch, idx) => ctx.fillText(ch, xs[idx], 159));

  ctx.restore();
}

export async function captureTimemarkPhoto(): Promise<void> {
  if (timemarkCapturing) return;
  const vid = $("timemarkVideo") as HTMLVideoElement | null;
  if (!vid || !vid.videoWidth || !vid.videoHeight) {
    toast("Camera is still starting…");
    return;
  }

  if (runtime.timeLogMode === "time_in" && timemarkProximityAlert) {
    const ok = await confirmDialog(
      `Your current GPS location is ~${timemarkProximityAlert.distanceLabel} away from "${timemarkProximityAlert.siteName}". Are you sure you want to submit this Time In anyway?`,
      "⚠️ Far From Work Site"
    );
    if (!ok) return;
  }

  timemarkCapturing = true;
  syncTimemarkControlUi();

  const flashEl = $("timemarkShutterFlash");
  if (flashEl) {
    flashEl.classList.add("flash");
    setTimeout(() => flashEl.classList.remove("flash"), 140);
  }

  try {
    const vw = vid.videoWidth;
    const vh = vid.videoHeight;

    // Apply aspect ratio crop and zoom
    let targetAspect = vw / vh;
    if (tmCfg.ratio === "3:4") targetAspect = 3 / 4;
    else if (tmCfg.ratio === "1:1") targetAspect = 1;

    let cropW = vw;
    let cropH = vh;
    if (vw / vh > targetAspect) {
      cropW = Math.round(vh * targetAspect);
    } else {
      cropH = Math.round(vw / targetAspect);
    }
    const zoomedW = Math.max(1, Math.round(cropW / Math.max(1, timemarkZoomLevel)));
    const zoomedH = Math.max(1, Math.round(cropH / Math.max(1, timemarkZoomLevel)));
    const sx = Math.round((vw - zoomedW) / 2);
    const sy = Math.round((vh - zoomedH) / 2);

    const spec = getTimemarkResolutionSpec();
    const croppedRatio = zoomedW / zoomedH;
    const outW = croppedRatio >= 1
      ? (Math.abs(croppedRatio - 1) < 0.05 ? spec.portraitBase : spec.landscapeBase)
      : spec.portraitBase;
    const outH = Math.round(outW / croppedRatio);
    const ui = outW / 960;

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.save();
    if (timemarkFacing === "user") {
      ctx.translate(outW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(vid, sx, sy, zoomedW, zoomedH, 0, 0, outW, outH);
    ctx.restore();

    // Optional auto-save clean unwatermarked original in selected 720p/1080p/4K resolution
    if (tmCfg.autoSaveOriginal) {
      canvas.toBlob(origBlob => {
        if (!origBlob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(origBlob);
        a.download = `eesi-original-${tmCfg.resolution}-${Date.now()}.jpg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }, "image/jpeg", spec.quality);
    }

    // Subtle bottom contrast gradient vignette matching live viewfinder
    const vigGrad = ctx.createLinearGradient(0, outH * 0.56, 0, outH);
    vigGrad.addColorStop(0, "rgba(0,0,0,0)");
    vigGrad.addColorStop(1, "rgba(0,0,0,0.52)");
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, outH * 0.56, outW, outH * 0.44);

    const d = getTimemarkStampData();
    if (!timemarkPhotoCode) timemarkPhotoCode = generateTimemarkPhotoCode();

    // Draw Top-Left Floating Satellite Mini-Map Inset (if Map enabled)
    const mapImg = $("timemarkMiniMapImg") as HTMLImageElement | null;
    if (tmCfg.showMap && timemarkCurrentCoords && mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
      const mapSize = Math.round(outW * 0.21);
      const mx = Math.round(outW * 0.03);
      const my = Math.round(outW * 0.03);
      ctx.save();
      drawRoundedRectPath(ctx, mx, my, mapSize, mapSize, Math.round(16 * ui));
      ctx.clip();
      ctx.drawImage(mapImg, mx, my, mapSize, mapSize);
      ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,0.94)";
      ctx.lineWidth = Math.max(2, Math.round(4 * ui));
      drawRoundedRectPath(ctx, mx, my, mapSize, mapSize, Math.round(16 * ui));
      ctx.stroke();

      const cx = mx + mapSize / 2;
      const cy = my + mapSize / 2;
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(cx, cy - 8 * ui, 9 * ui, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1.5, 2.5 * ui);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 ${Math.round(18 * ui)}px Inter, Arial, sans-serif`;
      ctx.fillText("Google", mx + 8 * ui, my + mapSize - 8 * ui);
    }

    // Top-right crisp resolution & verified shield tag
    ctx.save();
    const tagTxt = `${spec.label} · EESI VERIFIED`;
    ctx.font = `800 ${Math.round(16 * ui)}px Inter, Arial, sans-serif`;
    const tagW = ctx.measureText(tagTxt).width + 24 * ui;
    const tagH = 30 * ui;
    const tagX = outW - tagW - Math.round(outW * 0.03);
    const tagY = Math.round(outW * 0.03);
    ctx.fillStyle = "rgba(9,16,32,0.72)";
    drawRoundedRectPath(ctx, tagX, tagY, tagW, tagH, tagH / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.lineWidth = Math.max(1, 1.5 * ui);
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(tagTxt, tagX + 12 * ui, tagY + 20 * ui);
    ctx.restore();

    const pad = Math.round(outW * 0.032);
    const maxTextW = Math.round(outW * 0.84);
    const addressFull = d.selectedSite && !d.addressDisplay.toLowerCase().includes(d.selectedSite.toLowerCase())
      ? `${d.selectedSite} · ${d.addressDisplay}`
      : d.addressDisplay;

    const wrapLines = (text: string, font: string, maxW: number): string[] => {
      ctx.font = font;
      const words = String(text || "").split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const word of words) {
        const candidate = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(candidate).width > maxW && cur) {
          lines.push(cur);
          cur = word;
        } else {
          cur = candidate;
        }
      }
      if (cur) lines.push(cur);
      return lines;
    };

    const detailFont = `600 ${Math.round(22 * ui)}px Inter, Arial, sans-serif`;
    const detailLines: string[] = [];
    if (tmCfg.showTime || tmCfg.templateId === "clock_in") detailLines.push(d.dateDisplay);
    if (tmCfg.showAddress) detailLines.push(...wrapLines(`${addressFull}${d.unit ? ` · ${d.unit}` : ""}`, detailFont, maxTextW));
    if (tmCfg.showCoordinate) detailLines.push(`Coord: ${d.coordDisplay}`);
    if (tmCfg.showWeather) detailLines.push(`Weather: ${d.weatherElText}`);
    if (tmCfg.showAltitude) detailLines.push(`Altitude: ${d.altText}`);
    if (tmCfg.showCompass) detailLines.push(`Compass: ${d.compassText}`);
    if (tmCfg.showNotes && tmCfg.notesText.trim()) detailLines.push(...wrapLines(`Note: ${tmCfg.notesText.trim()}`, detailFont, maxTextW));
    if (runtime.timeLogMode === "time_in" && timemarkProximityAlert) {
      detailLines.push(`⚠️ ~${timemarkProximityAlert.distanceLabel} FROM ${timemarkProximityAlert.siteName.toUpperCase()}`);
    }
    if (tmCfg.showPhotoCode) detailLines.push(`✓ Photo Code: ${timemarkPhotoCode}`);

    const lineHeight = Math.round(29 * ui);
    const styledNoteH = tmCfg.showStyledNote && tmCfg.styledNoteText.trim() ? Math.round(38 * ui) : 0;

    if (tmCfg.templateId === "work_report" || tmCfg.templateId === "service") {
      const hdrBg = tmCfg.templateId === "service" ? "#1e6cf2" : tmCfg.accentColor;
      const hdrCol = tmCfg.templateId === "service" ? "#ffffff" : "#111827";
      const hdrLabel = tmCfg.templateId === "service" ? "EESI Service Report" : "Work Report";
      const cardLines = [
        ...(tmCfg.showTime ? [`${d.timeShort} · ${d.dateDisplay}`] : []),
        ...wrapLines(`Tech: ${d.whoStr}${d.unit ? ` · ${d.unit}` : ""}`, detailFont, maxTextW - 32 * ui),
        ...(tmCfg.showAddress ? wrapLines(`Site: ${addressFull}`, detailFont, maxTextW - 32 * ui) : []),
        ...(tmCfg.showCoordinate ? [`Coord: ${d.coordDisplay}`] : []),
        ...(tmCfg.showNotes && tmCfg.notesText.trim() ? wrapLines(`Note: ${tmCfg.notesText.trim()}`, detailFont, maxTextW - 32 * ui) : []),
        ...(tmCfg.showPhotoCode ? [`🛡️ Photo Code: ${timemarkPhotoCode}`] : []),
      ];
      const hdrH = Math.round(50 * ui);
      const bodyPadY = Math.round(14 * ui);
      const cardH = hdrH + styledNoteH + cardLines.length * lineHeight + bodyPadY * 2;
      const cardW = Math.min(maxTextW, Math.round(520 * ui));
      let curY = outH - cardH - pad;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 16 * ui;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      drawRoundedRectPath(ctx, pad, curY, cardW, cardH, Math.round(14 * ui));
      ctx.fill();
      ctx.restore();

      ctx.save();
      drawRoundedRectPath(ctx, pad, curY, cardW, cardH, Math.round(14 * ui));
      ctx.clip();
      ctx.fillStyle = hdrBg;
      ctx.fillRect(pad, curY, cardW, hdrH);
      ctx.fillStyle = hdrCol;
      ctx.font = `800 ${Math.round(21 * ui)}px Inter, Arial, sans-serif`;
      ctx.fillText(`${hdrLabel} · ${d.titleText}`, pad + 16 * ui, curY + 32 * ui);
      if (tmCfg.showLogo) {
        drawEesiLogoVector(ctx, pad + cardW - 76 * ui, curY + 8 * ui, 62 * ui, 34 * ui);
      }
      curY += hdrH + bodyPadY;

      if (styledNoteH) {
        ctx.font = `800 ${Math.round(20 * ui)}px Inter, Arial, sans-serif`;
        ctx.fillStyle = tmCfg.styledNoteColor.toLowerCase() === "#ffffff" ? "#1e293b" : tmCfg.styledNoteColor;
        ctx.fillText(tmCfg.styledNoteText, pad + 16 * ui, curY + 22 * ui);
        curY += styledNoteH;
      }

      cardLines.forEach((line, i) => {
        const isCode = line.startsWith("🛡️");
        ctx.fillStyle = isCode ? "#0369a1" : "#1e293b";
        ctx.font = isCode ? `800 ${Math.round(20 * ui)}px Inter, Arial, sans-serif` : `600 ${Math.round(21 * ui)}px Inter, Arial, sans-serif`;
        ctx.fillText(line, pad + 16 * ui, curY + 22 * ui + i * lineHeight);
      });
      ctx.restore();
    } else if (tmCfg.templateId === "inspection") {
      const cardLines = [
        ...(tmCfg.showTime ? [`${d.timeShort} · ${d.dateDisplay}`] : []),
        ...(tmCfg.showAddress ? wrapLines(addressFull, detailFont, maxTextW - 36 * ui) : []),
        `🧭 ${d.compassText} · ⛰️ ${d.altText}`,
        ...(tmCfg.showCoordinate ? [`Coord: ${d.coordDisplay}`] : []),
        ...(tmCfg.showNotes && tmCfg.notesText.trim() ? wrapLines(`Note: ${tmCfg.notesText.trim()}`, detailFont, maxTextW - 36 * ui) : []),
        ...(tmCfg.showPhotoCode ? [`✓ Photo Code: ${timemarkPhotoCode}`] : []),
      ];
      const hdrH = Math.round(48 * ui);
      const cardH = hdrH + styledNoteH + cardLines.length * lineHeight + Math.round(24 * ui);
      const cardW = Math.min(maxTextW, Math.round(520 * ui));
      let curY = outH - cardH - pad;

      ctx.save();
      ctx.fillStyle = "rgba(9,16,32,0.88)";
      drawRoundedRectPath(ctx, pad, curY, cardW, cardH, Math.round(14 * ui));
      ctx.fill();
      ctx.fillStyle = tmCfg.accentColor || "#fbbf24";
      ctx.fillRect(pad, curY, Math.round(7 * ui), cardH);

      ctx.font = `900 ${Math.round(20 * ui)}px Inter, Arial, sans-serif`;
      const bw = ctx.measureText(d.titleText).width + 24 * ui;
      drawRoundedRectPath(ctx, pad + 18 * ui, curY + 12 * ui, bw, 32 * ui, 7 * ui);
      ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.fillText(d.titleText, pad + 30 * ui, curY + 35 * ui);
      if (tmCfg.showLogo) {
        drawEesiLogoVector(ctx, pad + cardW - 78 * ui, curY + 10 * ui, 64 * ui, 35 * ui);
      }
      curY += hdrH + 10 * ui;
      if (styledNoteH) {
        ctx.font = `800 ${Math.round(20 * ui)}px Inter, Arial, sans-serif`;
        ctx.fillStyle = tmCfg.styledNoteColor;
        ctx.fillText(tmCfg.styledNoteText, pad + 18 * ui, curY + 20 * ui);
        curY += styledNoteH;
      }
      cardLines.forEach((line, i) => {
        const isCode = line.startsWith("✓ Photo Code:");
        ctx.fillStyle = isCode ? "#7dd3fc" : "#f8fafc";
        ctx.font = `600 ${Math.round(21 * ui)}px Inter, Arial, sans-serif`;
        ctx.fillText(line, pad + 18 * ui, curY + 22 * ui + i * lineHeight);
      });
      ctx.restore();
    } else if (tmCfg.templateId === "time_loc") {
      const hdrH = Math.round(62 * ui);
      const totalH = styledNoteH + hdrH + detailLines.length * lineHeight + Math.round(16 * ui);
      let curY = outH - totalH - pad;

      if (styledNoteH) {
        ctx.font = `800 ${Math.round(22 * ui)}px Inter, Arial, sans-serif`;
        ctx.fillStyle = tmCfg.styledNoteColor;
        ctx.fillText(tmCfg.styledNoteText, pad, curY + 23 * ui);
        curY += styledNoteH;
      }
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 8 * ui;
      let hx = pad;
      if (tmCfg.showTime) {
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${Math.round(48 * ui)}px Inter, Arial, sans-serif`;
        ctx.fillText(d.timeShort, hx, curY + 46 * ui);
        hx += ctx.measureText(d.timeShort).width + 16 * ui;
      }
      if (tmCfg.showTitle) {
        ctx.font = `900 ${Math.round(20 * ui)}px Inter, Arial, sans-serif`;
        const bw = ctx.measureText(d.titleText).width + 20 * ui;
        ctx.fillStyle = tmCfg.accentColor || "#fbbf24";
        drawRoundedRectPath(ctx, hx, curY + 14 * ui, bw, 32 * ui, 7 * ui);
        ctx.fill();
        ctx.fillStyle = "#111827";
        ctx.fillText(d.titleText, hx + 10 * ui, curY + 37 * ui);
        hx += bw + 12 * ui;
      }
      if (tmCfg.showLogo) {
        drawEesiLogoVector(ctx, hx, curY + 12 * ui, 68 * ui, 37 * ui);
      }
      curY += hdrH;
      detailLines.forEach((line, i) => {
        const isCode = line.startsWith("✓ Photo Code:");
        const isWarn = line.startsWith("⚠️");
        ctx.fillStyle = isWarn ? "#fecaca" : (isCode ? "#bae6fd" : "#ffffff");
        ctx.font = isCode || isWarn ? `700 ${Math.round(21 * ui)}px Inter, Arial, sans-serif` : detailFont;
        ctx.fillText(line, pad, curY + 22 * ui + i * lineHeight);
      });
      ctx.restore();
    } else {
      // Default "clock_in" & "photo_code" matching the exact video stamp
      const barH = tmCfg.showTitle || tmCfg.showTime || tmCfg.showLogo ? Math.round(62 * ui) : 0;
      const totalBlockH = styledNoteH + barH + (detailLines.length * lineHeight) + Math.round(18 * ui);
      let curY = outH - totalBlockH - pad;

      if (styledNoteH) {
        ctx.font = `800 ${Math.round(22 * ui)}px Inter, Arial, sans-serif`;
        const snW = Math.min(maxTextW, ctx.measureText(tmCfg.styledNoteText).width + 24 * ui);
        if (tmCfg.styledNoteBoxed) {
          ctx.fillStyle = tmCfg.styledNoteColor;
          drawRoundedRectPath(ctx, pad, curY, snW, Math.round(32 * ui), Math.round(8 * ui));
          ctx.fill();
          ctx.fillStyle = tmCfg.styledNoteColor.toLowerCase() === "#ffffff" ? "#0f172a" : "#ffffff";
        } else {
          ctx.fillStyle = tmCfg.styledNoteColor;
        }
        ctx.fillText(tmCfg.styledNoteText, pad + (tmCfg.styledNoteBoxed ? 12 * ui : 0), curY + 23 * ui);
        curY += styledNoteH;
      }

      if (barH > 0) {
        ctx.font = `900 ${Math.round(36 * ui)}px Inter, Arial, sans-serif`;
        const clockW = tmCfg.showTime ? ctx.measureText(d.timeShort).width + 18 * ui : 0;
        ctx.font = `900 ${Math.round(20 * ui)}px Inter, Arial, sans-serif`;
        const badgeTextW = tmCfg.showTitle ? ctx.measureText(d.titleText).width + 24 * ui : 0;
        const logoW = tmCfg.showLogo ? 82 * ui : 0;
        const pillW = Math.min(maxTextW, 14 * ui + badgeTextW + clockW + logoW + 16 * ui);

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 12 * ui;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        drawRoundedRectPath(ctx, pad, curY, pillW, Math.round(52 * ui), Math.round(12 * ui));
        ctx.fill();
        ctx.restore();

        let innerX = pad + 6 * ui;
        if (tmCfg.showTitle) {
          ctx.fillStyle = tmCfg.accentColor || "#fbbf24";
          drawRoundedRectPath(ctx, innerX, curY + 6 * ui, badgeTextW, Math.round(40 * ui), Math.round(8 * ui));
          ctx.fill();
          ctx.fillStyle = "#111827";
          ctx.font = `900 ${Math.round(20 * ui)}px Inter, Arial, sans-serif`;
          ctx.fillText(d.titleText, innerX + 12 * ui, curY + 33 * ui);
          innerX += badgeTextW + 12 * ui;
        }
        if (tmCfg.showTime) {
          ctx.fillStyle = "#0f172a";
          ctx.font = `900 ${Math.round(34 * ui)}px Inter, Arial, sans-serif`;
          ctx.fillText(d.timeShort, innerX, curY + 38 * ui);
          innerX += clockW;
        }
        if (tmCfg.showLogo) {
          drawEesiLogoVector(ctx, innerX, curY + 7 * ui, 72 * ui, 38 * ui);
        }
        curY += barH;
      }

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.94)";
      ctx.shadowBlur = 7 * ui;
      ctx.shadowOffsetY = 1.5 * ui;
      detailLines.forEach((line, i) => {
        const isCode = line.startsWith("✓ Photo Code:");
        const isWarn = line.startsWith("⚠️");
        ctx.fillStyle = isWarn ? "#fecaca" : (isCode ? "#bae6fd" : "#ffffff");
        ctx.font = isCode || isWarn ? `700 ${Math.round(21 * ui)}px Inter, Arial, sans-serif` : detailFont;
        ctx.fillText(line, pad, curY + 22 * ui + i * lineHeight);
      });
      ctx.restore();
    }

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(b => resolve(b), "image/jpeg", spec.quality)
    );
    if (!blob) {
      toast("Could not capture image.");
      return;
    }
    const prevUrl = timemarkLastPreviewUrl;
    timemarkLastPreviewUrl = URL.createObjectURL(blob);
    if (prevUrl && prevUrl.startsWith("blob:")) {
      setTimeout(() => URL.revokeObjectURL(prevUrl), 4000);
    }
    const file = new File(
      [blob],
      `timemark-${tmCfg.resolution}-${runtime.timeLogMode}-${Date.now()}.jpg`,
      { type: "image/jpeg" }
    );
    closeTimemarkCamera();
    void submitTimeLogPhoto(file);
  } finally {
    timemarkCapturing = false;
    syncTimemarkControlUi();
  }
}

type DtrExportStep = "jpeg" | "print" | "pdf";
interface DtrThreeStepState {
  jpeg: boolean;
  print: boolean;
  pdf: boolean;
}
const dtrThreeStepMemory: Record<string, DtrThreeStepState> = {};
const dtrThreeStepBusy: Record<DtrExportStep, boolean> = { jpeg: false, print: false, pdf: false };

function getCurrentPreviewEmployeeId(): string {
  return isManager() && val("dtrPreviewEmployee") ? val("dtrPreviewEmployee") : String(state.userId || "");
}

function getCurrentPreviewExportedIds(): string[] {
  const pickedUid = getCurrentPreviewEmployeeId();
  const employeeRows = (state.dtrs || []).filter(d => String(d.user_id) === String(pickedUid));
  const { rows } = filterDtrRowsByCutoff(employeeRows, getActiveDtrCutoffKey());
  return rows.map(d => String(d.id)).filter(Boolean);
}

function getDtrThreeStepKey(): string {
  return `eesi-dtr-3step:${getCurrentPreviewEmployeeId()}:${getActiveDtrCutoffKey()}`;
}

function readDtrThreeStepState(): DtrThreeStepState {
  const key = getDtrThreeStepKey();
  if (dtrThreeStepMemory[key]) return { ...dtrThreeStepMemory[key] };
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw);
      const next: DtrThreeStepState = { jpeg: !!p?.jpeg, print: !!p?.print, pdf: !!p?.pdf };
      dtrThreeStepMemory[key] = next;
      return { ...next };
    }
  } catch {}
  return { jpeg: false, print: false, pdf: false };
}

function writeDtrThreeStepState(st: DtrThreeStepState, keyOverride?: string): void {
  const key = keyOverride || getDtrThreeStepKey();
  dtrThreeStepMemory[key] = { ...st };
  try {
    localStorage.setItem(key, JSON.stringify(st));
  } catch {}
}

function clearDtrThreeStepState(keyOverride?: string): void {
  const key = keyOverride || getDtrThreeStepKey();
  delete dtrThreeStepMemory[key];
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function canRunDtrThreeStepPdf(): boolean {
  const ids = getCurrentPreviewExportedIds();
  if (!ids.length) return true;
  if (dtrThreeStepBusy.pdf) return false;
  return !readDtrThreeStepState().pdf;
}

export function syncDtrThreeStepUi(): void {
  const ids = getCurrentPreviewExportedIds();
  const jpegBtn = $("dtrBtnJpeg") as HTMLButtonElement | null;
  const printBtn = $("dtrBtnPrint") as HTMLButtonElement | null;
  const pdfBtn = $("dtrBtnPdf") as HTMLButtonElement | null;
  const hint = $("dtrExportHint");

  if (!ids.length) {
    clearDtrThreeStepState();
    if (jpegBtn) { jpegBtn.disabled = false; jpegBtn.textContent = "📷 Download & Share JPEG"; }
    if (printBtn) { printBtn.disabled = false; printBtn.textContent = "🖨️ Print DTR"; }
    if (pdfBtn) { pdfBtn.disabled = false; pdfBtn.textContent = "📑 Full History PDF"; }
    if (hint) hint.textContent = "No DTR entries in this cutoff period.";
    return;
  }

  const st = readDtrThreeStepState();
  if (jpegBtn) {
    jpegBtn.disabled = st.jpeg || dtrThreeStepBusy.jpeg;
    jpegBtn.textContent = st.jpeg ? "✓ JPEG Done (1/1)" : "📷 Download & Share JPEG";
  }
  if (printBtn) {
    printBtn.disabled = st.print || dtrThreeStepBusy.print;
    printBtn.textContent = st.print ? "✓ Print Done (1/1)" : "🖨️ Print DTR";
  }
  if (pdfBtn) {
    pdfBtn.disabled = st.pdf || dtrThreeStepBusy.pdf;
    pdfBtn.textContent = st.pdf ? "✓ PDF Done (1/1)" : "📑 Full History PDF";
  }

  if (hint) {
    const doneCount = [st.jpeg, st.print, st.pdf].filter(Boolean).length;
    const remaining: string[] = [];
    if (!st.jpeg) remaining.push("Download & Share JPEG");
    if (!st.print) remaining.push("Print DTR");
    if (!st.pdf) remaining.push("Full History PDF");
    hint.textContent = doneCount === 0
      ? "1 click per button (0/3 done) — DTR automatically clears once all 3 buttons are clicked."
      : `Export progress: ${doneCount}/3 done (Remaining: ${remaining.join(", ")}) — DTR automatically clears at 3/3.`;
  }
}

export async function completeDtrExportStep(step: DtrExportStep, exportedIds?: string[], keyOverride?: string): Promise<void> {
  const key = keyOverride || getDtrThreeStepKey();
  const st = readDtrThreeStepState();
  st[step] = true;
  writeDtrThreeStepState(st, key);
  syncDtrThreeStepUi();

  if (st.jpeg && st.print && st.pdf) {
    clearDtrThreeStepState(key);
    await clearDtrAfterExport(exportedIds);
    syncDtrThreeStepUi();
    toast("All 3 exports done (3/3) — DTR cleared automatically");
    return;
  }

  const doneCount = [st.jpeg, st.print, st.pdf].filter(Boolean).length;
  const remaining: string[] = [];
  if (!st.jpeg) remaining.push("JPEG");
  if (!st.print) remaining.push("Print");
  if (!st.pdf) remaining.push("Full History PDF");
  toast(`Completed (${doneCount}/3). Remaining: ${remaining.join(", ")}`);
}

export async function clearDtrAfterExport(ids?: string[]): Promise<void> {
  const targetIds = [...new Set((ids && ids.length ? ids : getCurrentPreviewExportedIds()).map(String).filter(Boolean))];
  if (targetIds.length && runtime.client && navigator.onLine) {
    try {
      const { error } = await runtime.client.from("dtr_entries").delete().in("id", targetIds);
      if (error) {
        for (const id of targetIds) {
          await runtime.client.from("dtr_entries").delete().eq("id", id);
        }
      }
      suppressNotifications();
      await loadDtrs();
    } catch {}
  }
  clearDtrForm();
  buildDtrPaper();
}

export async function downloadDtr(): Promise<void> {
  const paper = $("dtrPaper");
  if (!paper) return;
  const exportedIds = getCurrentPreviewExportedIds();
  if (!exportedIds.length) { toast("No DTR entries for this cutoff period."); return; }
  const stepKey = getDtrThreeStepKey();
  if (dtrThreeStepBusy.jpeg || readDtrThreeStepState().jpeg) {
    toast("Download & Share JPEG already used (1 click per button).");
    syncDtrThreeStepUi();
    return;
  }
  if (!window.html2canvas) { toast("Image export library is still loading. Try again in a moment."); return; }
  dtrThreeStepBusy.jpeg = true;
  syncDtrThreeStepUi();

  let sandbox: HTMLDivElement | null = null;
  try {
    sandbox = document.createElement("div");
    sandbox.style.position = "fixed";
    sandbox.style.left = "-99999px";
    sandbox.style.top = "0";
    sandbox.style.width = "1120px";
    sandbox.style.background = "#ffffff";
    sandbox.style.padding = "18px 22px 24px";
    sandbox.style.boxSizing = "border-box";
    sandbox.style.zIndex = "-1";

    const clone = document.createElement("div");
    clone.className = "dtr-paper";
    clone.style.width = "100%";
    clone.style.minWidth = "0";
    clone.style.maxWidth = "none";
    clone.style.padding = "0";
    clone.style.margin = "0";
    clone.style.boxShadow = "none";
    clone.innerHTML = paper.innerHTML;
    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    const imgs = [...clone.querySelectorAll("img")];
    await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise<void>(res => {
      img.onload = () => res();
      img.onerror = () => res();
    })));

    const canvas = await window.html2canvas(sandbox, {
      backgroundColor: "#ffffff",
      scale: 2,
      width: 1120,
      windowWidth: 1120,
    });
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob((b: Blob | null) => resolve(b), "image/jpeg", 0.94));
    if (!blob) {
      toast("Could not generate JPEG.");
      return;
    }
    const file = new File([blob], "DTR-" + new Date().toISOString().slice(0, 10) + ".jpg", { type: "image/jpeg" });
    let shared = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Daily Time Record" });
        shared = true;
      } catch {}
    }
    if (!shared) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    await completeDtrExportStep("jpeg", exportedIds, stepKey);
  } catch (err: any) {
    toast(err?.message || "Could not export.");
  } finally {
    if (sandbox) sandbox.remove();
    dtrThreeStepBusy.jpeg = false;
    syncDtrThreeStepUi();
  }
}

export function printDtr(): void {
  const exportedIds = getCurrentPreviewExportedIds();
  if (!exportedIds.length) { toast("No DTR entries for this cutoff period."); return; }
  const stepKey = getDtrThreeStepKey();
  if (dtrThreeStepBusy.print || readDtrThreeStepState().print) {
    toast("Print DTR already used (1 click per button).");
    syncDtrThreeStepUi();
    return;
  }
  dtrThreeStepBusy.print = true;
  syncDtrThreeStepUi();
  document.body.classList.remove("printing-leave", "printing-payslip");
  document.body.classList.add("printing-dtr");
  let completed = false;
  const finalizePrint = () => {
    if (completed) return;
    completed = true;
    document.body.classList.remove("printing-dtr");
    dtrThreeStepBusy.print = false;
    void completeDtrExportStep("print", exportedIds, stepKey);
  };
  window.addEventListener("afterprint", finalizePrint, { once: true });
  window.print();
  setTimeout(finalizePrint, 1800);
}

/* ==================== PAYROLL / PAYSLIP ==================== */
function round2(n: number): number {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function numVal(id: string): number {
  const n = Number(val(id));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function fmtPayslipDateDisplay(iso: string): string {
  const m = String(iso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}-${m[3]}-${m[1]}` : String(iso || "");
}

function fmtAccountingAmt(n: number, zeroAsDash = true): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || (zeroAsDash && Math.abs(v) < 0.005)) return "-";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtHoursShort(n: number): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || v <= 0) return "0";
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
}

function computeNightDiffMinutes(timeIn: string, timeOut: string): number {
  const inMin = parseTimeToMinutes(timeIn);
  const outMinRaw = parseTimeToMinutes(timeOut);
  if (inMin === null || outMinRaw === null) return 0;
  let outMin = outMinRaw;
  if (outMin <= inMin) outMin += 1440;
  const windows: Array<[number, number]> = [
    [0, 360],       // 12:00 AM - 6:00 AM
    [1320, 1800],   // 10:00 PM - 6:00 AM next day
    [2760, 3240],   // wrap safety
  ];
  let total = 0;
  windows.forEach(([ws, we]) => {
    const s = Math.max(inMin, ws);
    const e = Math.min(outMin, we);
    if (e > s) total += e - s;
  });
  return total;
}

function applyPayPeriodPreset(preset: string): void {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const pad = (x: number) => String(x).padStart(2, "0");
  const lastDay = (yr: number, mo: number) => new Date(yr, mo, 0).getDate();

  if (preset === "1-15") {
    setVal("payStartDate", `${y}-${pad(m)}-01`);
    setVal("payEndDate", `${y}-${pad(m)}-15`);
  } else if (preset === "16-end") {
    setVal("payStartDate", `${y}-${pad(m)}-16`);
    setVal("payEndDate", `${y}-${pad(m)}-${pad(lastDay(y, m))}`);
  } else if (preset === "dtr-11-25") {
    setVal("payStartDate", `${y}-${pad(m)}-11`);
    setVal("payEndDate", `${y}-${pad(m)}-25`);
  } else if (preset === "dtr-26-10") {
    const p = getDtrCutoffForDate(localDateKey(now));
    if (p.cycleType === "26-10") {
      setVal("payStartDate", p.startDate);
      setVal("payEndDate", p.endDate);
    } else {
      const prevMo = m === 1 ? 12 : m - 1;
      const prevYr = m === 1 ? y - 1 : y;
      setVal("payStartDate", `${prevYr}-${pad(prevMo)}-26`);
      setVal("payEndDate", `${y}-${pad(m)}-10`);
    }
  }
}

export function openPayrollPage(): void {
  go("payroll");
  syncPayrollFromDtr(false);
}

export function renderPayroll(): void {
  const empSel = $("payEmployee") as HTMLSelectElement | null;
  if (empSel) {
    const prevVal = empSel.value || (isManager() ? val("dtrPreviewEmployee") : "") || String(state.userId || "");
    const list = isManager()
      ? [...(state.profiles || [])].sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")))
      : (state.profiles || []).filter(p => String(p.user_id) === String(state.userId));
    const options = list.length
      ? list.map(p => `<option value="${esc(p.user_id)}">${esc(p.full_name || p.email || "Employee")}</option>`).join("")
      : `<option value="${esc(state.userId || "")}">${esc(state.profile?.full_name || state.email || "Me")}</option>`;
    empSel.innerHTML = options;
    if (prevVal && [...empSel.options].some(o => o.value === prevVal)) {
      empSel.value = prevVal;
    } else if (state.userId && [...empSel.options].some(o => o.value === String(state.userId))) {
      empSel.value = String(state.userId);
    }
    empSel.disabled = !isManager();
  }

  if (!val("payStartDate") || !val("payEndDate")) {
    const day = new Date().getDate();
    const preset = day <= 15 ? "1-15" : "16-end";
    setVal("payPeriodPreset", preset);
    applyPayPeriodPreset(preset);
  }

  updatePayslipPreview();
  renderSavedPayslipsList();
}

export function syncPayrollFromDtr(showToast = true): void {
  const uid = val("payEmployee") || String(state.userId || "");
  const start = val("payStartDate");
  const end = val("payEndDate");
  const summaryEl = $("payDtrSummary");
  if (!uid || !start || !end) {
    if (showToast) toast("Select employee and pay period dates first.");
    return;
  }

  const win = resolvePayrollDtrWindow(start, end, val("payPeriodPreset"));
  const rows = (state.dtrs || []).filter(d => {
    if (String(d.user_id) !== String(uid)) return false;
    const wd = String(d.work_date || "");
    return wd >= win.dtrStart && wd <= win.dtrEnd;
  });

  const dayBuckets = new Map<string, { firstIn: string | null; lastOut: string | null; mins: number; nsRepair: boolean }>();
  let nightMins = 0;
  rows.forEach(d => {
    const day = String(d.work_date || "");
    const meta = parseDtrJobMeta(d.job, d.approved_by);
    const ruleOpts = { workDate: day, nightshiftRepair: meta.nightshiftRepair };
    const cappedOut = capDtrTimeOut(d.time_in, d.time_out, ruleOpts);
    const mins = calculateDtrMinutes(d.time_in, cappedOut, null, ruleOpts);
    const bucket = dayBuckets.get(day) || { firstIn: null, lastOut: null, mins: 0, nsRepair: false };
    if (!bucket.firstIn && d.time_in) bucket.firstIn = d.time_in;
    if (cappedOut && cappedOut !== d.time_in) bucket.lastOut = cappedOut;
    bucket.mins += mins;
    if (meta.nightshiftRepair) bucket.nsRepair = true;
    dayBuckets.set(day, bucket);
    nightMins += computeNightDiffMinutes(d.time_in, cappedOut);
  });

  const todayStr = localDateKey(new Date());
  let regMins = 0;
  let grossDayOtMins = 0;
  let uncoveredLackingMins = 0;
  dayBuckets.forEach((b, day) => {
    const bd = calculateShiftBreakdown(b.firstIn, b.lastOut, b.mins, {
      workDate: day,
      nightshiftRepair: b.nsRepair,
    });
    regMins += bd.regularMins;
    grossDayOtMins += bd.finalOtMins;
    const isClosedDay = Boolean(b.lastOut) || day < todayStr;
    if (b.mins > 0 && isClosedDay) {
      uncoveredLackingMins += Math.max(0, bd.standardMins - bd.workedMins);
    }
  });
  const otMins = Math.max(0, grossDayOtMins - uncoveredLackingMins);

  const otHrs = round2(otMins / 60);
  const nightHrs = round2(nightMins / 60);
  const regHrs = round2(regMins / 60);
  const workedDays = dayBuckets.size;

  setVal("payOtHrs", String(otHrs));
  setVal("payNightHrs", String(nightHrs));

  const autoCalc = ($("payAutoCalcOt") as HTMLInputElement | null)?.checked ?? true;
  const basicPay = numVal("payBasicPay");
  if (autoCalc && basicPay > 0) {
    const denomHours = Math.max(1, (workedDays > 0 ? workedDays : 13) * REGULAR_WORKING_HOURS_PER_DAY);
    const hourlyRate = basicPay / denomHours;
    setVal("payOtAmt", otHrs > 0 ? String(round2(otHrs * hourlyRate * 1.25)) : "0");
    setVal("payNightAmt", nightHrs > 0 ? String(round2(nightHrs * hourlyRate * 0.1)) : "0");
  } else if (autoCalc && basicPay <= 0) {
    if (otHrs === 0) setVal("payOtAmt", "0");
    if (nightHrs === 0) setVal("payNightAmt", "0");
  }

  if (summaryEl) {
    const lackingNote = uncoveredLackingMins > 0
      ? ` (after −${round2(uncoveredLackingMins / 60)}h lacking deducted)`
      : "";
    const cutoffRange = `${fmtPayslipDateDisplay(win.dtrStart)} to ${fmtPayslipDateDisplay(win.dtrEnd)}`;
    const cutoffPrefix = win.mapped ? `${win.ruleLabel} (${cutoffRange})` : `DTR ${cutoffRange}`;
    summaryEl.textContent = rows.length
      ? `${cutoffPrefix} · Synced ${rows.length} DTR entry(ies) across ${workedDays} day(s): ${regHrs}h regular, ${otHrs}h final OT${lackingNote}, ${nightHrs}h night diff.`
      : `${cutoffPrefix} · No DTR entries found for ${profileName(uid)} between ${cutoffRange} (you can still enter values manually).`;
  }

  updatePayslipPreview();
  if (showToast) toast(rows.length ? `Synced ${rows.length} DTR entry(ies) from ${fmtPayslipDateDisplay(win.dtrStart)}–${fmtPayslipDateDisplay(win.dtrEnd)}` : "No DTR logs in this cutoff — manual values kept");
}

function readPayslipDraft(): PayslipRecord {
  const uid = val("payEmployee") || String(state.userId || "");
  const sel = $("payEmployee") as HTMLSelectElement | null;
  const selectedText = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex]?.text || "" : "";
  const empName = (uid ? profileName(uid) : "") || selectedText || state.profile?.full_name || "Employee";

  const basic_pay = round2(numVal("payBasicPay"));
  const overtime_hours = round2(numVal("payOtHrs"));
  const overtime_amount = round2(numVal("payOtAmt"));
  const night_diff_hours = round2(numVal("payNightHrs"));
  const night_diff_amount = round2(numVal("payNightAmt"));
  const allowance = round2(numVal("payAllow"));

  const sss = round2(numVal("paySss"));
  const philhealth = round2(numVal("payPhilhealth"));
  const pagibig = round2(numVal("payPagibig"));
  const cash_advance = round2(numVal("payCashAdvance"));
  const absent = round2(numVal("payAbsent"));
  const abuloy = round2(numVal("payAbuloy"));

  const total_earnings = round2(basic_pay + overtime_amount + night_diff_amount + allowance);
  const total_deductions = round2(sss + philhealth + pagibig + cash_advance + absent + abuloy);
  const net_pay = round2(total_earnings - total_deductions);

  const periodStart = val("payStartDate");
  const periodEnd = val("payEndDate");
  const win = resolvePayrollDtrWindow(periodStart, periodEnd, val("payPeriodPreset"));

  return {
    id: runtime.editingPayslipId || "",
    user_id: uid,
    employee_name: empName,
    period_start: periodStart,
    period_end: periodEnd,
    dtr_cutoff_start: win.dtrStart,
    dtr_cutoff_end: win.dtrEnd,
    basic_pay,
    overtime_hours,
    overtime_amount,
    night_diff_hours,
    night_diff_amount,
    allowance,
    sss,
    philhealth,
    pagibig,
    cash_advance,
    absent,
    abuloy,
    total_earnings,
    total_deductions,
    net_pay,
    created_by: state.userId,
  };
}

export function updatePayslipPreview(): void {
  const box = $("payslipPaper");
  if (!box) return;
  const d = readPayslipDraft();
  const netBadge = $("payNetBadge");
  if (netBadge) {
    netBadge.textContent = "Net Pay: ₱" + d.net_pay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const periodStr = `${fmtPayslipDateDisplay(d.period_start)} to ${fmtPayslipDateDisplay(d.period_end)}`;
  const hasMappedCutoff = Boolean(
    d.dtr_cutoff_start &&
    d.dtr_cutoff_end &&
    (d.dtr_cutoff_start !== d.period_start || d.dtr_cutoff_end !== d.period_end)
  );
  const dtrLabelCell = hasMappedCutoff ? "DTR Cutoff" : "";
  const dtrRangeCell = hasMappedCutoff
    ? `${fmtPayslipDateDisplay(d.dtr_cutoff_start || "")} – ${fmtPayslipDateDisplay(d.dtr_cutoff_end || "")}`
    : "";

  box.innerHTML =
    `<table class="payslip-table">` +
      `<colgroup>` +
        `<col style="width:27%">` +
        `<col style="width:7%">` +
        `<col style="width:7%">` +
        `<col style="width:16%">` +
        `<col style="width:24%">` +
        `<col style="width:19%">` +
      `</colgroup>` +
      `<tbody>` +
        `<tr><td colspan="4" class="ps-title">EESI ELEVATORS, INC.</td><td colspan="2"></td></tr>` +
        `<tr><td colspan="4" class="ps-sub">PAY SLIP</td><td colspan="2"></td></tr>` +
        `<tr><td>Employee</td><td colspan="3" class="ps-val-left">${esc(d.employee_name)}</td><td></td><td></td></tr>` +
        `<tr><td>Pay Period</td><td colspan="3" class="ps-val-left">${esc(periodStr)}</td><td>${esc(dtrLabelCell)}</td><td class="ps-val-left">${esc(dtrRangeCell)}</td></tr>` +
        `<tr><td>Earnings</td><td></td><td></td><td class="ps-amt-head">Amount</td><td></td><td></td></tr>` +
        `<tr><td>Basic Pay</td><td></td><td></td><td class="ps-num">${fmtAccountingAmt(d.basic_pay)}</td><td>Deductions</td><td class="ps-amt-head">Amount</td></tr>` +
        `<tr><td>overtime</td><td class="ps-qty">${fmtHoursShort(d.overtime_hours)}</td><td class="ps-unit">hrs</td><td class="ps-num">${fmtAccountingAmt(d.overtime_amount)}</td><td>sss</td><td class="ps-num">${fmtAccountingAmt(d.sss)}</td></tr>` +
        `<tr><td>night diff</td><td class="ps-qty">${fmtHoursShort(d.night_diff_hours)}</td><td class="ps-unit">hrs</td><td class="ps-num">${fmtAccountingAmt(d.night_diff_amount)}</td><td>philhealth</td><td class="ps-num">${fmtAccountingAmt(d.philhealth)}</td></tr>` +
        `<tr><td></td><td></td><td></td><td class="ps-num">-</td><td>pag-ibig</td><td class="ps-num">${fmtAccountingAmt(d.pagibig)}</td></tr>` +
        `<tr><td></td><td></td><td></td><td class="ps-num">-</td><td>cash advance</td><td class="ps-num">${fmtAccountingAmt(d.cash_advance)}</td></tr>` +
        `<tr><td></td><td></td><td></td><td class="ps-num">-</td><td>absent</td><td class="ps-num">${fmtAccountingAmt(d.absent)}</td></tr>` +
        `<tr><td>transpo allow/food allow.</td><td></td><td></td><td class="ps-num">${fmtAccountingAmt(d.allowance)}</td><td>abuloy</td><td class="ps-num">${fmtAccountingAmt(d.abuloy)}</td></tr>` +
        `<tr><td>Total Earnings</td><td></td><td></td><td class="ps-num ps-total-cell">${fmtAccountingAmt(d.total_earnings)}</td><td>Total Deductions</td><td class="ps-num ps-total-cell">${fmtAccountingAmt(d.total_deductions)}</td></tr>` +
        `<tr><td></td><td></td><td></td><td></td><td class="ps-net-label">Net Pay</td><td class="ps-num ps-net-amt">${fmtAccountingAmt(d.net_pay, false)}</td></tr>` +
      `</tbody>` +
    `</table>`;
}

function saveLocalPayslipCache(rec: PayslipRecord): void {
  try {
    const raw = localStorage.getItem(getLocalPayslipsKey());
    const list: PayslipRecord[] = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(list) ? list.filter(x => String(x.id) !== String(rec.id)) : [];
    arr.unshift(rec);
    localStorage.setItem(getLocalPayslipsKey(), JSON.stringify(arr.slice(0, 120)));
  } catch {}
}

function removeLocalPayslipCache(id: string): void {
  try {
    const raw = localStorage.getItem(getLocalPayslipsKey());
    const list: PayslipRecord[] = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(list) ? list.filter(x => String(x.id) !== String(id)) : [];
    localStorage.setItem(getLocalPayslipsKey(), JSON.stringify(arr));
  } catch {}
}

export function resetPayrollInputs(): void {
  runtime.editingPayslipId = null;
  ["payBasicPay", "payOtHrs", "payOtAmt", "payNightHrs", "payNightAmt", "payAllow", "paySss", "payPhilhealth", "payPagibig", "payCashAdvance", "payAbsent", "payAbuloy"].forEach(id => {
    setVal(id, id === "payBasicPay" ? "" : "0");
  });
  const btn = $("savePayslipBtn");
  if (btn) btn.textContent = "💾 Save Payslip";
  updatePayslipPreview();
  toast("Cleared payslip values");
}

export async function savePayslipRecord(): Promise<void> {
  if (!state.userId) return;
  const draft = readPayslipDraft();
  if (!draft.period_start || !draft.period_end) {
    toast("Please choose Period Start and Period End.");
    return;
  }
  const btn = $("savePayslipBtn") as HTMLButtonElement | null;
  const statusEl = $("payrollStatus");
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = "Saving payslip…";

  try {
    const payload: Omit<PayslipRecord, "id"> = {
      user_id: draft.user_id || state.userId,
      employee_name: draft.employee_name,
      period_start: draft.period_start,
      period_end: draft.period_end,
      dtr_cutoff_start: draft.dtr_cutoff_start || null,
      dtr_cutoff_end: draft.dtr_cutoff_end || null,
      basic_pay: draft.basic_pay,
      overtime_hours: draft.overtime_hours,
      overtime_amount: draft.overtime_amount,
      night_diff_hours: draft.night_diff_hours,
      night_diff_amount: draft.night_diff_amount,
      allowance: draft.allowance,
      sss: draft.sss,
      philhealth: draft.philhealth,
      pagibig: draft.pagibig,
      cash_advance: draft.cash_advance,
      absent: draft.absent,
      abuloy: draft.abuloy,
      total_earnings: draft.total_earnings,
      total_deductions: draft.total_deductions,
      net_pay: draft.net_pay,
      created_by: state.userId,
      created_at: new Date().toISOString(),
    };

    const writePayslipToDb = async (body: Record<string, any>) => {
      if (runtime.editingPayslipId && !String(runtime.editingPayslipId).startsWith("notice:") && !String(runtime.editingPayslipId).startsWith("local:")) {
        return runtime.client
          .from("payslips")
          .update(body)
          .eq("id", runtime.editingPayslipId)
          .select("*")
          .maybeSingle();
      }
      return runtime.client
        .from("payslips")
        .insert(body)
        .select("*")
        .maybeSingle();
    };

    let savedRecord: PayslipRecord | null = null;
    if (!runtime.payslipsTableMissing && runtime.client && navigator.onLine) {
      let { data, error } = await writePayslipToDb(payload);
      if (error && /dtr_cutoff_start|dtr_cutoff_end|42703|schema cache/i.test(String(error.message || ""))) {
        const legacyPayload: Record<string, any> = { ...payload };
        delete legacyPayload.dtr_cutoff_start;
        delete legacyPayload.dtr_cutoff_end;
        const retry = await writePayslipToDb(legacyPayload);
        data = retry.data;
        error = retry.error;
      }
      if (!error && data) {
        savedRecord = data;
      } else if (error && isMissingTableError(error)) {
        runtime.payslipsTableMissing = true;
      } else if (error) {
        throw error;
      }
    }

    if (!savedRecord && runtime.client && navigator.onLine) {
      const { data, error } = await runtime.client
        .from("app_notifications")
        .insert({
          title: "💵 Payslip Record",
          body: buildPayslipAppNoticeBody(payload),
        })
        .select("id,created_at")
        .maybeSingle();
      if (!error && data) {
        savedRecord = {
          ...payload,
          id: `notice:${data.id}`,
          app_notification_id: String(data.id),
          created_at: data.created_at || payload.created_at,
        };
      }
    }

    if (!savedRecord) {
      savedRecord = {
        ...payload,
        id: runtime.editingPayslipId || `local:${Date.now()}`,
      };
    }

    saveLocalPayslipCache(savedRecord);
    runtime.editingPayslipId = savedRecord.id;

    if (isManager() && String(payload.user_id) !== String(state.userId) && runtime.client && navigator.onLine) {
      try {
        await runtime.client.from("approval_notifications").insert({
          recipient_user_id: payload.user_id,
          title: "💵 New Payslip Available",
          body: `Payslip for ${fmtPayslipDateDisplay(payload.period_start)} to ${fmtPayslipDateDisplay(payload.period_end)} — Net Pay: ₱${fmtAccountingAmt(payload.net_pay, false)}`,
        });
      } catch {}
    }

    suppressNotifications();
    await loadPayslips();
    if (statusEl) statusEl.textContent = "Payslip saved.";
    toast("Payslip saved");
  } catch (err: any) {
    const msg = err?.message || "Could not save payslip.";
    if (statusEl) statusEl.textContent = msg;
    toast("Save failed: " + msg);
  } finally {
    if (btn) btn.disabled = false;
  }
}

export function loadPayslipIntoEditor(id: string): void {
  const rec = (state.payslips || []).find(p => String(p.id) === String(id));
  if (!rec) return;
  runtime.editingPayslipId = String(rec.id);
  setVal("payEmployee", String(rec.user_id || state.userId || ""));
  setVal("payPeriodPreset", "custom");
  setVal("payStartDate", String(rec.period_start || ""));
  setVal("payEndDate", String(rec.period_end || ""));
  setVal("payBasicPay", String(rec.basic_pay ?? 0));
  setVal("payOtHrs", String(rec.overtime_hours ?? 0));
  setVal("payOtAmt", String(rec.overtime_amount ?? 0));
  setVal("payNightHrs", String(rec.night_diff_hours ?? 0));
  setVal("payNightAmt", String(rec.night_diff_amount ?? 0));
  setVal("payAllow", String(rec.allowance ?? 0));
  setVal("paySss", String(rec.sss ?? 0));
  setVal("payPhilhealth", String(rec.philhealth ?? 0));
  setVal("payPagibig", String(rec.pagibig ?? 0));
  setVal("payCashAdvance", String(rec.cash_advance ?? 0));
  setVal("payAbsent", String(rec.absent ?? 0));
  setVal("payAbuloy", String(rec.abuloy ?? 0));
  const btn = $("savePayslipBtn");
  if (btn) btn.textContent = "💾 Update Payslip";
  updatePayslipPreview();
  $("payslipPreviewCard")?.scrollIntoView({ behavior: "smooth" });
  toast("Loaded payslip for " + (rec.employee_name || "Employee"));
}

export async function deletePayslipRecord(id: string): Promise<void> {
  if (!(await confirmDialog("Delete this saved payslip?", "Delete payslip"))) return;
  try {
    if (String(id).startsWith("notice:") && runtime.client && navigator.onLine) {
      const nid = String(id).replace(/^notice:/, "");
      await runtime.client.from("app_notifications").delete().eq("id", nid);
    } else if (!String(id).startsWith("local:") && !runtime.payslipsTableMissing && runtime.client && navigator.onLine) {
      await runtime.client.from("payslips").delete().eq("id", id);
    }
    removeLocalPayslipCache(id);
    if (runtime.editingPayslipId === id) runtime.editingPayslipId = null;
    suppressNotifications();
    await loadPayslips();
    toast("Payslip deleted");
  } catch (err: any) {
    toast("Delete failed: " + (err?.message || err));
  }
}

function renderSavedPayslipsList(): void {
  const box = $("savedPayslipList");
  if (!box) return;
  const rows = (state.payslips || []).filter(r => isManager() || String(r.user_id) === String(state.userId));
  if (!rows.length) {
    box.innerHTML = '<p class="muted">No saved payslips yet.</p>';
    return;
  }
  box.innerHTML = rows.map(r => {
    const period = `${fmtPayslipDateDisplay(r.period_start)} to ${fmtPayslipDateDisplay(r.period_end)}`;
    const win = resolvePayrollDtrWindow(r.period_start, r.period_end);
    const dtrStart = r.dtr_cutoff_start || (win.mapped ? win.dtrStart : "");
    const dtrEnd = r.dtr_cutoff_end || (win.mapped ? win.dtrEnd : "");
    const dtrTag = dtrStart && dtrEnd && (dtrStart !== r.period_start || dtrEnd !== r.period_end)
      ? ` · DTR counted: ${fmtPayslipDateDisplay(dtrStart)} to ${fmtPayslipDateDisplay(dtrEnd)}`
      : "";
    const canDelete = isManager() || String(r.user_id) === String(state.userId);
    return (
      `<div class="item">` +
        `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">` +
          `<div><b>${esc(r.employee_name || profileName(r.user_id))}</b><div class="muted">${esc(period)}${esc(dtrTag)}</div></div>` +
          `<span class="badge">Net Pay: ₱${esc(fmtAccountingAmt(r.net_pay, false))}</span>` +
        `</div>` +
        `<div class="muted" style="font-size:12px;margin-top:4px;">Basic: ₱${esc(fmtAccountingAmt(r.basic_pay, false))} · Earnings: ₱${esc(fmtAccountingAmt(r.total_earnings, false))} · Deductions: ₱${esc(fmtAccountingAmt(r.total_deductions, false))}</div>` +
        `<div class="inline-actions" style="margin-top:8px;">` +
          `<button class="btn small-btn" type="button" onclick="loadPayslipIntoEditor('${esc(r.id)}')">👁 Open</button>` +
          (canDelete ? `<button class="red small-btn" type="button" onclick="deletePayslipRecord('${esc(r.id)}')">Delete</button>` : "") +
        `</div>` +
      `</div>`
    );
  }).join("");
}

export async function downloadPayslipJpeg(): Promise<void> {
  const paper = $("payslipPaper");
  if (!paper) return;
  if (!window.html2canvas) { toast("Image export library is still loading. Try again in a moment."); return; }
  const d = readPayslipDraft();
  try {
    const canvas = await window.html2canvas(paper, { backgroundColor: "#ffffff", scale: 2 });
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob((b: Blob | null) => resolve(b), "image/jpeg", 0.94));
    if (!blob) { toast("Could not generate JPEG."); return; }
    const slug = String(d.employee_name || "payslip").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "payslip";
    const file = new File([blob], `EESI-Payslip-${slug}-${d.period_start || todayIso()}.jpg`, { type: "image/jpeg" });
    let shared = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "EESI Pay Slip" });
        shared = true;
      } catch {}
    }
    if (!shared) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    toast("Payslip JPEG ready");
  } catch (err: any) {
    toast("Could not export JPEG: " + (err?.message || err));
  }
}

export function printPayslip(): void {
  document.body.classList.remove("printing-leave");
  document.body.classList.add("printing-payslip");
  const cleanup = () => document.body.classList.remove("printing-payslip");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1800);
}

export async function downloadPayslipPdf(): Promise<void> {
  await exportPayslipPdf(readPayslipDraft());
}

export function exportPayslipXlsxAction(): void {
  exportPayslipXlsx(readPayslipDraft());
}

/* ==================== NOTES, RECS, LEAVE, PROFILE ==================== */
export function renderNotes(): void {
  const box = $("noteList");
  if (!box) return;
  box.innerHTML = state.notes.map(n => {
    const mine = String(n.user_id) === String(state.userId);
    return '<div class="item"><b>' + esc(n.title) + '</b><div class="muted">' + esc(profileName(n.user_id)) + " · " + esc(fmtDate(n.created_at)) +
      '</div><div style="white-space:pre-wrap">' + esc(n.body) + "</div>" +
      (mine || isManager() ? '<div class="inline-actions"><button class="red small-btn" type="button" data-act="del-note" data-id="' + esc(n.id) + '">Delete</button></div>' : "") + "</div>";
  }).join("") || '<p class="muted">No notes yet.</p>';
}
export function renderRecs(): void {
  const box = $("recList");
  if (!box) return;
  box.innerHTML = state.recs.map(r => {
    const meta = parseRecMeta(r.reason);
    const allowComment = canCommentOnRec(r);
    const canDelete = isManager() || String(r.user_id) === String(state.userId);
    const comments = (r.recommendation_comments || []).map((c: any) =>
      '<div class="item" style="background:rgba(0,0,0,0.2)"><b>' + esc(profileName(c.user_id)) + "</b><div>" + esc(c.comment) +
      '</div><div class="muted">' + esc(fmtDate(c.created_at)) + "</div></div>"
    ).join("");
    return '<div class="item"><b>' + esc(r.part) + " — " + esc(r.condition || "—") + "</b>" +
      (meta.siteUnit ? ' <span class="badge">🛗 ' + esc(meta.siteUnit) + "</span>" : "") +
      '<div class="muted">' + esc(r.site || "—") + (r.specific_location || r.location ? " · " + esc(r.specific_location || r.location) : "") +
      " · By " + esc(profileName(r.user_id)) + " · " + esc(fmtDate(r.created_at)) + "</div>" +
      (meta.assignedNames.length ? '<div style="margin-top:4px;font-size:12px;"><b>Assigned / Mentioned:</b> ' + esc(meta.assignedNames.join(", ")) + "</div>" : "") +
      (meta.cleanReason ? '<div style="margin-top:4px;white-space:pre-wrap;">' + esc(meta.cleanReason) + "</div>" : "") +
      (comments ? '<div style="margin-top:8px">' + comments + "</div>" : "") +
      (allowComment
        ? '<div class="field" style="margin-top:8px"><textarea id="comment' + esc(r.id) + '" placeholder="Add a comment…" rows="2"></textarea></div>' +
          '<div class="inline-actions"><button class="btn small-btn" type="button" data-act="comment-rec" data-id="' + esc(r.id) + '">Comment</button>' +
          (canDelete ? '<button class="red small-btn" type="button" data-act="del-rec" data-id="' + esc(r.id) + '">Delete</button>' : "") + "</div>"
        : '<div class="muted" style="margin-top:8px;font-size:12px;">👁️ View only — only the uploader, assigned personnel, Selective Representative, or Admin can comment.</div>' +
          (canDelete ? '<div class="inline-actions"><button class="red small-btn" type="button" data-act="del-rec" data-id="' + esc(r.id) + '">Delete</button></div>' : "")) +
      "</div>";
  }).join("") || '<p class="muted">No recommendations yet.</p>';
}
export async function saveNote(): Promise<void> {
  const title = val("noteTitle").trim();
  const body = val("noteBody").trim();
  if (!title) { toast("Enter a title"); return; }
  const { error } = await runtime.client.from("notes").insert({ user_id: state.userId, title, body });
  if (error) { toast("Could not save: " + error.message); return; }
  setVal("noteTitle", "");
  setVal("noteBody", "");
  suppressNotifications();
  await loadNotes();
  toast("Note saved");
}
export function switchNoteTab(tab: "notes" | "recs"): void {
  runtime.currentNoteTab = tab;
  $("notesPanel")?.classList.toggle("hidden", tab !== "notes");
  $("recsPanel")?.classList.toggle("hidden", tab !== "recs");
  $("notesTab")?.classList.toggle("active", tab === "notes");
  $("recsTab")?.classList.toggle("active", tab === "recs");
  applyRandomOpenStyle($(tab === "notes" ? "notesPanel" : "recsPanel"));
  triggerAndroidHapticTap();
  if (tab === "recs") renderRecPickers();
  saveLastView();
}
export async function saveRec(): Promise<void> {
  const part = val("recPart").trim();
  if (!part) { toast("Enter a part"); return; }
  const condition = val("recCondition").trim();
  const siteName = val("recSite").trim();
  const unitName = val("recUnit").trim();
  const picked = [...document.querySelectorAll<HTMLInputElement>('input[name="recPersonnel"]:checked')];
  const assignedNames = picked.map(i => i.dataset.name).filter(Boolean) as string[];
  const fullReason = buildRecReasonWithMeta(unitName, assignedNames, val("recReason").trim());

  const { error } = await runtime.client.from("recommendations").insert({
    user_id: state.userId,
    condition: condition || null,
    part,
    reason: fullReason || null,
    site: siteName || null,
    specific_location: val("recLocation").trim() || null,
  });
  if (error) { toast("Could not save: " + error.message); return; }

  let unitMarkedNeedsRepair = false;
  let unitUpdateError = "";
  if (condition === "Needs Replacement" && unitName) {
    const matchedSite = siteName
      ? state.sites.find(s => String(s.name || "").trim().toLowerCase() === siteName.toLowerCase())
      : null;
    const targetUnit = matchedSite
      ? state.units.find(
          u =>
            String(u.site_id) === String(matchedSite.id) &&
            String(u.unit_name || "").trim().toLowerCase() === unitName.toLowerCase()
        )
      : state.units.find(
          u => String(u.unit_name || "").trim().toLowerCase() === unitName.toLowerCase()
        );

    if (targetUnit && targetUnit.status !== "Needs Repair") {
      const { error: unitErr } = await runtime.client
        .from("site_units")
        .update({ status: "Needs Repair" })
        .eq("id", targetUnit.id);
      if (unitErr) {
        unitUpdateError = unitErr.message;
      } else {
        unitMarkedNeedsRepair = true;
      }
    }
  }

  ["recCondition", "recPart", "recReason", "recSite", "recUnit", "recLocation"].forEach(id => setVal(id, ""));
  document.querySelectorAll<HTMLInputElement>('input[name="recPersonnel"]:checked').forEach(i => { i.checked = false; });
  suppressNotifications();
  await loadRecs();
  if (unitMarkedNeedsRepair) await loadUnits();

  if (unitMarkedNeedsRepair) {
    toast(`Recommendation submitted · "${unitName}" marked Needs Repair`);
  } else if (unitUpdateError) {
    toast(`Recommendation saved, but unit update failed: ${unitUpdateError}`);
  } else {
    toast("Recommendation submitted");
  }
}

function updateLeaveDaysPreview(): void {
  const el = $("leaveDaysPreview");
  const wdEl = $("leaveWorkingDays") as HTMLInputElement | null;
  const start = val("leaveStart");
  const end = val("leaveEnd");
  const typeEl = $("leaveType") as HTMLSelectElement | null;
  const typeLabel = typeEl ? typeEl.options[typeEl.selectedIndex].text : "leave";
  if (!start || !end) { if (el) el.textContent = ""; return; }
  const days = leaveDaysCount(start, end);
  if (wdEl && days && (!wdEl.value || wdEl.dataset.autoFilled === "1")) {
    wdEl.value = String(days);
    wdEl.dataset.autoFilled = "1";
  }
  if (el) {
    el.textContent = days ? "Total: " + days + " day(s) will count toward " + typeLabel + "." : "End date must be on or after start date.";
  }
}

function splitFullNameParts(fullName: string): { lastName: string; firstName: string; middleName: string } {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { lastName: "", firstName: "", middleName: "" };
  if (parts.length === 1) return { lastName: parts[0], firstName: "", middleName: "" };
  if (parts.length === 2) return { lastName: parts[1], firstName: parts[0], middleName: "" };
  return {
    firstName: parts.slice(0, -2).join(" "),
    middleName: parts[parts.length - 2],
    lastName: parts[parts.length - 1],
  };
}

function collectLeaveMetaFromForm() {
  const typeVal = val("leaveType") as "sick" | "emergency" | "vacation" | "others";
  const defParts = splitFullNameParts(state.profile?.full_name || "");
  const filingDate = val("leaveFilingDate").trim() || localDateKey(new Date());
  const lastName = val("leaveLastName").trim() || defParts.lastName;
  const firstName = val("leaveFirstName").trim() || defParts.firstName;
  const middleName = val("leaveMiddleName").trim() || defParts.middleName;
  const othersSpecify = val("leaveOthersSpecify").trim();
  const vacSel = document.querySelector<HTMLInputElement>('input[name="leaveVacationPlace"]:checked')?.value || val("leaveVacationPlace");
  const vacationPlace = (vacSel === "within" || vacSel === "outside") ? vacSel : "";
  const outsideSpecify = val("leaveOutsideSpecify").trim();
  const inHospital = !!($("leaveInHospital") as HTMLInputElement | null)?.checked;
  const hospitalSpecify = val("leaveHospitalSpecify").trim();
  const workingDays = val("leaveWorkingDays").trim();
  const applicantName = val("leaveApplicantName").trim() || [firstName, middleName, lastName].filter(Boolean).join(" ") || (state.profile?.full_name || "");
  const reasonText = val("leaveReason").trim();
  return {
    filingDate,
    lastName,
    firstName,
    middleName,
    displayType: typeVal,
    othersSpecify,
    vacationPlace: vacationPlace as "within" | "outside" | "",
    outsideSpecify,
    inHospital,
    hospitalSpecify,
    workingDays,
    applicantName,
    reasonText,
  };
}

export function closeLeaveFormOverlay(): void {
  $("leaveFormOverlay")?.classList.add("hidden");
  runtime.editingLeaveId = null;
  const ttl = $("leaveFormTitle");
  if (ttl) ttl.textContent = "Application for Leave";
  const btn = $("submitLeaveBtn");
  if (btn) btn.textContent = "Submit request";
}

export function openAddLeaveModal(): void {
  runtime.editingLeaveId = null;
  const ttl = $("leaveFormTitle");
  if (ttl) ttl.textContent = "Application for Leave";
  const btn = $("submitLeaveBtn");
  if (btn) btn.textContent = "Submit request";
  setVal("leaveFilingDate", localDateKey(new Date()));
  setVal("leaveType", "vacation");
  const defParts = splitFullNameParts(state.profile?.full_name || "");
  setVal("leaveLastName", defParts.lastName || "");
  setVal("leaveFirstName", defParts.firstName || "");
  setVal("leaveMiddleName", defParts.middleName || "");
  setVal("leaveApplicantName", state.profile?.full_name || "");
  ["leaveStart", "leaveEnd", "leaveReason", "leaveOthersSpecify", "leaveVacationPlace", "leaveOutsideSpecify", "leaveHospitalSpecify", "leaveWorkingDays"].forEach(id => setVal(id, ""));
  const wdEl = $("leaveWorkingDays") as HTMLInputElement | null;
  if (wdEl) wdEl.dataset.autoFilled = "1";
  const hospEl = $("leaveInHospital") as HTMLInputElement | null;
  if (hospEl) hospEl.checked = false;
  const st = $("leaveFormStatus");
  if (st) st.textContent = "";
  updateLeaveDaysPreview();
  $("leaveFormOverlay")?.classList.remove("hidden");
}

export function editLeaveRequest(id: string): void {
  const req = state.leaveRequests.find(r => String(r.id) === String(id));
  if (!req) return;
  if (String(req.user_id) !== String(state.userId) && !isManager()) {
    toast("You can only edit your own leave requests.");
    return;
  }
  runtime.editingLeaveId = String(req.id);
  const meta = parseLeaveMeta(req.reason);
  const defParts = splitFullNameParts(profileName(req.user_id) || state.profile?.full_name || "");
  const ttl = $("leaveFormTitle");
  if (ttl) ttl.textContent = "✏️ Edit Leave Request";
  const btn = $("submitLeaveBtn");
  if (btn) btn.textContent = "Save changes";

  setVal("leaveFilingDate", meta.filingDate || String(req.created_at || "").slice(0, 10) || localDateKey(new Date()));
  const lType = (meta.displayType || req.leave_type || "vacation").toLowerCase();
  setVal("leaveType", ["vacation", "sick", "emergency", "others"].includes(lType) ? lType : "vacation");
  setVal("leaveLastName", meta.lastName || defParts.lastName || "");
  setVal("leaveFirstName", meta.firstName || defParts.firstName || "");
  setVal("leaveMiddleName", meta.middleName || defParts.middleName || "");
  setVal("leaveOthersSpecify", meta.othersSpecify || "");
  setVal("leaveVacationPlace", meta.vacationPlace || "");
  setVal("leaveOutsideSpecify", meta.outsideSpecify || "");
  const hospEl = $("leaveInHospital") as HTMLInputElement | null;
  if (hospEl) hospEl.checked = !!meta.inHospital;
  setVal("leaveHospitalSpecify", meta.hospitalSpecify || "");
  setVal("leaveStart", req.start_date || "");
  setVal("leaveEnd", req.end_date || "");
  const wdEl = $("leaveWorkingDays") as HTMLInputElement | null;
  if (wdEl) {
    wdEl.dataset.autoFilled = "0";
    wdEl.value = meta.workingDays || String(req.workdays || req.calendar_days || "");
  }
  setVal("leaveApplicantName", meta.applicantName || profileName(req.user_id) || state.profile?.full_name || "");
  setVal("leaveReason", meta.cleanReason || "");
  const st = $("leaveFormStatus");
  if (st) st.textContent = "";
  updateLeaveDaysPreview();
  $("leaveFormOverlay")?.classList.remove("hidden");
}

export async function submitLeaveRequest(): Promise<void> {
  const start = val("leaveStart");
  const end = val("leaveEnd");
  if (!start || !end) { toast("Choose inclusive start and end dates"); return; }
  const days = leaveDaysCount(start, end);
  if (!days) { toast("End date must be on or after start date"); return; }
  const meta = collectLeaveMetaFromForm();
  const dbType = meta.displayType === "others" ? "others" : meta.displayType;
  const encodedReason = buildLeaveReasonWithMeta({
    ...meta,
    workingDays: meta.workingDays || String(days),
  });

  const isEditing = !!runtime.editingLeaveId;
  const payload = {
    leave_type: dbType,
    start_date: start,
    end_date: end,
    calendar_days: days,
    workdays: Number(meta.workingDays) || days,
    reason: encodedReason || null,
  };

  let { error } = isEditing
    ? await runtime.client.from("leave_requests").update(payload).eq("id", runtime.editingLeaveId)
    : await runtime.client.from("leave_requests").insert({
        user_id: state.userId,
        ...payload,
        status: "pending",
      });
  if (error && dbType === "others" && (error.code === "23514" || /leave_requests_leave_type_check/i.test(error.message || ""))) {
    const retry = isEditing
      ? await runtime.client.from("leave_requests").update({ ...payload, leave_type: "emergency" }).eq("id", runtime.editingLeaveId)
      : await runtime.client.from("leave_requests").insert({
          user_id: state.userId,
          ...payload,
          leave_type: "emergency",
          status: "pending",
        });
    error = retry.error;
  }

  const st = $("leaveFormStatus");
  if (error) { if (st) st.textContent = "Failed: " + error.message; return; }
  ["leaveReason", "leaveOthersSpecify", "leaveOutsideSpecify", "leaveHospitalSpecify", "leaveWorkingDays"].forEach(id => setVal(id, ""));
  if (st) st.textContent = (isEditing ? "Request updated (" : "Request submitted (") + days + " day(s)).";
  updateLeaveDaysPreview();
  closeLeaveFormOverlay();
  suppressNotifications();
  await loadLeaveRequests();
  renderLeaveBalances();
  toast(isEditing ? "Leave request updated" : "Leave request submitted");
}

export function renderLeave(): void {
  const mine = state.leaveRequests.filter(r => String(r.user_id) === String(state.userId));
  const myBox = $("myLeaveRequests");
  if (myBox) {
    myBox.innerHTML = mine.map(r => {
      const days = r.calendar_days || leaveDaysCount(r.start_date, r.end_date) || r.workdays || 0;
      const meta = parseLeaveMeta(r.reason);
      const dispType = (meta.displayType || r.leave_type || "").toUpperCase() +
        (meta.displayType === "others" && meta.othersSpecify ? ` (${meta.othersSpecify})` : "");
      return '<div class="item"><b>' + esc(dispType || r.leave_type) + '</b> <span class="badge">' + esc(r.status) + '</span><div class="muted">' +
        esc(fmtDay(r.start_date)) + " – " + esc(fmtDay(r.end_date)) + " · " + (meta.workingDays || days) + " working day(s)" +
        (meta.filingDate ? " · Filed " + esc(fmtDay(meta.filingDate)) : "") + "</div>" +
        (meta.cleanReason ? "<div>" + esc(meta.cleanReason) + "</div>" : "") +
        '<div class="inline-actions">' +
        '<button class="gray small-btn" type="button" onclick="editLeaveRequest(\'' + esc(r.id) + '\')">✏️ Edit</button>' +
        '<button class="gray small-btn" type="button" onclick="openLeaveSheetPreview(\'' + esc(r.id) + '\')">📄 View / Print Form</button></div></div>';
    }).join("") || '<p class="muted">No requests yet.</p>';
  }
  const revBox = $("leaveReviewList");
  if (revBox) {
    const pending = state.leaveRequests.filter(r => r.status === "pending" && String(r.user_id) !== String(state.userId));
    revBox.innerHTML = pending.map(r => {
      const days = r.calendar_days || leaveDaysCount(r.start_date, r.end_date) || r.workdays || 0;
      const meta = parseLeaveMeta(r.reason);
      const dispType = (meta.displayType || r.leave_type || "").toUpperCase();
      return '<div class="item"><b>' + esc(profileName(r.user_id)) + "</b> — " + esc(dispType) + '<div class="muted">' +
        esc(fmtDay(r.start_date)) + " – " + esc(fmtDay(r.end_date)) + " · " + (meta.workingDays || days) + " day(s)</div>" +
        (meta.cleanReason ? "<div>" + esc(meta.cleanReason) + "</div>" : "") +
        '<div class="inline-actions"><button class="gray small-btn" type="button" onclick="openLeaveSheetPreview(\'' + esc(r.id) + '\')">📄 Form</button>' +
        '<button class="green small-btn" type="button" data-act="leave-approve" data-id="' + esc(r.id) + '">Approve</button>' +
        '<button class="red small-btn" type="button" data-act="leave-reject" data-id="' + esc(r.id) + '">Reject</button></div></div>';
    }).join("") || '<p class="muted">Nothing to review.</p>';
  }
  renderLeaveBalances();
}

export function openLeaveSheetPreview(requestId?: string): void {
  const req = requestId ? state.leaveRequests.find(r => String(r.id) === String(requestId)) : null;
  const paper = $("leaveSheetPaper");
  const overlay = $("leaveSheetPreviewOverlay");
  if (!paper || !overlay) return;

  let meta: any = {};
  let leaveType = "";
  let start = "";
  let end = "";
  let status = "pending";
  let days = 0;
  let approverName = "";
  let isOwn = true;

  if (req) {
    meta = parseLeaveMeta(req.reason);
    leaveType = (meta.displayType || req.leave_type || "").toLowerCase();
    start = req.start_date || "";
    end = req.end_date || "";
    status = req.status || "pending";
    days = req.calendar_days || leaveDaysCount(start, end) || req.workdays || 0;
    isOwn = String(req.user_id) === String(state.userId);
    const prof = profileOf(req.user_id);
    const nameParts = splitFullNameParts(prof?.full_name || "");
    if (!meta.lastName) meta.lastName = nameParts.lastName;
    if (!meta.firstName) meta.firstName = nameParts.firstName;
    if (!meta.middleName) meta.middleName = nameParts.middleName;
    if (!meta.applicantName) meta.applicantName = prof?.full_name || "";
    if (!meta.filingDate) meta.filingDate = String(req.created_at || "").slice(0, 10) || start;
    if (req.reviewed_by) approverName = profileName(req.reviewed_by);
  } else {
    meta = collectLeaveMetaFromForm();
    leaveType = meta.displayType;
    start = val("leaveStart");
    end = val("leaveEnd");
    days = leaveDaysCount(start, end);
  }

  const chk = (on: boolean) => `<span class="ls-box">${on ? "✓" : ""}</span>`;
  const fmtFiling = meta.filingDate
    ? new Date(meta.filingDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";
  const inclusiveStr = start && end ? `${fmtDay(start)} – ${fmtDay(end)}` : (start ? fmtDay(start) : "");
  const workDaysStr = meta.workingDays || (days ? String(days) : "");
  const othersText = meta.othersSpecify || (leaveType === "emergency" ? "Emergency Leave" : (leaveType === "others" ? (meta.cleanReason || "") : ""));
  const sigImg = isOwn
    ? (signaturePhotoDataUrl ? `<img src="${esc(signaturePhotoDataUrl)}" alt="Signature" class="ls-sig-img">` : (drawnSigDataUrl ? `<img src="${esc(drawnSigDataUrl)}" alt="Signature" class="ls-sig-img">` : ""))
    : "";

  paper.innerHTML =
    `<div class="ls-header">` +
      `<div class="ls-top-date">Date:</div>` +
      `<div class="ls-title">APPLICATION FOR LEAVE</div>` +
    `</div>` +
    `<div class="ls-name-row">` +
      `<span class="ls-lbl">NAME :</span>` +
      `<div class="ls-name-block">` +
        `<div class="ls-name-vals">` +
          `<div class="ls-line-val">${esc(meta.lastName || "")}</div>` +
          `<div class="ls-line-val">${esc(meta.firstName || "")}</div>` +
          `<div class="ls-line-val">${esc(meta.middleName || "")}</div>` +
        `</div>` +
        `<div class="ls-name-subs">` +
          `<div class="ls-sub">LAST</div>` +
          `<div class="ls-sub">FIRST</div>` +
          `<div class="ls-sub">MIDDLE</div>` +
        `</div>` +
      `</div>` +
    `</div>` +
    `<div class="ls-grid">` +
      `<div class="ls-col">` +
        `<div class="ls-field-line"><span class="ls-lbl">DATE OF FILLING :</span><span class="ls-fill-val">${esc(fmtFiling)}</span></div>` +
        `<div class="ls-sec-lbl">TYPE OF LEAVE:</div>` +
        `<div class="ls-check-item">${chk(leaveType === "vacation")} <span>VACATION</span></div>` +
        `<div class="ls-check-item">${chk(leaveType === "sick")} <span>SICK</span></div>` +
        `<div class="ls-check-item">${chk(leaveType === "others" || leaveType === "emergency")} <span>OTHERS (Specify)</span></div>` +
        `<div class="ls-under-val ls-under-indent">${esc(othersText)}</div>` +
        `<div class="ls-sec-lbl" style="margin-top:8px;">NUMBER OF WORKING DAYS APPLIED FOR</div>` +
        `<div class="ls-under-val">${esc(workDaysStr)}</div>` +
        `<div class="ls-sec-lbl" style="margin-top:14px;">INCLUSIVE DATES :</div>` +
        `<div class="ls-under-val">${esc(inclusiveStr)}</div>` +
        `<div class="ls-sig-block">` +
          `<div class="ls-sig-line">${sigImg}<div class="ls-sig-name">${esc(meta.applicantName || "")}</div></div>` +
          `<div class="ls-sig-cap">Signature of Applicant</div>` +
        `</div>` +
      `</div>` +
      `<div class="ls-col">` +
        `<div class="ls-sec-lbl" style="margin-top:0;">WHERE LEAVE WILL BE SPENT</div>` +
        `<div class="ls-sub-sec">(1) IN CASE OF VACATION LEAVE</div>` +
        `<div class="ls-check-item">${chk(meta.vacationPlace === "within")} <span>Within Metro Manila</span></div>` +
        `<div class="ls-check-item">${chk(meta.vacationPlace === "outside")} <span>Outside Metro Manila (Specify)</span></div>` +
        `<div class="ls-under-val">${esc(meta.outsideSpecify || "")}</div>` +
        `<div class="ls-sub-sec" style="margin-top:14px;">(2) IN CASE OF SICK LEAVE</div>` +
        `<div class="ls-check-item">${chk(!!meta.inHospital)} <span>In Hospital (Specify)</span></div>` +
        `<div class="ls-under-val">${esc(meta.hospitalSpecify || "")}</div>` +
        `<div class="ls-sub-sec" style="margin-top:14px;">(3) STATUS</div>` +
        `<div class="ls-check-item">${chk(status === "approved")} <span>APPROVED</span></div>` +
        `<div class="ls-check-item">${chk(status === "rejected")} <span>NOT APPROVE</span></div>` +
        `<div class="ls-auth-lbl">Approved by</div>` +
        `<div class="ls-sig-block" style="padding-top:10px;">` +
          `<div class="ls-sig-line"><div class="ls-sig-name">${esc(approverName)}</div></div>` +
          `<div class="ls-sig-cap">Authorized Signatory</div>` +
        `</div>` +
      `</div>` +
    `</div>`;

  overlay.classList.remove("hidden");
}

export function closeLeaveSheetPreview(): void {
  $("leaveSheetPreviewOverlay")?.classList.add("hidden");
}

export async function downloadLeaveSheet(): Promise<void> {
  const paper = $("leaveSheetPaper");
  if (!paper) return;
  if (!window.html2canvas) { toast("Image export library is still loading."); return; }
  let host: HTMLDivElement | null = null;
  try {
    host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:760px;background:#fff;z-index:-1;";
    const clone = paper.cloneNode(true) as HTMLElement;
    clone.style.width = "760px";
    clone.style.minWidth = "760px";
    clone.style.margin = "0";
    host.appendChild(clone);
    document.body.appendChild(host);

    const canvas = await window.html2canvas(clone, {
      backgroundColor: "#fff",
      scale: 2,
      width: 760,
      windowWidth: 820,
    });
    canvas.toBlob(async (blob: Blob | null) => {
      if (!blob) return;
      const file = new File([blob], "Leave-Application-" + new Date().toISOString().slice(0, 10) + ".jpg", { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Application for Leave" }); return; } catch {}
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/jpeg", 0.92);
  } catch (err: any) {
    toast(err?.message || "Could not export form.");
  } finally {
    host?.remove();
  }
}

export function printLeaveSheet(): void {
  document.body.classList.add("printing-leave");
  const cleanup = () => document.body.classList.remove("printing-leave");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 1500);
}
export function renderLeaveBalances(): void {
  if (!state.userId) return;
  const html = renderUserLeaveBalanceHtml(state.userId);
  const box = $("leaveBalances");
  if (box) box.innerHTML = html;
  const pageBox = $("leavePageBalances");
  if (pageBox) pageBox.innerHTML = html;
}
export async function refreshLeaveBalances(): Promise<void> { await loadLeaveRequests(); toast("Balances refreshed"); }

export function renderProfile(): void {
  const p = state.profile || {};
  setVal("pName", p.full_name || "");
  setVal("pId", p.id_no || "");
  setVal("pAddress", p.address || "");
  setVal("pTeam", p.team || "");
  setVal("pPhone", p.phone || "");
  setVal("pArea", p.area || "");
  setVal("pEmail", p.email || state.email || "");
  const prev = $("profilePreview") as HTMLImageElement | null;
  if (prev) prev.src = safeUrl(p.avatar_url) || BLANK_IMG;
  const cover = safeUrl(p.cover_url);
  const coverBox = $("coverPreview");
  if (coverBox) {
    if (cover) { coverBox.style.backgroundImage = 'url("' + cover + '")'; coverBox.innerHTML = ""; }
    else { coverBox.style.backgroundImage = ""; coverBox.innerHTML = "<span>Cover picture</span>"; }
  }
  renderLeaveBalances();
}
export async function saveProfile(): Promise<void> {
  const { error } = await runtime.client.from("profiles").update({
    full_name: val("pName").trim(),
    id_no: val("pId").trim() || null,
    address: val("pAddress").trim() || null,
    team: val("pTeam").trim() || null,
    phone: val("pPhone").trim() || null,
    area: val("pArea") || null,
  }).eq("user_id", state.userId);
  if (error) { toast("Save failed: " + error.message); return; }
  await loadProfiles();
  renderProfile();
  renderHome();
  toast("Profile saved");
}
export async function removePhoto(field: "avatar_url" | "cover_url"): Promise<void> {
  const { error } = await runtime.client.from("profiles").update({ [field]: null }).eq("user_id", state.userId);
  if (error) { toast("Failed: " + error.message); return; }
  await loadProfiles();
  renderProfile();
  toast("Removed");
}

export function changePassword(): void {
  $("changePasswordOverlay")?.classList.remove("hidden");
  const st = $("changePasswordStatus");
  if (st) st.textContent = "";
}
export function closeChangePasswordModal(): void {
  $("changePasswordOverlay")?.classList.add("hidden");
  ["currentPassword", "newPasswordModal", "retypeNewPassword"].forEach(id => setVal(id, ""));
}
export async function submitChangePassword(): Promise<void> {
  const cur = val("currentPassword");
  const nw = val("newPasswordModal");
  const rt = val("retypeNewPassword");
  const st = $("changePasswordStatus");
  if (!cur || !nw) { if (st) st.textContent = "Fill in every field."; return; }
  if (nw !== rt) { if (st) st.textContent = "New passwords do not match."; return; }
  if (nw.length < 8) { if (st) st.textContent = "Use at least 8 characters."; return; }
  if (st) st.textContent = "Updating…";
  const { error: signErr } = await runtime.client.auth.signInWithPassword({ email: state.email, password: cur });
  if (signErr) { if (st) st.textContent = "Current password is wrong."; return; }
  const { error } = await runtime.client.auth.updateUser({ password: nw });
  if (error) { if (st) st.textContent = error.message; return; }
  closeChangePasswordModal();
  toast("Password updated");
}

/* ==================== GLOBAL WIRING & DELEGATION ==================== */
export function initFeatureWiring(): void {
  initSignature();

  document.querySelectorAll<HTMLElement>("[data-units-region]").forEach(btn => {
    btn.addEventListener("click", () => {
      runtime.unitsRegion = btn.dataset.unitsRegion || "ALL";
      document.querySelectorAll<HTMLElement>("[data-units-region]").forEach(b => b.classList.toggle("active", b === btn));
      renderUnits();
      saveLastView();
    });
  });

  $("unitsLocationFilter")?.addEventListener("change", () => {
    runtime.unitsLocationFilter = val("unitsLocationFilter") || "ALL";
    renderUnits();
  });
  $("unitsSideFilter")?.addEventListener("change", () => {
    runtime.unitsSideFilter = val("unitsSideFilter") || "ALL";
    renderUnits();
  });
  $("unitsFloorFilter")?.addEventListener("change", () => {
    runtime.unitsFloorFilter = val("unitsFloorFilter") || "ALL";
    renderUnits();
  });
  $("unitsDirFilter")?.addEventListener("change", () => {
    runtime.unitsDirFilter = (val("unitsDirFilter") as any) || "ALL";
    renderUnits();
  });
  $("unitsShowAllBtn")?.addEventListener("click", () => {
    runtime.unitsShowAllInline = !runtime.unitsShowAllInline;
    renderUnits();
  });
  $("unitsResetFiltersBtn")?.addEventListener("click", () => {
    runtime.unitsLocationFilter = "ALL";
    runtime.unitsSideFilter = "ALL";
    runtime.unitsFloorFilter = "ALL";
    runtime.unitsDirFilter = "ALL";
    renderUnits();
  });

  const unitManualFile = $("unitManualFile") as HTMLInputElement | null;
  unitManualFile?.addEventListener("change", async () => {
    const f = unitManualFile.files?.[0];
    unitManualFile.value = "";
    const unitId = pendingManualUploadUnitId || runtime.manualUnitId;
    pendingManualUploadUnitId = null;
    if (!f || !unitId || !state.userId) return;
    if (!checkNetwork()) return;
    const u = state.units.find(x => String(x.id) === String(unitId));
    if (!u) return;
    try {
      toast("Uploading manual file…");
      const processed = isImageFile(f) ? await prepareImageFile(f, 1600, 0.85) : f;
      const safeName = (processed.name || "manual").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${state.userId}/manuals/${Date.now()}-${safeName}`;
      const { error: up } = await runtime.client.storage.from("reports").upload(path, processed, { upsert: false, contentType: processed.type || undefined });
      if (up) throw up;
      const { data: pub } = runtime.client.storage.from("reports").getPublicUrl(path);
      const meta = parseUnitManualMeta(u.notes);
      const nextNotes = buildUnitNotesWithManual(meta.cleanNotes, pub.publicUrl, meta.manualText);
      const { error } = await runtime.client.from("site_units").update({ notes: nextNotes || null }).eq("id", unitId);
      if (error) throw error;
      suppressNotifications();
      await loadUnits();
      const updated = state.units.find(x => String(x.id) === String(unitId));
      if (updated && !$("unitManualOverlay")?.classList.contains("hidden")) {
        renderUnitManualOverlayBody(updated);
      }
      toast("Unit manual uploaded");
    } catch (err: any) {
      toast("Manual upload failed: " + (err?.message || err));
    }
  });

  $("reportSite")?.addEventListener("change", renderReportUnits);
  $("schSite")?.addEventListener("change", () => { renderScheduleUnitOptions(); syncScheduleTitleFromSelection(); });
  $("schUnit")?.addEventListener("change", syncScheduleTitleFromSelection);
  $("recSite")?.addEventListener("change", () => {
    renderRecPickers();
  });
  $("dtrDate")?.addEventListener("change", () => {
    autoFillDtrFromSchedule(false);
    renderDtrLiveStatus();
  });
  ["dtrIn", "dtrOut"].forEach(id => {
    $(id)?.addEventListener("input", renderDtrLiveStatus);
    $(id)?.addEventListener("change", renderDtrLiveStatus);
  });
  $("dtrNightshiftOrRepair")?.addEventListener("change", renderDtrLiveStatus);
  $("dtrLocation")?.addEventListener("input", () => {
    const locEl = $("dtrLocation") as HTMLInputElement | null;
    if (locEl) locEl.dataset.autoFilled = "0";
    renderDtrUnitOptions();
  });
  $("dtrLocation")?.addEventListener("change", () => {
    const locEl = $("dtrLocation") as HTMLInputElement | null;
    if (locEl) locEl.dataset.autoFilled = "0";
    renderDtrUnitOptions();
  });
  $("dtrUnit")?.addEventListener("change", () => {
    const uEl = $("dtrUnit") as HTMLSelectElement | null;
    if (uEl) uEl.dataset.autoFilled = "0";
  });
  $("dtrJob")?.addEventListener("input", () => {
    const jobEl = $("dtrJob") as HTMLInputElement | null;
    if (jobEl) jobEl.dataset.autoFilled = "0";
  });
  $("dtrJob")?.addEventListener("change", () => {
    const jobEl = $("dtrJob") as HTMLInputElement | null;
    if (jobEl) jobEl.dataset.autoFilled = "0";
  });
  ["dtrCutoffFilter", "dtrPreviewCutoff"].forEach(id => {
    $(id)?.addEventListener("change", e => {
      const sel = e.currentTarget as HTMLSelectElement | null;
      if (!sel) return;
      runtime.dtrCutoffKey = sel.value || getDtrCutoffForDate(localDateKey(new Date())).key;
      renderDtr();
      buildDtrPaper();
    });
  });
  $("dtrPreviewEmployee")?.addEventListener("change", buildDtrPaper);
  $("timeLogSite")?.addEventListener("change", () => {
    const ls = $("timeLogSite") as HTMLSelectElement | null;
    if (ls) ls.dataset.autoFilled = "0";
    renderTimeLogSitePickers();
    syncTimemarkSiteSelectOptions();
    if (!$("timemarkCamOverlay")?.classList.contains("hidden")) {
      updateTimemarkHud();
      void evaluateTimemarkSiteProximity();
    }
  });
  $("timemarkSiteSelect")?.addEventListener("change", () => {
    const picked = val("timemarkSiteSelect");
    setVal("timeLogSite", picked);
    renderTimeLogSitePickers();
    updateTimemarkHud();
    void evaluateTimemarkSiteProximity();
  });
  ["timeLogCam", "timeLogPhoto"].forEach(id => {
    const inp = $(id) as HTMLInputElement | null;
    inp?.addEventListener("change", () => {
      const f = inp.files?.[0];
      inp.value = "";
      if (f) void submitTimeLogPhoto(f);
    });
  });
  $("timeLogNoteInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); void sendTimeLogNote(); }
  });

  $("toggleUnitFormBtn")?.addEventListener("click", () => {
    openAddUnitForSite("");
  });
  $("unitFormOverlay")?.addEventListener("click", ev => {
    if (ev.target === $("unitFormOverlay")) cancelUnitForm();
  });

  $("reportPhotoPreview")?.addEventListener("click", e => {
    const t = e.target as HTMLElement | null;
    const remPending = t?.closest<HTMLElement>("[data-remove-pending-att]");
    if (remPending) {
      const idx = Number(remPending.dataset.removePendingAtt);
      const removed = runtime.pendingReportFiles.splice(idx, 1)[0];
      if (removed && removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      renderReportAttachmentPreview();
      return;
    }
    const remExisting = t?.closest<HTMLElement>("[data-remove-existing-att]");
    if (remExisting) {
      runtime.editingExistingUrls.splice(Number(remExisting.dataset.removeExistingAtt), 1);
      renderReportAttachmentPreview();
    }
  });

  const rPhotos = $("reportPhotos") as HTMLInputElement | null;
  rPhotos?.addEventListener("change", async () => {
    const chosen = [...(rPhotos.files || [])];
    rPhotos.value = "";
    if (!chosen.length) return;
    for (const rawFile of chosen) {
      const exists = runtime.pendingReportFiles.some(
        p => p.file.name === rawFile.name && p.file.size === rawFile.size && p.file.lastModified === rawFile.lastModified
      );
      if (exists) continue;
      const isImg = isImageFile(rawFile);
      const processed = isImg ? await prepareImageFile(rawFile, 1600, 0.85) : rawFile;
      runtime.pendingReportFiles.push({
        file: processed,
        previewUrl: isImg ? URL.createObjectURL(processed) : "",
      });
    }
    renderReportAttachmentPreview();
    toast(chosen.length + " attachment(s) ready");
  });

  $("submitReportButton")?.addEventListener("click", submitReport);
  ["leaveStart", "leaveEnd", "leaveType"].forEach(id => $(id)?.addEventListener("change", updateLeaveDaysPreview));
  $("toggleLeaveFormBtn")?.addEventListener("click", () => {
    openAddLeaveModal();
  });
  $("leaveFormOverlay")?.addEventListener("click", ev => {
    if (ev.target === $("leaveFormOverlay")) closeLeaveFormOverlay();
  });
  $("siteUnitsOverlay")?.addEventListener("click", ev => {
    if (ev.target === $("siteUnitsOverlay")) closeSiteUnitsOverlay();
  });
  $("siteMapOverlay")?.addEventListener("click", ev => {
    if (ev.target === $("siteMapOverlay")) closeSiteMapOverlay();
  });
  $("adminMemberOverlay")?.addEventListener("click", ev => {
    if (ev.target === $("adminMemberOverlay")) closeAdminMemberOverlay();
  });

  const sigPhoto = $("signaturePhoto") as HTMLInputElement | null;
  sigPhoto?.addEventListener("change", async () => {
    const f = sigPhoto.files && sigPhoto.files[0];
    sigPhoto.value = "";
    if (!f) return;
    if (!isImageFile(f)) {
      toast("Please choose an image file for your signature.");
      return;
    }
    try {
      toast("Extracting signature strokes…");
      signaturePhotoDataUrl = await extractSignatureStrokeOnly(f);
      const img = $("signaturePhotoPreview") as HTMLImageElement | null;
      if (img) { img.src = signaturePhotoDataUrl; img.classList.remove("hidden"); }
      if (state.userId) {
        try { localStorage.setItem("eesi-sig-photo:" + state.userId, signaturePhotoDataUrl); } catch {}
      }
      toast("Signature stroke ready (transparent background)");
    } catch (err: any) {
      toast("Could not process signature picture: " + (err?.message || err));
    }
  });

  $("pmsBackToSites")?.addEventListener("click", () => {
    $("pmsChecklistPanel")?.classList.add("hidden");
    $("pmsSitePicker")?.classList.remove("hidden");
  });
  document.querySelectorAll<HTMLElement>("[data-pms-region]").forEach(b =>
    b.addEventListener("click", () => {
      runtime.pmsRegion = b.dataset.pmsRegion || "Luzon";
      document.querySelectorAll<HTMLElement>("[data-pms-region]").forEach(x => x.classList.toggle("active", x === b));
      renderPmsSiteOptions();
    })
  );
  document.querySelectorAll<HTMLElement>("[data-pms-unit]").forEach(b =>
    b.addEventListener("click", () => {
      runtime.pmsUnit = (b.dataset.pmsUnit as "elevator" | "escalator") || "elevator";
      document.querySelectorAll<HTMLElement>("[data-pms-unit]").forEach(x => x.classList.toggle("active", x === b));
      if (!$("pmsChecklistPanel")?.classList.contains("hidden")) openPmsChecklist();
    })
  );
  $("pmsChecklistPreview")?.addEventListener("click", e => {
    const rem = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-remove-pms-att]");
    if (!rem) return;
    const idx = Number(rem.dataset.removePmsAtt);
    const removed = runtime.pendingPmsFiles.splice(idx, 1)[0];
    if (removed && removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    renderPmsAttachmentPreview();
  });

  const pmsFilesInp = $("pmsChecklistFiles") as HTMLInputElement | null;
  pmsFilesInp?.addEventListener("change", async () => {
    const chosen = [...(pmsFilesInp.files || [])];
    pmsFilesInp.value = "";
    if (!chosen.length) return;
    for (const rawFile of chosen) {
      const exists = runtime.pendingPmsFiles.some(
        p => p.file.name === rawFile.name && p.file.size === rawFile.size && p.file.lastModified === rawFile.lastModified
      );
      if (exists) continue;
      const isImg = isImageFile(rawFile);
      const processed = isImg ? await prepareImageFile(rawFile, 1600, 0.85) : rawFile;
      runtime.pendingPmsFiles.push({
        file: processed,
        previewUrl: isImg ? URL.createObjectURL(processed) : "",
      });
    }
    renderPmsAttachmentPreview();
    toast(chosen.length + " PMS attachment(s) ready");
  });

  $("savePmsRecordButton")?.addEventListener("click", async () => {
    if (!runtime.pmsSiteId) { toast("Pick a site first"); return; }
    if (!checkNetwork()) return;
    const btn = $("savePmsRecordButton") as HTMLButtonElement | null;
    const st = $("pmsRecordStatus");
    if (btn) btn.disabled = true;
    if (st) st.textContent = "Uploading & saving PMS checklist…";
    try {
      const urls: string[] = [];
      for (let i = 0; i < runtime.pendingPmsFiles.length; i++) {
        const f = runtime.pendingPmsFiles[i].file;
        if (f.size > 25 * 1024 * 1024) throw new Error(f.name + " is larger than 25MB");
        const safeName = (f.name || ("pms-" + i)).replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${state.userId}/pms/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}-${safeName}`;
        const { error: up } = await runtime.client.storage.from("reports").upload(path, f, { upsert: false, contentType: f.type || undefined });
        if (up) throw up;
        const { data: pub } = runtime.client.storage.from("reports").getPublicUrl(path);
        urls.push(pub.publicUrl);
      }

      const all = [...document.querySelectorAll<HTMLInputElement>("#pmsCategories input[type='checkbox']")];
      const passed = all.filter(c => c.checked).length;
      const itemsSummary = all.map(c => ({ label: (c.parentElement?.textContent || "").trim(), passed: c.checked }));
      const unitId = val("pmsChecklistUnit");
      const unitObj = state.units.find(u => String(u.id) === String(unitId));
      const { error } = await runtime.client.from("pms_checklist_records").insert({
        site_id: runtime.pmsSiteId,
        user_id: state.userId,
        unit_type: runtime.pmsUnit,
        checklist_date: val("pmsChecklistDate") || new Date().toISOString().slice(0, 10),
        items_passed: passed,
        items_total: all.length,
        details: JSON.stringify({
          unit: runtime.pmsUnit,
          unitId: unitId || null,
          unitName: unitObj?.unit_name || null,
          region: runtime.pmsRegion,
          attachments: urls,
          items: itemsSummary,
        }),
      });
      if (error) throw error;
      clearPendingPmsFiles();
      renderPmsAttachmentPreview();
      if (st) st.textContent = "Saved (" + passed + "/" + all.length + " passed" + (urls.length ? `, ${urls.length} attachment(s)` : "") + ").";
      suppressNotifications();
      await loadPmsRecords();
      toast("PMS record saved");
    } catch (err: any) {
      if (st) st.textContent = "Failed: " + (err?.message || err);
      toast("PMS save failed: " + (err?.message || err));
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  ["pmsRecordsTeam", "pmsRecordsLocation", "pmsRecordsSite"].forEach(id => $(id)?.addEventListener("change", renderPmsRecords));
  $("closePmsRecordOverlay")?.addEventListener("click", () => $("pmsRecordOverlay")?.classList.add("hidden"));

  document.querySelectorAll<HTMLElement>("#reportTypeTabs [data-report-type]").forEach(b => {
    b.addEventListener("click", () => {
      state.reportType = b.dataset.reportType || "service";
      document.querySelectorAll<HTMLElement>("#reportTypeTabs .tab").forEach(x => x.classList.toggle("active", x === b));
      if (state.reportType === "checklist") {
        runtime.reportsViewMode = "checklist";
        $("reportContent")?.classList.add("hidden");
        $("searchView")?.classList.add("hidden");
        $("pmsReportContent")?.classList.remove("hidden");
        $("pmsRecordsView")?.classList.add("hidden");
        $("pmsChecklistView")?.classList.remove("hidden");
        renderPmsSiteOptions();
      } else {
        runtime.reportsViewMode = "list";
        $("reportContent")?.classList.remove("hidden");
        $("pmsReportContent")?.classList.add("hidden");
        $("pmsChecklistPanel")?.classList.add("hidden");
        $("searchView")?.classList.add("hidden");
        renderReports();
      }
      saveLastView();
    });
  });

  $("reportSearchTab")?.addEventListener("click", () => {
    runtime.reportsViewMode = "search";
    document.querySelectorAll("#reportTypeTabs .tab").forEach(x => x.classList.remove("active"));
    $("reportSearchTab")?.classList.add("active");
    $("reportContent")?.classList.add("hidden");
    $("pmsReportContent")?.classList.add("hidden");
    $("pmsChecklistPanel")?.classList.add("hidden");
    $("searchView")?.classList.remove("hidden");
    runSearch();
    saveLastView();
  });

  $("pmsRecordsTab")?.addEventListener("click", () => {
    runtime.reportsViewMode = "pms-records";
    document.querySelectorAll("#reportTypeTabs .tab").forEach(x => x.classList.remove("active"));
    $("pmsRecordsTab")?.classList.add("active");
    $("reportContent")?.classList.add("hidden");
    $("searchView")?.classList.add("hidden");
    $("pmsChecklistPanel")?.classList.add("hidden");
    $("pmsReportContent")?.classList.remove("hidden");
    $("pmsRecordsView")?.classList.remove("hidden");
    $("pmsChecklistView")?.classList.add("hidden");
    loadPmsRecords();
    saveLastView();
  });

  $("searchFilterToggleBtn")?.addEventListener("click", () => {
    const panel = $("searchFilterPanel");
    if (!panel) return;
    const opening = panel.classList.contains("hidden");
    panel.classList.toggle("hidden");
    $("searchFilterToggleBtn")?.setAttribute("aria-expanded", String(opening));
  });
  $("searchRegion")?.addEventListener("change", () => { renderSearchSiteOptions(); runSearch(); });
  ["searchSite", "searchEquipment", "searchType", "searchDateFrom", "searchDateTo", "searchUploadsOnly"].forEach(id => $(id)?.addEventListener("change", runSearch));
  $("searchApplyFilters")?.addEventListener("click", () => { runSearch(); $("searchFilterPanel")?.classList.add("hidden"); });
  $("searchRunBtn")?.addEventListener("click", runSearch);
  $("searchQuery")?.addEventListener("input", runSearch);
  $("searchClear")?.addEventListener("click", () => {
    ["searchQuery", "searchRegion", "searchEquipment", "searchType", "searchSite", "searchDateFrom", "searchDateTo"].forEach(id => setVal(id, ""));
    const uo = $("searchUploadsOnly") as HTMLInputElement | null;
    if (uo) uo.checked = false;
    renderSearchSiteOptions();
    runSearch();
  });

  $("cancelAddSite")?.addEventListener("click", () => {
    runtime.editingSiteId = null;
    $("addSiteOverlay")?.classList.add("hidden");
    resetAddSitePinPicker();
  });
  $("openAddSite")?.addEventListener("click", openAddSiteModal);

  $("sitesRegionTabs")?.addEventListener("click", ev => {
    const btn = (ev.target as HTMLElement | null)?.closest<HTMLElement>("[data-sites-region]");
    if (!btn) return;
    runtime.sitesRegionFilter = btn.dataset.sitesRegion || "ALL";
    renderSites();
    void refreshVisibleSiteDistances(getFilteredSites());
  });
  document.querySelectorAll<HTMLElement>("[data-sites-status]").forEach(btn => {
    btn.addEventListener("click", () => {
      runtime.sitesStatusFilter = btn.dataset.sitesStatus || "ALL";
      renderSites();
      void refreshVisibleSiteDistances(getFilteredSites());
    });
  });
  $("refreshSiteDistancesBtn")?.addEventListener("click", () => {
    void refreshVisibleSiteDistances(getFilteredSites(), { force: true });
  });
  ($("siteThumbFile") as HTMLInputElement | null)?.addEventListener("change", async ev => {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    const targetId = pendingSiteThumbTargetId;
    pendingSiteThumbTargetId = null;
    if (!file || !targetId) return;
    await uploadSiteThumbnailFile(targetId, file);
  });
  $("siteList")?.addEventListener("change", async ev => {
    const sel = (ev.target as HTMLElement | null)?.closest<HTMLSelectElement>("[data-site-status-select]");
    if (!sel) return;
    const siteId = sel.dataset.siteStatusSelect || "";
    if (!siteId) return;
    await updateSiteStatus(siteId, sel.value);
  });

  $("payEmployee")?.addEventListener("change", () => syncPayrollFromDtr(false));
  $("payPeriodPreset")?.addEventListener("change", () => {
    const preset = val("payPeriodPreset");
    if (preset !== "custom") applyPayPeriodPreset(preset);
    syncPayrollFromDtr(false);
  });
  ["payStartDate", "payEndDate"].forEach(id => {
    $(id)?.addEventListener("change", () => {
      setVal("payPeriodPreset", "custom");
      syncPayrollFromDtr(false);
    });
  });
  $("payAutoCalcOt")?.addEventListener("change", () => syncPayrollFromDtr(false));
  ["payBasicPay", "payOtHrs", "payOtAmt", "payNightHrs", "payNightAmt", "payAllow", "paySss", "payPhilhealth", "payPagibig", "payCashAdvance", "payAbsent", "payAbuloy"].forEach(id => {
    $(id)?.addEventListener("input", () => {
      if (id === "payBasicPay" && ($("payAutoCalcOt") as HTMLInputElement | null)?.checked) {
        const otHrs = numVal("payOtHrs");
        const nightHrs = numVal("payNightHrs");
        const basicPay = numVal("payBasicPay");
        if (basicPay > 0 && (otHrs > 0 || nightHrs > 0)) {
          const uid = val("payEmployee") || String(state.userId || "");
          const start = val("payStartDate");
          const end = val("payEndDate");
          const win = resolvePayrollDtrWindow(start, end, val("payPeriodPreset"));
          const daysSet = new Set(
            (state.dtrs || [])
              .filter(d => String(d.user_id) === String(uid) && String(d.work_date || "") >= win.dtrStart && String(d.work_date || "") <= win.dtrEnd)
              .map(d => String(d.work_date || ""))
          );
          const denom = Math.max(1, (daysSet.size || 13) * REGULAR_WORKING_HOURS_PER_DAY);
          const hourly = basicPay / denom;
          setVal("payOtAmt", otHrs > 0 ? String(round2(otHrs * hourly * 1.25)) : "0");
          setVal("payNightAmt", nightHrs > 0 ? String(round2(nightHrs * hourly * 0.1)) : "0");
        }
      }
      updatePayslipPreview();
    });
  });

  $("toggleScheduleFormBtn")?.addEventListener("click", () => {
    openScheduleFormOverlay();
  });
  $("schStatement")?.addEventListener("input", () => {
    updateScheduleStatementPreview();
  });
  $("scheduleFormOverlay")?.addEventListener("click", ev => {
    if (ev.target === $("scheduleFormOverlay")) closeScheduleFormOverlay();
  });
  $("toggleReportFormBtn")?.addEventListener("click", () => {
    const card = $("reportFormCard");
    if (!card) return;
    const opening = card.classList.contains("hidden");
    if (opening) renderReportSites();
    card.classList.toggle("hidden");
    if (opening) {
      if (!val("reportDate")) setVal("reportDate", new Date().toISOString().slice(0, 10));
      card.scrollIntoView({ behavior: "smooth" });
    }
  });
  $("cancelReportFormBtn")?.addEventListener("click", () => {
    runtime.editingReportId = null;
    runtime.editingExistingUrls = [];
    setVal("reportTitle", "");
    setVal("reportDetails", "");
    setVal("reportUnit", "");
    clearPendingReportFiles();
    renderReportAttachmentPreview();
    const sb = $("submitReportButton");
    const rs = $("reportStatus");
    if (sb) sb.textContent = "Submit report";
    if (rs) rs.textContent = "";
    $("reportFormCard")?.classList.add("hidden");
  });

  ["profileFile", "coverFile"].forEach(id => {
    const el = $(id) as HTMLInputElement | null;
    if (!el) return;
    el.addEventListener("change", async () => {
      const rawFile = el.files && el.files[0];
      el.value = "";
      if (!rawFile || !state.userId) return;
      if (!checkNetwork()) return;
      if (!isImageFile(rawFile)) { toast("Please select an image file."); return; }
      const field = id === "profileFile" ? "avatar_url" : "cover_url";
      const bucket = id === "profileFile" ? "avatars" : "covers";
      const oldUrl = state.profile?.[field] || "";
      toast("Uploading picture…");
      try {
        const prepared = await prepareImageFile(rawFile, id === "profileFile" ? 1024 : 1600, 0.88);
        const path = state.userId + "/" + Date.now() + "-" + prepared.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const { error: up } = await runtime.client.storage.from(bucket).upload(path, prepared, {
          upsert: false,
          contentType: prepared.type || "image/jpeg",
        });
        if (up) throw up;
        const { data: pub } = runtime.client.storage.from(bucket).getPublicUrl(path);
        const { error } = await runtime.client.from("profiles").update({ [field]: pub.publicUrl }).eq("user_id", state.userId);
        if (error) throw error;
        if (oldUrl) await deleteStorageFile(bucket, oldUrl);
        await loadProfiles();
        renderProfile();
        renderHome();
        renderChatList();
        toast("Picture updated");
      } catch (err: any) { toast("Upload failed: " + (err?.message || err)); }
    });
  });

  /* Global action delegation */
  document.addEventListener("click", async e => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.id === "sheet") { closeSheet(); return; }

    const markBtn = target.closest<HTMLElement>("[data-mark-notice-read]");
    if (markBtn) {
      e.stopPropagation();
      const key = markBtn.dataset.markNoticeRead || "";
      const appId = markBtn.dataset.dbApp || "";
      const apprId = markBtn.dataset.dbAppr || "";
      if (appId) {
        state.appNotifications = (state.appNotifications || []).map(n =>
          String(n.id) === String(appId) ? { ...n, is_read: true } : n
        );
      }
      if (apprId) {
        state.approvalNotifications = (state.approvalNotifications || []).map(n =>
          String(n.id) === String(apprId) ? { ...n, is_read: true } : n
        );
      }
      markNoticeRead(key);
      if (appId && navigator.onLine) {
        await runtime.client.from("app_notifications").update({ is_read: true }).eq("id", appId);
      }
      if (apprId && navigator.onLine) {
        await runtime.client.from("approval_notifications").update({ is_read: true }).eq("id", apprId);
      }
      toast("Marked as read");
      return;
    }

    const delNoticeBtn = target.closest<HTMLElement>("[data-del-notice]");
    if (delNoticeBtn) {
      e.stopPropagation();
      await deleteSingleNotice({
        key: delNoticeBtn.dataset.delNotice || "",
        appId: delNoticeBtn.dataset.dbApp || "",
        approvalId: delNoticeBtn.dataset.dbAppr || "",
        reportId: delNoticeBtn.dataset.reportId || "",
      });
      return;
    }

    const editDtrRow = target.closest<HTMLElement>("[data-edit-dtr]");
    if (editDtrRow) {
      const id = editDtrRow.dataset.editDtr || "";
      if (id) openEditDtr(id);
      return;
    }

    const pmsCard = target.closest<HTMLElement>("[data-pms-record]");
    if (pmsCard) {
      const rec = state.pmsRecords.find(r => String(r.id) === String(pmsCard.dataset.pmsRecord));
      if (!rec) return;
      const site = state.sites.find(s => String(s.id) === String(rec.site_id));
      let parsed: any = {};
      try { parsed = JSON.parse(rec.details || "{}"); } catch {}
      const itemsHtml = (parsed.items || []).map((it: any) => "<div>" + (it.passed ? "✅ " : "❌ ") + esc(it.label) + "</div>").join("");
      const attHtml = buildUrlAttachmentHtml(Array.isArray(parsed.attachments) ? parsed.attachments : []);
      const det = $("pmsRecordDetails");
      if (det) {
        det.innerHTML = "<h2>" + esc(site ? site.name : "Site") + '</h2><div class="muted">' + esc((rec.unit_type || "").toUpperCase()) +
          " · " + esc(fmtDay(rec.checklist_date)) + " · " + esc(profileName(rec.user_id)) + "</div><p><b>Result:</b> " +
          rec.items_passed + "/" + rec.items_total + " passed</p>" +
          '<div class="inline-actions" style="margin:0 0 12px;">' +
          '<button class="gray small-btn" type="button" onclick="exportPmsRecords(\'xls\',\'' + esc(rec.id) + '\')">📊 Export XLS</button>' +
          '<button class="gray small-btn" type="button" onclick="exportPmsRecords(\'doc\',\'' + esc(rec.id) + '\')">📝 Export DOC</button>' +
          "</div>" +
          (attHtml ? '<div class="media-grid" style="margin:0 0 12px;">' + attHtml + "</div>" : "") +
          itemsHtml;
      }
      $("pmsRecordOverlay")?.classList.remove("hidden");
      return;
    }

    const el = target.closest<HTMLElement>("[data-act], [data-report-edit], [data-report-delete], [data-app-notice], [data-approval-notice], [data-report-notice], [data-chat-notice]");
    if (!el) return;
    const act = el.dataset.act || "";
    const id = el.dataset.id || "";
    const nKey = el.dataset.noticeKey;
    if (nKey) markNoticeRead(nKey);

    if (el.dataset.reportEdit) {
      const rep = state.reports.find(r => String(r.id) === String(el.dataset.reportEdit));
      if (!rep) return;
      runtime.editingReportId = String(rep.id);
      state.reportType = rep.report_type;
      runtime.reportsViewMode = "list";
      document.querySelectorAll<HTMLElement>("#reportTypeTabs .tab").forEach(x => x.classList.toggle("active", x.dataset.reportType === rep.report_type));
      renderReportSites();
      setVal("reportSite", String(rep.site_id || ""));
      renderReportUnits();
      const parsedUnit = parseReportUnit(rep.details);
      if (parsedUnit.unitId) setVal("reportUnit", parsedUnit.unitId);
      setVal("reportDate", rep.report_date || "");
      setVal("reportTitle", rep.title || "");
      setVal("reportDetails", stripReportPhotos(rep.details));
      clearPendingReportFiles();
      runtime.editingExistingUrls = extractReportPhotoUrls(rep.details);
      renderReportAttachmentPreview();
      const sb = $("submitReportButton");
      if (sb) sb.textContent = "Update report";
      go("reports");
      $("reportFormCard")?.classList.remove("hidden");
      $("reportFormCard")?.scrollIntoView({ behavior: "smooth" });
      toast("Editing report — submit to save");
      return;
    }

    if (el.dataset.reportDelete) {
      if (!(await confirmDialog("Delete this report?", "Delete report"))) return;
      const rep = state.reports.find(r => String(r.id) === String(el.dataset.reportDelete));
      for (const u of (rep ? extractReportPhotoUrls(rep.details) : [])) await deleteStorageFile("reports", u);
      const { error } = await runtime.client.from("service_delivery_reports").delete().eq("id", el.dataset.reportDelete);
      if (error) { toast("Delete failed: " + error.message); return; }
      suppressNotifications();
      await loadReports();
      toast("Report deleted");
      return;
    }

    if (el.dataset.appNotice) {
      await runtime.client.from("app_notifications").update({ is_read: true }).eq("id", el.dataset.appNotice);
      const notice = state.appNotifications.find(n => String(n.id) === String(el.dataset.appNotice));
      const isDtrNotice = !notice?.report_id && /Time In|Time Out/i.test(String(notice?.title || ""));
      if (isDtrNotice) {
        await loadAppNotifications();
        go("dtr");
        dtrTab("time_log");
        return;
      }
      const rep = notice?.report_id ? state.reports.find(r => String(r.id) === String(notice.report_id)) : null;
      if (rep) {
        state.reportType = rep.report_type === "delivery" ? "delivery" : "service";
        runtime.reportsViewMode = "list";
        document.querySelectorAll<HTMLElement>("#reportTypeTabs .tab").forEach(x => x.classList.toggle("active", x.dataset.reportType === state.reportType));
      }
      await loadAppNotifications();
      go("reports");
      return;
    }
    if (el.dataset.approvalNotice) {
      await runtime.client.from("approval_notifications").update({ is_read: true }).eq("id", el.dataset.approvalNotice);
      await loadApprovalNotifications();
      return;
    }
    if (el.dataset.reportNotice) {
      const rep = state.reports.find(r => String(r.id) === String(el.dataset.reportNotice));
      if (rep) {
        state.reportType = rep.report_type === "delivery" ? "delivery" : "service";
        runtime.reportsViewMode = "list";
        document.querySelectorAll<HTMLElement>("#reportTypeTabs .tab").forEach(x => x.classList.toggle("active", x.dataset.reportType === state.reportType));
      }
      go("reports");
      return;
    }
    if (el.dataset.chatNotice) { await openThread(el.dataset.chatNotice); return; }

    switch (act) {
      case "noop": return;
      case "close-sheet": closeSheet(); return;
      case "open-dm": await openDirect(id); return;
      case "open-thread": await openThread(id); return;
      case "person-menu": openProfileView(id); return;
      case "approve": await approveRequest(id, true); return;
      case "decline": await approveRequest(id, false); return;
      case "view-ann": {
        const a = state.announcements.find(x => String(x.id) === String(id));
        if (a) openSheet("<h2>" + esc(a.title) + '</h2><div class="sheet-text">' + esc(a.body || "") + "</div>" + sheetClose());
        return;
      }
      case "edit-ann": {
        const a = state.announcements.find(x => String(x.id) === String(id));
        if (!a) return;
        runtime.editingAnnouncementId = String(a.id);
        setVal("annTitle", a.title || "");
        setVal("annBody", a.body || "");
        const btn = $("postAnnouncementBtn");
        if (btn) btn.textContent = "Save changes";
        $("cancelAnnouncementBtn")?.classList.remove("hidden");
        go("announcements");
        return;
      }
      case "del-ann": {
        if (!(await confirmDialog("Delete this announcement?", "Delete announcement"))) return;
        const { error } = await runtime.client.from("announcements").delete().eq("id", id);
        if (error) { toast("Delete failed: " + error.message); return; }
        suppressNotifications();
        await loadAnnouncements();
        toast("Deleted");
        return;
      }
      case "edit-sched": {
        editSchedule(id);
        return;
      }
      case "sched-to-dtr": {
        const s = (state.schedules || []).find(x => String(x.id) === String(id));
        if (s?.scheduled_date) setVal("dtrDate", String(s.scheduled_date));
        autoFillDtrFromSchedule(true);
        go("dtr");
        toast("DTR filled from schedule");
        return;
      }
      case "del-sched": {
        if (!(await confirmDialog("Delete this schedule?", "Delete schedule"))) return;
        const { error } = await runtime.client.from("schedules").delete().eq("id", id);
        if (error) { toast("Delete failed: " + error.message); return; }
        suppressNotifications();
        await loadSchedules();
        toast("Deleted");
        return;
      }
      case "edit-site": {
        openEditSiteOverlay(id);
        return;
      }
      case "del-site": {
        if (!(await confirmDialog("Delete this site?", "Delete site"))) return;
        const { error } = await runtime.client.from("sites").delete().eq("id", id);
        if (error) { toast("Delete failed: " + error.message); return; }
        suppressNotifications();
        await loadSites();
        toast("Deleted");
        return;
      }
      case "map": {
        openSiteOnMap(id);
        return;
      }
      case "upload-site-thumb": {
        if (!isManager()) return;
        pendingSiteThumbTargetId = id;
        ($("siteThumbFile") as HTMLInputElement | null)?.click();
        return;
      }
      case "preview-site-thumb": {
        const site = state.sites.find(x => String(x.id) === String(id));
        const url = site ? getSiteThumbnailUrl(site) : null;
        if (url) openPhotoPreview(url, site?.name || "Site Thumbnail");
        return;
      }
      case "approve-ot": {
        const { error } = await runtime.client.from("dtr_entries").update({ overtime_approved: true }).eq("id", id);
        if (error) { toast("Failed: " + error.message); return; }
        suppressNotifications();
        await loadDtrs();
        toast("Overtime approved");
        return;
      }
      case "del-dtr": {
        if (!(await confirmDialog("Delete this DTR entry?", "Delete DTR entry"))) return;
        const { error } = await runtime.client.from("dtr_entries").delete().eq("id", id);
        if (error) { toast("Failed: " + error.message); return; }
        suppressNotifications();
        await loadDtrs();
        toast("Deleted");
        return;
      }
      case "del-note": {
        if (!(await confirmDialog("Delete this note?", "Delete note"))) return;
        const { error } = await runtime.client.from("notes").delete().eq("id", id);
        if (error) { toast("Failed: " + error.message); return; }
        suppressNotifications();
        await loadNotes();
        toast("Deleted");
        return;
      }
      case "comment-rec": {
        const rec = state.recs.find(r => String(r.id) === String(id));
        if (!rec || !canCommentOnRec(rec)) {
          toast("View only: only the uploader, assigned personnel, Representative, or Admin can comment.");
          return;
        }
        const comment = val("comment" + id).trim();
        if (!comment) { toast("Write a comment first"); return; }
        const { error } = await runtime.client.from("recommendation_comments").insert({
          recommendation_id: id, user_id: state.userId, comment,
        });
        if (error) { toast("Failed: " + error.message); return; }
        suppressNotifications();
        await loadRecs();
        toast("Comment added");
        return;
      }
      case "del-rec": {
        if (!(await confirmDialog("Delete this recommendation?", "Delete recommendation"))) return;
        const { error } = await runtime.client.from("recommendations").delete().eq("id", id);
        if (error) { toast("Failed: " + error.message); return; }
        suppressNotifications();
        await loadRecs();
        toast("Deleted");
        return;
      }
      case "admin-edit": await openAdminEdit(id); return;
      case "leave-approve":
      case "leave-reject": {
        const status = act === "leave-approve" ? "approved" : "rejected";
        const { error } = await runtime.client
          .from("leave_requests")
          .update({ status, reviewed_by: state.userId, reviewed_at: new Date().toISOString() })
          .eq("id", id);
        if (error) { toast("Failed: " + error.message); return; }
        const req = state.leaveRequests.find(r => String(r.id) === String(id));
        if (req) {
          await runtime.client.from("approval_notifications").insert({
            recipient_user_id: req.user_id,
            title: "Leave " + status,
            body: req.leave_type + " leave for " + req.start_date + " – " + req.end_date + " was " + status + ".",
          });
        }
        suppressNotifications();
        await loadLeaveRequests();
        toast("Leave " + status);
        return;
      }
      case "remove-my-reaction": await removeMyReaction(id); return;
      case "chat-media":
      case "open-pinned-sheet":
      case "chat-members":
      case "chat-add":
      case "new-mute":
      case "new-notify":
      case "new-autosave":
      case "chat-share":
      case "new-e2e":
      case "new-disappearing":
      case "new-receipts":
      case "new-typing":
      case "new-permissions":
      case "new-block-dm":
      case "new-restrict":
      case "new-report":
      case "new-leave":
      case "chat-delete":
        await handleChatInfoAction(act, id);
        return;
      case "go-announcements": go("announcements"); return;
      case "go-schedule": go("schedule"); return;
      case "go-leave": go("leave"); return;
      case "go-pending": go("pending"); return;
    }
  });

  document.addEventListener("click", ev => {
    const tabBtn = (ev.target as HTMLElement | null)?.closest<HTMLElement>(".tabs .tab, .seg button");
    if (!tabBtn) return;
    triggerAndroidHapticTap();
    // Avoid double-animating dedicated tab handlers that already animate their specific panel
    if (["dtrFillTab", "dtrTimeLogTab", "dtrPrevTab", "notesTab", "recsTab"].includes(tabBtn.id)) return;
    const container = tabBtn.closest(".tabs, .seg");
    const targetPanel =
      (container?.nextElementSibling as HTMLElement | null) ||
      tabBtn.closest(".card") ||
      tabBtn.closest(".page");
    if (targetPanel) {
      requestAnimationFrame(() => applyRandomOpenStyle(targetPanel));
    }
  });

  let lastDtrMinuteTick = -1;
  setInterval(() => {
    if (!state.userId) return;
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    if (curMin !== lastDtrMinuteTick) {
      lastDtrMinuteTick = curMin;
      renderHomeDtrStatus();
      renderDtrLiveStatus();
      const dtrPageVisible = !$("page-dtr")?.classList.contains("hidden");
      const fillVisible = !$("dtrFill")?.classList.contains("hidden");
      if (dtrPageVisible && fillVisible && getLiveDtrTodaySummary().activeEntry) {
        renderDtr();
      }
    }
  }, 1000);

  setInterval(() => {
    if (state.userId) {
      if (state.schedules && state.schedules.length) {
        renderSchedules();
        checkUpcomingShiftReminders();
      }
      renderHome();
      renderHomeDtrStatus();
    }
  }, 30000);
}
