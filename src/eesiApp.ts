import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import {
  $,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  calculateDtrMinutes,
  calculateShiftBreakdown,
  capDtrTimeOut,
  checkNetwork,
  closeSheet,
  extractReportPhotoUrls,
  filterDtrRowsByCutoff,
  fmtDate,
  fmtDay,
  fmtTableDate,
  hooks,
  parseDtrJobMeta,
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
  activateAndroidSoundAndVibration,
  applyDisplaySettings,
  applyTheme,
  applyWatermark,
  checkAppLock,
  clearWatermark,
  closeIosInstallModal,
  closePinSetup,
  disableBiometricLock,
  dismissAndroidInstallBanner,
  enableBiometricLock,
  enablePush,
  initPwaInstall,
  initSettingsWiring,
  installFromAndroidSheet,
  openPinSetup,
  playSettingSound,
  refreshLiveGpsWeather,
  renderDecor,
  requestNotificationPermission,
  resetDisplaySettings,
  setWatermarkOpacity,
  showDailyVerse,
  startClock,
  stopSettingSound,
  submitPinSetup,
  syncAndroidDevicePrefsToDb,
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
  getCachedUserGpsCoords,
  initAlwaysOnLocation,
  initDataListeners,
  initSiteMapControls,
  initSitesMapOverview,
  loadAnnouncements,
  loadAppNotifications,
  loadApprovalNotifications,
  loadBlockedUsers,
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
  loadStories,
  loadThreads,
  loadTimeLogs,
  loadUnits,
  loadUnread,
  markNoticeRead,
  refreshVisibleSiteDistances,
  reloadEverything,
  renderLiveOnlineMembersList,
  resetDataLoadFlags,
  restoreLastView,
  saveLastView,
  scheduleSiteMapLazyInit,
  setBasemap,
  setLiveMapFilter,
  setSiteMapLayer,
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
  canRunDtrThreeStepPdf,
  checkUpcomingShiftReminders,
  clearDtrAfterExport,
  clearDtrForm,
  clearPendingPmsFiles,
  clearPendingReportFiles,
  clearScheduleStatement,
  clearSignature,
  clearSignaturePhoto,
  closeAdminMemberOverlay,
  closeChangePasswordModal,
  closeEditDtr,
  closeLeaveFormOverlay,
  closeLeaveSheetPreview,
  closeScheduleFormOverlay,
  closeSiteMapOverlay,
  closeSiteUnitsOverlay,
  closeUnitActionOverlay,
  closeTimemarkCamera,
  closeTimemarkEditDrawer,
  closeTimemarkStyledNoteModal,
  closeTimemarkTemplatesDrawer,
  closeUnitManualOverlay,
  completeDtrExportStep,
  copyDailyScheduleSummary,
  cycleTimemarkZoom,
  deleteAdminMember,
  deleteAllNotices,
  deletePayslipRecord,
  deleteTimeLog,
  deleteUnit,
  downloadDtr,
  downloadLeaveSheet,
  downloadPayslipJpeg,
  downloadPayslipPdf,
  dtrTab,
  editLeaveRequest,
  editSchedule,
  editTimemarkNotesText,
  editUnit,
  ensureAmcbUnitsSeeded,
  evaluateDailySiteGeofence,
  exportPayslipXlsxAction,
  flipTimemarkCamera,
  focusTimemarkAt,
  go,
  initFeatureWiring,
  isCurrentUserMentionedInSchedule,
  loadPayslipIntoEditor,
  loadSavedDrawnSignature,
  loadSavedSignaturePhoto,
  markAllNoticesRead,
  openAddLeaveModal,
  openAddSiteModal,
  openAddUnitForSite,
  openEditDtr,
  openEditSiteOverlay,
  openHolidayCalendarSheet,
  openLastTimemarkPreview,
  openLeaveSheetPreview,
  openPayrollPage,
  openPmsChecklist,
  openPmsQuickShortcut,
  openQuickTimeAction,
  openScheduleFormOverlay,
  openSiteOnMap,
  openSiteUnitsOverlay,
  openTimemarkCamera,
  openTimemarkEditDrawer,
  openTimemarkStyledNoteModal,
  openTimemarkTemplatesDrawer,
  openTroubleUnitsFilter,
  openUnitManual,
  openUnitPms,
  openUnitReport,
  postAnnouncement,
  printDtr,
  printLeaveSheet,
  printPayslip,
  promptTimemarkTitle,
  quickUpdateUnitStatus,
  refreshLeaveBalances,
  removeAdminMember,
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
  renderPayroll,
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
  renderTimemarkTemplatesGrid,
  renderUnitSiteOptions,
  renderUnits,
  resetPayrollInputs,
  resetSignatureState,
  runSearch,
  saveAdminEdit,
  saveEditedDtr,
  saveNote,
  savePayslipRecord,
  saveProfile,
  saveRec,
  saveSchedule,
  saveTimemarkStyledNote,
  saveUnit,
  saveUnitManual,
  selectPayrollQuickCycle,
  selectTimemarkTemplate,
  selectUnitForActions,
  sendTimeLogNote,
  setAdminRoleFilter,
  setNoticesFilter,
  setScheduleFilter,
  setScheduleSearch,
  setSiteUnitsSearch,
  setTimeLogMode,
  setTimemarkAccentColor,
  setTimemarkAutoFlip,
  setTimemarkAutoSaveOriginal,
  setTimemarkCustomTitle,
  setTimemarkGridEnabled,
  setTimemarkLogoEnabled,
  setTimemarkNotesText,
  setTimemarkRatio,
  setTimemarkResolution,
  setTimemarkStyledNoteBoxed,
  setTimemarkStyledNoteColor,
  setTimemarkTimer,
  showTimemarkVerifyInfo,
  submitChangePassword,
  submitLeaveRequest,
  switchNoteTab,
  switchUnitsTab,
  syncPayrollFromDtr,
  syncPayrollMonthQuickPicker,
  toggleTimemarkConfigField,
  toggleTimemarkFlash,
  toggleTimemarkGrid,
  toggleTimemarkModeInsideCam,
  toggleTimemarkSideMenu,
  toggleTimemarkSitePicker,
  toggleUnitSiteCard,
  triggerTimemarkCapture,
  triggerUnitManualUpload,
  updateAccess,
  updateAnnouncementTicker,
  updateStyledNotePreviewText,
  visibleSchedules,
} from "./eesiFeatures";
import { openStartupThread } from "./eesiSettings";

export type ExportKind = "reports" | "pms" | "dtr" | "recommendations";

export function exportData(
  kind: ExportKind,
  options: { format?: "xlsx" | "doc" | "pdf"; id?: string; clearAfter?: boolean } = {}
): void {
  const format = options.format || "xlsx";
  if (format === "pdf") {
    if (kind === "dtr") { void exportDtrHistoryPdf({ clearAfter: !!options.clearAfter }); return; }
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
    headers = ["Date", "Employee", "Team / Area", "Location / Site", "Work Description / Unit", "Time In", "Time Out", "Total Hours", "Regular (9h)", "O.T. Hours", "OT Approved"];
    colWidths = [14, 24, 20, 26, 36, 12, 12, 13, 13, 12, 14];
    const dayBuckets = new Map<string, { firstIn: string | null; lastOut: string | null; mins: number; nsRepair: boolean }>();
    list.forEach(d => {
      const meta = parseDtrJobMeta(d.job, d.approved_by);
      const ruleOpts = { workDate: d.work_date, nightshiftRepair: meta.nightshiftRepair };
      const cappedOut = capDtrTimeOut(d.time_in, d.time_out, ruleOpts);
      const mins = calculateDtrMinutes(d.time_in, cappedOut, null, ruleOpts);
      const key = `${String(d.work_date || "")}::${String(d.user_id || "")}`;
      const b = dayBuckets.get(key) || { firstIn: null, lastOut: null, mins: 0, nsRepair: false };
      if (!b.firstIn && d.time_in) b.firstIn = d.time_in;
      if (cappedOut && cappedOut !== d.time_in) b.lastOut = cappedOut;
      b.mins += mins;
      if (meta.nightshiftRepair) b.nsRepair = true;
      dayBuckets.set(key, b);
    });
    const dailyRegAllocated = new Map<string, number>();
    const dailyOtRemaining = new Map<string, number>();
    const empOtStats = new Map<string, { grossOt: number; lacking: number; totalHrs: number; regHrs: number }>();
    const nowDt = new Date();
    const todayIsoStr = `${nowDt.getFullYear()}-${String(nowDt.getMonth() + 1).padStart(2, "0")}-${String(nowDt.getDate()).padStart(2, "0")}`;
    dayBuckets.forEach((b, key) => {
      const [wd, uid] = key.split("::");
      const bd = calculateShiftBreakdown(b.firstIn, b.lastOut, b.mins, {
        workDate: wd,
        nightshiftRepair: b.nsRepair,
      });
      dailyRegAllocated.set(key, 0);
      dailyOtRemaining.set(key, bd.finalOtMins);
      const isClosed = Boolean(b.lastOut) || wd < todayIsoStr;
      const uncoveredLacking = (b.mins > 0 && isClosed) ? Math.max(0, bd.standardMins - bd.workedMins) : 0;
      const st = empOtStats.get(uid) || { grossOt: 0, lacking: 0, totalHrs: 0, regHrs: 0 };
      st.grossOt += bd.finalOtMins;
      st.lacking += uncoveredLacking;
      st.totalHrs += b.mins / 60;
      st.regHrs += bd.regularMins / 60;
      empOtStats.set(uid, st);
    });

    rows = list.map(d => {
      const p = profileOf(d.user_id);
      const meta = parseDtrJobMeta(d.job, d.approved_by, d.nightshift_repair);
      const ruleOpts = { workDate: d.work_date, nightshiftRepair: meta.nightshiftRepair };
      const cappedOut = capDtrTimeOut(d.time_in, d.time_out, ruleOpts);
      const mins = calculateDtrMinutes(d.time_in, cappedOut, null, ruleOpts);
      const hrs = mins / 60;
      const key = `${String(d.work_date || "")}::${String(d.user_id || "")}`;
      const regSoFar = dailyRegAllocated.get(key) || 0;
      const otRem = dailyOtRemaining.get(key) || 0;
      const regCap = 9 * 60;
      const regShare = otRem > 0 ? Math.min(mins, Math.max(0, regCap - regSoFar)) : mins;
      const otShare = Math.min(otRem, Math.max(0, mins - regShare));
      dailyRegAllocated.set(key, regSoFar + regShare);
      dailyOtRemaining.set(key, Math.max(0, otRem - otShare));
      const regHrs = regShare / 60;
      const otHrs = otShare / 60;
      const jobDisplay = [
        meta.unitName ? `[${meta.unitName}]` : "",
        meta.cleanJob,
        meta.nightshiftRepair ? "(Nightshift/Repair)" : "",
      ].filter(Boolean).join(" ") || "—";
      return [
        fmtTableDate(d.work_date),
        profileName(d.user_id),
        [p?.team, p?.area].filter(Boolean).join(" / ") || "—",
        d.location || "—",
        jobDisplay,
        d.time_in || "—",
        cappedOut || "—",
        Number(hrs.toFixed(2)),
        Number(regHrs.toFixed(2)),
        Number(otHrs.toFixed(2)),
        meta.approvedBy || (meta.nightshiftRepair ? "Nightshift/Repair" : "Approved"),
      ];
    });

    let sumTotalHrs = 0;
    let sumRegHrs = 0;
    let sumGrossOtMins = 0;
    let sumLackingMins = 0;
    let sumFinalOtMins = 0;
    empOtStats.forEach(st => {
      sumTotalHrs += st.totalHrs;
      sumRegHrs += st.regHrs;
      sumGrossOtMins += st.grossOt;
      sumLackingMins += st.lacking;
      sumFinalOtMins += Math.max(0, st.grossOt - st.lacking);
    });
    if (sumLackingMins > 0) {
      rows.push([
        "SUMMARY",
        "All Working Days",
        "—",
        "—",
        `Gross Day O.T.: ${(sumGrossOtMins / 60).toFixed(2)}h − Lacking Deducted: ${(sumLackingMins / 60).toFixed(2)}h`,
        "—",
        "—",
        Number(sumTotalHrs.toFixed(2)),
        Number(sumRegHrs.toFixed(2)),
        Number((sumFinalOtMins / 60).toFixed(2)),
        "Final Overall O.T.",
      ]);
    } else {
      rows.push([
        "SUMMARY",
        "All Working Days",
        "—",
        "—",
        "Final Total Overall O.T.",
        "—",
        "—",
        Number(sumTotalHrs.toFixed(2)),
        Number(sumRegHrs.toFixed(2)),
        Number((sumFinalOtMins / 60).toFixed(2)),
        "Final Overall O.T.",
      ]);
    }
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
    refreshVisibleSiteDistances,
    openSiteOnMap,
    clearDtrAfterExport,
    canRunDtrThreeStepPdf,
    completeDtrExportStep,
    renderLiveOnlineMembers: renderLiveOnlineMembersList,
    closeSiteUnitsOverlay,
    renderPayroll,
    evaluateDailySiteGeofence,
    isUserMentionedInSchedule: isCurrentUserMentionedInSchedule,
    getCachedGps: getCachedUserGpsCoords,
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
    activateAndroidSoundAndVibration,
    dismissAndroidInstallBanner,
    installFromAndroidSheet,
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
    editSchedule,
    setScheduleFilter,
    setScheduleSearch,
    copyDailyScheduleSummary,
    setNoticesFilter,
    clearScheduleStatement,
    openScheduleFormOverlay,
    closeScheduleFormOverlay,
    saveUnit,
    cancelUnitForm,
    openAddUnitForSite,
    editUnit,
    deleteUnit,
    ensureAmcbUnitsSeeded,
    toggleUnitSiteCard,
    openSiteUnitsOverlay,
    closeSiteUnitsOverlay,
    setSiteUnitsSearch,
    selectUnitForActions,
    closeUnitActionOverlay,
    quickUpdateUnitStatus,
    openPmsQuickShortcut,
    openTroubleUnitsFilter,
    closeUnitManualOverlay,
    switchUnitsTab,
    openUnitManual,
    saveUnitManual,
    triggerUnitManualUpload,
    openUnitReport,
    openUnitPms,
    openSiteOnMap,
    closeSiteMapOverlay,
    setSiteMapLayer,
    setSiteMapTravelMode,
    centerSiteMapOnSelected,
    fitSiteMapRoute,
    initSitesMapOverview,
    scheduleSiteMapLazyInit,
    dtrTab,
    addDtr,
    clearDtrForm,
    clearDtrAfterExport,
    openEditDtr,
    closeEditDtr,
    saveEditedDtr,
    openTimemarkCamera,
    closeTimemarkCamera,
    flipTimemarkCamera,
    captureTimemarkPhoto,
    triggerTimemarkCapture,
    toggleTimemarkSideMenu,
    toggleTimemarkFlash,
    showTimemarkVerifyInfo,
    cycleTimemarkZoom,
    openTimemarkEditDrawer,
    closeTimemarkEditDrawer,
    toggleTimemarkSitePicker,
    toggleTimemarkModeInsideCam,
    openLastTimemarkPreview,
    openTimemarkTemplatesDrawer,
    closeTimemarkTemplatesDrawer,
    selectTimemarkTemplate,
    renderTimemarkTemplatesGrid,
    toggleTimemarkConfigField,
    setTimemarkAccentColor,
    setTimemarkCustomTitle,
    setTimemarkNotesText,
    promptTimemarkTitle,
    editTimemarkNotesText,
    openTimemarkStyledNoteModal,
    closeTimemarkStyledNoteModal,
    setTimemarkStyledNoteBoxed,
    setTimemarkStyledNoteColor,
    saveTimemarkStyledNote,
    updateStyledNotePreviewText,
    setTimemarkRatio,
    setTimemarkResolution,
    setTimemarkGridEnabled,
    toggleTimemarkGrid,
    focusTimemarkAt,
    setTimemarkTimer,
    setTimemarkLogoEnabled,
    setTimemarkAutoSaveOriginal,
    setTimemarkAutoFlip,
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
    openAddLeaveModal,
    closeLeaveFormOverlay,
    editLeaveRequest,
    submitLeaveRequest,
    openLeaveSheetPreview,
    closeLeaveSheetPreview,
    downloadLeaveSheet,
    printLeaveSheet,
    openAddSiteModal,
    openEditSiteOverlay,
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
    setAdminRoleFilter,
    closeAdminMemberOverlay,
    removeAdminMember,
    deleteAdminMember,
    markNoticeRead,
    markAllNoticesRead,
    deleteAllNotices,
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
    openPayrollPage,
    syncPayrollFromDtr,
    syncPayrollMonthQuickPicker,
    selectPayrollQuickCycle,
    refreshLiveGpsWeather,
    savePayslipRecord,
    loadPayslipIntoEditor,
    deletePayslipRecord,
    resetPayrollInputs,
    downloadPayslipJpeg,
    printPayslip,
    downloadPayslipPdf,
    exportPayslipXlsx: exportPayslipXlsxAction,
    openHolidayCalendarSheet,
  });
}

/* ==================== AUTH UI ==================== */
let pendingAuthNotice = "";

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

async function ensurePendingRequest(
  session: any,
  overrides?: { fullName?: string; email?: string; idNo?: string; address?: string; team?: string; phone?: string; area?: string }
): Promise<{ ok: boolean; error?: string }> {
  const meta = session?.user?.user_metadata || {};
  const email = (overrides?.email || session?.user?.email || "").trim();
  const fullName = (
    overrides?.fullName ||
    meta.full_name ||
    meta.name ||
    (email || "Member").split("@")[0]
  ).trim();
  const idNo = (overrides?.idNo ?? meta.id_no ?? "") || null;
  const address = (overrides?.address ?? meta.address ?? "") || null;
  const team = (overrides?.team ?? meta.team ?? "") || null;
  const phone = (overrides?.phone ?? meta.phone ?? "") || null;
  const area = (overrides?.area ?? meta.area ?? "") || null;

  const [{ data: existingReq }, { data: existingRole }] = await Promise.all([
    runtime.client.from("registration_requests").select("id,status").eq("user_id", session.user.id).maybeSingle(),
    runtime.client.from("user_roles").select("user_id,approval_status").eq("user_id", session.user.id).maybeSingle(),
  ]);
  if (existingReq && existingReq.status === "pending" && existingRole) {
    return { ok: true };
  }

  const { error: rpcError } = await runtime.client.rpc("submit_registration_request", {
    p_user_id: session.user.id,
    p_full_name: fullName,
    p_email: email,
    p_requested_role: "employee",
    p_id_no: idNo,
    p_address: address,
    p_team: team,
    p_phone: phone,
    p_area: area,
  });
  if (!rpcError) return { ok: true };

  // Fallback for authenticated sessions if the RPC hits a legacy schema mismatch (e.g. missing updated_at column)
  const { error: profErr } = await runtime.client
    .from("profiles")
    .upsert(
      { user_id: session.user.id, full_name: fullName, email, id_no: idNo, address, team, phone, area },
      { onConflict: "user_id" }
    );
  if (profErr) {
    await runtime.client
      .from("profiles")
      .upsert({ user_id: session.user.id, full_name: fullName, email }, { onConflict: "user_id" });
  }

  if (!existingRole) {
    await runtime.client.from("user_roles").insert({
      user_id: session.user.id,
      app_role: "employee",
      approval_status: "pending",
      area,
    });
  }

  let reqErr: any = null;
  if (!existingReq) {
    const res = await runtime.client.from("registration_requests").insert({
      user_id: session.user.id,
      full_name: fullName,
      email,
      requested_role: "employee",
      id_no: idNo,
      address,
      team,
      phone,
      area,
      status: "pending",
    });
    reqErr = res.error;
  } else if (existingReq.status !== "pending") {
    const res = await runtime.client
      .from("registration_requests")
      .update({ full_name: fullName, email, id_no: idNo, address, team, phone, area, status: "pending" })
      .eq("id", existingReq.id);
    reqErr = res.error;
  }

  if (!reqErr) return { ok: true };
  return { ok: false, error: rpcError.message || reqErr.message };
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
    if (roleRow?.approval_status === "declined" || roleRow?.approval_status === "rejected") {
      pendingAuthNotice = "Your registration was declined. Contact an administrator for details.";
    } else {
      const reqRes = await ensurePendingRequest(session);
      pendingAuthNotice = reqRes.ok
        ? "Your account is awaiting administrator approval. You can sign in once an administrator approves it."
        : "Account created, but approval request failed (" + (reqRes.error || "database setup needed") + "). Ask an administrator to run the latest SQL.";
    }
    const msg = pendingAuthNotice;
    await runtime.client.auth.signOut();
    pendingAuthNotice = "";
    showAuth(msg);
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
    loadAppNotifications(),
    loadApprovalNotifications(),
    loadThreads(),
    loadPayslips(),
  ]);
  void ensureAmcbUnitsSeeded();
  await Promise.all([
    loadUnread(),
    loadRecentChatNotices(),
  ]);
  if (run !== runtime.authRun) return;

  state.booted = true;
  renderAssigneesPicker();
  renderReportSites();
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
    syncPushSession(session);
    enablePush(true);
    void syncAndroidDevicePrefsToDb();
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
    approvalNotifications: [], blockedUsers: [], stories: [], payslips: [], booted: false, reportType: "service",
  });
  resetDataLoadFlags();
  runtime.editingAnnouncementId = null;
  runtime.editingScheduleId = null;
  runtime.editingScheduleMeta = null;
  runtime.scheduleFilter = "all";
  runtime.scheduleSearch = "";
  runtime.noticesFilter = "all";
  runtime.editingReportId = null;
  runtime.editingExistingUrls = [];
  runtime.editingUnitId = null;
  runtime.editingDtrId = null;
  runtime.editingPayslipId = null;
  runtime.editingMessageId = null;
  runtime.replyingToMsg = null;
  runtime.expandedUnitSiteIds = {};
  runtime.selectedUnitsSiteId = null;
  runtime.selectedUnitId = null;
  runtime.siteUnitsSearch = "";
  runtime.unitsLocationFilter = "ALL";
  runtime.unitsSideFilter = "ALL";
  runtime.unitsFloorFilter = "ALL";
  runtime.unitsDirFilter = "ALL";
  runtime.unitsShowAllInline = false;
  runtime.hasLiveGpsLock = false;
  runtime.lastWeatherPlace = "";
  runtime.lastWeatherAcc = 0;
  runtime.lastWeatherUpdatedAt = 0;
  runtime.editingLeaveId = null;
  runtime.adminRoleFilter = "all";
  runtime.selectedSiteId = null;
  runtime.editingSiteId = null;
  runtime.timeLogModeManual = false;
  runtime.sitesRegionFilter = "ALL";
  runtime.sitesStatusFilter = "ALL";
  runtime.siteMapLayer = "roadmap";
  runtime.siteDistances = {};
  runtime.siteDistanceOriginKey = "";
  runtime.siteMetaNotices = {};
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
  teardownLive(true);
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
    if (!checkNetwork()) return;
    const btn = $("registerButton") as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    setAuthStatus("Creating account…");
    runtime.isRegistering = true;
    let activeSession: any = null;
    try {
      const fullName = val("regName").trim();
      const email = val("regEmail").trim();
      const password = val("regPassword");
      const requestedRole = "employee";
      const idNo = val("regId").trim();
      const address = val("regAddress").trim();
      const team = val("regTeam").trim();
      const phone = val("regPhone").trim();
      const area = val("regArea");

      const { data, error } = await runtime.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            id_no: idNo || null,
            address: address || null,
            team: team || null,
            phone: phone || null,
            area: area || null,
          },
          emailRedirectTo: runtime.APP_REDIRECT_URL,
        },
      });
      setVal("regPassword", "");
      if (btn) btn.disabled = false;
      activeSession = data?.session || null;

      if (error) {
        const msg = String(error.message || "");
        if (/already registered|already exists|user_already_exists/i.test(msg)) {
          setAuthStatus("This email already has an account. Switch to Log in and sign in with your email & password to submit or check your approval request.");
        } else {
          setAuthStatus("Registration failed: " + msg);
        }
        return;
      }
      if (!data.user) { setAuthStatus("Account creation did not return a user."); return; }
      if (data.user.identities && data.user.identities.length === 0) {
        setAuthStatus("This email is already registered. Log in with your email and password to submit or check your approval request.");
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

      let requestSaved = !reqError;
      let errMsg = reqError ? reqError.message : "";

      if (!requestSaved && activeSession) {
        const fallback = await ensurePendingRequest(activeSession, { fullName, email, idNo, address, team, phone, area });
        requestSaved = fallback.ok;
        if (!requestSaved && fallback.error) errMsg = fallback.error;
      }

      if (!requestSaved) {
        const failNotice =
          "Account created, but approval request failed (" + errMsg + "). " +
          "Once the administrator runs the SQL fix, sign in with your email and password to send your approval request automatically.";
        if (activeSession) {
          pendingAuthNotice = failNotice;
          await runtime.client.auth.signOut();
          pendingAuthNotice = "";
        }
        showLoginForm();
        setAuthStatus(failNotice);
        return;
      }

      const okNotice = data.session
        ? "Registration submitted! Wait for administrator approval before signing in."
        : "Registration submitted! Check your email if confirmation is enabled, then wait for administrator approval before signing in.";
      if (activeSession) {
        pendingAuthNotice = okNotice;
        await runtime.client.auth.signOut();
        pendingAuthNotice = "";
      }
      ($("registerForm") as HTMLFormElement | null)?.reset();
      showLoginForm();
      setAuthStatus(okNotice);
    } finally {
      if (btn) btn.disabled = false;
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
  runtime.APP_REDIRECT_URL =
    location.protocol === "file:"
      ? location.href.split(/[?#]/)[0]
      : window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, "/");
  runtime.client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

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
      teardownLive(true);
      resetState();
      const notice = pendingAuthNotice || "Sign in to continue.";
      pendingAuthNotice = "";
      showAuth(notice);
      return;
    }
    if (runtime.recoveryMode) return;
    if (event === "SIGNED_IN" && !runtime.isRegistering) setTimeout(() => boot(session), 0);
  });

  initPwaInstall();

  initAuthWiring();
  initSettingsWiring();
  initDataListeners();
  initSiteMapControls();
  initChatWiring();
  initFeatureWiring();

  applyDisplaySettings();
  applyTheme(localStorage.getItem("eesi-theme") || "dark");
  startClock();
  initAlwaysOnLocation();
  startSession();
}
