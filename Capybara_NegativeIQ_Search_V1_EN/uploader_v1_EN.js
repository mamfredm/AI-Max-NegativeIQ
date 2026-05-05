// ============================================================
// AI Max Negative IQ v1 — Uploader Script
// Location: Google Ads > Tools > Scripts
// Books negatives from the sheet into your Google Ads account
// ============================================================

function main() {
  // ── CONFIGURATION ──────────────────────────────────────────
  const SPREADSHEET_URL    = 'YOUR_SHEET_URL_HERE';
  const EXPORT_SHEET_NAME  = 'Negative_Export';
  // ──────────────────────────────────────────────────────────

  const ss    = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  const sheet = ss.getSheetByName(EXPORT_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) {
    console.log('No data found for upload.');
    return;
  }

  // Columns: List/Target | Keyword | Match Type | Source Campaign | Category
  const data         = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  let successCount   = 0;
  let errorCount     = 0;
  const successRows  = []; // Row indices (0-based) that were successfully uploaded

  console.log(`--- Starting upload: ${data.length} keywords ---`);

  for (let i = 0; i < data.length; i++) {
    const target    = String(data[i][0]).trim();
    const kwText    = String(data[i][1]).trim();
    const matchType = String(data[i][2]).trim();
    const campName  = String(data[i][3]).trim();
    const category  = String(data[i][4]).trim();

    if (!kwText || !target) {
      console.log(`⚠️ Row ${i + 2}: Empty keyword or target — skipped.`);
      errorCount++;
      continue;
    }

    // Match type formatting
    let formatted;
    if      (matchType === 'Exact')  formatted = '[' + kwText + ']';
    else if (matchType === 'Phrase') formatted = '"' + kwText + '"';
    else                             formatted = kwText; // Broad

    try {
      if (target.toLowerCase() === 'campaign') {
        // Book as campaign-level negative
        const campIter = AdsApp.campaigns().withCondition(`Name = "${campName}"`).get();
        if (campIter.hasNext()) {
          campIter.next().createNegativeKeyword(formatted);
          console.log(`✅ Campaign "${campName}" | ${category}: ${formatted}`);
          successCount++;
          successRows.push(i);
        } else {
          console.log(`⚠️ Campaign not found: "${campName}" — Keyword: ${formatted}`);
          errorCount++;
        }
      } else {
        // Book as list-level negative
        const listIter = AdsApp.negativeKeywordLists()
          .withCondition(`Name = "${target}"`).get();
        if (listIter.hasNext()) {
          listIter.next().addNegativeKeyword(formatted);
          console.log(`✅ List "${target}" | ${category}: ${formatted}`);
          successCount++;
          successRows.push(i);
        } else {
          console.log(`⚠️ Negative list not found: "${target}" — Keyword: ${formatted}`);
          console.log(`   → Tip: Cross-check list name in Config!A4 with exact Google Ads list name (case-sensitive!)`);
          errorCount++;
        }
      }
    } catch (e) {
      console.log(`❌ Error for "${kwText}": ${e.toString()}`);
      errorCount++;
    }
  }

  // Delete only successfully uploaded rows (bottom to top)
  if (successRows.length > 0) {
    const rowsToDelete = successRows.map(i => i + 2); // Sheet row (1-based + header)
    rowsToDelete.sort((a, b) => b - a); // Delete from bottom to top
    rowsToDelete.forEach(rowNum => sheet.deleteRow(rowNum));
    console.log(`🗑️  ${successRows.length} rows removed from sheet.`);
  }

  console.log(`--- Upload complete ---`);
  console.log(`Successful:       ${successCount}`);
  console.log(`Errors/Warnings:  ${errorCount}`);
  if (errorCount > 0) {
    console.log(`→ Failed keywords remain in the sheet for manual correction.`);
  }
}
