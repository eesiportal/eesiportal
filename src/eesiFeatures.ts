import {
  $,
  BLANK_IMG,
  PMS_ITEMS,
  TimeLogNoticeMeta,
  UNIT_MANUAL_DEFAULTS,
  buildRecReasonWithMeta,
  buildReportDetailsWithUnit,
  buildTimeLogAppNoticeBody,
  buildUnitNotesWithManual,
  calculateDtrHours,
  calculateOtMinutes,
  canCommentOnRec,
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
  fmtTableDate,
  getDtrCutoffForDate,
  hooks,
  isAdmin,
  isImageFile,
  isImageUrl,
  isManager,
  isMissingTableError,
  leaveDaysCount,
  listAvailableDtrCutoffs,
  localDateKey,
  openSheet,
  parseRecMeta,
  parseReportUnit,
  parseUnitManualMeta,
  prepareImageFile,
  profileName,
  profileOf,
  renderUserLeaveBalanceHtml,
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
  val,
} from "./eesiTypes";
import {
  isNoticeMarkedRead,
  loadAnnouncements,
  loadAppNotifications,
  loadApprovalNotifications,
  loadDtrs,
  loadLeaveRequests,
  loadLiveMap,
  loadNotes,
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
  markNoticeRead,
  onlineIds,
  openSiteGoogleMap,
  saveLastView,
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
import { phHolidays, triggerShiftAlert } from "./eesiSettings";

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
  if (isManager() && state.reportType === "checklist") state.reportType = "service";
  renderPmsChecklist();
}

export function go(p: string, opts: { skipScrollReset?: boolean } = {}): void {
  if (["members", "pending"].includes(p) && !isManager()) { toast("Admin or Representative access only"); return; }
  if (p === "admin" && !isAdmin()) { toast("Administrator only"); return; }
  if (p === "live-map" && !isAdmin()) { toast("Administrator only"); return; }
  if (p === "live-map") setTimeout(() => loadLiveMap(), 50);
  const pageEl = $("page-" + p);
  if (!pageEl) { toast("Page not found"); return; }
  document.querySelectorAll(".page").forEach(el => el.classList.add("hidden"));
  pageEl.classList.remove("hidden");
  runtime.currentPage = p;
  $("settingsMenu")?.classList.add("hidden");
  document.querySelectorAll<HTMLElement>("nav.bottom button").forEach(btn => btn.classList.toggle("active", btn.dataset.page === p));
  if (p === "profile") renderProfile();
  if (p === "units") { renderUnitSiteOptions(); renderUnits(); }
  if (p === "reports") { renderReportSites(); renderReports(); if (runtime.reportsViewMode === "search") runSearch(); }
  if (p === "chat") { renderChatList(); renderMessages(); }
  if (p === "notices") { loadAppNotifications(); loadApprovalNotifications(); loadRecentChatNotices(); }
  if (p === "admin") renderAdmin();
  if (p === "schedule") { renderScheduleSiteOptions(); renderAssigneesPicker(); }
  if (p === "notes") { renderConnectedPickers(); }
  if (p === "dtr") { renderConnectedPickers(); autoFillDtrFromSchedule(false); renderTimeLog(); }
  renderAll();
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

function parseScheduleTimeToken(raw: string): { hours: number; minutes: number; timeLabel: string } | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const match = s.match(/(\d{1,2}):([0-5]\d)(?:\s*([ap]m))?/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
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
  };
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
export function visibleSchedules(): any[] {
  if (isAdmin()) return [...state.schedules];
  const myName = (state.profile?.full_name || "").trim().toLowerCase();
  if (!myName) return [];
  const escaped = myName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRegex = new RegExp("(^|[^a-z0-9])" + escaped + "([^a-z0-9]|$)", "i");
  return state.schedules.filter(s => {
    const notes = s.notes || "";
    const match = notes.match(/^\[ASSIGNED:\s*([^\]]+)\]/);
    if (match && match[1].split(",").map((n: string) => n.trim().toLowerCase()).includes(myName)) return true;
    return nameRegex.test((s.title || "") + " " + notes);
  });
}

export function checkUpcomingShiftReminders(): void {
  if (!state.userId || !state.schedules?.length) return;
  const list = visibleSchedules();
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
    isRead: isNoticeMarkedRead("ann:" + a.id),
  }));
  visibleSchedules().forEach(s => items.push({
    key: "sched:" + s.id, date: (s.scheduled_date || "1970-01-01") + "T" + (s.time_in || "00:00"), icon: "📅",
    title: s.title || "Schedule", body: [s.region, s.time_in && s.time_out ? s.time_in + "–" + s.time_out : "", s.priority].filter(Boolean).join(" · "),
    label: "Schedule", act: "go-schedule",
    isRead: isNoticeMarkedRead("sched:" + s.id),
  }));
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
      isRead: isNoticeMarkedRead(key),
    });
  });
  state.approvalNotifications.forEach(n => items.push({
    key: "appr:" + n.id, date: n.created_at, icon: "🔔", title: n.title, body: n.body,
    label: "Notification", approvalId: n.id, isRead: !!n.is_read,
  }));
  state.appNotifications.forEach(n => {
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
      isRead: !!n.is_read,
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
      label: typeLbl, reportNoticeId: r.id,
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
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}

let tickerKey = "";
export function updateAnnouncementTicker(): void {
  const text = $("tickerText");
  if (!text) return;
  const all = [...SYSTEM_ANNOUNCEMENTS, ...(state.announcements || [])];
  const line = all.map(a => "📢 " + (a.title || "") + " — " + (a.body || "")).join("     ◆     ") + "     ◆     ";
  if (line === tickerKey) return;
  tickerKey = line;
  text.textContent = line;
  text.style.animation = "marquee " + Math.max(20, Math.round(line.length * 0.18)) + "s linear infinite";
}

export function openQuickTimeAction(mode: "time_in" | "time_out"): void {
  setTimeLogMode(mode);
  go("dtr");
  dtrTab("time_log");
}

export function renderHomeDtrStatus(): void {
  const card = $("homeDtrStatusCard");
  if (!card) return;
  if (!state.userId) {
    card.classList.add("hidden");
    return;
  }
  const todayStr = localDateKey(new Date());
  const myToday = (state.dtrs || []).filter(
    d => String(d.user_id) === String(state.userId) && String(d.work_date) === String(todayStr)
  );
  const activeEntry = myToday.find(d => d.time_in && (!d.time_out || d.time_out === d.time_in));
  let totalHours = myToday.reduce(
    (sum, d) => sum + calculateDtrHours(d.time_in, d.time_out, !!d.overtime_approved),
    0
  );
  if (activeEntry && activeEntry.time_in) {
    const [ih, im] = String(activeEntry.time_in).split(":").map(Number);
    if (Number.isFinite(ih) && Number.isFinite(im)) {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const inMins = ih * 60 + im;
      const elapsed = Math.max(0, nowMins - inMins);
      totalHours += elapsed / 60;
    }
  }
  const hasAnyToday = myToday.length > 0;
  const statusBadge = activeEntry
    ? '<span class="sess-badge now" style="margin-left:0;">● Clocked In</span>'
    : (hasAnyToday
      ? '<span class="badge">✅ Shift Logged</span>'
      : '<span class="badge">⚪ Not Clocked In</span>');
  const detailText = activeEntry
    ? `Total today: <b>${totalHours.toFixed(2)} hrs</b> · Since <b>${esc(activeEntry.time_in)}</b>` +
      (activeEntry.location ? ` · 📍 ${esc(activeEntry.location)}` : "")
    : `Total today: <b>${totalHours.toFixed(2)} hrs</b>` +
      (hasAnyToday ? " · Shift completed" : " · Tap Time In to start");
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

  const box = $("homeTimeline");
  if (!box) return;
  const now = new Date();
  const year = now.getFullYear();
  const todayStr = localDateKey(now);
  const upcomingHolidays = [...phHolidays(year), ...phHolidays(year + 1)].filter(h => h.date >= todayStr).slice(0, 4);

  const recentItems = [
    ...state.announcements.map(a => ({ date: a.created_at, icon: "📢", title: a.title || "Announcement", detail: a.body || "", label: "Announcement" })),
    ...visibleSchedules().filter(s => s.scheduled_date).map(s => ({
      date: s.scheduled_date + "T" + (s.time_in || "00:00"), icon: "📅", title: s.title || "Schedule",
      detail: [s.region, s.time_in && s.time_out ? s.time_in + "–" + s.time_out : ""].filter(Boolean).join(" · "), label: "Schedule",
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
      };
    }),
  ].filter(item => item.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

  const upcomingHtml = upcomingHolidays.map(h => {
    const diffDays = Math.round((new Date(h.date + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000);
    const badge = diffDays === 0 ? '<span class="sess-badge now">TODAY</span>' : '<span class="sess-badge soon">In ' + diffDays + " day(s)</span>";
    return '<div class="pv-row"><span><b>' + esc(fmtDay(h.date)) + "</b> — " + esc(h.name) + " " + badge + '</span><span class="muted">' + esc(h.kind) + "</span></div>";
  }).join("") || '<p class="muted">No upcoming holidays.</p>';

  const recentHtml = recentItems.map(item =>
    '<div class="item"><b>' + item.icon + " " + esc(item.title) + '</b><div class="muted">' + esc(item.label) + " · " + esc(fmtDate(item.date)) + "</div><div>" + esc(item.detail) + "</div></div>"
  ).join("") || '<p class="muted">No recent timeline items yet.</p>';

  const nextHtml =
    '<div style="margin-bottom:14px;"><h3 style="margin:0 0 8px;">🇵🇭 Upcoming Philippine Holidays</h3><div class="item sess-soon">' + upcomingHtml + "</div></div>" +
    '<div><h3 style="margin:0 0 8px;">🕒 Recent Timeline</h3>' + recentHtml + "</div>";
  if (box.innerHTML !== nextHtml) box.innerHTML = nextHtml;
}

export function renderNotices(): void {
  const box = $("noticeList");
  if (!box) return;
  const items = getNoticeItems();
  box.innerHTML = items.map(item => {
    let attr = ' data-act="noop"';
    if (item.approvalId) attr = ' data-approval-notice="' + esc(item.approvalId) + '"';
    else if (item.appId) attr = ' data-app-notice="' + esc(item.appId) + '"';
    else if (item.reportNoticeId) attr = ' data-report-notice="' + esc(item.reportNoticeId) + '"';
    else if (item.chatId) attr = ' data-chat-notice="' + esc(item.chatId) + '"';
    else if (item.act) attr = ' data-act="' + esc(item.act) + '"';
    const unreadClass = !item.isRead ? " unread-notice" : "";
    const statusBadge = !item.isRead
      ? '<button class="btn small-btn" type="button" data-mark-notice-read="' + esc(item.key) + '" data-db-app="' + esc(item.appId || "") + '" data-db-appr="' + esc(item.approvalId || "") + '">✓ Done / Mark read</button>'
      : '<span class="badge">✓ Read</span>';
    return '<div class="item clickable' + unreadClass + '"' + attr + ' data-notice-key="' + esc(item.key) + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;"><div><b>' + item.icon + " " + esc(item.title) +
      '</b><div class="muted">' + esc(item.label) + " · " + esc(fmtDate(item.date)) + "</div></div><div>" + statusBadge + '</div></div><div style="margin-top:4px">' + esc(item.body) + "</div></div>";
  }).join("") || '<p class="muted">No notifications yet.</p>';
  const bell = $("bell");
  if (bell) {
    const unreadCount = items.filter(i => !i.isRead).length;
    bell.textContent = unreadCount ? String(unreadCount) : "";
  }
}

/* ==================== MEMBERS / ONLINE / PENDING / ADMIN ==================== */
function memberRow(p: any): string {
  const online = onlineIds().has(String(p.user_id));
  const role = state.roles[p.user_id];
  const label = role ? roleLabel(role.app_role) : (p.team || "Member");
  return '<div class="person"><span class="tap" data-act="person-menu" data-id="' + esc(p.user_id) + '">' + face(p) +
    '</span><span class="person-info"><button type="button" class="text-button" data-act="person-menu" data-id="' + esc(p.user_id) + '">' + esc(p.full_name || "Member") +
    '</button><span class="muted"><span class="online-dot ' + (online ? "on" : "") + '"></span>' + (online ? "Online" : "Offline") + " · " + esc(label) + (p.area ? " · " + esc(p.area) : "") +
    "</span></span>" + (String(p.user_id) !== String(state.userId) ? '<button class="btn small-btn" type="button" data-act="open-dm" data-id="' + esc(p.user_id) + '">Chat</button>' : "") + "</div>";
}
export function renderMembers(): void {
  const box = $("members");
  if (!state.userId || !box) return;
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
}
export function renderPending(): void {
  const box = $("pending");
  if (!isManager() || !box) return;
  box.innerHTML = state.pending.map(r =>
    '<div class="item"><b>' + esc(r.full_name) + "</b> — " + esc(roleLabel(r.requested_role)) +
    '<div class="muted">' + esc(r.email || "") + " · requested " + esc(fmtDate(r.created_at)) + '</div>' +
    '<div class="inline-actions"><button class="green small-btn" type="button" data-act="approve" data-id="' + esc(r.id) + '">Approve</button>' +
    '<button class="red small-btn" type="button" data-act="decline" data-id="' + esc(r.id) + '">Decline</button></div></div>'
  ).join("") || '<p class="muted">No pending registrations.</p>';
}
export function renderAdmin(): void {
  const box = $("adminList");
  if (!box) return;
  if (!isAdmin()) { box.innerHTML = '<p class="muted">Admin only.</p>'; return; }
  box.innerHTML = state.profiles.map(p => {
    const role = state.roles[p.user_id];
    const roleText = role ? roleLabel(role.app_role) : "—";
    return '<div class="person">' + face(p) + '<span class="person-info"><b>' + esc(p.full_name || "Member") + '</b><span class="muted">' +
      esc(roleText) + (p.area ? " · " + esc(p.area) : "") + '</span></span><button class="gray small-btn" type="button" data-act="admin-edit" data-id="' + esc(p.user_id) + '">Edit</button></div>';
  }).join("") || '<p class="muted">No members.</p>';
}

async function approveRequest(id: string, approve: boolean): Promise<void> {
  const req = state.pending.find(r => String(r.id) === String(id));
  if (!req) return;
  if (approve) {
    const { error: roleErr } = await runtime.client
      .from("user_roles")
      .upsert({ user_id: req.user_id, app_role: req.requested_role || "technician", approval_status: "approved" }, { onConflict: "user_id" });
    if (roleErr) { toast("Could not approve: " + roleErr.message); return; }
    await runtime.client.from("profiles").upsert({
      user_id: req.user_id, full_name: req.full_name, email: req.email,
      id_no: req.id_no, address: req.address, team: req.team, phone: req.phone, area: req.area,
    }, { onConflict: "user_id" });
  }
  const { error } = await runtime.client.from("registration_requests").update({ status: approve ? "approved" : "declined" }).eq("id", id);
  if (error) { toast("Could not update: " + error.message); return; }
  await runtime.client.from("approval_notifications").insert({
    recipient_user_id: req.user_id,
    title: approve ? "Account approved" : "Registration declined",
    body: approve ? "You can now sign in to EESI Ops." : "Contact an administrator for details.",
  });
  suppressNotifications();
  await loadPending();
  if (approve) { await loadProfiles(); await loadRoles(); }
  toast(approve ? "Approved" : "Declined");
}

async function openAdminEdit(userId: string): Promise<void> {
  const p = profileOf(userId);
  const role = state.roles[userId];
  if (!p) return;
  openSheet(
    '<h2>Edit member</h2><div class="field"><label>Full name</label><input id="admName" value="' + esc(p.full_name || "") +
    '"></div><div class="field"><label>ID No.</label><input id="admId" value="' + esc(p.id_no || "") +
    '"></div><div class="field"><label>Team</label><input id="admTeam" value="' + esc(p.team || "") +
    '"></div><div class="field"><label>Area</label><select id="admArea">' +
    ["", "Visayas", "Luzon", "Mindanao"].map(a => '<option value="' + a + '"' + (p.area === a ? " selected" : "") + ">" + (a || "—") + "</option>").join("") +
    '</select></div><div class="field"><label>Designation</label><select id="admRole">' +
    ["admin", "representative", "technician", "employee"].map(r => '<option value="' + r + '"' + ((role ? role.app_role : "") === r ? " selected" : "") + ">" + esc(roleLabel(r)) + "</option>").join("") +
    '</select></div><button class="btn" style="width:100%" onclick="saveAdminEdit(\'' + esc(userId) + "')\">Save</button>" + sheetClose()
  );
}
export async function saveAdminEdit(userId: string): Promise<void> {
  const { error: pe } = await runtime.client.from("profiles").update({
    full_name: val("admName").trim(), id_no: val("admId").trim() || null, team: val("admTeam").trim() || null, area: val("admArea") || null,
  }).eq("user_id", userId);
  if (pe) { toast("Profile update failed: " + pe.message); return; }
  const { error: re } = await runtime.client.from("user_roles").upsert({
    user_id: userId, app_role: val("admRole"), approval_status: "approved",
  }, { onConflict: "user_id" });
  if (re) { toast("Role update failed: " + re.message); return; }
  closeSheet();
  suppressNotifications();
  await loadProfiles();
  await loadRoles();
  renderAdmin();
  toast("Member updated");
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
  box.innerHTML = keys.map(key =>
    '<div class="person-group-title">' + esc(key) + "</div>" +
    grouped[key].map(p =>
      '<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" name="schPersonnel" data-name="' + esc(p.full_name) + '" value="' + esc(p.user_id) + '" style="width:auto">' + esc(p.full_name) + "</label>"
    ).join("")
  ).join("") || '<p class="muted">No personnel in this area.</p>';
}

export function renderSchedules(): void {
  const box = $("scheduleList");
  if (!box) return;
  const filtered = visibleSchedules();
  box.innerHTML = filtered.map(s => {
    const match = (s.notes || "").match(/^\[ASSIGNED:\s*([^\]]+)\]/);
    const assigned = match ? match[1] : "";
    const notes = (s.notes || "").replace(/^\[ASSIGNED:\s*[^\]]+\]\s*/, "");
    const sst = sessionState(s);
    return '<div class="item' + (sst ? " sess-" + sst : "") + '"><b>' + esc(s.title) + "</b> " + sessionBadge(s) +
      ' <span class="badge">' + esc(s.priority || "Normal") + '</span><div class="muted">' + esc(fmtDay(s.scheduled_date)) +
      (s.region ? " · " + esc(s.region) : "") + (s.time_in && s.time_out ? " · " + esc(s.time_in) + "–" + esc(s.time_out) : "") +
      "</div>" + (assigned ? "<div><b>Assigned:</b> " + esc(assigned) + "</div>" : "") + (notes ? "<div>" + esc(notes) + "</div>" : "") +
      (isManager() ? '<div class="inline-actions"><button class="red small-btn" type="button" data-act="del-sched" data-id="' + esc(s.id) + '">Delete</button></div>' : "") + "</div>";
  }).join("") || '<p class="muted">No schedules assigned to you.</p>';
}

export async function saveSchedule(): Promise<void> {
  if (!isManager()) return;
  const title = val("schTitle").trim();
  if (!title) { toast("Enter a job or site"); return; }
  const picked = [...document.querySelectorAll<HTMLInputElement>('input[name="schPersonnel"]:checked')];
  const names = picked.map(i => i.dataset.name).filter(Boolean);
  const note = (names.length ? "[ASSIGNED: " + names.join(", ") + "] " : "") + val("schNotes").trim();
  const { error } = await runtime.client.from("schedules").insert({
    title, region: val("schRegion"), scheduled_date: val("schDate") || null,
    priority: val("schPriority"), time_in: val("schIn") || null, time_out: val("schOut") || null, notes: note,
  });
  if (error) { toast("Could not save: " + error.message); return; }
  setVal("schSite", "");
  setVal("schUnit", "");
  setVal("schTitle", "");
  setVal("schNotes", "");
  document.querySelectorAll<HTMLInputElement>('input[name="schPersonnel"]:checked').forEach(i => { i.checked = false; });
  suppressNotifications();
  await loadSchedules();
  $("scheduleFormCard")?.classList.add("hidden");
  toast("Schedule saved");
}

export function renderSites(): void {
  const box = $("siteList");
  if (!box) return;
  box.innerHTML = state.sites.map(s =>
    '<div class="item"><b>' + esc(s.name) + '</b><div class="muted">' + esc([s.address, s.city, s.region].filter(Boolean).join(" · ")) +
    '</div><div class="inline-actions"><button class="gray small-btn" type="button" data-act="map" data-id="' + esc(s.id) + '">📍 Map</button>' +
    (isManager() ? '<button class="red small-btn" type="button" data-act="del-site" data-id="' + esc(s.id) + '">Delete</button>' : "") + "</div></div>"
  ).join("") || '<p class="muted">No sites yet.</p>';
}

export async function addSite(): Promise<void> {
  const name = val("siteName").trim();
  if (!name) { toast("Enter a site name"); return; }
  const { error } = await runtime.client.from("sites").insert({
    name, address: val("siteAddress").trim() || null, region: val("siteRegion"), city: val("siteCity").trim() || null,
  });
  if (error) { toast("Could not add: " + error.message); return; }
  $("addSiteOverlay")?.classList.add("hidden");
  setVal("siteName", "");
  setVal("siteAddress", "");
  setVal("siteCity", "");
  suppressNotifications();
  await loadSites();
  toast("Site added");
}

export function openSiteOnMap(siteId: string): void {
  const s = state.sites.find(x => String(x.id) === String(siteId));
  if (!s) return;
  go("sites");
  $("siteMapCard")?.classList.remove("hidden");
  const ttl = $("siteMapTitle");
  if (ttl) ttl.textContent = s.name;
  const query = [s.name, s.address, s.city, s.region, "Philippines"].filter(Boolean).join(", ");
  void openSiteGoogleMap("siteGoogleMap", query, s.name, "siteMapStatus");
  $("siteMapCard")?.scrollIntoView({ behavior: "smooth" });
}

/* ==================== UNITS & MANUALS ==================== */
export function renderUnitSiteOptions(): void {
  const sel = $("unitSite") as HTMLSelectElement | null;
  if (!sel) return;
  const cur = sel.value;
  const grouped = ["Luzon", "Visayas", "Mindanao"].map(reg => {
    const list = state.sites.filter(s => s.region === reg);
    if (!list.length) return "";
    return '<optgroup label="' + esc(reg) + '">' + list.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + (s.city ? " (" + esc(s.city) + ")" : "") + "</option>").join("") + "</optgroup>";
  }).join("");
  const other = state.sites.filter(s => !["Luzon", "Visayas", "Mindanao"].includes(s.region));
  const otherHtml = other.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + "</option>").join("");
  sel.innerHTML = '<option value="">Select a work site</option>' + grouped + otherHtml;
  if (state.sites.some(s => String(s.id) === cur)) sel.value = cur;
}

export function openAddUnitForSite(siteId: string): void {
  runtime.editingUnitId = null;
  const ttl = $("unitFormTitle");
  if (ttl) ttl.textContent = "Add unit";
  ["unitName", "unitBrand", "unitSerial", "unitCapacity", "unitNotes"].forEach(id => setVal(id, ""));
  setVal("unitType", "elevator");
  setVal("unitStatus", "Operational");
  renderUnitSiteOptions();
  setVal("unitSite", siteId);
  $("unitFormCard")?.classList.remove("hidden");
  $("unitFormCard")?.scrollIntoView({ behavior: "smooth" });
}

export function editUnit(unitId: string): void {
  const u = state.units.find(x => String(x.id) === String(unitId));
  if (!u) return;
  runtime.editingUnitId = String(u.id);
  const ttl = $("unitFormTitle");
  if (ttl) ttl.textContent = "Edit unit";
  renderUnitSiteOptions();
  setVal("unitSite", String(u.site_id || ""));
  setVal("unitName", u.unit_name || "");
  setVal("unitType", u.unit_type || "elevator");
  setVal("unitStatus", u.status || "Operational");
  setVal("unitBrand", u.brand_model || "");
  setVal("unitSerial", u.serial_no || "");
  setVal("unitCapacity", u.capacity_floors || "");
  setVal("unitNotes", parseUnitManualMeta(u.notes).cleanNotes);
  $("unitFormCard")?.classList.remove("hidden");
  $("unitFormCard")?.scrollIntoView({ behavior: "smooth" });
}

export function cancelUnitForm(): void {
  runtime.editingUnitId = null;
  ["unitName", "unitBrand", "unitSerial", "unitCapacity", "unitNotes"].forEach(id => setVal(id, ""));
  $("unitFormCard")?.classList.add("hidden");
}

export async function saveUnit(): Promise<void> {
  if (!checkNetwork()) return;
  const siteId = val("unitSite");
  const unitName = val("unitName").trim();
  if (!siteId || !unitName) { toast("Select a work site and enter a unit name"); return; }

  let combinedNotes = val("unitNotes").trim();
  if (runtime.editingUnitId) {
    const existing = state.units.find(u => String(u.id) === String(runtime.editingUnitId));
    if (existing) {
      const meta = parseUnitManualMeta(existing.notes);
      combinedNotes = buildUnitNotesWithManual(combinedNotes, meta.manualUrl, meta.manualText);
    }
  }

  const payload = {
    site_id: siteId,
    unit_name: unitName,
    unit_type: val("unitType"),
    status: val("unitStatus"),
    brand_model: val("unitBrand").trim() || null,
    serial_no: val("unitSerial").trim() || null,
    capacity_floors: val("unitCapacity").trim() || null,
    notes: combinedNotes || null,
  };
  const q = runtime.editingUnitId
    ? runtime.client.from("site_units").update(payload).eq("id", runtime.editingUnitId)
    : runtime.client.from("site_units").insert({ ...payload, created_by: state.userId });
  const { error } = await q;
  if (error) { toast("Could not save unit: " + error.message); return; }
  cancelUnitForm();
  suppressNotifications();
  await loadUnits();
  toast("Unit saved");
}

export async function deleteUnit(unitId: string): Promise<void> {
  if (!(await confirmDialog("Delete this unit?", "Delete unit"))) return;
  const { error } = await runtime.client.from("site_units").delete().eq("id", unitId);
  if (error) { toast("Delete failed: " + error.message); return; }
  if (runtime.manualUnitId === String(unitId)) runtime.manualUnitId = null;
  suppressNotifications();
  await loadUnits();
  toast("Unit deleted");
}

export function switchUnitsTab(tab: "list" | "manual"): void {
  runtime.unitsTab = tab;
  document.querySelectorAll<HTMLElement>("[data-units-tab]").forEach(b => b.classList.toggle("active", b.dataset.unitsTab === tab));
  $("unitsListView")?.classList.toggle("hidden", tab !== "list");
  $("unitsManualView")?.classList.toggle("hidden", tab !== "manual");
  renderUnits();
  saveLastView();
}

export function openUnitManual(unitId: string): void {
  const u = state.units.find(x => String(x.id) === String(unitId));
  if (!u) return;
  const site = state.sites.find(s => String(s.id) === String(u.site_id));
  if (site?.region) {
    runtime.unitsRegion = site.region;
    document.querySelectorAll<HTMLElement>("[data-units-region]").forEach(b => b.classList.toggle("active", b.dataset.unitsRegion === site.region));
  }
  runtime.manualUnitId = String(u.id);
  switchUnitsTab("manual");
  go("units");
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
  toast("Unit manual updated");
}

let pendingManualUploadUnitId: string | null = null;
export function triggerUnitManualUpload(unitId: string): void {
  pendingManualUploadUnitId = unitId;
  $("unitManualFile")?.click();
}

export function openUnitReport(siteId: string, unitName: string, unitId = ""): void {
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

function renderUnitsManualSection(sites: any[], q: string): void {
  const box = $("unitsManualView");
  if (!box) return;
  const filteredUnits = state.units.filter(u => {
    const site = state.sites.find(s => String(s.id) === String(u.site_id));
    if (!site || (runtime.unitsRegion !== "ALL" && site.region !== runtime.unitsRegion)) return false;
    if (!q) return true;
    const hay = [u.unit_name, u.unit_type, u.brand_model, u.serial_no, site.name, site.city, site.address].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });

  if (!filteredUnits.length) {
    box.innerHTML = '<div class="card"><p class="muted" style="margin:0;">No units found in ' + esc(runtime.unitsRegion) + " for manuals yet. Add units in the Units list tab.</p></div>";
    return;
  }

  const activeUnit = filteredUnits.find(u => String(u.id) === String(runtime.manualUnitId)) || filteredUnits[0];
  if (activeUnit && String(runtime.manualUnitId) !== String(activeUnit.id)) {
    runtime.manualUnitId = String(activeUnit.id);
  }

  const pickerCards = sites.map(site => {
    const sUnits = filteredUnits
      .filter(u => String(u.site_id) === String(site.id))
      .sort((a, b) => String(a.unit_name || "").localeCompare(String(b.unit_name || "")));
    if (!sUnits.length) return "";
    const loc = [site.address, site.city, site.region].filter(Boolean).join(" · ");
    return '<div class="card" style="margin-bottom:10px;"><b style="font-size:14px;">📍 ' + esc(site.name) + '</b><div class="muted" style="margin-bottom:8px;">' + esc(loc) + '</div>' +
      '<div class="inline-actions" style="margin-top:0;">' +
      sUnits.map(u => {
        const active = activeUnit && String(u.id) === String(activeUnit.id);
        return '<button class="' + (active ? "btn" : "gray") + ' small-btn" type="button" onclick="openUnitManual(\'' + esc(u.id) + '\')">📖 ' + esc(u.unit_name) + "</button>";
      }).join("") +
      "</div></div>";
  }).filter(Boolean).join("");

  let detailHtml = "";
  if (activeUnit) {
    const site = state.sites.find(s => String(s.id) === String(activeUnit.site_id));
    const meta = parseUnitManualMeta(activeUnit.notes);
    const std = UNIT_MANUAL_DEFAULTS[activeUnit.unit_type] || UNIT_MANUAL_DEFAULTS.elevator;
    const canEditManual = isManager() || String(activeUnit.created_by) === String(state.userId);
    const fileUrl = safeUrl(meta.manualUrl);

    detailHtml =
      '<div class="card" style="border-color:var(--border-hot);">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">' +
      '<div><h2 style="margin:0 0 4px;">📖 ' + esc(activeUnit.unit_name) + " — Manual</h2>" +
      '<div class="muted">📍 ' + esc(site ? [site.name, site.address, site.city, site.region].filter(Boolean).join(" · ") : "Site") +
      " · " + esc([activeUnit.unit_type, activeUnit.brand_model, activeUnit.serial_no ? "S/N: " + activeUnit.serial_no : "", activeUnit.capacity_floors].filter(Boolean).join(" · ")) +
      "</div></div>" +
      '<span class="badge">' + esc(activeUnit.status || "Operational") + "</span></div>" +
      (fileUrl
        ? '<div class="item" style="margin-top:12px;"><b>📎 Attached Unit Manual Document</b><div class="inline-actions"><a class="btn small-btn" href="' + esc(fileUrl) + '" target="_blank" rel="noopener" style="text-decoration:none;">Open Manual File ↗</a></div></div>'
        : "") +
      (meta.manualText
        ? '<div class="item" style="margin-top:12px;border-left:3px solid var(--cyan);"><b>📝 Site-Specific Manual / Wiring / Controller Notes</b><div style="white-space:pre-wrap;margin-top:6px;line-height:1.5;">' + esc(meta.manualText) + "</div></div>"
        : "") +
      '<div style="margin-top:14px;"><h3 style="margin:0 0 8px;">' + esc(std.title) + "</h3>" +
      std.sections.map(sec =>
        '<div class="item"><b>' + esc(sec.heading) + '</b><ul style="margin:6px 0 0;padding-left:18px;line-height:1.5;">' +
        sec.steps.map(st => "<li>" + esc(st) + "</li>").join("") + "</ul></div>"
      ).join("") +
      "</div>" +
      (canEditManual
        ? '<div class="card" style="margin-top:12px;background:rgba(0,0,0,0.2);">' +
          '<h3 style="margin:0 0 8px;">Update Custom Unit Manual</h3>' +
          '<div class="field"><label for="manualUrlInput_' + esc(activeUnit.id) + '">Manual File / PDF URL</label><input id="manualUrlInput_' + esc(activeUnit.id) + '" value="' + esc(meta.manualUrl) + '" placeholder="https://… or upload below"></div>' +
          '<div class="field"><label for="manualCustomText_' + esc(activeUnit.id) + '">Unit-Specific Instructions / Fault Codes / Notes</label><textarea id="manualCustomText_' + esc(activeUnit.id) + '" rows="4" placeholder="Enter controller fault codes, key switches, emergency rescue steps…">' + esc(meta.manualText) + "</textarea></div>" +
          '<div class="inline-actions">' +
          '<button class="btn small-btn" type="button" onclick="saveUnitManual(\'' + esc(activeUnit.id) + '\')">💾 Save Manual</button>' +
          '<button class="gray small-btn" type="button" onclick="triggerUnitManualUpload(\'' + esc(activeUnit.id) + '\')">📎 Upload PDF / Photo Manual</button>' +
          "</div></div>"
        : "") +
      "</div>";
  }

  box.innerHTML = pickerCards + detailHtml;
}

export function renderUnits(): void {
  const box = $("unitsList");
  const q = val("unitsSearch").trim().toLowerCase();
  const sortMode = val("unitsSort") || "site";

  const sites = state.sites
    .filter(s => s.region === runtime.unitsRegion)
    .sort((a, b) => {
      if (sortMode === "location") {
        const la = [a.city, a.address, a.name].filter(Boolean).join(" ");
        const lb = [b.city, b.address, b.name].filter(Boolean).join(" ");
        return la.localeCompare(lb);
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  renderUnitsManualSection(sites, q);
  if (!box || runtime.unitsTab === "manual") return;

  const siteCards = sites.map(site => {
    const loc = [site.address, site.city, site.region].filter(Boolean).join(" · ");
    let siteUnits = state.units.filter(u => String(u.site_id) === String(site.id));
    if (q) {
      const siteMatch = (site.name + " " + loc).toLowerCase().includes(q);
      if (!siteMatch) {
        siteUnits = siteUnits.filter(u =>
          [u.unit_name, u.unit_type, u.brand_model, u.serial_no, u.status, u.notes].filter(Boolean).join(" ").toLowerCase().includes(q)
        );
      }
      if (!siteMatch && !siteUnits.length) return "";
    }
    siteUnits = [...siteUnits].sort((a, b) => {
      if (sortMode === "status") return String(a.status || "").localeCompare(String(b.status || ""));
      return String(a.unit_name || "").localeCompare(String(b.unit_name || ""));
    });

    const siteReports = state.reports.filter(r => String(r.site_id) === String(site.id));
    const sitePms = state.pmsRecords.filter(r => String(r.site_id) === String(site.id));
    const siteRecs = state.recs.filter(r => (r.site || "").trim().toLowerCase() === (site.name || "").trim().toLowerCase());
    const siteSchedules = visibleSchedules().filter(s => (s.title || "").toLowerCase().includes((site.name || "").toLowerCase()));

    const unitsHtml = siteUnits.map(u => {
      const canManage = isManager() || String(u.created_by) === String(state.userId);
      const statusBadge = u.status === "Operational" ? "now" : (u.status === "Needs Repair" || u.status === "Shutdown" ? "" : "soon");
      const badgeStyle = (u.status === "Needs Repair" || u.status === "Shutdown") ? ' style="background:var(--red);color:#fff;"' : "";
      const specs = [u.unit_type, u.brand_model, u.serial_no ? "S/N: " + u.serial_no : "", u.capacity_floors].filter(Boolean).join(" · ");
      const meta = parseUnitManualMeta(u.notes);
      return '<div class="item" style="margin-top:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">' +
        '<div><b>🛗 ' + esc(u.unit_name) + '</b> <span class="sess-badge ' + statusBadge + '"' + badgeStyle + ">" + esc(u.status || "Operational") + "</span></div>" +
        '<span class="muted" style="font-size:12px;">📍 ' + esc(site.name + (site.city ? " · " + site.city : "")) + "</span></div>" +
        '<div class="muted">' + esc(specs) + "</div>" +
        (meta.cleanNotes ? '<div style="margin-top:4px">' + esc(meta.cleanNotes) + "</div>" : "") +
        '<div class="inline-actions">' +
        '<button class="btn small-btn" type="button" onclick="openUnitManual(\'' + esc(u.id) + '\')">📖 Manual</button>' +
        '<button class="gray small-btn" type="button" onclick="openUnitPms(\'' + esc(site.id) + "','" + esc(site.region) + "','" + esc(u.unit_type) + "','" + esc(u.id) + '\')">✅ PMS</button>' +
        '<button class="gray small-btn" type="button" onclick="openUnitReport(\'' + esc(site.id) + "','" + esc(u.unit_name) + "','" + esc(u.id) + '\')">📄 Report</button>' +
        (canManage ? '<button class="gray small-btn" type="button" onclick="editUnit(\'' + esc(u.id) + '\')">Edit</button><button class="red small-btn" type="button" onclick="deleteUnit(\'' + esc(u.id) + '\')">Delete</button>' : "") +
        "</div></div>";
    }).join("") || '<p class="muted" style="margin:8px 0;">No units added for this site yet.</p>';

    const latestReport = siteReports[0];
    const latestPms = sitePms[0];
    const connectedHtml =
      '<div class="muted" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:12px;">' +
      "<div><b>Connected:</b> " + siteUnits.length + " unit(s) · " + siteReports.length + " report(s) · " + sitePms.length + " PMS · " + siteRecs.length + " rec(s) · " + siteSchedules.length + " schedule(s)</div>" +
      (latestReport ? "<div>Latest report: <b>" + esc(latestReport.title) + "</b> (" + esc(fmtDay(latestReport.report_date)) + ")</div>" : "") +
      (latestPms ? "<div>Latest PMS: <b>" + esc((latestPms.unit_type || "").toUpperCase()) + "</b> — " + latestPms.items_passed + "/" + latestPms.items_total + " passed (" + esc(fmtDay(latestPms.checklist_date)) + ")</div>" : "") +
      "</div>";

    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;"><div><h2 style="margin:0 0 4px;">' +
      esc(site.name) + '</h2><div class="muted">📍 ' + esc(loc) +
      '</div></div><button class="gray small-btn" type="button" onclick="openSiteOnMap(\'' + esc(site.id) + '\')">📍 Map</button></div>' +
      unitsHtml +
      '<div class="inline-actions"><button class="btn small-btn" type="button" onclick="openAddUnitForSite(\'' + esc(site.id) + '\')">＋ Add Unit</button>' +
      '<button class="gray small-btn" type="button" onclick="openUnitReport(\'' + esc(site.id) + ',\'\')">📄 New Report</button></div>' +
      connectedHtml + "</div>";
  }).filter(Boolean).join("");

  box.innerHTML = siteCards || '<p class="muted">No matching work sites or units in ' + esc(runtime.unitsRegion) + ".</p>";
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

function buildReportAttachmentHtml(details: string | null | undefined): string {
  return extractReportPhotoUrls(details).map(safeUrl).filter((u): u is string => !!u).map(u => {
    if (isImageUrl(u)) return '<img src="' + esc(u) + '" alt="Photo" data-preview-url="' + esc(u) + '" data-preview-label="Report Photo">';
    const fname = decodeURIComponent((u.split("/").pop() || "File").replace(/^\d+-\d+-[a-z0-9]+-/, ""));
    return '<a class="report-att-item" href="' + esc(u) + '" target="_blank" rel="noopener" style="text-decoration:none;"><span class="report-att-file">📎 ' + esc(fname) + "</span></a>";
  }).join("");
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

export function openPmsChecklist(selectedUnitId = ""): void {
  const site = state.sites.find(s => String(s.id) === String(runtime.pmsSiteId));
  $("pmsSitePicker")?.classList.add("hidden");
  $("pmsChecklistPanel")?.classList.remove("hidden");
  const ttl = $("pmsSelectedSite");
  if (ttl) ttl.textContent = site ? site.name : "Site";
  renderPmsChecklistUnits(selectedUnitId);
  setVal("pmsChecklistDate", new Date().toISOString().slice(0, 10));
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
    if (!uploadsOnly) {
      state.pmsRecords.forEach(r => {
        if (equip && r.unit_type !== equip) return;
        const sObj = state.sites.find(s => String(s.id) === String(r.site_id));
        if (region && (!sObj || sObj.region !== region)) return;
        if (site && String(r.site_id) !== site) return;
        if (from && r.checklist_date < from) return;
        if (to && r.checklist_date > to) return;
        let parsed: any = {};
        try { parsed = JSON.parse(r.details || "{}"); } catch {}
        const hay = ((sObj?.name || "") + " " + (r.unit_type || "") + " " + (parsed.unitName || "") + " " + (r.details || "")).toLowerCase();
        if (q && !hay.includes(q)) return;
        hits.push({
          kind: "PMS (" + r.unit_type + ")" + (parsed.unitName ? " · 🛗 " + parsed.unitName : ""),
          title: sObj ? sObj.name : "Site",
          date: fmtDay(r.checklist_date) + " · " + profileName(r.user_id),
          body: r.items_passed + "/" + r.items_total + " passed",
        });
      });
    }
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
  renderDtrCutoffOptions();
  renderDtrPreviewEmployeeOptions();
  const baseRows = isManager() ? state.dtrs : state.dtrs.filter(d => String(d.user_id) === String(state.userId));
  const activeKey = getActiveDtrCutoffKey();
  const { period, rows } = filterDtrRowsByCutoff(baseRows, activeKey);

  const summaryEl = $("dtrCutoffSummary");
  if (summaryEl) {
    const periodText = period ? period.label : "All Dates";
    summaryEl.textContent = `${periodText} · ${rows.length} ${rows.length === 1 ? "entry" : "entries"}`;
  }

  tbody.innerHTML = rows.map(d => {
    const hrs = calculateDtrHours(d.time_in, d.time_out, d.overtime_approved);
    const otMins = calculateOtMinutes(d.time_in, d.time_out);
    const canApprove = isManager() && otMins > 0 && !d.overtime_approved;
    const canDelete = String(d.user_id) === String(state.userId) || isManager();
    return "<tr><td>" + esc(fmtTableDate(d.work_date)) + "</td><td>" + esc(employeeDisplayName(d.user_id)) + "</td><td>" +
      esc([d.location, d.job].filter(Boolean).join(" · ")) + "</td><td><b>" + esc(d.time_in || "—") + "</b></td><td><b>" +
      esc(d.time_out || "—") + "</b></td><td>" + hrs.toFixed(2) + (otMins > 0 ? (d.overtime_approved ? " (OT✓)" : " (OT)") : "") + "</td><td>" +
      (canApprove ? '<button class="green small-btn" type="button" data-act="approve-ot" data-id="' + esc(d.id) + '">Approve OT</button> ' : "") +
      (canDelete ? '<button class="red small-btn" type="button" data-act="del-dtr" data-id="' + esc(d.id) + '">×</button>' : "") + "</td></tr>";
  }).join("") || '<tr><td colspan="7" class="muted">No DTR entries for this cutoff period.</td></tr>';
  if (!$("dtrPreview")?.classList.contains("hidden")) buildDtrPaper();
}

function isUserMentionedInSchedule(s: any, myName: string, myEmail: string): boolean {
  if (!s) return false;
  const notes = String(s.notes || "");
  const title = String(s.title || "");
  const assignMatch = notes.match(/^\[ASSIGNED:\s*([^\]]+)\]/i);
  if (myName && assignMatch) {
    const assigned = assignMatch[1].split(",").map((n: string) => n.trim().toLowerCase());
    if (assigned.includes(myName)) return true;
  }
  const combined = `${title} ${notes}`;
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
    return n && (titleLower === n || titleLower.startsWith(n + " —") || titleLower.startsWith(n + " -") || titleLower.includes(n));
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

  const cleanNotes = String(best.notes || "")
    .replace(/^\[ASSIGNED:\s*[^\]]+\]\s*/i, "")
    .trim();
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
  if (normalized === "fill") autoFillDtrFromSchedule(false);
  if (normalized === "preview") buildDtrPaper();
  if (normalized === "time_log") {
    renderTimeLogSitePickers();
    autoFillDtrFromSchedule(false);
    renderTimeLog();
  }
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
  const otEl = $("dtrOvertimeApproved") as HTMLInputElement | null;
  const unitName = val("dtrUnit").trim();
  const jobRaw = val("dtrJob").trim();
  const jobFull = [unitName ? `[Unit: ${unitName}]` : "", jobRaw].filter(Boolean).join(" ");
  try {
    await insertDtrEntrySafe({
      user_id: state.userId,
      work_date: date,
      location: val("dtrLocation").trim() || null,
      job: jobFull || null,
      time_in: val("dtrIn") || null,
      time_out: val("dtrOut") || null,
      overtime_approved: otEl ? otEl.checked : false,
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
  suppressNotifications();
  await loadDtrs();
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
  const otEl = $("dtrOvertimeApproved") as HTMLInputElement | null;
  if (otEl) otEl.checked = false;
}

export function setTimeLogMode(mode: "time_in" | "time_out"): void {
  runtime.timeLogMode = mode === "time_out" ? "time_out" : "time_in";
  document.querySelectorAll<HTMLElement>("#timeLogModeToggle [data-time-mode]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.timeMode === runtime.timeLogMode)
  );
  const badge = $("timeLogModeBadge");
  if (badge) {
    badge.textContent = runtime.timeLogMode === "time_in" ? "🟢 Time In Selected" : "🔴 Time Out Selected";
  }
}

export function renderTimeLog(): void {
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
  summary: string
): Promise<{ dtrEntryId: string | null; savedTimeIn: string; savedTimeOut: string }> {
  if (!state.userId) throw new Error("Sign in required before saving DTR.");
  const schedWork = findScheduledWorkForUser(workDate);
  const scheduledJob = schedWork?.jobDescription || "";
  const jobLabel = [
    unit ? `[Unit: ${unit}]` : "",
    scheduledJob || (mode === "time_in" ? "Photo Time In" : "Photo Time Out"),
    summary ? `(${summary.slice(0, 70)})` : "",
  ].filter(Boolean).join(" ");
  const myRowsForDate = (state.dtrs || []).filter(
    d => String(d.user_id) === String(state.userId) && String(d.work_date) === String(workDate)
  );

  let dtrEntryId: string | null = null;
  let savedTimeIn = mode === "time_in" ? time24 : "";
  let savedTimeOut = mode === "time_out" ? time24 : "";

  if (mode === "time_in") {
    const existingNoIn = myRowsForDate.find(d => !d.time_in);
    if (existingNoIn) {
      const { error } = await runtime.client
        .from("dtr_entries")
        .update({
          time_in: time24,
          ...(location && !existingNoIn.location ? { location } : {}),
          ...(jobLabel && !existingNoIn.job ? { job: jobLabel } : {}),
        })
        .eq("id", existingNoIn.id);
      if (error) throw error;
      dtrEntryId = String(existingNoIn.id);
      savedTimeOut = existingNoIn.time_out || "";
    } else {
      dtrEntryId = await insertDtrEntrySafe({
        user_id: state.userId,
        work_date: workDate,
        location: location || null,
        job: jobLabel || null,
        time_in: time24,
        time_out: null,
        overtime_approved: false,
      });
    }
  } else {
    const targetRow =
      myRowsForDate.find(d => d.time_in && (!d.time_out || d.time_out === d.time_in)) ||
      myRowsForDate.find(d => !d.time_out) ||
      myRowsForDate[0];
    if (targetRow) {
      const { error } = await runtime.client
        .from("dtr_entries")
        .update({
          time_out: time24,
          ...(location && !targetRow.location ? { location } : {}),
        })
        .eq("id", targetRow.id);
      if (error) throw error;
      dtrEntryId = String(targetRow.id);
      savedTimeIn = targetRow.time_in || "";
    } else {
      dtrEntryId = await insertDtrEntrySafe({
        user_id: state.userId,
        work_date: workDate,
        location: location || null,
        job: jobLabel || null,
        time_in: null,
        time_out: time24,
        overtime_approved: false,
      });
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
  buildDtrPaper();

  return { dtrEntryId, savedTimeIn, savedTimeOut };
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

    const uploadFile = await prepareImageFile(file, 1400, 0.84);
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
      suppressNotifications();
      await loadAppNotifications();
      await loadTimeLogs();
      if (statusEl) statusEl.textContent = "Uploaded to feed, but no clear timestamp was detected in the photo.";
      toast("No timestamp detected on photo");
      return;
    }

    const slotResult = await writeAnalyzedTimeToDtr(mode, workDate, time24, detectedLoc, selectedUnit, summary);
    const slotText = `Time In: ${slotResult.savedTimeIn || "—"} | Time Out: ${slotResult.savedTimeOut || "—"}`;
    const aiReadingMsg = `Done reading! AI verified ${modeLabel}: ${time12 || time24} (${fmtDay(workDate)}) and already filled the ${modeLabel} slot in DTR (${slotText}).${summary ? " " + summary : ""}`;

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
      `AI Reading: ${time12 || time24} (${fmtDay(workDate)}) · Site: ${detectedLoc}${selectedUnit ? " (" + selectedUnit + ")" : ""} · Filled ${modeLabel} slot.`
    );

    suppressNotifications();
    await loadAppNotifications();
    await loadTimeLogs();
    if (statusEl) {
      statusEl.textContent = `✅ Done reading! Already filled ${modeLabel} slot (${time12 || time24}) for ${senderName} · ${slotText}`;
    }
    toast(`✅ Done reading! ${modeLabel} (${time12 || time24}) filled into DTR`);
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
function buildDtrPaper(): void {
  renderDtrCutoffOptions();
  const pickedUid = isManager() && val("dtrPreviewEmployee") ? val("dtrPreviewEmployee") : String(state.userId || "");
  const employeeRows = state.dtrs.filter(d => String(d.user_id) === String(pickedUid));
  const { period, rows } = filterDtrRowsByCutoff(employeeRows, getActiveDtrCutoffKey());
  const isOwn = String(pickedUid) === String(state.userId);
  const sig = isOwn
    ? (signaturePhotoDataUrl ? '<img src="' + esc(signaturePhotoDataUrl) + '" alt="">' : (drawnSigDataUrl ? '<img src="' + esc(drawnSigDataUrl) + '" alt="">' : ""))
    : "";
  const body = rows.map(d =>
    "<tr><td>" + esc(fmtTableDate(d.work_date)) + "</td><td>" + esc(d.location || "") + "</td><td>" + esc(d.job || "") +
    "</td><td>" + esc(d.time_in || "—") + "</td><td>" + esc(d.time_out || "—") + "</td><td>" +
    calculateDtrHours(d.time_in, d.time_out, d.overtime_approved).toFixed(2) + "</td></tr>"
  ).join("") || '<tr><td colspan="6" class="dp-empty">No entries for this cutoff period.</td></tr>';
  const periodLine = period ? `<div style="font-size:12px;font-weight:600;margin-top:2px;">Cutoff: ${esc(period.label)}</div>` : "";
  const paper = $("dtrPaper");
  if (paper) {
    paper.innerHTML =
      '<table class="dp-table"><tr><td colspan="6" class="dp-sheet-title">EESI ELEVATORS INC.<br>DAILY TIME RECORD' + periodLine + '</td></tr>' +
      '<tr class="dp-col-head"><th>Date</th><th>Location</th><th>Work description</th><th>Time In</th><th>Time Out</th><th>Hours</th></tr>' +
      body + '</table><div class="dp-employee-sign">' + sig + '<div class="dp-employee-name">' + esc(employeeDisplayName(pickedUid)) +
      '</div><div class="dp-employee-caption">Employee signature</div></div>';
  }
}
export async function downloadDtr(): Promise<void> {
  const paper = $("dtrPaper");
  if (!paper) return;
  if (!window.html2canvas) { toast("Image export library is still loading. Try again in a moment."); return; }
  try {
    const canvas = await window.html2canvas(paper, { backgroundColor: "#fff", scale: 2 });
    canvas.toBlob(async (blob: Blob | null) => {
      if (!blob) return;
      const file = new File([blob], "DTR-" + new Date().toISOString().slice(0, 10) + ".jpg", { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Daily Time Record" }); return; } catch {}
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/jpeg", 0.92);
  } catch (err: any) { toast(err?.message || "Could not export."); }
}
export function printDtr(): void { window.print(); }

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
  if (!el) return;
  const start = val("leaveStart");
  const end = val("leaveEnd");
  const typeEl = $("leaveType") as HTMLSelectElement | null;
  const typeLabel = typeEl ? typeEl.options[typeEl.selectedIndex].text : "leave";
  if (!start || !end) { el.textContent = ""; return; }
  const days = leaveDaysCount(start, end);
  el.textContent = days ? "Total: " + days + " day(s) will count toward " + typeLabel + "." : "End date must be on or after start date.";
}
export async function submitLeaveRequest(): Promise<void> {
  const start = val("leaveStart");
  const end = val("leaveEnd");
  if (!start || !end) { toast("Choose both dates"); return; }
  const days = leaveDaysCount(start, end);
  if (!days) { toast("End date must be after start"); return; }
  const { error } = await runtime.client.from("leave_requests").insert({
    user_id: state.userId, leave_type: val("leaveType"), start_date: start, end_date: end,
    calendar_days: days, workdays: days, reason: val("leaveReason").trim() || null, status: "pending",
  });
  const st = $("leaveFormStatus");
  if (error) { if (st) st.textContent = "Failed: " + error.message; return; }
  setVal("leaveReason", "");
  if (st) st.textContent = "Request submitted (" + days + " day(s)).";
  updateLeaveDaysPreview();
  $("leaveFormCard")?.classList.add("hidden");
  suppressNotifications();
  await loadLeaveRequests();
  renderLeaveBalances();
  toast("Leave request submitted");
}
export function renderLeave(): void {
  const mine = state.leaveRequests.filter(r => String(r.user_id) === String(state.userId));
  const myBox = $("myLeaveRequests");
  if (myBox) {
    myBox.innerHTML = mine.map(r => {
      const days = r.calendar_days || leaveDaysCount(r.start_date, r.end_date) || r.workdays || 0;
      return '<div class="item"><b>' + esc(r.leave_type) + '</b> <span class="badge">' + esc(r.status) + '</span><div class="muted">' +
        esc(fmtDay(r.start_date)) + " – " + esc(fmtDay(r.end_date)) + " · " + days + " day(s)</div>" +
        (r.reason ? "<div>" + esc(r.reason) + "</div>" : "") + "</div>";
    }).join("") || '<p class="muted">No requests yet.</p>';
  }
  const revBox = $("leaveReviewList");
  if (revBox) {
    const pending = state.leaveRequests.filter(r => r.status === "pending" && String(r.user_id) !== String(state.userId));
    revBox.innerHTML = pending.map(r => {
      const days = r.calendar_days || leaveDaysCount(r.start_date, r.end_date) || r.workdays || 0;
      return '<div class="item"><b>' + esc(profileName(r.user_id)) + "</b> — " + esc(r.leave_type) + '<div class="muted">' +
        esc(fmtDay(r.start_date)) + " – " + esc(fmtDay(r.end_date)) + " · " + days + " day(s)</div>" +
        (r.reason ? "<div>" + esc(r.reason) + "</div>" : "") +
        '<div class="inline-actions"><button class="green small-btn" type="button" data-act="leave-approve" data-id="' + esc(r.id) + '">Approve</button>' +
        '<button class="red small-btn" type="button" data-act="leave-reject" data-id="' + esc(r.id) + '">Reject</button></div></div>';
    }).join("") || '<p class="muted">Nothing to review.</p>';
  }
  renderLeaveBalances();
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
      runtime.unitsRegion = btn.dataset.unitsRegion || "Luzon";
      document.querySelectorAll<HTMLElement>("[data-units-region]").forEach(b => b.classList.toggle("active", b === btn));
      renderUnits();
      saveLastView();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-units-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchUnitsTab((btn.dataset.unitsTab as "list" | "manual") || "list");
    });
  });

  $("unitsSearch")?.addEventListener("input", renderUnits);
  $("unitsSort")?.addEventListener("change", renderUnits);

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
  $("dtrDate")?.addEventListener("change", () => autoFillDtrFromSchedule(false));
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
    const card = $("unitFormCard");
    if (!card) return;
    const opening = card.classList.contains("hidden");
    if (opening) {
      runtime.editingUnitId = null;
      const ttl = $("unitFormTitle");
      if (ttl) ttl.textContent = "Add unit";
      renderUnitSiteOptions();
      const firstInRegion = state.sites.find(s => s.region === runtime.unitsRegion);
      if (firstInRegion) setVal("unitSite", String(firstInRegion.id));
    }
    card.classList.toggle("hidden");
    if (opening) card.scrollIntoView({ behavior: "smooth" });
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
    const card = $("leaveFormCard");
    if (!card) return;
    const opening = card.classList.contains("hidden");
    card.classList.toggle("hidden");
    if (opening) card.scrollIntoView({ behavior: "smooth" });
  });
  $("cancelLeaveFormBtn")?.addEventListener("click", () => {
    $("leaveFormCard")?.classList.add("hidden");
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
  $("savePmsRecordButton")?.addEventListener("click", async () => {
    if (!runtime.pmsSiteId) { toast("Pick a site first"); return; }
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
        items: itemsSummary,
      }),
    });
    const st = $("pmsRecordStatus");
    if (error) { if (st) st.textContent = "Failed: " + error.message; return; }
    if (st) st.textContent = "Saved (" + passed + "/" + all.length + " passed).";
    suppressNotifications();
    await loadPmsRecords();
    toast("PMS record saved");
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

  $("cancelAddSite")?.addEventListener("click", () => $("addSiteOverlay")?.classList.add("hidden"));
  $("openAddSite")?.addEventListener("click", () => $("addSiteOverlay")?.classList.remove("hidden"));
  $("toggleScheduleFormBtn")?.addEventListener("click", () => {
    const form = $("scheduleFormCard");
    if (form) {
      const opening = form.classList.contains("hidden");
      if (opening) { renderScheduleSiteOptions(); renderAssigneesPicker(); }
      form.classList.toggle("hidden");
      if (opening) form.scrollIntoView({ behavior: "smooth" });
    }
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
      if (appId) await runtime.client.from("app_notifications").update({ is_read: true }).eq("id", appId);
      if (apprId) await runtime.client.from("approval_notifications").update({ is_read: true }).eq("id", apprId);
      markNoticeRead(key);
      if (appId) await loadAppNotifications();
      if (apprId) await loadApprovalNotifications();
      toast("Marked as read");
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
      const det = $("pmsRecordDetails");
      if (det) {
        det.innerHTML = "<h2>" + esc(site ? site.name : "Site") + '</h2><div class="muted">' + esc((rec.unit_type || "").toUpperCase()) +
          " · " + esc(fmtDay(rec.checklist_date)) + " · " + esc(profileName(rec.user_id)) + "</div><p><b>Result:</b> " +
          rec.items_passed + "/" + rec.items_total + " passed</p>" +
          '<div class="inline-actions" style="margin:0 0 12px;">' +
          '<button class="gray small-btn" type="button" onclick="exportPmsRecords(\'xls\',\'' + esc(rec.id) + '\')">📊 Export XLS</button>' +
          '<button class="gray small-btn" type="button" onclick="exportPmsRecords(\'doc\',\'' + esc(rec.id) + '\')">📝 Export DOC</button>' +
          "</div>" + itemsHtml;
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
      case "del-sched": {
        if (!(await confirmDialog("Delete this schedule?", "Delete schedule"))) return;
        const { error } = await runtime.client.from("schedules").delete().eq("id", id);
        if (error) { toast("Delete failed: " + error.message); return; }
        suppressNotifications();
        await loadSchedules();
        toast("Deleted");
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

  setInterval(() => {
    if (state.userId) {
      if (state.schedules && state.schedules.length) {
        renderSchedules();
        checkUpcomingShiftReminders();
      }
      renderHomeDtrStatus();
    }
  }, 30000);
}
