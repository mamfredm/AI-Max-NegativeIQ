// ============================================================
// KI-Keyword-Analyzer V3.0 — Fetcher Script
// Location: Google Ads > Tools > Scripts
// Runs daily on a schedule
// ============================================================

function main() {
  // ── CONFIGURATION ──────────────────────────────────────────
  const SPREADSHEET_URL = 'YOUR_SHEET_URL_HERE';
  const SHEET_NAME      = 'SearchTerms';
  const LOOKBACK_DAYS   = 'LAST_30_DAYS';  // or LAST_7_DAYS, LAST_14_DAYS
  const MIN_CLICKS      = 1;               // Only terms with at least X clicks
  // ──────────────────────────────────────────────────────────

  const ss    = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  let sheet   = ss.getSheetByName(SHEET_NAME);

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

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }

  // Read existing SearchTerms for dedup check
  const existingData = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    : [];

  // Index: "CampaignName|||SearchTerm" → row number (1-based) in sheet
  // Only rows that are not yet "Processed"
  const existingIndex = {};
  existingData.forEach((row, idx) => {
    const statusVal = String(row[13]).trim(); // Column N (index 13)
    if (statusVal !== 'Processed') {
      const key = `${row[0]}|||${row[1]}`;
      existingIndex[key] = idx + 2; // +2: header row + 0-based index
    }
  });

  // GAQL Query
  const query = `
    SELECT
      campaign.name,
      search_term_view.search_term,
      segments.keyword.info.text,
      segments.keyword.info.match_type,
      metrics.clicks,
      metrics.conversions
    FROM search_term_view
    WHERE metrics.clicks >= ${MIN_CLICKS}
    AND segments.date DURING ${LOOKBACK_DAYS}
    ORDER BY metrics.clicks DESC
  `;

  const report = AdsApp.search(query);
  const newRows      = [];
  let   updatedCount = 0;

  while (report.hasNext()) {
    const row   = report.next();
    const camp  = row.campaign.name;
    const term  = row.searchTermView.searchTerm;
    const kw    = row.segments.keyword.info.text;
    const match = row.segments.keyword.info.matchType;
    const clicks= row.metrics.clicks;
    const conv  = row.metrics.conversions;

    const key = `${camp}|||${term}`;

    if (existingIndex.hasOwnProperty(key) && existingIndex[key] > 0) {
      // Term already exists in sheet → aggregate clicks/conversions
      const sheetRow = existingIndex[key];
      const existingClicks = Number(sheet.getRange(sheetRow, 5).getValue()) || 0;
      const existingConv   = Number(sheet.getRange(sheetRow, 6).getValue()) || 0;
      sheet.getRange(sheetRow, 5).setValue(existingClicks + clicks);
      sheet.getRange(sheetRow, 6).setValue(existingConv   + conv);
      updatedCount++;
    } else if (!existingIndex.hasOwnProperty(key)) {
      // New term → write to new row
      newRows.push([
        camp,     // A Campaign
        term,     // B SearchTerm
        kw,       // C Triggered Keyword
        match,    // D Triggered Match
        clicks,   // E Clicks
        conv,     // F Conversions
        'Pending',// G Classification
        '',       // H Confidence
        '',       // I AI Reason
        '',       // J Correction
        false,    // K Validated
        '',       // L Target Match Type
        '',       // M Export Target
        ''        // N Status
      ]);
      // Mark as 0: already seen in this report run, but not yet in sheet
      existingIndex[key] = 0;
    }
    // existingIndex[key] === 0 → term appeared twice in report → skip
  }

  if (newRows.length > 0) {
    // Ensure header exists
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    }
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }

  console.log(`--- Fetcher completed ---`);
  console.log(`New terms:           ${newRows.length}`);
  console.log(`Aggregated (dedup):  ${updatedCount}`);
}
