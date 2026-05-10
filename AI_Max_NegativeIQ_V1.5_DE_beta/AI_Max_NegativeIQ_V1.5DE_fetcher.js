// ============================================================
// AI Max Negative IQ V1.5 DE — Fetcher Script
// Location: Google Ads > Tools > Scripts
// Runs daily on a schedule
// ============================================================

function main() {

  // ── CONFIGURATION ──────────────────────────────────────────
  const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1QElpjSapCqKwZW2-WYUEGYwMJTvk2gxLkyawcTYFq7g/edit?gid=775828999#gid=775828999';
  const SHEET_NAME      = 'SearchTerms';
  const LOOKBACK_DAYS   = 'LAST_30_DAYS';  // LAST_7_DAYS | LAST_14_DAYS | LAST_30_DAYS
  const MIN_CLICKS      = 1;               // only terms with at least X clicks
  // ──────────────────────────────────────────────────────────

  const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  fetchSearchTerms(ss, SHEET_NAME, LOOKBACK_DAYS, MIN_CLICKS);
}


// ============================================================
// Standard Search Campaigns
// ============================================================

function fetchSearchTerms(ss, sheetName, lookbackDays, minClicks) {

  const headers = [
    'Campaign',          // A
    'SearchTerm',        // B
    'Triggered Keyword', // C
    'Triggered Match',   // D
    'Clicks',            // E
    'Conversions',       // F
    'Classification',    // G
    'Confidence',        // H
    'AI Reason',         // I
    'Correction',        // J
    'Validated ✅',      // K
    'Target Match Type', // L
    'Export Target',     // M
    'Status'             // N
  ];

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }

  // Read existing rows for dedup (skip rows with Status = 'Processed')
  const existingData = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    : [];

  // Index: "Campaign|||SearchTerm" → sheet row number (1-based), or 0 if seen this run
  const existingIndex = {};
  existingData.forEach((row, idx) => {
    const statusVal = String(row[13]).trim();
    if (statusVal !== 'Processed') {
      const key = `${row[0]}|||${row[1]}`;
      existingIndex[key] = idx + 2; // +2: 1 header row + 0-based offset
    }
  });

  const query = `
    SELECT
      campaign.name,
      search_term_view.search_term,
      segments.keyword.info.text,
      segments.keyword.info.match_type,
      metrics.clicks,
      metrics.conversions
    FROM search_term_view
    WHERE metrics.clicks >= ${minClicks}
    AND segments.date DURING ${lookbackDays}
    ORDER BY metrics.clicks DESC
  `;

  const report      = AdsApp.search(query);
  const newRows     = [];
  let   updatedCount = 0;

  while (report.hasNext()) {
    const row   = report.next();
    const camp  = row.campaign.name;
    const term  = row.searchTermView.searchTerm;
    const kw    = row.segments.keyword.info.text;
    const match = row.segments.keyword.info.matchType;
    const clicks= Number(String(row.metrics.clicks).replace(/,/g, ''))      || 0;  // strip commas, force numeric
    const conv  = Number(String(row.metrics.conversions).replace(/,/g, '')) || 0;  // strip commas, force numeric
    const key   = `${camp}|||${term}`;

    if (existingIndex.hasOwnProperty(key) && existingIndex[key] > 0) {
      // Already in sheet → aggregate
      const sheetRow   = existingIndex[key];
      const prevClicks = Number(sheet.getRange(sheetRow, 5).getValue()) || 0;
      const prevConv   = Number(sheet.getRange(sheetRow, 6).getValue()) || 0;
      sheet.getRange(sheetRow, 5).setValue(prevClicks + clicks);
      sheet.getRange(sheetRow, 6).setValue(prevConv   + conv);
      updatedCount++;
    } else if (!existingIndex.hasOwnProperty(key)) {
      // New term
      newRows.push([
        camp, term, kw, match, clicks, conv,
        'Pending', '', '', '', false, '', '', ''
      ]);
      existingIndex[key] = 0; // mark seen this run
    }
    // key === 0 → duplicate within this report run → skip
  }

  if (newRows.length > 0) {
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    }
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }

  console.log(`--- Search Fetcher ---`);
  console.log(`New terms:          ${newRows.length}`);
  console.log(`Aggregated (dedup): ${updatedCount}`);
}
