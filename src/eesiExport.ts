import * as XLSX from "xlsx";
import {
  $,
  PMS_ITEMS,
  PayslipRecord,
  calculateDtrMinutes,
  calculateOtMinutes,
  calculateShiftBreakdown,
  capDtrTimeOut,
  esc,
  filterDtrRowsByCutoff,
  fmtDate,
  fmtDay,
  fmtHalfSheetDate,
  hooks,
  isManager,
  isSundayDate,
  parseDtrJobMeta,
  parseRecMeta,
  parseReportUnit,
  profileName,
  profileOf,
  sortDtrEntriesAscending,
  state,
  stripReportPhotos,
  extractReportPhotoUrls,
  toast,
  val,
  runtime,
} from "./eesiTypes";

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}

function safeFileSlug(name: string): string {
  return String(name || "export")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "export";
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

interface TableCol {
  label: string;
  px: number;
  pct: number;
  align?: "left" | "center" | "right";
}

function buildXlsHtml(
  title: string,
  subtitle: string,
  cols: TableCol[],
  rows: string[][]
): string {
  const totalPx = cols.reduce((s, c) => s + c.px, 0);
  const colgroup = cols.map(c => `<col width="${c.px}" style="width:${c.px}px">`).join("");
  const headers = cols
    .map(
      c =>
        `<th style="background:#0b1b38;color:#ffffff;font-weight:bold;border:1px solid #334155;padding:7px 8px;text-align:${c.align || "left"};vertical-align:middle;font-size:10pt;">${esc(c.label)}</th>`
    )
    .join("");
  const body =
    rows.length > 0
      ? rows
          .map(
            (r, rIdx) =>
              `<tr style="background:${rIdx % 2 === 1 ? "#f4f7fc" : "#ffffff"};">` +
              cols
                .map(
                  (c, idx) =>
                    `<td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:${c.align || "left"};vertical-align:top;white-space:pre-wrap;word-wrap:break-word;mso-number-format:'\\@';font-size:10pt;color:#0f172a;">${esc(r[idx] ?? "")}</td>`
                )
                .join("") +
              "</tr>"
          )
          .join("")
      : `<tr><td colspan="${cols.length}" style="border:1px solid #cbd5e1;padding:12px;text-align:center;color:#64748b;">No records available.</td></tr>`;

  return (
    "\ufeff" +
    `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>EESI Export</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/><x:FitToPage/><x:Print><x:ValidPrinterInfo/><x:Scale>90</x:Scale></x:Print></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
</xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; margin: 12px; color: #0f172a; }
  table { border-collapse: collapse; table-layout: fixed; width: ${totalPx}px; }
  td, th { font-family: Calibri, Arial, sans-serif; }
</style>
</head>
<body>
<table>
  <colgroup>${colgroup}</colgroup>
  <tr><td colspan="${cols.length}" style="font-size:14pt;font-weight:bold;background:#1e6cf2;color:#ffffff;padding:10px 8px;border:1px solid #0b1b38;text-align:left;">EESI ELEVATORS INC. — ${esc(title)}</td></tr>
  <tr><td colspan="${cols.length}" style="font-size:9.5pt;background:#e8f0fe;color:#1e293b;padding:6px 8px;border:1px solid #cbd5e1;text-align:left;">${esc(subtitle)} · Exported ${esc(new Date().toLocaleString())}</td></tr>
  <tr>${headers}</tr>
  ${body}
</table>
</body>
</html>`
  );
}

function buildDocHtml(
  title: string,
  subtitle: string,
  cols: TableCol[],
  rows: string[][],
  extraSectionsHtml = ""
): string {
  const colgroup = cols.map(c => `<col style="width:${c.pct}%">`).join("");
  const headers = cols
    .map(
      c =>
        `<th style="background:#0b1b38;color:#ffffff;font-weight:bold;border:1px solid #1e293b;padding:6px 7px;text-align:${c.align || "left"};vertical-align:middle;font-size:9.5pt;">${esc(c.label)}</th>`
    )
    .join("");
  const body =
    rows.length > 0
      ? rows
          .map(
            (r, rIdx) =>
              `<tr style="background:${rIdx % 2 === 1 ? "#f8fafc" : "#ffffff"};">` +
              cols
                .map(
                  (c, idx) =>
                    `<td style="border:1px solid #94a3b8;padding:6px 7px;text-align:${c.align || "left"};vertical-align:top;white-space:pre-wrap;word-wrap:break-word;font-size:9.5pt;color:#0f172a;">${esc(r[idx] ?? "")}</td>`
                )
                .join("") +
              "</tr>"
          )
          .join("")
      : `<tr><td colspan="${cols.length}" style="border:1px solid #94a3b8;padding:12px;text-align:center;color:#64748b;">No records available.</td></tr>`;

  return (
    "\ufeff" +
    `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  @page WordSection1 { size: 8.5in 11in; margin: 0.55in 0.55in 0.55in 0.55in; }
  div.WordSection1 { page: WordSection1; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #0f172a; margin: 0; }
  .hdr { border-bottom: 2px solid #1e6cf2; padding-bottom: 8px; margin-bottom: 12px; }
  .brand { font-size: 15pt; font-weight: bold; color: #0b1b38; margin: 0; }
  .sub { font-size: 11pt; font-weight: bold; color: #1e6cf2; margin: 2px 0 4px; }
  .meta { font-size: 9pt; color: #475569; margin: 0; }
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
</style>
</head>
<body>
<div class="WordSection1">
  <div class="hdr">
    <p class="brand">EESI ELEVATORS INC.</p>
    <p class="sub">${esc(title)}</p>
    <p class="meta">${esc(subtitle)} &nbsp;|&nbsp; Exported: ${esc(new Date().toLocaleString())} &nbsp;|&nbsp; Prepared by: ${esc(state.profile?.full_name || state.email || "Member")}</p>
  </div>
  <table class="grid">
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${headers}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  ${extraSectionsHtml}
</div>
</body>
</html>`
  );
}

function downloadXls(filename: string, title: string, subtitle: string, cols: TableCol[], rows: string[][]): void {
  const html = buildXlsHtml(title, subtitle, cols, rows);
  triggerDownload(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }), filename.endsWith(".xls") ? filename : filename + ".xls");
  toast("Exported " + filename);
}

function downloadDoc(filename: string, title: string, subtitle: string, cols: TableCol[], rows: string[][], extra = ""): void {
  const html = buildDocHtml(title, subtitle, cols, rows, extra);
  triggerDownload(new Blob([html], { type: "application/msword;charset=utf-8" }), filename.endsWith(".doc") ? filename : filename + ".doc");
  toast("Exported " + filename);
}

/* ==================== SERVICE & DELIVERY REPORTS ==================== */
export function exportReports(format: "xls" | "doc", singleReportId?: string): void {
  const type = state.reportType === "delivery" ? "delivery" : "service";
  const typeLabel = type === "delivery" ? "Delivery Reports" : "Service Reports";
  let list = state.reports.filter(r => r.report_type === type);
  if (singleReportId) {
    list = state.reports.filter(r => String(r.id) === String(singleReportId));
  }
  if (!list.length) {
    toast("No " + typeLabel.toLowerCase() + " to export.");
    return;
  }
  const cols: TableCol[] = [
    { label: "Date", px: 95, pct: 10, align: "center" },
    { label: "Type", px: 85, pct: 9, align: "center" },
    { label: "Site / Location", px: 150, pct: 16, align: "left" },
    { label: "Unit", px: 130, pct: 13, align: "left" },
    { label: "Title", px: 160, pct: 16, align: "left" },
    { label: "Details", px: 250, pct: 22, align: "left" },
    { label: "Submitted By", px: 110, pct: 9, align: "left" },
    { label: "Attachments", px: 65, pct: 5, align: "center" },
  ];
  const rows = list.map(r => {
    const site = state.sites.find(s => String(s.id) === String(r.site_id));
    const siteText = site ? [site.name, site.city, site.region].filter(Boolean).join(" · ") : "Unknown site";
    const parsedUnit = parseReportUnit(r.details);
    const attCount = extractReportPhotoUrls(r.details).length;
    return [
      r.report_date ? fmtDay(r.report_date) : "",
      r.report_type === "delivery" ? "Delivery" : "Service",
      siteText,
      parsedUnit.unitName || "General / All Units",
      r.title || "",
      stripReportPhotos(r.details) || "",
      profileName(r.created_by),
      attCount ? `${attCount} file(s)` : "None",
    ];
  });
  const title = singleReportId ? `${list[0].report_type === "delivery" ? "Delivery" : "Service"} Report` : typeLabel;
  const sub = singleReportId ? (list[0].title || "Single Report") : `${list.length} record(s)`;
  const baseName = singleReportId
    ? `eesi-${list[0].report_type}-report-${safeFileSlug(list[0].title || stamp())}`
    : `eesi-${type}-reports-${stamp()}`;
  if (format === "xls") downloadXls(baseName + ".xls", title, sub, cols, rows);
  else downloadDoc(baseName + ".doc", title, sub, cols, rows);
}

/* ==================== LIVE PMS CHECKLIST ==================== */
export function exportCurrentChecklist(format: "xls" | "doc"): void {
  const site = state.sites.find(s => String(s.id) === String(runtime.pmsSiteId));
  const siteName = site ? site.name : ($("pmsSelectedSite")?.textContent || "Selected Site");
  const dateVal = val("pmsChecklistDate") || stamp();
  const unitType = runtime.pmsUnit === "escalator" ? "Escalator" : "Elevator";
  const sections = PMS_ITEMS[runtime.pmsUnit] || PMS_ITEMS.elevator;

  const cards = [...document.querySelectorAll<HTMLElement>("#pmsCategories .card")];
  const rows: string[][] = [];
  let passedCount = 0;
  let totalCount = 0;

  if (cards.length) {
    cards.forEach((card, secIdx) => {
      const heading = card.querySelector("h2")?.textContent?.trim() || (sections[secIdx]?.[0] || `Section ${secIdx + 1}`);
      card.querySelectorAll<HTMLLabelElement>("label.check-row").forEach((lbl, idx) => {
        const cb = lbl.querySelector<HTMLInputElement>("input[type='checkbox']");
        const ok = !!cb?.checked;
        if (ok) passedCount++;
        totalCount++;
        rows.push([
          String(totalCount),
          heading,
          lbl.textContent?.trim() || `Item ${idx + 1}`,
          ok ? "PASS" : "FAIL / N/A",
        ]);
      });
    });
  } else {
    sections.forEach(([heading, items]) => {
      items.forEach(item => {
        totalCount++;
        rows.push([String(totalCount), heading, item, "UNCHECKED"]);
      });
    });
  }

  const cols: TableCol[] = [
    { label: "#", px: 45, pct: 6, align: "center" },
    { label: "Category", px: 200, pct: 28, align: "left" },
    { label: "Inspection Item", px: 410, pct: 52, align: "left" },
    { label: "Status", px: 105, pct: 14, align: "center" },
  ];
  const title = `PMS Checklist — ${unitType}`;
  const sub = `Site: ${siteName} (${runtime.pmsRegion}) · Date: ${fmtDay(dateVal)} · Passed: ${passedCount}/${totalCount}`;
  const fname = `eesi-pms-checklist-${safeFileSlug(siteName)}-${dateVal}`;
  if (format === "xls") downloadXls(fname + ".xls", title, sub, cols, rows);
  else downloadDoc(fname + ".doc", title, sub, cols, rows);
}

/* ==================== PMS RECORDS (FILTERED LIST & SINGLE) ==================== */
export function getFilteredPmsRecords(): any[] {
  const team = val("pmsRecordsTeam");
  const loc = val("pmsRecordsLocation");
  const siteId = val("pmsRecordsSite");
  return state.pmsRecords.filter(r => {
    const p = profileOf(r.user_id);
    const site = state.sites.find(s => String(s.id) === String(r.site_id));
    if (team && (!p || p.team !== team)) return false;
    if (loc && (!site || site.region !== loc)) return false;
    if (siteId && String(r.site_id) !== siteId) return false;
    return true;
  });
}

export function exportPmsRecords(format: "xls" | "doc", singleRecordId?: string): void {
  if (singleRecordId) {
    const rec = state.pmsRecords.find(r => String(r.id) === String(singleRecordId));
    if (!rec) { toast("PMS record not found."); return; }
    const site = state.sites.find(s => String(s.id) === String(rec.site_id));
    const siteName = site ? site.name : "Unknown Site";
    let parsed: any = {};
    try { parsed = JSON.parse(rec.details || "{}"); } catch {}
    const items: Array<{ label: string; passed: boolean }> = Array.isArray(parsed.items) ? parsed.items : [];
    const cols: TableCol[] = [
      { label: "#", px: 50, pct: 8, align: "center" },
      { label: "Inspection Item", px: 520, pct: 74, align: "left" },
      { label: "Result", px: 120, pct: 18, align: "center" },
    ];
    const rows = items.map((it, idx) => [
      String(idx + 1),
      it.label || "",
      it.passed ? "PASS" : "FAIL / UNCHECKED",
    ]);
    const title = `PMS Inspection Record — ${(rec.unit_type || "").toUpperCase()}`;
    const attCount = Array.isArray(parsed.attachments) ? parsed.attachments.length : 0;
    const sub = `Site: ${siteName} · Date: ${fmtDay(rec.checklist_date)} · Inspector: ${profileName(rec.user_id)} · Score: ${rec.items_passed}/${rec.items_total}${attCount ? ` · Attachments: ${attCount}` : ""}`;
    const fname = `eesi-pms-record-${safeFileSlug(siteName)}-${rec.checklist_date || stamp()}`;
    if (format === "xls") downloadXls(fname + ".xls", title, sub, cols, rows);
    else downloadDoc(fname + ".doc", title, sub, cols, rows);
    return;
  }

  const list = getFilteredPmsRecords();
  if (!list.length) {
    toast("No PMS records to export.");
    return;
  }
  const cols: TableCol[] = [
    { label: "Date", px: 95, pct: 10, align: "center" },
    { label: "Region", px: 85, pct: 9, align: "center" },
    { label: "Site", px: 165, pct: 18, align: "left" },
    { label: "Unit Type", px: 90, pct: 10, align: "center" },
    { label: "Inspector", px: 135, pct: 14, align: "left" },
    { label: "Team", px: 100, pct: 10, align: "left" },
    { label: "Score", px: 80, pct: 9, align: "center" },
    { label: "Failed Items", px: 200, pct: 14, align: "left" },
    { label: "Files", px: 60, pct: 6, align: "center" },
  ];
  const rows = list.map(r => {
    const site = state.sites.find(s => String(s.id) === String(r.site_id));
    const p = profileOf(r.user_id);
    let parsed: any = {};
    try { parsed = JSON.parse(r.details || "{}"); } catch {}
    const failed = Array.isArray(parsed.items)
      ? parsed.items.filter((i: any) => !i.passed).map((i: any) => i.label).join("; ")
      : "";
    const attCount = Array.isArray(parsed.attachments) ? parsed.attachments.length : 0;
    return [
      fmtDay(r.checklist_date),
      site?.region || parsed.region || "—",
      site ? site.name : "Unknown site",
      (r.unit_type || "").toUpperCase(),
      profileName(r.user_id),
      p?.team || "—",
      `${r.items_passed}/${r.items_total}`,
      failed || "All passed",
      attCount ? `${attCount} file(s)` : "None",
    ];
  });
  const fname = `eesi-pms-records-${stamp()}`;
  if (format === "xls") downloadXls(fname + ".xls", "PMS Checklist Records", `${list.length} inspection record(s)`, cols, rows);
  else downloadDoc(fname + ".doc", "PMS Checklist Records", `${list.length} inspection record(s)`, cols, rows);
}

/* ==================== RECOMMENDATIONS ==================== */
export function exportRecommendations(format: "xls" | "doc"): void {
  const list = state.recs || [];
  if (!list.length) {
    toast("No recommendations to export.");
    return;
  }
  const cols: TableCol[] = [
    { label: "Date", px: 100, pct: 11, align: "center" },
    { label: "Site", px: 130, pct: 13, align: "left" },
    { label: "Unit / Location", px: 130, pct: 13, align: "left" },
    { label: "Part", px: 120, pct: 12, align: "left" },
    { label: "Condition", px: 100, pct: 10, align: "center" },
    { label: "Reason / Findings", px: 200, pct: 18, align: "left" },
    { label: "Assigned", px: 115, pct: 9, align: "left" },
    { label: "Submitted By", px: 105, pct: 7, align: "left" },
    { label: "Comments", px: 190, pct: 7, align: "left" },
  ];
  const rows = list.map(r => {
    const meta = parseRecMeta(r.reason);
    const comments = (r.recommendation_comments || [])
      .map((c: any) => `${profileName(c.user_id)}: ${c.comment}`)
      .join("\n");
    return [
      fmtDate(r.created_at),
      r.site || "—",
      [meta.siteUnit, r.location].filter(Boolean).join(" · ") || "—",
      r.part || "—",
      r.condition || "—",
      meta.cleanReason || "—",
      meta.assignedNames.join(", ") || "—",
      profileName(r.user_id),
      comments || "None",
    ];
  });
  const fname = `eesi-recommendations-${stamp()}`;
  if (format === "xls") downloadXls(fname + ".xls", "Parts & Maintenance Recommendations", `${list.length} recommendation(s)`, cols, rows);
  else downloadDoc(fname + ".doc", "Parts & Maintenance Recommendations", `${list.length} recommendation(s)`, cols, rows);
}

function formatPdfTime12h(t: string | null | undefined): string {
  const s = String(t || "").trim();
  if (!s) return "";
  if (/[ap]\.?m\.?$/i.test(s)) return s.replace(/\./g, "").toUpperCase();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  let h = Number(m[1]);
  const min = m[2];
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${suffix}`;
}

export async function exportDtrHistoryPdf(opts: { clearAfter?: boolean } = {}): Promise<void> {
  if (opts?.clearAfter && hooks.canRunDtrThreeStepPdf && !hooks.canRunDtrThreeStepPdf()) {
    toast("Full History PDF already used (1 click per button).");
    return;
  }
  const pickedUid = isManager() && val("dtrPreviewEmployee") ? val("dtrPreviewEmployee") : String(state.userId || "");
  const rawList = isManager() && !opts?.clearAfter
    ? [...(state.dtrs || [])]
    : (state.dtrs || []).filter(d => String(d.user_id) === String(opts?.clearAfter ? pickedUid : state.userId));

  if (!rawList.length) {
    toast("No DTR history entries available to export.");
    return;
  }

  const cutoffResult = filterDtrRowsByCutoff(rawList, runtime.dtrCutoffKey || undefined);
  const list = opts?.clearAfter
    ? cutoffResult.rows
    : (cutoffResult.rows.length ? cutoffResult.rows : sortDtrEntriesAscending(rawList));
  if (!list.length) {
    toast("No DTR history entries available for this cutoff period.");
    return;
  }

  toast("Generating official DTR PDF…");
  try {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 11;
    const contentW = pageW - marginX * 2; // 275mm

    const groups = new Map<string, any[]>();
    list.forEach(d => {
      const uid = String(d.user_id || state.userId || "unknown");
      if (!groups.has(uid)) groups.set(uid, []);
      groups.get(uid)!.push(d);
    });

    let pageIdx = 0;
    for (const [uid, empRows] of groups.entries()) {
      if (pageIdx > 0) doc.addPage();
      pageIdx++;

      const dayMetaMap = new Map<string, { firstIn: string | null; lastOut: string | null; mins: number; nsRepair: boolean }>();
      empRows.forEach(d => {
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

      const tableRows = empRows.map(d => {
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

        const tIn = formatPdfTime12h(d.time_in);
        const tOut = formatPdfTime12h(capDtrTimeOut(d.time_in, d.time_out, ruleOpts));
        const timeRange = (tIn && tOut) ? `${tIn} - ${tOut}` : (tIn || tOut || "—");
        const desc = [meta.cleanJob, meta.unitName ? `(${meta.unitName})` : ""].filter(Boolean).join(" ") || meta.unitName || "";
        const approvedTxt = meta.approvedBy ||
          (isSunday ? "SUNDAY DUTY" : ((hasDailyOt || calculateOtMinutes(d.time_in, d.time_out, ruleOpts) > 0) ? "EXTEND" : ""));

        return [
          fmtHalfSheetDate(d.work_date) || "",
          String(d.location || ""),
          desc,
          timeRange,
          approvedTxt,
        ];
      });

      autoTable(doc, {
        startY: 14,
        margin: { left: marginX, right: marginX, bottom: 26 },
        head: [
          [{ content: "DAILY TIME RECORD & AUTHORITY TO CONDUCT OVERTIME", colSpan: 5, styles: { font: "times", fontStyle: "bold", fontSize: 15, halign: "center", valign: "middle", cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 } } }],
          [
            { content: "DATE", styles: { font: "times", fontStyle: "bolditalic", fontSize: 9.5 } },
            { content: "LOCATION", styles: { font: "times", fontStyle: "bolditalic", fontSize: 9.5 } },
            { content: "WORK DESCRIPTION", styles: { font: "times", fontStyle: "bolditalic", fontSize: 9.5 } },
            { content: "TIME START/END", styles: { font: "times", fontStyle: "bolditalic", fontSize: 9.5 } },
            { content: "APPROVED BY:", styles: { font: "times", fontStyle: "bolditalic", fontSize: 9.5 } },
          ],
        ],
        body: tableRows,
        showHead: "everyPage",
        theme: "grid",
        styles: {
          font: "times",
          fontStyle: "bold",
          fontSize: 9.5,
          cellPadding: { top: 1.7, bottom: 1.7, left: 2.2, right: 2.2 },
          textColor: [0, 0, 0],
          fillColor: [255, 255, 255],
          lineColor: [0, 0, 0],
          lineWidth: 0.35,
          halign: "center",
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.35,
          halign: "center",
          valign: "middle",
        },
        columnStyles: {
          0: { cellWidth: contentW * 0.11 },
          1: { cellWidth: contentW * 0.20 },
          2: { cellWidth: contentW * 0.37, fontSize: 9 },
          3: { cellWidth: contentW * 0.19 },
          4: { cellWidth: contentW * 0.13 },
        },
      });

      let sigY = Number((doc as any).lastAutoTable?.finalY || 120) + 12;
      if (sigY + 18 > pageH - 8) {
        doc.addPage();
        sigY = 28;
      }

      const sigW = 88;
      const sigX = marginX;
      const isOwn = String(uid) === String(state.userId || "");
      const sigUrl = isOwn ? String(runtime.activeDtrSigDataUrl || "") : "";
      if (sigUrl && sigUrl.startsWith("data:image/")) {
        try {
          const fmt = sigUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(sigUrl, fmt, sigX + (sigW - 46) / 2, sigY - 12.5, 46, 15.5);
        } catch {}
      }

      const empName = (profileName(uid) || state.profile?.full_name || state.email || "EMPLOYEE").toUpperCase();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(empName, sigX + sigW / 2, sigY + 1.5, { align: "center" });

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.42);
      doc.line(sigX, sigY + 3.2, sigX + sigW, sigY + 3.2);
      doc.line(sigX, sigY + 4.2, sigX + sigW, sigY + 4.2);

      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(8.5);
      doc.text("Signature Over Printed Name of Employee", sigX + sigW / 2, sigY + 8.4, { align: "center" });
    }

    const filename = `eesi-dtr-${stamp()}.pdf`;
    doc.save(filename);
    if (opts?.clearAfter) {
      const exportedIds = list.map(d => String(d.id));
      if (hooks.completeDtrExportStep) {
        await hooks.completeDtrExportStep("pdf", exportedIds);
      } else {
        await hooks.clearDtrAfterExport?.(exportedIds);
        toast("Exported " + filename + " and cleared DTR");
      }
    } else {
      toast("Exported " + filename);
    }
  } catch (err: any) {
    console.error("DTR PDF export failed:", err);
    toast("PDF export failed: " + (err?.message || err));
  }
}

/* ==================== PAYSLIP PDF & EXCEL (.XLSX) EXPORTS ==================== */
function fmtPayslipPeriodDate(iso: string): string {
  const m = String(iso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}-${m[3]}-${m[1]}` : String(iso || "");
}

function fmtPayslipAmt(n: number, zeroAsDash = true): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || (zeroAsDash && Math.abs(v) < 0.005)) return "-";
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPayslipHrs(n: number): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || v <= 0) return "0";
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
}

export async function exportPayslipPdf(rec: PayslipRecord): Promise<void> {
  toast("Generating Payslip PDF…");
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const left = 14;
    const colW = [50, 12, 12, 34, 42, 32]; // Total 182mm across A4 (210mm)
    const totalW = colW.reduce((s, w) => s + w, 0);
    const colX: number[] = [];
    let curX = left;
    colW.forEach(w => { colX.push(curX); curX += w; });
    const rowH = 7.2;
    let y = 20;

    const drawGridRow = (
      cells: Array<{ text: string; span?: number; align?: "left" | "center" | "right"; bold?: boolean; topBorder?: boolean; doubleBottom?: boolean }>
    ) => {
      let idx = 0;
      cells.forEach(c => {
        const span = c.span || 1;
        const x = colX[idx];
        const w = colW.slice(idx, idx + span).reduce((s, v) => s + v, 0);
        doc.setDrawColor(212, 212, 216);
        doc.setLineWidth(0.2);
        doc.rect(x, y, w, rowH);
        if (c.topBorder) {
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.45);
          doc.line(x, y, x + w, y);
        }
        if (c.doubleBottom) {
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.38);
          doc.line(x, y + rowH - 0.85, x + w, y + rowH - 0.85);
          doc.line(x, y + rowH, x + w, y + rowH);
        }
        if (c.text) {
          doc.setFont("helvetica", c.bold ? "bold" : "normal");
          doc.setFontSize(c.bold ? 10 : 9.5);
          doc.setTextColor(0, 0, 0);
          const pad = 2.2;
          const tx = c.align === "center" ? x + w / 2 : c.align === "right" ? x + w - pad : x + pad;
          doc.text(c.text, tx, y + rowH * 0.67, { align: c.align || "left" });
        }
        idx += span;
      });
      y += rowH;
    };

    const periodText = `${fmtPayslipPeriodDate(rec.period_start)} to ${fmtPayslipPeriodDate(rec.period_end)}`;
    drawGridRow([{ text: "EESI ELEVATORS, INC.", span: 4, align: "center", bold: true }, { text: "", span: 2 }]);
    drawGridRow([{ text: "PAY SLIP", span: 4, align: "center", bold: true }, { text: "", span: 2 }]);
    drawGridRow([{ text: "Employee" }, { text: rec.employee_name || "Employee", span: 3 }, { text: "" }, { text: "" }]);
    drawGridRow([{ text: "Pay Period" }, { text: periodText, span: 3 }, { text: "" }, { text: "" }]);
    drawGridRow([{ text: "Earnings" }, { text: "" }, { text: "" }, { text: "Amount", align: "center" }, { text: "" }, { text: "" }]);
    drawGridRow([
      { text: "Basic Pay" }, { text: "" }, { text: "" }, { text: fmtPayslipAmt(rec.basic_pay), align: "right" },
      { text: "Deductions" }, { text: "Amount", align: "center" },
    ]);
    drawGridRow([
      { text: "overtime" }, { text: fmtPayslipHrs(rec.overtime_hours), align: "right" }, { text: "hrs" }, { text: fmtPayslipAmt(rec.overtime_amount), align: "right" },
      { text: "sss" }, { text: fmtPayslipAmt(rec.sss), align: "right" },
    ]);
    drawGridRow([
      { text: "night diff" }, { text: fmtPayslipHrs(rec.night_diff_hours), align: "right" }, { text: "hrs" }, { text: fmtPayslipAmt(rec.night_diff_amount), align: "right" },
      { text: "philhealth" }, { text: fmtPayslipAmt(rec.philhealth), align: "right" },
    ]);
    drawGridRow([
      { text: "" }, { text: "" }, { text: "" }, { text: "-", align: "right" },
      { text: "pag-ibig" }, { text: fmtPayslipAmt(rec.pagibig), align: "right" },
    ]);
    drawGridRow([
      { text: "" }, { text: "" }, { text: "" }, { text: "-", align: "right" },
      { text: "cash advance" }, { text: fmtPayslipAmt(rec.cash_advance), align: "right" },
    ]);
    drawGridRow([
      { text: "" }, { text: "" }, { text: "" }, { text: "-", align: "right" },
      { text: "absent" }, { text: fmtPayslipAmt(rec.absent), align: "right" },
    ]);
    drawGridRow([
      { text: "transpo allow/food allow." }, { text: "" }, { text: "" }, { text: fmtPayslipAmt(rec.allowance), align: "right" },
      { text: "abuloy" }, { text: fmtPayslipAmt(rec.abuloy), align: "right" },
    ]);
    drawGridRow([
      { text: "Total Earnings" }, { text: "" }, { text: "" }, { text: fmtPayslipAmt(rec.total_earnings), align: "right", topBorder: true },
      { text: "Total Deductions" }, { text: fmtPayslipAmt(rec.total_deductions), align: "right", topBorder: true },
    ]);
    drawGridRow([
      { text: "" }, { text: "" }, { text: "" }, { text: "" },
      { text: "Net Pay", bold: true, topBorder: true, doubleBottom: true },
      { text: fmtPayslipAmt(rec.net_pay, false), align: "right", bold: true, topBorder: true, doubleBottom: true },
    ]);

    doc.setDrawColor(180, 185, 195);
    doc.setLineWidth(0.25);
    doc.rect(left, 20, totalW, y - 20);

    const filename = `eesi-payslip-${safeFileSlug(rec.employee_name)}-${rec.period_start || stamp()}.pdf`;
    doc.save(filename);
    toast("Exported " + filename);
  } catch (err: any) {
    console.error("Payslip PDF export failed:", err);
    toast("PDF export failed: " + (err?.message || err));
  }
}

export function exportPayslipXlsx(rec: PayslipRecord): void {
  const periodText = `${fmtPayslipPeriodDate(rec.period_start)} to ${fmtPayslipPeriodDate(rec.period_end)}`;
  const numOrDash = (v: number, dashWhenZero = true): number | string => {
    const n = Number(v || 0);
    if (!Number.isFinite(n) || (dashWhenZero && Math.abs(n) < 0.005)) return "-";
    return Number(n.toFixed(2));
  };
  const aoa: Array<Array<string | number>> = [
    ["EESI ELEVATORS, INC.", "", "", "", "", ""],
    ["PAY SLIP", "", "", "", "", ""],
    ["Employee", rec.employee_name || "", "", "", "", ""],
    ["Pay Period", periodText, "", "", "", ""],
    ["Earnings", "", "", "Amount", "", ""],
    ["Basic Pay", "", "", numOrDash(rec.basic_pay), "Deductions", "Amount"],
    ["overtime", Number(rec.overtime_hours || 0), "hrs", numOrDash(rec.overtime_amount), "sss", numOrDash(rec.sss)],
    ["night diff", Number(rec.night_diff_hours || 0), "hrs", numOrDash(rec.night_diff_amount), "philhealth", numOrDash(rec.philhealth)],
    ["", "", "", "-", "pag-ibig", numOrDash(rec.pagibig)],
    ["", "", "", "-", "cash advance", numOrDash(rec.cash_advance)],
    ["", "", "", "-", "absent", numOrDash(rec.absent)],
    ["transpo allow/food allow.", "", "", numOrDash(rec.allowance), "abuloy", numOrDash(rec.abuloy)],
    ["Total Earnings", "", "", numOrDash(rec.total_earnings), "Total Deductions", numOrDash(rec.total_deductions)],
    ["", "", "", "", "Net Pay", numOrDash(rec.net_pay, false)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } },
  ];
  ws["!cols"] = [{ wch: 26 }, { wch: 8 }, { wch: 7 }, { wch: 15 }, { wch: 20 }, { wch: 15 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pay Slip");
  const filename = `eesi-payslip-${safeFileSlug(rec.employee_name)}-${rec.period_start || stamp()}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast("Exported " + filename);
}

