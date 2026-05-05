// ============================================================
// AI Max Negative IQ — Fetcher Script
// Ort: Google Ads > Tools > Skripte
// Läuft täglich per Zeitplan
// ============================================================

function main() {
  // ── KONFIGURATION ──────────────────────────────────────────
  const SPREADSHEET_URL = 'DEINE_SHEET_URL_HIER';
  const SHEET_NAME      = 'SearchTerms';
  const LOOKBACK_DAYS   = 'LAST_30_DAYS';  // oder LAST_7_DAYS, LAST_14_DAYS
  const MIN_CLICKS      = 1;               // Nur Terms mit mindestens X Klicks
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
    'KI-Begründung',     // I
    'Korrektur',         // J
    'Validiert ✅',      // K
    'Target Match Type', // L
    'Export Ziel',       // M
    'Status'             // N
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }

  // Bestehende SearchTerms einlesen für Dedup-Check
  const existingData = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    : [];

  // Index: "CampaignName|||SearchTerm" → Zeilennummer (1-basiert) im Sheet
  // Nur Zeilen die noch nicht "Verarbeitet" sind
  const existingIndex = {};
  existingData.forEach((row, idx) => {
    const statusVal = String(row[13]).trim(); // Spalte N (Index 13)
    if (statusVal !== 'Verarbeitet') {
      const key = `${row[0]}|||${row[1]}`;
      existingIndex[key] = idx + 2; // +2: Header-Zeile + 0-basierter Index
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
      // Term existiert bereits im Sheet → Klicks/Conversions aggregieren
      const sheetRow = existingIndex[key];
      const existingClicks = Number(sheet.getRange(sheetRow, 5).getValue()) || 0;
      const existingConv   = Number(sheet.getRange(sheetRow, 6).getValue()) || 0;
      sheet.getRange(sheetRow, 5).setValue(existingClicks + clicks);
      sheet.getRange(sheetRow, 6).setValue(existingConv   + conv);
      updatedCount++;
    } else if (!existingIndex.hasOwnProperty(key)) {
      // Neuer Term → in neue Zeile schreiben
      newRows.push([
        camp,     // A Campaign
        term,     // B SearchTerm
        kw,       // C Triggered Keyword
        match,    // D Triggered Match
        clicks,   // E Clicks
        conv,     // F Conversions
        'Pending',// G Classification
        '',       // H Confidence
        '',       // I KI-Begründung
        '',       // J Korrektur
        false,    // K Validiert
        '',       // L Target Match Type
        '',       // M Export Ziel
        ''        // N Status
      ]);
      // Mit 0 markieren: innerhalb dieses Report-Laufs bereits gesehen, aber noch nicht im Sheet
      existingIndex[key] = 0;
    }
    // existingIndex[key] === 0 → Term kam im Report doppelt vor → überspringen
  }

  if (newRows.length > 0) {
    // Header sicherstellen
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    }
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }

  console.log(`--- Fetcher abgeschlossen ---`);
  console.log(`Neue Terms:         ${newRows.length}`);
  console.log(`Aggregiert (dedup): ${updatedCount}`);
}
