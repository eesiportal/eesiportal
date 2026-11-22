import {
  $,
  PMS_ITEMS,
  calculateDtrHours,
  calculateOtMinutes,
  esc,
  filterDtrRowsByCutoff,
  fmtDate,
  fmtDay,
  fmtTableDate,
  hooks,
  isManager,
  parseDtrJobMeta,
  parseRecMeta,
  parseReportUnit,
  profileName,
  profileOf,
  roleLabel,
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

/* ==================== FULL DTR HISTORY PROFESSIONAL PDF EXPORT ==================== */
function formatPdfTime(t: string | null | undefined): string {
  const s = String(t || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s || "—";
  let h = Number(m[1]);
  const min = m[2];
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${suffix}`;
}

export async function exportDtrHistoryPdf(opts: { clearAfter?: boolean } = {}): Promise<void> {
  const pickedUid = isManager() && val("dtrPreviewEmployee") ? val("dtrPreviewEmployee") : String(state.userId || "");
  const rawList = isManager() && !opts?.clearAfter
    ? [...(state.dtrs || [])]
    : (state.dtrs || []).filter(d => String(d.user_id) === String(opts?.clearAfter ? pickedUid : state.userId));

  if (!rawList.length) {
    toast("No DTR history entries available to export.");
    return;
  }

  const cutoffResult = filterDtrRowsByCutoff(rawList, runtime.dtrCutoffKey || undefined);
  const list = cutoffResult.rows.length ? cutoffResult.rows : sortDtrEntriesAscending(rawList);
  if (!list.length) {
    toast("No DTR history entries available to export.");
    return;
  }

  toast("Generating DTR audit PDF…");
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
    const marginX = 12;
    const contentW = pageW - marginX * 2;

    const sortedDates = list
      .map(d => String(d.work_date || ""))
      .filter(Boolean)
      .sort();
    const oldestDate = sortedDates[0] ? fmtDay(sortedDates[0]) : "—";
    const newestDate = sortedDates[sortedDates.length - 1] ? fmtDay(sortedDates[sortedDates.length - 1]) : "—";
    const dateRange = oldestDate === newestDate ? newestDate : `${oldestDate} to ${newestDate}`;

    const staffIds = new Set(list.map(d => String(d.user_id || "")).filter(Boolean));
    let totalHours = 0;
    let totalRegularHours = 0;
    let totalApprovedOtHours = 0;
    let approvedOtCount = 0;
    const pendingOtCount = 0;

    const tableRows = list.map((d, idx) => {
      const p = profileOf(d.user_id);
      const jobMeta = parseDtrJobMeta(d.job, d.approved_by);
      const isSunday = d.work_date ? new Date(String(d.work_date) + "T00:00:00").getDay() === 0 : false;
      const hrs = calculateDtrHours(d.time_in, d.time_out, true);
      const otMins = calculateOtMinutes(d.time_in, d.time_out);
      const otHrs = otMins / 60;
      totalHours += hrs;
      if (otMins > 0) {
        approvedOtCount++;
        totalApprovedOtHours += otHrs;
        totalRegularHours += Math.max(0, hrs - otHrs);
      } else {
        totalRegularHours += hrs;
      }

      const otLabel =
        jobMeta.approvedBy ||
        (isSunday
          ? "SUNDAY DUTY"
          : otMins > 0
            ? `EXTEND (+${otHrs.toFixed(1)}h)`
            : "Standard");

      const displayJob = [jobMeta.unitName ? `[${jobMeta.unitName}]` : "", jobMeta.cleanJob].filter(Boolean).join(" ") || "—";

      return [
        String(idx + 1),
        fmtTableDate(d.work_date) || "—",
        profileName(d.user_id) || "Member",
        [p?.team, p?.area].filter(Boolean).join(" / ") || "—",
        d.location || "—",
        displayJob,
        formatPdfTime(d.time_in),
        formatPdfTime(d.time_out),
        hrs.toFixed(2),
        otLabel,
      ];
    });

    // Header Banner
    doc.setFillColor(11, 27, 56);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setFillColor(30, 108, 242);
    doc.rect(0, 24, pageW, 1.5, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("EESI ELEVATORS INC.", marginX, 10.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(191, 219, 254);
    doc.text("DAILY TIME RECORD (DTR) — FULL AUDIT & MANAGEMENT HISTORY", marginX, 17);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`DOC ID: EESI-DTR-${stamp()}`, pageW - marginX, 9.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - marginX, 14.5, { align: "right" });
    doc.text(
      isManager() ? "SCOPE: ALL PERSONNEL AUDIT" : "SCOPE: PERSONAL ATTENDANCE RECORD",
      pageW - marginX,
      19.5,
      { align: "right" }
    );

    // Metadata & KPI Card
    const metaY = 29;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX, metaY, contentW, 20, 2, 2, "FD");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("PREPARED BY:", marginX + 4, metaY + 6.5);
    doc.text("AUDIT PERIOD:", marginX + 4, metaY + 12.2);
    doc.text("OVERTIME SUMMARY:", marginX + 4, metaY + 17.5);

    doc.setFont("helvetica", "normal");
    const preparedName = state.profile?.full_name || state.email || "Authorized Member";
    doc.text(`${preparedName} (${roleLabel(state.role)})`, marginX + 34, metaY + 6.5);
    doc.text(dateRange, marginX + 34, metaY + 12.2);
    doc.text(
      `${approvedOtCount} approved OT entry(ies) · ${pendingOtCount} pending OT entry(ies)`,
      marginX + 42,
      metaY + 17.5
    );

    // KPI Mini-Boxes on right half of summary strip
    const kpis = [
      { label: "TOTAL LOGS", value: String(list.length) },
      { label: "PERSONNEL", value: String(staffIds.size) },
      { label: "REGULAR HRS", value: totalRegularHours.toFixed(2) },
      { label: "APPROVED OT", value: totalApprovedOtHours.toFixed(2) },
      { label: "TOTAL HOURS", value: totalHours.toFixed(2) },
    ];
    const kpiW = 28;
    const kpiGap = 2.5;
    const kpiStartX = pageW - marginX - (kpis.length * kpiW + (kpis.length - 1) * kpiGap) - 3;

    kpis.forEach((k, i) => {
      const kx = kpiStartX + i * (kpiW + kpiGap);
      const isLast = i === kpis.length - 1;
      doc.setFillColor(isLast ? 11 : 255, isLast ? 27 : 255, isLast ? 56 : 255);
      doc.setDrawColor(isLast ? 11 : 203, isLast ? 27 : 213, isLast ? 56 : 225);
      doc.roundedRect(kx, metaY + 2.8, kpiW, 14.4, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(isLast ? 147 : 100, isLast ? 197 : 116, isLast ? 253 : 139);
      doc.text(k.label, kx + kpiW / 2, metaY + 7.2, { align: "center" });
      doc.setFontSize(10.5);
      doc.setTextColor(isLast ? 255 : 15, isLast ? 255 : 23, isLast ? 255 : 42);
      doc.text(k.value, kx + kpiW / 2, metaY + 13.8, { align: "center" });
    });

    // Main DTR Audit Table
    autoTable(doc, {
      startY: 53,
      margin: { left: marginX, right: marginX, bottom: 18 },
      head: [[
        "#",
        "Work Date",
        "Employee",
        "Team / Area",
        "Work Site / Location",
        "Work Description / Unit",
        "Time In",
        "Time Out",
        "Hours",
        "OT Status",
      ]],
      body: tableRows,
      foot: [[
        "",
        "TOTAL",
        `${staffIds.size} Staff`,
        "",
        "",
        `${list.length} Recorded DTR Entries`,
        "",
        "",
        totalHours.toFixed(2),
        `${totalApprovedOtHours.toFixed(2)}h OT`,
      ]],
      showHead: "everyPage",
      showFoot: "lastPage",
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.8,
        cellPadding: 2.1,
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [11, 27, 56],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.8,
        halign: "left",
      },
      footStyles: {
        fillColor: [226, 232, 240],
        textColor: [11, 27, 56],
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 9, halign: "center" },
        1: { cellWidth: 23, halign: "center" },
        2: { cellWidth: 36 },
        3: { cellWidth: 26 },
        4: { cellWidth: 42 },
        5: { cellWidth: 59 },
        6: { cellWidth: 18, halign: "center" },
        7: { cellWidth: 18, halign: "center" },
        8: { cellWidth: 16, halign: "right", fontStyle: "bold" },
        9: { cellWidth: 26, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 9) {
          const txt = String(data.cell.raw || "");
          if (txt.startsWith("OT Approved")) {
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = "bold";
          } else if (txt.startsWith("OT Pending")) {
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [71, 85, 105];
          }
        }
      },
    });

    // Audit Sign-Off Block
    const finalY = Number((doc as any).lastAutoTable?.finalY || 140);
    let signY = finalY + 10;
    if (signY + 26 > pageH - 16) {
      doc.addPage();
      signY = 22;
    }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      "Certification: I certify that the Daily Time Record entries listed above accurately reflect verified field attendance and approved overtime.",
      marginX,
      signY
    );

    const sigBoxY = signY + 14;
    doc.setDrawColor(100, 116, 139);
    doc.line(marginX, sigBoxY, marginX + 82, sigBoxY);
    doc.line(pageW - marginX - 82, sigBoxY, pageW - marginX, sigBoxY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(preparedName.toUpperCase(), marginX, sigBoxY + 4.5);
    doc.text("OPERATIONS / HR AUDIT APPROVAL", pageW - marginX - 82, sigBoxY + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Prepared By (${roleLabel(state.role)})`, marginX, sigBoxY + 8.5);
    doc.text("Authorized Signature & Date", pageW - marginX - 82, sigBoxY + 8.5);

    // Per-page confidential footer
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, pageH - 11, pageW - marginX, pageH - 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("EESI Elevators Inc. · Confidential DTR Audit Report", marginX, pageH - 6.5);
      doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 6.5, { align: "right" });
    }

    const filename = `eesi-dtr-audit-history-${stamp()}.pdf`;
    doc.save(filename);
    if (opts?.clearAfter) {
      await hooks.clearDtrAfterExport?.(list.map(d => String(d.id)));
      toast("Exported " + filename + " and cleared DTR");
    } else {
      toast("Exported " + filename);
    }
  } catch (err: any) {
    console.error("DTR PDF export failed:", err);
    toast("PDF export failed: " + (err?.message || err));
  }
}
