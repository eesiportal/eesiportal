import * as XLSX from "xlsx";
import {
  $,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  calculateDtrHours,
  checkNetwork,
  closeSheet,
  extractReportPhotoUrls,
  filterDtrRowsByCutoff,
  fmtDate,
  fmtDay,
  fmtTableDate,
  hooks,
  parseRecMeta,
  parseReportUnit,
  profileName,
  profileOf,
  roleLabel,
  runtime,
  setVal,
  sortDtrEntriesAscending,
  state,
  stripReportPhotos,
  toast,
  val,
} from "./eesiTypes";
import {
  applyDisplaySettings,
  applyTheme,
  applyWatermark,
  checkAppLock,
  clearWatermark,
  closeIosInstallModal,
  closePinSetup,
  disableBiometricLock,
  enableBiometricLock,
  enablePush,
  initPwaInstall,
  initSettingsWiring,
  openPinSetup,
  playSettingSound,
  renderDecor,
  requestNotificationPermission,
  resetDisplaySettings,
  setWatermarkOpacity,
  showDailyVerse,
  startClock,
  stopSettingSound,
  submitPinSetup,
  syncPushSession,
  toggleSettingsMenu,
  toggleTheme,
  triggerPwaInstall,
  unlockWithBiometrics,
  updateLiveWeather,
} from "./eesiSettings";
import {
  centerSiteMapOnSelected,
  checkConnectionNow,
  fitLiveMapAll,
  fitSiteMapRoute,
  focusLiveEmployee,
  initDataListeners,
  initSitesMapOverview,
  loadAnnouncements,
  loadAppNotifications,
  loadApprovalNotifications,
  loadBlockedUsers,
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
  loadStories,
  loadThreads,
  loadTimeLogs,
  loadUnits,
  loadUnread,
  markNoticeRead,
  reloadEverything,
  resetDataLoadFlags,
  restoreLastView,
  saveLastView,
  setBasemap,
  setLiveMapFilter,
  setSiteMapTravelMode,
  startEmployeeLocationSharing,
  startLive,
  teardownLive,
} from "./eesiData";
import {
  exportCurrentChecklist,
  exportDtrHistoryPdf,
  exportPmsRecords,
  exportRecommendations,
  exportReports,
  getFilteredPmsRecords,
} from "./eesiExport";
import {
  addMemberToGroup,
  cancelReply,
  clearTyping,
  closeChat,
  closeChatInfo,
  closeCompose,
  closeDeleteMessageModal,
  closeStoryComposer,
  closeStoryViewer,
  confirmDeleteForEveryone,
  confirmDeleteForYou,
  createGroup,
  deleteStory,
  endCall,
  hideGroupForm,
  hideIncoming,
  initChatWiring,
  isMuted,
  markThreadRead,
  openActiveChatProfile,
  openActiveStatusSheet,
  openChatInfo,
  openCompose,
  openCustomizeSheet,
  openDirect,
  openMembersSheet,
  openNicknamesSheet,
  openPinnedSheet,
  openProfileView,
  openSearchInChatSheet,
  openStoryComposer,
  openStoryViewer,
  openThread,
  pickEmoji,
  postStory,
  removeMyReaction,
  renderChatList,
  renderMessages,
  saveCustomize,
  saveGroupNicknames,
  saveNickname,
  setChatFilter,
  showGroupForm,
  startCallListener,
  stepStoryViewer,
  stopCallListener,
  threadTitle,
  toggleChatPlus,
  toggleEmoji,
  updateSendBtn,
} from "./eesiChat";
import {
  addDtr,
  addSite,
  autoFillDtrFromSchedule,
  cancelEditAnnouncement,
  cancelUnitForm,
  captureTimemarkPhoto,
  changePassword,
  checkUpcomingShiftReminders,
  clearDtrForm,
  clearPendingPmsFiles,
  clearPendingReportFiles,
  clearSignature,
  clearSignaturePhoto,
  closeChangePasswordModal,
  closeEditDtr,
  closeLeaveSheetPreview,
  closeTimemarkCamera,
  closeUnitManualOverlay,
  deleteTimeLog,
  deleteUnit,
  downloadDtr,
  downloadLeaveSheet,
  dtrTab,
  editUnit,
  ensureAmcbUnitsSeeded,
  flipTimemarkCamera,
  go,
  initFeatureWiring,
  loadSavedDrawnSignature,
  loadSavedSignaturePhoto,
  openAddUnitForSite,
  openEditDtr,
  openLeaveSheetPreview,
  openPmsChecklist,
  openQuickTimeAction,
  openSiteOnMap,
  openTimemarkCamera,
  openUnitManual,
  openUnitPms,
  openUnitReport,
  postAnnouncement,
  printDtr,
  printLeaveSheet,
  refreshLeaveBalances,
  removePhoto,
  renderAdmin,
  renderAll,
  renderAnnouncements,
  renderAssigneesPicker,
  renderConnectedPickers,
  renderDtr,
  renderDtrSiteOptions,
  renderDtrUnitOptions,
  renderHome,
  renderLeave,
  renderLeaveBalances,
  renderMembers,
  renderNotes,
  renderNotices,
  renderOnline,
  renderPending,
  renderPmsAttachmentPreview,
  renderPmsChecklist,
  renderPmsRecords,
  renderPmsRecordsFilters,
  renderPmsSiteOptions,
  renderRecPickers,
  renderRecs,
  renderReportAttachmentPreview,
  renderReportSites,
  renderReportUnits,
  renderReports,
  renderScheduleSiteOptions,
  renderScheduleUnitOptions,
  renderSchedules,
  renderSearchSiteOptions,
  renderSites,
  renderTimeLog,
  renderUnitSiteOptions,
  renderUnits,
  resetSignatureState,
  runSearch,
  saveAdminEdit,
  saveEditedDtr,
  saveNote,
  saveProfile,
  saveRec,
  saveSchedule,
  saveUnit,
  saveUnitManual,
  sendTimeLogNote,
  setTimeLogMode,
  submitChangePassword,
  submitLeaveRequest,
  switchNoteTab,
  switchUnitsTab,
  toggleUnitSiteCard,
  triggerUnitManualUpload,
  updateAccess,
  updateAnnouncementTicker,
  visibleSchedules,
} from "./eesiFeatures";
import { openStartupThread } from "./eesiSettings";

export type ExportKind = "reports" | "pms" | "dtr" | "recommendations";

export function exportData(
  kind: ExportKind,
  options: { format?: "xlsx" | "doc" | "pdf"; id?: string } = {}
): void {
  const format = options.format || "xlsx";
  if (format === "pdf") {
    if (kind === "dtr") { void exportDtrHistoryPdf(); return; }
  }
  if (format === "doc") {
    if (kind === "reports") { exportReports("doc", options.id); return; }
    if (kind === "pms") { exportPmsRecords("doc", options.id); return; }
    if (kind === "recommendations") { exportRecommendations("doc"); return; }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  let sheetTitle = "EESI Export";
  let sheetName = "Records";
  let fileName = `eesi-${kind}-${stamp}.xlsx`;
  let headers: string[] = [];
  let rows: Array<Array<string | number>> = [];
  let colWidths: number[] = [];

  if (kind === "reports") {
    const type = state.reportType === "delivery" ? "delivery" : "service";
    const list = options.id
      ? state.reports.filter(r => String(r.id) === String(options.id))
      : state.reports.filter(r => r.report_type === type);
    if (!list.length) {
      toast("No reports available to export.");
      return;
    }
    sheetTitle = options.id
      ? `EESI ELEVATORS INC. — ${list[0].report_type === "delivery" ? "DELIVERY" : "SERVICE"} REPORT`
      : `EESI ELEVATORS INC. — ${type === "delivery" ? "DELIVERY" : "SERVICE"} REPORTS`;
    sheetName = type === "delivery" ? "Delivery Reports" : "Service Reports";
    fileName = options.id
      ? `eesi-${list[0].report_type}-report-${stamp}.xlsx`
      : `eesi-${type}-reports-${stamp}.xlsx`;
    headers = ["Date", "Type", "Work Site", "Location / Region", "Unit", "Title", "Details", "Submitted By", "Attachments"];
    colWidths = [14, 12, 26, 22, 22, 28, 48, 22, 16];
    rows = list.map(r => {
      const site = state.sites.find(s => String(s.id) === String(r.site_id));
      const parsedUnit = parseReportUnit(r.details);
      const attCount = extractReportPhotoUrls(r.details).length;
      return [
        r.report_date ? fmtDay(r.report_date) : "",
        r.report_type === "delivery" ? "Delivery" : "Service",
        site ? site.name : "Unknown site",
        site ? [site.city, site.region].filter(Boolean).join(", ") : "",
        parsedUnit.unitName || "General / All Units",
        r.title || "",
        stripReportPhotos(r.details) || "",
        profileName(r.created_by),
        attCount ? `${attCount} file(s)` : "None",
      ];
    });
  } else if (kind === "pms") {
    if (options.id) {
      const rec = state.pmsRecords.find(r => String(r.id) === String(options.id));
      if (!rec) { toast("PMS record not found."); return; }
      const site = state.sites.find(s => String(s.id) === String(rec.site_id));
      let parsed: any = {};
      try { parsed = JSON.parse(rec.details || "{}"); } catch {}
      const items: Array<{ label: string; passed: boolean }> = Array.isArray(parsed.items) ? parsed.items : [];
      sheetTitle = `EESI ELEVATORS INC. — PMS CHECKLIST (${(rec.unit_type || "").toUpperCase()})`;
      sheetName = "PMS Checklist";
      fileName = `eesi-pms-${rec.checklist_date || stamp}.xlsx`;
      headers = ["#", "Work Site", "Unit", "Unit Type", "Date", "Inspector", "Inspection Item", "Status"];
      colWidths = [6, 24, 20, 14, 14, 22, 52, 16];
      rows = items.map((it, idx) => [
        idx + 1,
        site ? site.name : "Site",
        parsed.unitName || "Site-wide",
        (rec.unit_type || "").toUpperCase(),
        fmtDay(rec.checklist_date),
        profileName(rec.user_id),
        it.label || "",
        it.passed ? "PASS" : "FAIL / N/A",
      ]);
    } else {
      const list = getFilteredPmsRecords();
      if (!list.length) { toast("No PMS records to export."); return; }
      sheetTitle = "EESI ELEVATORS INC. — PMS RECORDS SUMMARY";
      sheetName = "PMS Records";
      fileName = `eesi-pms-records-${stamp}.xlsx`;
      headers = ["Date", "Region", "Work Site", "Unit", "Unit Type", "Inspector", "Team", "Score", "Failed Items"];
      colWidths = [14, 12, 26, 20, 14, 22, 16, 12, 42];
      rows = list.map(r => {
        const site = state.sites.find(s => String(s.id) === String(r.site_id));
        const p = profileOf(r.user_id);
        let parsed: any = {};
        try { parsed = JSON.parse(r.details || "{}"); } catch {}
        const failed = Array.isArray(parsed.items)
          ? parsed.items.filter((i: any) => !i.passed).map((i: any) => i.label).join("; ")
          : "";
        return [
          fmtDay(r.checklist_date),
          site?.region || parsed.region || "—",
          site ? site.name : "Unknown site",
          parsed.unitName || "General",
          (r.unit_type || "").toUpperCase(),
          profileName(r.user_id),
          p?.team || "—",
          `${r.items_passed}/${r.items_total}`,
          failed || "All passed",
        ];
      });
    }
  } else if (kind === "dtr") {
    const rawList = (state.role === "admin" || state.role === "representative")
      ? state.dtrs
      : state.dtrs.filter(d => String(d.user_id) === String(state.userId));
    const cutoffResult = filterDtrRowsByCutoff(rawList, runtime.dtrCutoffKey || undefined);
    const list = cutoffResult.rows.length ? cutoffResult.rows : sortDtrEntriesAscending(rawList);
    if (!list.length) { toast("No DTR logs to export."); return; }
    sheetTitle = "EESI ELEVATORS INC. — DAILY TIME RECORD (DTR) LOGS";
    sheetName = "DTR Logs";
    fileName = `eesi-dtr-logs-${stamp}.xlsx`;
    headers = ["Date", "Employee", "Team / Area", "Location / Site", "Work Description / Unit", "Time In", "Time Out", "Total Hours", "OT Approved"];
    colWidths = [14, 24, 20, 26, 36, 12, 12, 14, 14];
    rows = list.map(d => {
      const p = profileOf(d.user_id);
      const hrs = calculateDtrHours(d.time_in, d.time_out, d.overtime_approved);
      return [
        fmtTableDate(d.work_date),
        profileName(d.user_id),
        [p?.team, p?.area].filter(Boolean).join(" / ") || "—",
        d.location || "—",
        d.job || "—",
        d.time_in || "—",
        d.time_out || "—",
        Number(hrs.toFixed(2)),
        d.overtime_approved ? "Approved" : "No",
      ];
    });
  } else if (kind === "recommendations") {
    const list = state.recs || [];
    if (!list.length) { toast("No recommendations to export."); return; }
    sheetTitle = "EESI ELEVATORS INC. — PARTS & MAINTENANCE RECOMMENDATIONS";
    sheetName = "Recommendations";
    fileName = `eesi-recommendations-${stamp}.xlsx`;
    headers = ["Date", "Site", "Unit / Specific Location", "Part", "Condition", "Reason / Findings", "Assigned / Mentioned", "Submitted By", "Comments"];
    colWidths = [18, 22, 24, 22, 18, 40, 24, 20, 36];
    rows = list.map(r => {
      const meta = parseRecMeta(r.reason);
      const comments = (r.recommendation_comments || [])
        .map((c: any) => `${profileName(c.user_id)}: ${c.comment}`)
        .join(" | ");
      return [
        fmtDate(r.created_at),
        r.site || "—",
        [meta.siteUnit, r.specific_location || r.location].filter(Boolean).join(" · ") || "—",
        r.part || "—",
        r.condition || "—",
        meta.cleanReason || "—",
        meta.assignedNames.join(", ") || "—",
        profileName(r.user_id),
        comments || "None",
      ];
    });
  }

  const colCount = headers.length;
  const aoa: Array<Array<string | number>> = [
    [sheetTitle],
    [`Exported: ${new Date().toLocaleString()} · Prepared by: ${state.profile?.full_name || state.email || "EESI Member"} · Total Rows: ${rows.length}`],
    [],
    headers,
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, colCount - 1) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, colCount - 1) } },
  ];
  ws["!cols"] = colWidths.map((wch, idx) => {
    const maxLen = Math.max(
      wch,
      String(headers[idx] || "").length + 4,
      ...rows.slice(0, 60).map(r => Math.min(54, String(r[idx] ?? "").split("\n")[0].length + 3))
    );
    return { wch: Math.min(58, maxLen) };
  });
  ws["!rows"] = [
    { hpt: 24 },
    { hpt: 18 },
    { hpt: 10 },
    { hpt: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName);
  toast("Exported " + fileName);
}

function registerHooks(): void {
  Object.assign(hooks, {
    go,
    renderAll,
    renderHome,
    renderMembers,
    renderOnline,
    renderPending,
    renderAdmin,
    renderAnnouncements,
    renderSchedules,
    renderAssigneesPicker,
    renderSites,
    renderUnits,
    renderUnitSiteOptions,
    renderDtr,
    renderDtrSiteOptions,
    renderConnectedPickers,
    renderTimeLog,
    loadTimeLogs,
    applyWatermark,
    switchUnitsTab,
    renderNotes,
    renderRecs,
    renderNotices,
    renderReports,
    renderReportSites,
    renderSearchSiteOptions,
    renderPmsSiteOptions,
    renderPmsChecklist,
    renderPmsRecordsFilters,
    renderPmsRecords,
    renderLeave,
    renderLeaveBalances,
    renderChatList,
    renderMessages,
    openThread,
    closeChat,
    cancelReply,
    updateSendBtn,
    isMuted,
    threadTitle,
    startCallListener,
    stopCallListener,
    endActiveCall: () => endCall(null, false),
    hideIncoming,
    clearTyping,
    updateAccess,
    updateAnnouncementTicker,
    signOut,
    showAuth,
    startLive,
    reloadEverything,
    runSearch,
    dtrTab,
    switchNoteTab,
    openPmsChecklist,
    saveLastView,
    visibleSchedules,
    loadThreads,
    loadStories,
    ensureAmcbUnitsSeeded,
    openEditDtr,
    openTimemarkCamera,
    markThreadRead,
    checkShiftReminders: checkUpcomingShiftReminders,
    autoFillDtrFromSchedule: () => autoFillDtrFromSchedule(false),
  });
}

function exposeWindowGlobals(): void {
  Object.assign(window, {
    toggleSettingsMenu,
    toggleTheme,
    resetDisplaySettings,
    applyWatermark,
    setWatermarkOpacity,
    clearWatermark,
    openPinSetup,
    closePinSetup,
    submitPinSetup,
    previewNotificationSound: () => playSettingSound(false),
    changePassword,
    closeChangePasswordModal,
    submitChangePassword,
    signOut,
    go,
    postAnnouncement,
    cancelEditAnnouncement,
    renderAssigneesPicker,
    renderScheduleSiteOptions,
    renderScheduleUnitOptions,
    saveSchedule,
    saveUnit,
    cancelUnitForm,
    openAddUnitForSite,
    editUnit,
    deleteUnit,
    ensureAmcbUnitsSeeded,
    toggleUnitSiteCard,
    closeUnitManualOverlay,
    switchUnitsTab,
    openUnitManual,
    saveUnitManual,
    triggerUnitManualUpload,
    openUnitReport,
    openUnitPms,
    openSiteOnMap,
    setSiteMapTravelMode,
    centerSiteMapOnSelected,
    fitSiteMapRoute,
    initSitesMapOverview,
    dtrTab,
    addDtr,
    clearDtrForm,
    openEditDtr,
    closeEditDtr,
    saveEditedDtr,
    openTimemarkCamera,
    closeTimemarkCamera,
    flipTimemarkCamera,
    captureTimemarkPhoto,
    renderDtrUnitOptions,
    autoFillDtrFromSchedule,
    setTimeLogMode,
    renderTimeLog,
    sendTimeLogNote,
    deleteTimeLog,
    openQuickTimeAction,
    clearSignature,
    clearSignaturePhoto,
    downloadDtr,
    printDtr,
    switchNoteTab,
    saveNote,
    saveRec,
    renderRecPickers,
    renderReportUnits,
    removePhoto,
    saveProfile,
    refreshLeaveBalances,
    submitLeaveRequest,
    openLeaveSheetPreview,
    closeLeaveSheetPreview,
    downloadLeaveSheet,
    printLeaveSheet,
    addSite,
    openCompose,
    closeCompose,
    setChatFilter,
    showGroupForm,
    hideGroupForm,
    createGroup,
    closeChat,
    openActiveChatProfile,
    openChatInfo,
    closeChatInfo,
    cancelReply,
    pickEmoji,
    toggleChatPlus,
    toggleEmoji,
    openThread,
    openDirect,
    openDM: openDirect,
    closeSheet,
    openCustomizeSheet,
    saveCustomize,
    openMembersSheet,
    openSearchInChatSheet,
    openPinnedSheet,
    openProfileView,
    openActiveStatusSheet,
    openNicknamesSheet,
    saveNickname,
    saveGroupNicknames,
    addMemberToGroup,
    removeMyReaction,
    closeDeleteMessageModal,
    confirmDeleteForEveryone,
    confirmDeleteForYou,
    openStoryComposer,
    closeStoryComposer,
    postStory,
    openStoryViewer,
    closeStoryViewer,
    stepStoryViewer,
    deleteStory,
    setBasemap,
    setLiveMapFilter,
    fitLiveMapAll,
    loadLiveMap,
    focusLiveEmployee,
    saveAdminEdit,
    markNoticeRead,
    renderDecor,
    startEmployeeLocationSharing,
    enableBiometricLock,
    disableBiometricLock,
    unlockWithBiometrics,
    triggerPwaInstall,
    closeIosInstallModal,
    checkConnectionNow,
    exportData,
    exportDtrHistoryPdf,
    exportReports,
    exportCurrentChecklist,
    exportPmsRecords,
    exportRecommendations,
  });
}

/* ==================== AUTH UI ==================== */
function setAuthStatus(msg: string): void {
  const el = $("authStatus");
  if (el) el.textContent = msg;
}
function showAuth(message?: string): void {
  teardownLive();
  $("pinLockOverlay")?.classList.add("hidden");
  $("authScreen")?.classList.remove("hidden");
  $("app")?.classList.add("hidden");
  setAuthStatus(message || "Sign in to continue.");
}
function showApp(): void {
  $("authScreen")?.classList.add("hidden");
  $("app")?.classList.remove("hidden");
}
function showLoginForm(): void {
  $("loginForm")?.classList.remove("hidden");
  $("registerForm")?.classList.add("hidden");
  $("resetForm")?.classList.add("hidden");
  $("loginOptions")?.classList.remove("hidden");
}
function showResetForm(): void {
  $("loginForm")?.classList.add("hidden");
  $("loginOptions")?.classList.add("hidden");
  $("registerForm")?.classList.add("hidden");
  $("resetForm")?.classList.remove("hidden");
}

/* ==================== BOOT / SESSION ==================== */
async function ensureProfile(session: any) {
  const { data, error } = await runtime.client
    .from("profiles")
    .select("user_id,full_name,email,id_no,address,team,phone,area,avatar_url,cover_url")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const fullName =
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    (session.user.email || "Member").split("@")[0];
  const { data: created, error: insertError } = await runtime.client
    .from("profiles")
    .upsert({ user_id: session.user.id, full_name: fullName, email: session.user.email }, { onConflict: "user_id" })
    .select("user_id,full_name,email,id_no,address,team,phone,area,avatar_url,cover_url")
    .maybeSingle();
  if (insertError) throw insertError;
  return created || { user_id: session.user.id, full_name: fullName, email: session.user.email };
}

async function ensurePendingRequest(session: any): Promise<void> {
  const { data: existing } = await runtime.client
    .from("registration_requests")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (existing) return;
  const fullName =
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    (session.user.email || "Member").split("@")[0];
  await runtime.client.from("registration_requests").insert({
    user_id: session.user.id,
    full_name: fullName,
    email: session.user.email,
    requested_role: "technician",
    status: "pending",
  });
}

async function bootInner(session: any): Promise<void> {
  if (state.booted && state.userId === session.user.id) return;
  const run = ++runtime.authRun;
  const { data: roleRow, error: roleError } = await runtime.client
    .from("user_roles")
    .select("app_role,approval_status")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (run !== runtime.authRun) return;
  if (roleError) { showAuth("Role check failed: " + roleError.message); return; }
  if (!roleRow || roleRow.approval_status !== "approved") {
    if (!roleRow) await ensurePendingRequest(session);
    await runtime.client.auth.signOut();
    showAuth("Your account is awaiting approval. You can sign in once an administrator approves it.");
    return;
  }

  let profile: any;
  try { profile = await ensureProfile(session); }
  catch (err: any) { showAuth("Database setup required. Contact administrator. (" + err.message + ")"); return; }
  if (run !== runtime.authRun) return;

  state.userId = session.user.id;
  state.email = session.user.email;
  state.role = roleRow.app_role;
  state.profile = profile;
  loadSavedSignaturePhoto();
  await loadSavedDrawnSignature();
  state.setupIssue = "";
  $("setupWarn")?.classList.add("hidden");
  const wel = $("welcome");
  const rl = $("roleLabel");
  if (wel) wel.textContent = profile.full_name || session.user.email;
  if (rl) rl.textContent = roleLabel(state.role);
  updateAccess();
  showApp();
  checkAppLock();
  requestNotificationPermission();
  applyTheme(localStorage.getItem("eesi-theme") || "dark");
  applyDisplaySettings();
  startClock();
  updateLiveWeather();
  startEmployeeLocationSharing();
  renderDecor();
  showDailyVerse();

  await Promise.all([
    loadBlockedUsers(),
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
    loadLeaveRequests(),
    loadPmsRecords(),
    loadReports(),
    loadStories(),
  ]);
  void ensureAmcbUnitsSeeded();
  await Promise.all([
    loadThreads(),
    loadUnread(),
    loadRecentChatNotices(),
  ]);
  if (run !== runtime.authRun) return;

  state.booted = true;
  renderAssigneesPicker();
  renderAll();
  startLive();
}

async function boot(session: any): Promise<void> {
  if (runtime.booting) return;
  if (state.booted && state.userId === session.user.id) return;
  runtime.booting = true;
  try {
    await bootInner(session);
    if (!state.booted) return;
    renderReportSites();
    await Promise.all([
      loadAppNotifications(),
      loadApprovalNotifications(),
    ]);
    syncPushSession(session);
    enablePush(true);
    const openedFromPush = await openStartupThread();
    if (!openedFromPush) await restoreLastView();
  } finally {
    runtime.booting = false;
  }
}

function resetState(): void {
  Object.assign(state, {
    userId: null, email: null, role: null, profile: null, profiles: [], roles: {}, presence: {},
    sites: [], units: [], schedules: [], dtrs: [], dtrTimeLogs: [], notes: [], recs: [], announcements: [], pending: [],
    leaveRequests: [], pmsRecords: [], recentChatNotices: [], threads: [], unread: {}, previews: {},
    chatFilter: "all", activeThread: null, messages: [], setupIssue: "", appNotifications: [],
    approvalNotifications: [], blockedUsers: [], stories: [], booted: false, reportType: "service",
  });
  resetDataLoadFlags();
  runtime.editingAnnouncementId = null;
  runtime.editingReportId = null;
  runtime.editingExistingUrls = [];
  runtime.editingUnitId = null;
  runtime.editingDtrId = null;
  runtime.editingMessageId = null;
  runtime.replyingToMsg = null;
  runtime.expandedUnitSiteIds = {};
  runtime.selectedSiteId = null;
  runtime.amcbSeedAttempted = false;
  clearPendingReportFiles();
  renderReportAttachmentPreview();
  clearPendingPmsFiles();
  renderPmsAttachmentPreview();
  closeTimemarkCamera();
  try { closeChat(); } catch {}
  const setTxt = (id: string, v: string) => { const e = $(id); if (e) e.textContent = v; };
  setTxt("welcome", "");
  setTxt("roleLabel", "");
  const msgs = $("messages");
  if (msgs) msgs.innerHTML = "";
  $("setupWarn")?.classList.add("hidden");
  setVal("settingSoundFile", "");
  stopSettingSound();
  resetSignatureState();
}

export async function signOut(): Promise<void> {
  teardownLive();
  state.booted = false;
  const { error } = await runtime.client.auth.signOut();
  if (error) { toast("Sign-out failed: " + error.message); return; }
  resetState();
  showLoginForm();
  showAuth("You are signed out.");
}

function initAuthWiring(): void {
  $("showRegisterButton")?.addEventListener("click", () => {
    $("loginForm")?.classList.add("hidden");
    $("loginOptions")?.classList.add("hidden");
    $("registerForm")?.classList.remove("hidden");
    setAuthStatus("Registration requires approval.");
  });
  $("backLoginButton")?.addEventListener("click", () => { showLoginForm(); setAuthStatus("Sign in to continue."); });
  $("resetBackButton")?.addEventListener("click", () => { showLoginForm(); setAuthStatus("Sign in to continue."); });

  $("loginForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!checkNetwork()) return;
    const btn = $("loginButton") as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    setAuthStatus("Signing in…");
    const { data, error } = await runtime.client.auth.signInWithPassword({
      email: val("email").trim(),
      password: val("password"),
    });
    setVal("password", "");
    if (btn) btn.disabled = false;
    if (error) { setAuthStatus("Sign-in failed: " + error.message); return; }
    if (data.session) await boot(data.session);
  });

  $("registerForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("registerButton") as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    setAuthStatus("Creating account…");
    runtime.isRegistering = true;
    try {
      const fullName = val("regName").trim();
      const email = val("regEmail").trim();
      const password = val("regPassword");
      const requestedRole = val("regRole");
      const idNo = val("regId").trim();
      const address = val("regAddress").trim();
      const team = val("regTeam").trim();
      const phone = val("regPhone").trim();
      const area = val("regArea");

      const { data, error } = await runtime.client.auth.signUp({
        email, password, options: { data: { full_name: fullName }, emailRedirectTo: runtime.APP_REDIRECT_URL },
      });
      setVal("regPassword", "");
      if (btn) btn.disabled = false;
      if (error) { setAuthStatus("Registration failed: " + error.message); return; }
      if (!data.user) { setAuthStatus("Account creation did not return a user."); return; }
      if (data.user.identities && data.user.identities.length === 0) {
        setAuthStatus("This email is already registered. Wait for approval or sign in.");
        return;
      }

      const { error: reqError } = await runtime.client.rpc("submit_registration_request", {
        p_user_id: data.user.id,
        p_full_name: fullName,
        p_email: email,
        p_requested_role: requestedRole,
        p_id_no: idNo || null,
        p_address: address || null,
        p_team: team || null,
        p_phone: phone || null,
        p_area: area || null,
      });
      if (reqError) { setAuthStatus("Account created, but approval request failed: " + reqError.message); return; }
      if (data.session) await runtime.client.auth.signOut();
      ($("registerForm") as HTMLFormElement | null)?.reset();
      showLoginForm();
      setAuthStatus("Registration submitted. Wait for approval before signing in.");
    } finally {
      runtime.isRegistering = false;
    }
  });

  $("forgotButton")?.addEventListener("click", async () => {
    const email = val("email").trim();
    if (!email) { setAuthStatus("Enter your email first."); ($("email") as HTMLInputElement | null)?.focus(); return; }
    setAuthStatus("Sending reset email…");
    const { error } = await runtime.client.auth.resetPasswordForEmail(email, { redirectTo: runtime.APP_REDIRECT_URL });
    setAuthStatus(error ? "Reset failed: " + error.message : "If the account exists, a reset email is on the way.");
  });

  const oauth = async (provider: string) => {
    setAuthStatus("Opening " + provider + " sign-in…");
    const { error } = await runtime.client.auth.signInWithOAuth({ provider, options: { redirectTo: runtime.APP_REDIRECT_URL } });
    if (error) setAuthStatus(provider + " sign-in failed: " + error.message);
  };
  $("googleButton")?.addEventListener("click", () => oauth("google"));
  $("facebookButton")?.addEventListener("click", () => oauth("facebook"));

  $("resetForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const password = val("newPassword");
    const { error } = await runtime.client.auth.updateUser({ password });
    setVal("newPassword", "");
    if (error) { setAuthStatus("Password update failed: " + error.message); return; }
    runtime.recoveryMode = false;
    if (location.hash) history.replaceState({}, document.title, runtime.APP_REDIRECT_URL);
    await runtime.client.auth.signOut();
    showLoginForm();
    setAuthStatus("Password updated. Sign in with your new password.");
  });
}

async function startSession(): Promise<void> {
  const recovery = (location.hash + location.search).includes("type=recovery");
  const { data, error } = await runtime.client.auth.getSession();
  if (error) { showAuth("Session check failed: " + error.message); return; }
  if (recovery) {
    runtime.recoveryMode = true;
    showAuth("Choose a new password.");
    showResetForm();
    return;
  }
  if (data.session) await boot(data.session);
  else showAuth("Sign in to continue.");
}

export function initEesiApp(): void {
  if (!window.supabase) {
    setAuthStatus("Could not load the Supabase library. Check your connection and reload.");
    return;
  }
  runtime.APP_REDIRECT_URL =
    location.protocol === "file:"
      ? location.href.split(/[?#]/)[0]
      : window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, "/");
  runtime.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  registerHooks();
  exposeWindowGlobals();

  runtime.client.auth.onAuthStateChange((event: string, session: any) => {
    if (session && event !== "SIGNED_OUT") syncPushSession(session);
    if (event === "PASSWORD_RECOVERY") {
      runtime.recoveryMode = true;
      showAuth("Choose a new password.");
      showResetForm();
      return;
    }
    if (event === "SIGNED_OUT" || !session) {
      runtime.authRun++;
      state.booted = false;
      teardownLive();
      resetState();
      showAuth("Sign in to continue.");
      return;
    }
    if (runtime.recoveryMode) return;
    if (event === "SIGNED_IN" && !runtime.isRegistering) setTimeout(() => boot(session), 0);
  });

  initPwaInstall();

  initAuthWiring();
  initSettingsWiring();
  initDataListeners();
  initChatWiring();
  initFeatureWiring();

  applyDisplaySettings();
  applyTheme(localStorage.getItem("eesi-theme") || "dark");
  startClock();
  startSession();
}
