// ============================================================
// KI-Keyword-Analyzer V3.0 — Uploader Script
// Ort: Google Ads > Tools > Skripte
// Bucht Negatives aus dem Sheet ins Google Ads Konto
// ============================================================

function main() {
  // ── KONFIGURATION ──────────────────────────────────────────
  const SPREADSHEET_URL    = 'DEINE_SHEET_URL_HIER';
  const EXPORT_SHEET_NAME  = 'Negative_Export';
  // ──────────────────────────────────────────────────────────

  const ss    = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  const sheet = ss.getSheetByName(EXPORT_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) {
    console.log('Keine Daten zum Hochladen gefunden.');
    return;
  }

  // Spalten: Liste/Ziel | Keyword | Match Type | Herkunftskampagne | Kategorie
  const data         = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  let successCount   = 0;
  let errorCount     = 0;
  const successRows  = []; // Zeilen-Indizes (0-basiert) die erfolgreich waren

  console.log(`--- Start Upload: ${data.length} Keywords ---`);

  for (let i = 0; i < data.length; i++) {
    const target    = String(data[i][0]).trim();
    const kwText    = String(data[i][1]).trim();
    const matchType = String(data[i][2]).trim();
    const campName  = String(data[i][3]).trim();
    const category  = String(data[i][4]).trim();

    if (!kwText || !target) {
      console.log(`⚠️ Zeile ${i + 2}: Leeres Keyword oder Ziel — übersprungen.`);
      errorCount++;
      continue;
    }

    // Match-Type-Formatierung
    let formatted;
    if      (matchType === 'Exact')  formatted = '[' + kwText + ']';
    else if (matchType === 'Phrase') formatted = '"' + kwText + '"';
    else                             formatted = kwText; // Broad

    try {
      if (target.toLowerCase() === 'kampagne') {
        // Als Kampagnen-Negatives einbuchen
        const campIter = AdsApp.campaigns().withCondition(`Name = "${campName}"`).get();
        if (campIter.hasNext()) {
          campIter.next().createNegativeKeyword(formatted);
          console.log(`✅ Kampagne "${campName}" | ${category}: ${formatted}`);
          successCount++;
          successRows.push(i);
        } else {
          console.log(`⚠️ Kampagne nicht gefunden: "${campName}" — Keyword: ${formatted}`);
          errorCount++;
        }
      } else {
        // Als Listen-Negatives einbuchen
        const listIter = AdsApp.negativeKeywordLists()
          .withCondition(`Name = "${target}"`).get();
        if (listIter.hasNext()) {
          listIter.next().addNegativeKeyword(formatted);
          console.log(`✅ Liste "${target}" | ${category}: ${formatted}`);
          successCount++;
          successRows.push(i);
        } else {
          console.log(`⚠️ Negativ-Liste nicht gefunden: "${target}" — Keyword: ${formatted}`);
          console.log(`   → Tipp: Namen in Config!A4 mit Google Ads Listennamen abgleichen (Groß/Kleinschreibung!)`);
          errorCount++;
        }
      }
    } catch (e) {
      console.log(`❌ Fehler bei "${kwText}": ${e.toString()}`);
      errorCount++;
    }
  }

  // Nur erfolgreich hochgeladene Zeilen löschen (von unten nach oben)
  if (successRows.length > 0) {
    const rowsToDelete = successRows.map(i => i + 2); // Sheet-Zeile (1-basiert + Header)
    rowsToDelete.sort((a, b) => b - a); // von unten nach oben löschen
    rowsToDelete.forEach(rowNum => sheet.deleteRow(rowNum));
    console.log(`🗑️  ${successRows.length} Zeilen aus Sheet entfernt.`);
  }

  console.log(`--- Upload beendet ---`);
  console.log(`Erfolgreich: ${successCount}`);
  console.log(`Fehler/Warnungen: ${errorCount}`);
  if (errorCount > 0) {
    console.log(`→ Fehlgeschlagene Keywords verbleiben im Sheet zur manuellen Korrektur.`);
  }
}
