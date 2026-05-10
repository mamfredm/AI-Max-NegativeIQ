// ============================================================
// AI Max NegativeIQ V1.5DE — GAS Zentral-Skript
// Google Sheet > Erweiterungen > Apps Script

// Changelog V1.5 — UX:
//   - _runAIClassification: upfront alert shows queue size, batch count, estimated duration
//   - per-batch log line restored with term list
//   - _runAIClassification: flush moved from per-row → per-batch (was 720 flushes, now 48)
//   - _runAIClassification: sleep reduced from 2000ms → 500ms (saves ~70s per 700-term run)
//   - _batchWriteToSheet: new helper — groups cell writes by column before flushing
//   - _runPreClassification: batch writes at end instead of per-row setValue calls
//   - Brand tier split: 'Eigene Marke' removed entirely
//   - New categories: Brand Pure (Review), Brand Kombi (Review), Brand Noise (Negativ)
//   - Keyword Lists col A → 'Brand Pure'; col F → 'Brand Noise Terms' (noise modifiers)
//   - Pre-classify: Brand Pure hit → Brand Pure; Noise modifier hit → Brand Noise;
//     Brand name present but no modifier match → AI Queue for Kombi vs Noise
//   - AI prompt updated with brand tier descriptions + examples
//   - learningLoop: Brand Pure → col A, Brand Noise → col F, Brand Kombi → AI examples only
//   - neg_lists registry: Brand_Noise_Negatives pre-filled (⚠️ in Google Ads erstellen!)
//   - Brand Noise auto-routes to Brand_Noise_Negatives on export
// ============================================================

// ─────────────────────────────────────────────────────────────
// MENÜ
// ─────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛠️ AI Max NegativeIQ')
    .addItem('1. Prepare Layout',                          'setupLayout')
    .addSeparator()
    .addItem('2a. Pre-Classify SearchTerms (Config)',      'preClassifySearch')
    .addItem('2b. AI-Classify SearchTerms (AI)',           'aiClassifySearch')
    .addSeparator()
    .addItem('3. Export Validated Data',                   'exportValidated')
    .addItem('4. Update Config (Learning Loop)',           'learningLoop')
    .addSeparator()
    .addItem('🧹 Clear Export Sheets',                    'clearExportSheets')
    .addItem('🔍 Diagnose & Debug',                       'debugDiagnose')
    .addToUi();
}

// ─────────────────────────────────────────────────────────────
// LOGGER HELPER
// ─────────────────────────────────────────────────────────────
function log(msg) {
  console.log('[AI Max NegativeIQ] ' + msg);
}

// ─────────────────────────────────────────────────────────────
// SHARED CONSTANTS
// ─────────────────────────────────────────────────────────────
const SEARCH_SHEET_NAME = 'SearchTerms';
const AI_CONFIG_NAME    = 'AI Config';      // client profile, categories, AI examples, neg_lists
const KW_LISTS_NAME     = 'Keyword Lists';  // Brand / Bestand / Sperrbegriffe / Mitbewerber

const SHEET_HEADERS = [
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

// ─────────────────────────────────────────────────────────────
// 🔍 DIAGNOSE
// ─────────────────────────────────────────────────────────────
function debugDiagnose() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ui  = SpreadsheetApp.getUi();
  let report = '🔍 DIAGNOSE-REPORT\n';
  report += '══════════════════════════════\n\n';

  // ── 1. Sheet-Reiter prüfen ──
  const requiredSheets = [
    SEARCH_SHEET_NAME,
    AI_CONFIG_NAME, KW_LISTS_NAME,
    'Negative_Export', 'Expansion_Ideen'
  ];
  report += '📋 SHEET-REITER:\n';
  requiredSheets.forEach(name => {
    const s = ss.getSheetByName(name);
    report += (s ? '  ✅ ' : '  ❌ FEHLT: ') + name + '\n';
  });
  report += '\n';

  // ── 2. SearchTerms Header prüfen ──
  const stSheet = ss.getSheetByName(SEARCH_SHEET_NAME);
  if (stSheet) {
    const headers = stSheet.getLastRow() > 0
      ? stSheet.getRange(1, 1, 1, stSheet.getLastColumn()).getValues()[0]
      : [];
    report += `📊 SEARCHTERMS HEADER:\n`;
    SHEET_HEADERS.forEach(col => {
      const idx = headers.indexOf(col);
      report += (idx >= 0 ? `  ✅ "${col}" → Spalte ${idx + 1}\n` : `  ❌ FEHLT: "${col}"\n`);
    });
    report += `  Gesamt Zeilen: ${stSheet.getLastRow()} (inkl. Header)\n`;

    if (stSheet.getLastRow() > 1) {
      const classifIdx = headers.indexOf('Classification');
      if (classifIdx >= 0) {
        const data = stSheet.getRange(2, 1, stSheet.getLastRow() - 1, stSheet.getLastColumn()).getValues();
        const counts = {};
        data.forEach(row => {
          const val = String(row[classifIdx] || 'leer').trim() || 'leer';
          counts[val] = (counts[val] || 0) + 1;
        });
        report += '\n  Classification-Verteilung:\n';
        Object.entries(counts).forEach(([k, v]) => {
          const flag = k === 'AI Queue' ? ' ← wartet auf AI-Schritt' : '';
          report += `    "${k}": ${v}x${flag}\n`;
        });
      }
    }
    report += '\n';
  }

  // ── 3. AI Config prüfen ──
  const aiCfgSheet = ss.getSheetByName(AI_CONFIG_NAME);
  if (aiCfgSheet) {
    report += '⚙️ AI CONFIG — CLIENT-PROFIL (A1:B7):\n';
    const profile = aiCfgSheet.getRange('A1:B7').getValues();
    profile.forEach(row => { if (row[0]) report += `  ${row[0]}: "${row[1]}"\n`; });

    const negListsRaw = aiCfgSheet.getRange('A9:B30').getValues()
      .filter(r => String(r[0]).trim() === 'neg_lists' && String(r[1]).trim() !== '');
    report += `\n  Negativ-Listen (neg_lists, ab A9): ${negListsRaw.length} Einträge\n`;
    negListsRaw.forEach(r => report += `    → "${r[1]}"\n`);

    const cats = aiCfgSheet.getRange('E1:G50').getValues().filter(r => r[0] !== '');
    report += `\n  Kategorien (E:G): ${cats.length} Einträge\n`;
    cats.forEach(r => report += `    "${r[0]}" → Aktion: "${r[2]}"\n`);

    const examples = aiCfgSheet.getRange('H1:I50').getValues().filter(r => r[0] !== '');
    report += `\n  KI-Beispiele (H:I): ${examples.length} Einträge\n\n`;
  } else {
    report += `❌ "${AI_CONFIG_NAME}" Sheet fehlt!\n\n`;
  }

  // ── 3b. Keyword Lists prüfen ──
  const kwSheet = ss.getSheetByName(KW_LISTS_NAME);
  if (kwSheet) {
    const lists      = kwSheet.getRange('A4:F1000').getValues();
    const brandCount = lists.filter(r => r[0]).length;
    const kombiCount = lists.filter(r => r[1]).length;
    const exstCount  = lists.filter(r => r[2]).length;
    const ignCount   = lists.filter(r => r[3]).length;
    const compCount  = lists.filter(r => r[4]).length;
    const noiseCount = lists.filter(r => r[5]).length;
    report += `📂 KEYWORD LISTS:\n`;
    report += `    Brand Pure (A):        ${brandCount} Einträge\n`;
    report += `    Brand Kombi (B):       ${kombiCount} Einträge\n`;
    report += `    Bestand (C):           ${exstCount} Einträge\n`;
    report += `    Sperrbegriffe (D):     ${ignCount} Einträge\n`;
    report += `    Mitbewerber (E):       ${compCount} Einträge\n`;
    report += `    Brand Noise Terms (F): ${noiseCount} Einträge\n\n`;
  } else {
    report += `❌ "${KW_LISTS_NAME}" Sheet fehlt!\n\n`;
  }

  // ── 4. API-Key prüfen ──
  const apiKey = PropertiesService.getScriptProperties().getProperty('AIML_API_KEY');
  if (apiKey && apiKey.trim().length > 10) {
    report += `🔑 API-KEY: ✅ Vorhanden (${apiKey.trim().length} Zeichen, endet auf "...${apiKey.trim().slice(-4)}")\n`;
  } else {
    report += `🔑 API-KEY: ❌ FEHLT oder zu kurz!\n  → Zahnrad > Skripteigenschaften > AIML_API_KEY\n`;
  }

  console.log(report);
  ui.alert(report);
}

// ─────────────────────────────────────────────────────────────
// CONFIG LESEN
// Reads from two sheets:
//   AI Config     — client profile, neg_lists, categories, AI examples
//   Keyword Lists — A: Brand Pure, B: Brand Kombi, C: Bestand,
//                   D: Sperrbegriffe, E: Mitbewerber, F: Brand Noise Terms
// ─────────────────────────────────────────────────────────────
function getConfig() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();

  // ── AI Config sheet ──
  const cfg = ss.getSheetByName(AI_CONFIG_NAME);
  if (!cfg) throw new Error(`"${AI_CONFIG_NAME}" Sheet nicht gefunden! Bitte Template neu aufsetzen.`);

  const profile = cfg.getRange('A1:B7').getValues();
  const clientProfile = {};
  profile.forEach(row => { if (row[0]) clientProfile[String(row[0]).trim()] = row[1]; });
  log('AI Config geladen: ' + JSON.stringify(clientProfile));

  const catData    = cfg.getRange('E1:G50').getValues().filter(r => r[0] !== '');
  const categories = catData.map(r => ({
    code: String(r[0]).trim(), description: String(r[1]).trim(), action: String(r[2]).trim()
  }));

  const exampleData = cfg.getRange('H1:I50').getValues().filter(r => r[0] !== '');
  const examples    = exampleData.map(r => ({ term: r[0], category: r[1] }));

  const convProtectRaw = clientProfile['conv_protect'];
  const convProtect    = convProtectRaw !== false && String(convProtectRaw).toUpperCase() !== 'FALSE';

  // ── neg_lists registry (A9:B30, key='neg_lists') ──
  const defaultList = String(clientProfile['default_neg_list'] || 'Wettbewerber_Global');
  const brandNoiseList_default = String(clientProfile['brand_noise_list'] || 'Brand_Noise_Negatives');
  const negListsRaw = cfg.getRange('A9:B30').getValues()
    .filter(r => String(r[0]).trim() === 'neg_lists' && String(r[1]).trim() !== '')
    .map(r => String(r[1]).trim());
  const negLists = negListsRaw.length > 0 ? negListsRaw : [defaultList];
  log('neg_lists: ' + JSON.stringify(negLists));

  // ── Keyword Lists sheet (A4:F1000) ──
  // Col A: Brand Pure     — exact brand names / root forms
  // Col B: Brand Kombi    — brand + geo/product combos with direct intent
  // Col C: Bestand (Aktiv)— active keywords
  // Col D: Sperrbegriffe  — blocking terms
  // Col E: Mitbewerber    — competitor brands
  // Col F: Brand Noise Terms — noise modifiers (erfahrungen, alternative, kündigen…)
  const kwSheet = ss.getSheetByName(KW_LISTS_NAME);
  if (!kwSheet) throw new Error(`"${KW_LISTS_NAME}" Sheet nicht gefunden! Bitte Template neu aufsetzen.`);

  const listData        = kwSheet.getRange('A4:F1000').getValues();
  const brandPureList   = listData.map(r => String(r[0]).toLowerCase()).filter(Boolean);
  const brandKombiList  = listData.map(r => String(r[1]).toLowerCase()).filter(Boolean);
  const existingList    = listData.map(r => String(r[2]).toLowerCase()).filter(Boolean);
  const ignoreList      = listData.map(r => String(r[3]).toLowerCase()).filter(Boolean);
  const competitorList  = listData.map(r => String(r[4]).toLowerCase()).filter(Boolean);
  const brandNoiseTerms = listData.map(r => String(r[5]).toLowerCase()).filter(Boolean);

  return {
    industry:          String(clientProfile['client_industry']  || 'Online-Marketing'),
    clientName:        String(clientProfile['client_name']      || ''),
    defaultList,
    brandNoiseList:    brandNoiseList_default,
    negLists,
    convProtect,
    confWarn:          parseFloat(clientProfile['confidence_warn']) || 0.7,
    batchSize:         parseInt(clientProfile['batch_size'])        || 15,
    categories,
    brandList:         brandPureList,   // kept as brandList for backward compat in AI prompt
    brandPureList,
    brandNoiseTerms,
    brandKombiList,
    existingList,
    ignoreList,
    competitorList,
    examples
  };
}

// ─────────────────────────────────────────────────────────────
// SCHRITT 1: LAYOUT & DROPDOWNS
// ─────────────────────────────────────────────────────────────
function setupLayout() {
  log('setupLayout() gestartet');
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = getConfig();

  const stRows = _setupSheetLayout(ss, SEARCH_SHEET_NAME, cfg);

  _styleExportSheet('Negative_Export');
  _styleExportSheet('Expansion_Ideen');

  log('setupLayout() abgeschlossen');
  SpreadsheetApp.getUi().alert(
    '🛠️ AI Max NegativeIQ V2.4 — Layout abgeschlossen!\n\n' +
    'SearchTerms:     ' + stRows + ' Zeilen gestylt\n' +
    'Negative_Export: ✅\n' +
    'Expansion_Ideen: ✅\n\n' +
    'Export Ziel Dropdown: ' + cfg.negLists.length + ' Listen\n' +
    '(' + cfg.negLists.join(', ') + ')'
  );
}

// ─────────────────────────────────────────────────────────────
// HELPER: Sheet layouten
// ─────────────────────────────────────────────────────────────
function _setupSheetLayout(ss, sheetName, cfg) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    log('Neues Sheet erstellt: ' + sheetName);
  }

  sheet.setHiddenGridlines(true);
  const colWidths = [180, 260, 180, 110, 70, 100, 200, 95, 300, 150, 95, 130, 180, 120];
  colWidths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  const hdrColors = [
    '#1A1A2E','#1A1A2E','#1A1A2E','#1A1A2E',
    '#1A1A2E','#1A1A2E',
    '#0F3460','#0F3460','#0F3460',
    '#CC0000','#0F6E56',
    '#555555','#555555','#555555'
  ];

  sheet.setRowHeight(1, 30);
  sheet.getRange(1, 1, 1, SHEET_HEADERS.length)
       .setValues([SHEET_HEADERS])
       .setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
       .setFontColor('#FFFFFF').setVerticalAlignment('middle')
       .setHorizontalAlignment('center').setWrap(false);
  hdrColors.forEach((c, i) => sheet.getRange(1, i + 1).setBackground(c));

  const hints = [
    '↑ aus Google Ads', '↑ aus Google Ads', '↑ aus Google Ads', '↑ aus Google Ads',
    '30 Tage', '30 Tage', 'KI-Urteil', '0.0–1.0', 'Warum?',
    'Manuell korrigieren', '✓ = exportieren', 'Exact/Phrase/Broad', 'Ziel-Liste', 'Pending / Verarbeitet'
  ];
  sheet.setRowHeight(2, 18);
  sheet.getRange(2, 1, 1, hints.length)
       .setValues([hints])
       .setFontFamily('Arial').setFontSize(8).setFontWeight('normal')
       .setFontColor('#888888').setFontStyle('italic')
       .setBackground('#F8F9FA').setHorizontalAlignment('center').setVerticalAlignment('middle');

  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(2);

  const lastRow = sheet.getLastRow();
  let dataRows = 0;
  if (lastRow >= 3) {
    dataRows = lastRow - 2;
    const catCodes = cfg.categories.map(c => c.code);
    if (catCodes.length > 0) {
      sheet.getRange(3, 10, dataRows).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(catCodes, true).build()
      );
    }
    sheet.getRange(3, 11, dataRows).clearDataValidations();
    sheet.getRange(3, 11, dataRows).insertCheckboxes();
    sheet.getRange(3, 12, dataRows).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Exact', 'Phrase', 'Broad'], true).build()
    );

    // ── Export Ziel dropdown (col M) — sourced from neg_lists registry ──
    sheet.getRange(3, 13, dataRows).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(cfg.negLists, true).build()
    );

    _styleDataRows(sheet, 3, lastRow);
  }

  log('_setupSheetLayout "' + sheetName + '": ' + dataRows + ' Zeilen');
  return dataRows;
}

// ─────────────────────────────────────────────────────────────
// HELPER: Datenzeilen stylen
// ─────────────────────────────────────────────────────────────
function _styleDataRows(sheet, fromRow, toRow) {
  if (toRow < fromRow) return;

  var classifColors = { 'Unklar': { bg: '#FFF3E0', fg: '#E65100' } };
  var cfgSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AI_CONFIG_NAME);
  if (cfgSheet) {
    cfgSheet.getRange('E1:G50').getValues().filter(function(r) { return r[0] !== ''; }).forEach(function(row) {
      var code   = String(row[0]).trim();
      var action = String(row[2]).trim();
      if      (action === 'Negativ')   classifColors[code] = { bg: '#FFE5E5', fg: '#CC0000' };
      else if (action === 'Expansion') classifColors[code] = { bg: '#E8FDF5', fg: '#0F6E56' };
      else if (action === 'Review')    classifColors[code] = { bg: '#FFF3E0', fg: '#E65100' };
      else                             classifColors[code] = { bg: '#FFF8E1', fg: '#854F0B' };
    });
  }

  const numRows = toRow - fromRow + 1;
  const data    = sheet.getRange(fromRow, 1, numRows, 14).getValues();

  sheet.getRange(fromRow, 1, numRows, 14)
       .setFontFamily('Arial').setFontSize(10).setFontColor('#1A1A2E')
       .setVerticalAlignment('middle').setHorizontalAlignment('left')
       .setBorder(true, true, true, true, true, true, '#D0D0D0', SpreadsheetApp.BorderStyle.SOLID)
       .setWrap(false);

  for (let r = 0; r < numRows; r++) {
    const sr    = fromRow + r;
    const rowBg = r % 2 === 0 ? '#FFFFFF' : '#F8F9FA';
    sheet.setRowHeight(sr, 22);
    sheet.getRange(sr, 1, 1, 14).setBackground(rowBg);

    // Classification (col 7)
    const rawClass = String(data[r][6] || '');
    const classKey = rawClass.replace('⚠️ Prüfen: ', '').trim();
    if (classKey === 'Pending' || classKey === '' || classKey === '⚠️ Conv-Schutz') {
      sheet.getRange(sr, 7).setBackground('#FFF8E1').setFontColor('#854F0B')
           .setFontWeight('bold').setHorizontalAlignment('center');
    } else {
      const matchedColor = classifColors[classKey] || null;
      if (matchedColor) {
        sheet.getRange(sr, 7).setBackground(matchedColor.bg).setFontColor(matchedColor.fg)
             .setFontWeight('bold').setHorizontalAlignment('center');
      }
    }

    // Confidence (col 8)
    const confVal = data[r][7];
    if (confVal !== '' && confVal !== null) {
      const conf = parseFloat(confVal) || 0;
      const cbg  = conf >= 0.8 ? '#E8FDF5' : conf >= 0.7 ? '#FFF8E1' : '#FFE5E5';
      const cfg2 = conf >= 0.8 ? '#0F6E56' : conf >= 0.7 ? '#854F0B' : '#CC0000';
      sheet.getRange(sr, 8).setBackground(cbg).setFontColor(cfg2)
           .setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('0.00');
    }

    sheet.getRange(sr, 5, 1, 2).setHorizontalAlignment('center');
    sheet.getRange(sr, 9).setWrap(true);
    if (String(data[r][13]).trim() === 'Verarbeitet') {
      sheet.getRange(sr, 14).setFontColor('#888888').setFontStyle('italic');
    }
  }
  log('_styleDataRows: ' + numRows + ' Zeilen in "' + sheet.getName() + '"');
}

// ─────────────────────────────────────────────────────────────
// HELPER: Export-Sheet stylen
// ─────────────────────────────────────────────────────────────
function _styleExportSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = ss.getSheetByName(name);
  if (!s || s.getLastRow() < 1) { log('"' + name + '" leer'); return; }
  const isNeg  = name === 'Negative_Export';
  const HDR_BG = isNeg ? '#CC0000' : '#0F6E56';
  const BNR_BG = isNeg ? '#FFF8E1' : '#E8FDF5';
  const BORDER = '#D0D0D0';

  var catColors = { 'Unklar': { bg: '#F8F9FA', fg: '#555555' } };
  var _cfg = ss.getSheetByName(AI_CONFIG_NAME);
  if (_cfg) {
    _cfg.getRange('E1:G50').getValues().filter(function(r) { return r[0] !== ''; }).forEach(function(row) {
      var code = String(row[0]).trim(), action = String(row[2]).trim();
      if      (action === 'Negativ')   catColors[code] = { bg: '#FFE5E5', fg: '#CC0000' };
      else if (action === 'Expansion') catColors[code] = { bg: '#E8FDF5', fg: '#0F6E56' };
      else if (action === 'Review')    catColors[code] = { bg: '#FFF3E0', fg: '#E65100' };
      else                             catColors[code] = { bg: '#FFF8E1', fg: '#854F0B' };
    });
  }

  s.setHiddenGridlines(true);
  const numCols = s.getLastColumn();
  const lastRow = s.getLastRow();
  const widths  = isNeg ? [220, 260, 100, 240, 130] : [260, 130, 220, 80, 110, 100];
  widths.forEach((w, i) => s.setColumnWidth(i + 1, w));

  s.getRange(1, 1, 1, numCols)
   .setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
   .setFontColor('#FFFFFF').setBackground(HDR_BG)
   .setHorizontalAlignment('center').setVerticalAlignment('middle')
   .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  s.setRowHeight(1, 28);

  if (lastRow >= 2) {
    const bannerText = isNeg
      ? 'ℹ️  Der Uploader löscht nur erfolgreich hochgeladene Zeilen. Fehlgeschlagene bleiben stehen. Listennamen Groß-/Kleinschreibungs-sensitiv!'
      : 'ℹ️  Hier landen Begriffe mit Aktion "Expansion" — Städte, Regionen, Produktvarianten mit Potenzial. Basis für neue Kampagnen-Strukturen.';
    try { s.getRange(2, 1, 1, numCols).breakApart(); } catch(e) {}
    s.getRange(2, 1, 1, numCols).merge().setValue(bannerText)
     .setFontFamily('Arial').setFontSize(9).setFontStyle('italic')
     .setFontColor('#555555').setBackground(BNR_BG).setWrap(true)
     .setVerticalAlignment('middle')
     .setBorder(true, true, true, true, false, false, BORDER, SpreadsheetApp.BorderStyle.SOLID);
    s.setRowHeight(2, 38);
  }
  s.setFrozenRows(2);

  if (lastRow < 3) return;
  const numData = lastRow - 2;
  const data = s.getRange(3, 1, numData, numCols).getValues();

  s.getRange(3, 1, numData, numCols)
   .setFontFamily('Arial').setFontSize(10).setFontColor('#1A1A2E')
   .setVerticalAlignment('middle').setHorizontalAlignment('left')
   .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID)
   .setWrap(false);

  for (let r = 0; r < numData; r++) {
    const sr    = 3 + r;
    const rowBg = r % 2 === 0 ? '#FFFFFF' : '#F8F9FA';
    s.setRowHeight(sr, 22);
    s.getRange(sr, 1, 1, numCols).setBackground(rowBg);

    if (isNeg) {
      s.getRange(sr, 3).setHorizontalAlignment('center');
      const cc = catColors[String(data[r][4])] || { bg: rowBg, fg: '#1A1A2E' };
      s.getRange(sr, 5).setBackground(cc.bg).setFontColor(cc.fg)
                       .setFontWeight('bold').setHorizontalAlignment('center');
    } else {
      const cc = catColors[String(data[r][1])] || { bg: rowBg, fg: '#1A1A2E' };
      s.getRange(sr, 2).setBackground(cc.bg).setFontColor(cc.fg)
                       .setFontWeight('bold').setHorizontalAlignment('center');
      s.getRange(sr, 4, 1, 2).setHorizontalAlignment('center');
      s.getRange(sr, 6).setNumberFormat('DD.MM.YYYY').setHorizontalAlignment('center');
    }
  }
  log('_styleExportSheet "' + name + '": ' + numData + ' Zeilen');
}

// ─────────────────────────────────────────────────────────────
// SCHRITT 2a: PRE-KLASSIFIZIERUNG (Config-Listen)
// ─────────────────────────────────────────────────────────────
function preClassifySearch() {
  log('preClassifySearch() gestartet');
  _runPreClassification(SEARCH_SHEET_NAME);
}

// ─────────────────────────────────────────────────────────────
// SCHRITT 2b: AI-KLASSIFIZIERUNG (nur AI Queue Zeilen)
// ─────────────────────────────────────────────────────────────
function aiClassifySearch() {
  log('aiClassifySearch() gestartet');
  _runAIClassification(SEARCH_SHEET_NAME);
}

// ─────────────────────────────────────────────────────────────
// ENGINE A: Pre-Klassifizierung über Config-Listen
// Setzt: Config-Treffer → finale Kategorie
//        Kein Treffer   → 'AI Queue'  (Signal für Engine B)
//        Conv-Schutz    → '⚠️ Conv-Schutz'
//
// Performance: all writes collected in memory, written in one
// batch per column at the end — no per-row flush.
// ─────────────────────────────────────────────────────────────
function _runPreClassification(sheetName) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) { SpreadsheetApp.getUi().alert('❌ Sheet nicht gefunden: ' + sheetName); return; }

  const cfg     = getConfig();
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];

  const COL = {
    searchTerm: headers.indexOf('SearchTerm'),
    conv:       headers.indexOf('Conversions'),
    classif:    headers.indexOf('Classification'),
    conf:       headers.indexOf('Confidence'),
    reason:     headers.indexOf('KI-Begründung'),
    match:      headers.indexOf('Target Match Type'),
    exportZiel: headers.indexOf('Export Ziel'),
    status:     headers.indexOf('Status')
  };

  const missingCols = Object.entries(COL).filter(([k, v]) => v === -1).map(([k]) => k);
  if (missingCols.length > 0) {
    SpreadsheetApp.getUi().alert(
      `❌ Fehlende Spalten in "${sheetName}":\n${missingCols.join(', ')}\n\nBitte zuerst "1. Prepare Layout" ausführen!`
    );
    return;
  }

  if (data.length < 3) {
    SpreadsheetApp.getUi().alert('Keine Datenzeilen in "' + sheetName + '".');
    return;
  }

  // Only pick up truly unprocessed rows (Pending or blank, not already classified)
  const pendingRows = [];
  for (let i = 2; i < data.length; i++) {
    const classVal  = String(data[i][COL.classif] ?? '').trim();
    const statusVal = String(data[i][COL.status]  ?? '').trim();
    if ((classVal === 'Pending' || classVal === '') && statusVal !== 'Verarbeitet') {
      pendingRows.push(i);
    }
  }

  log(`[${sheetName}] Pre-Classify: ${pendingRows.length} Pending-Zeilen`);

  if (pendingRows.length === 0) {
    SpreadsheetApp.getUi().alert(
      `Keine Pending-Zeilen in "${sheetName}".\nEntweder bereits klassifiziert oder Sheet leer.`
    );
    return;
  }

  let configHits = 0, convProtected = 0, aiQueued = 0;

  // Collect all writes in memory first, then batch-write at the end
  const writes = []; // { row, col, val }[]

  for (const i of pendingRows) {
    const term   = String(data[i][COL.searchTerm] ?? '').trim();
    const tLower = term.toLowerCase();
    const conv   = Number(data[i][COL.conv]) || 0;
    const sheetRow = i + 1;

    // Conv-Schutz
    if (cfg.convProtect && conv > 0) {
      writes.push({ row: sheetRow, col: COL.classif + 1, val: '⚠️ Conv-Schutz' });
      writes.push({ row: sheetRow, col: COL.conf    + 1, val: 1.0 });
      writes.push({ row: sheetRow, col: COL.reason  + 1, val: 'Conversions vorhanden — manuell prüfen' });
      convProtected++;
      continue;
    }

    // Config-Listen-Check — Brand tier logic:
    //   1. Exact pure brand match                        → Brand Pure
    //   2. Exact match in Brand Kombi list               → Brand Kombi
    //   3. Brand name + noise modifier                   → Brand Noise
    //   4. Brand name but modifier unclear               → AI Queue
    //   5. All other list checks follow
    let category = null, reason = '';

    const hasBrandName = cfg.brandPureList.some(b => b && tLower.includes(b));
    const hasNoiseTerm = cfg.brandNoiseTerms.some(n => n && tLower.includes(n));
    const hasKombiHit  = cfg.brandKombiList.some(k => k && tLower === k);

    if (hasBrandName && !hasNoiseTerm && cfg.brandPureList.some(b => b && tLower === b)) {
      category = 'Brand Pure';
      reason   = 'Exakter Treffer Brand Pure Liste';
    } else if (hasKombiHit) {
      category = 'Brand Kombi';
      reason   = 'Treffer in Brand Kombi Liste (Keyword Lists B)';
    } else if (hasBrandName && hasNoiseTerm) {
      category = 'Brand Noise';
      reason   = 'Brand + Noise-Modifier (Keyword Lists F)';
    } else if (hasBrandName) {
      reason = 'Brand-Name erkannt — AI entscheidet Kombi vs Noise';
    } else if (cfg.ignoreList.some(ign => ign && tLower.includes(ign))) {
      category = 'Junk';
      reason   = 'Treffer in Sperrbegriff-Liste (Keyword Lists)';
    } else if (cfg.existingList.some(ex => ex && tLower === ex)) {
      category = 'Bestand (Aktiv)';
      reason   = 'Identisch mit aktivem Keyword (Keyword Lists)';
    } else if (cfg.competitorList.some(c => c && tLower.includes(c))) {
      category = 'Mitbewerber';
      reason   = 'Treffer in Mitbewerber-Liste (Keyword Lists)';
    }

    if (category) {
      writes.push({ row: sheetRow, col: COL.classif + 1, val: category });
      writes.push({ row: sheetRow, col: COL.conf    + 1, val: 1.0 });
      writes.push({ row: sheetRow, col: COL.reason  + 1, val: reason });
      if (category === 'Mitbewerber') {
        writes.push({ row: sheetRow, col: COL.match      + 1, val: 'Exact' });
        writes.push({ row: sheetRow, col: COL.exportZiel + 1, val: cfg.defaultList });
      }
      if (category === 'Brand Noise') {
        writes.push({ row: sheetRow, col: COL.match      + 1, val: 'Exact' });
        writes.push({ row: sheetRow, col: COL.exportZiel + 1, val: cfg.brandNoiseList });
      }
      configHits++;
    } else {
      writes.push({ row: sheetRow, col: COL.classif + 1, val: 'AI Queue' });
      writes.push({ row: sheetRow, col: COL.reason  + 1, val: reason || 'Wartet auf AI-Klassifizierung' });
      aiQueued++;
    }
  }

  // Single batch write for all pre-classification results
  _batchWriteToSheet(sheet, writes);
  SpreadsheetApp.flush();

  const summary =
    `✅ Pre-Klassifizierung abgeschlossen!\n\n` +
    `Config-Treffer:  ${configHits}\n` +
    `Conv-Schutz:     ${convProtected}\n` +
    `→ AI Queue:      ${aiQueued}\n\n` +
    (aiQueued > 0 ? `Jetzt "2b. AI-Classify" ausführen.` : 'Fertig — kein AI-Schritt nötig.');
  log(summary);
  SpreadsheetApp.getUi().alert(summary);
}

// ─────────────────────────────────────────────────────────────
// ENGINE B: AI-Klassifizierung
// Verarbeitet NUR Zeilen mit Classification = 'AI Queue'
//
// Performance changes vs V2.3:
//   - flush moved from per-row → per-batch
//   - sleep reduced from 2000ms → 500ms
//   - writes collected via _batchWriteToSheet helper
// ─────────────────────────────────────────────────────────────
function _runAIClassification(sheetName) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) { SpreadsheetApp.getUi().alert('❌ Sheet nicht gefunden: ' + sheetName); return; }

  const cfg     = getConfig();
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];

  const COL = {
    searchTerm: headers.indexOf('SearchTerm'),
    classif:    headers.indexOf('Classification'),
    conf:       headers.indexOf('Confidence'),
    reason:     headers.indexOf('KI-Begründung'),
    match:      headers.indexOf('Target Match Type'),
    exportZiel: headers.indexOf('Export Ziel'),
    status:     headers.indexOf('Status')
  };

  const missingCols = Object.entries(COL).filter(([k, v]) => v === -1).map(([k]) => k);
  if (missingCols.length > 0) {
    SpreadsheetApp.getUi().alert(
      `❌ Fehlende Spalten in "${sheetName}":\n${missingCols.join(', ')}\n\nBitte zuerst "1. Prepare Layout" ausführen!`
    );
    return;
  }

  // Only pick up rows marked 'AI Queue' by the pre-classify step
  const aiRows = [];
  for (let i = 2; i < data.length; i++) {
    const classVal  = String(data[i][COL.classif] ?? '').trim();
    const statusVal = String(data[i][COL.status]  ?? '').trim();
    if (classVal === 'AI Queue' && statusVal !== 'Verarbeitet') {
      aiRows.push({ rowIdx: i, term: String(data[i][COL.searchTerm] ?? '').trim() });
    }
  }

  log(`[${sheetName}] AI-Classify: ${aiRows.length} Zeilen in AI Queue`);

  if (aiRows.length === 0) {
    SpreadsheetApp.getUi().alert(
      `Keine "AI Queue" Zeilen in "${sheetName}" gefunden.\n\nBitte zuerst den Pre-Classify Schritt ausführen.`
    );
    return;
  }

  let processed      = 0;
  const totalBatches = Math.ceil(aiRows.length / cfg.batchSize);
  const estMinutes   = Math.ceil(totalBatches * 4 / 60); // ~4s per batch: API ~3s + 0.5s sleep + write

  log(`[${sheetName}] KI-Batch: ${aiRows.length} Begriffe in ${totalBatches} Batch(es)`);

  // ── Upfront info so the user knows what's about to run ──
  SpreadsheetApp.getUi().alert(
    `🤖 AI-Klassifizierung startet\n\n` +
    `Begriffe in AI Queue:  ${aiRows.length}\n` +
    `Batches:               ${totalBatches} à ${cfg.batchSize} Begriffe\n` +
    `Geschätzte Dauer:      ~${estMinutes} Min.\n\n` +
    `Das Fenster kann minimiert werden.\nOK drücken zum Starten.`
  );

  for (let b = 0; b < aiRows.length; b += cfg.batchSize) {
    const batchNum = Math.floor(b / cfg.batchSize) + 1;
    const chunk    = aiRows.slice(b, b + cfg.batchSize);
    log(`[${sheetName}] Batch ${batchNum}/${totalBatches} (${chunk.length} Begriffe): ${chunk.map(c => '"' + c.term + '"').join(', ')}`);

    const results = callAIBatch(chunk.map(c => c.term), cfg);

    // ── Collect all writes for this batch in memory ──
    const writes = []; // { row, col, val }[]

    for (let k = 0; k < chunk.length; k++) {
      const rowIdx   = chunk[k].rowIdx;
      const sheetRow = rowIdx + 1;
      const res      = results[k] || { category: 'Unklar', confidence: 0.0, reason: 'Kein Ergebnis' };
      const cat      = res.category || 'Unklar';
      const conf     = parseFloat(res.confidence) || 0.0;
      const displayCat = (conf < cfg.confWarn && cat !== 'Unklar') ? ('⚠️ Prüfen: ' + cat) : cat;

      writes.push({ row: sheetRow, col: COL.classif + 1, val: displayCat });
      writes.push({ row: sheetRow, col: COL.conf    + 1, val: conf });
      writes.push({ row: sheetRow, col: COL.reason  + 1, val: res.reason || '' });
      if (cat === 'Mitbewerber') {
        writes.push({ row: sheetRow, col: COL.match      + 1, val: 'Exact' });
        writes.push({ row: sheetRow, col: COL.exportZiel + 1, val: cfg.defaultList });
      }
      if (cat === 'Brand Noise') {
        writes.push({ row: sheetRow, col: COL.match      + 1, val: 'Exact' });
        writes.push({ row: sheetRow, col: COL.exportZiel + 1, val: cfg.brandNoiseList });
      }
      processed++;
    }

    // One batch write + one flush per batch (was: one flush per row)
    _batchWriteToSheet(sheet, writes);
    SpreadsheetApp.flush();

    // 500ms sleep — enough for gpt-4o-mini rate limits on aimlapi
    if (b + cfg.batchSize < aiRows.length) { Utilities.sleep(500); }
  }

  const summary =
    `✅ AI-Klassifizierung abgeschlossen!\n\n` +
    `KI verarbeitet: ${processed} in ${totalBatches} Batch(es)`;
  log(summary);
  SpreadsheetApp.getUi().alert(summary);
}

// ─────────────────────────────────────────────────────────────
// HELPER: Batch-Write
// Groups pending cell writes by column and fires them
// sequentially without intermediate flushes.
// ─────────────────────────────────────────────────────────────
function _batchWriteToSheet(sheet, writes) {
  if (!writes || writes.length === 0) return;

  // Group writes by column number
  const byCol = {};
  writes.forEach(function(w) {
    if (!byCol[w.col]) byCol[w.col] = [];
    byCol[w.col].push({ row: w.row, val: w.val });
  });

  // Write each column's cells in row order — no flush between writes
  Object.keys(byCol).forEach(function(col) {
    const colNum  = parseInt(col);
    const entries = byCol[col].sort(function(a, b) { return a.row - b.row; });
    entries.forEach(function(e) {
      sheet.getRange(e.row, colNum).setValue(e.val);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// KI-API: BATCH-CALL
// ─────────────────────────────────────────────────────────────
function callAIBatch(terms, cfg) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('AIML_API_KEY');
  if (!API_KEY) {
    log('FEHLER: AIML_API_KEY nicht gesetzt!');
    return terms.map(() => ({ category: 'Error', confidence: 0.0, reason: 'API-Key fehlt' }));
  }

  const url      = 'https://api.aimlapi.com/chat/completions';
  const catLines = cfg.categories.map(c => `  - "${c.code}": ${c.description}`).join('\n');
  const exLines  = cfg.examples.length > 0
    ? 'Beispiele:\n' + cfg.examples.map(e => `  - "${e.term}" → ${e.category}`).join('\n')
    : '';

  const systemPrompt =
    `Du bist ein Experte für Google Ads Keyword-Analyse im Bereich "${cfg.industry}".\n\n` +
    `Verfügbare Kategorien:\n${catLines}\n\n${exLines}\n\n` +
    `WICHTIG — Brand-Tier-Unterscheidung:\n` +
    `  Brand Pure:  Der Suchbegriff IST die Marke, keine Zusätze oder nur klare Kaufabsicht (z.B. "marke", "marke kaufen", "marke shop").\n` +
    `  Brand Kombi: Markenname + geografischer/produktbezogener Zusatz mit direkter Kaufabsicht (z.B. "marke münchen", "marke winterjacke", "marke outlet").\n` +
    `  Brand Noise: Markenname + Zusatz der auf Recherche, Unzufriedenheit oder No-Intent hinweist (z.B. "marke erfahrungen", "marke alternative", "marke kündigen", "marke test", "marke probleme").\n` +
    `  → Wenn ein Suchbegriff einen Markennamen enthält, MUSS er als Brand Pure, Brand Kombi oder Brand Noise klassifiziert werden — nie als Informational, Junk oder andere Kategorie.\n\n` +
    `Antworte AUSSCHLIESSLICH mit einem validen JSON-Array. Kein anderer Text, kein Markdown.\n` +
    `Format: [{"term":"...","category":"...","confidence":0.85,"reason":"..."}]\n` +
    `confidence: 0.0 (sehr unsicher) bis 1.0 (sehr sicher). reason: max. 12 Wörter auf Deutsch.`;

  const userPrompt =
    `Analysiere diese ${terms.length} Suchbegriffe:\n` +
    terms.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt }
    ],
    temperature: 0.1
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + API_KEY.trim() },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    log(`API Response Code: ${statusCode}`);

    if (statusCode !== 200) {
      log(`API Fehler: ${response.getContentText().substring(0, 300)}`);
      throw new Error(`HTTP ${statusCode}`);
    }

    const json      = JSON.parse(response.getContentText());
    const content   = json.choices[0].message.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Kein JSON-Array in Antwort gefunden');

    const parsed = JSON.parse(jsonMatch[0]);
    return terms.map((t, i) => parsed[i] || { category: 'Unklar', confidence: 0.0, reason: 'Kein Ergebnis' });

  } catch (e) {
    log(`BATCH FEHLER: ${e} — Fallback Einzelverarbeitung`);
    return terms.map(t => callAISingle(t, cfg, API_KEY, url));
  }
}

// ─────────────────────────────────────────────────────────────
// KI-API: FALLBACK EINZEL-CALL
// ─────────────────────────────────────────────────────────────
function callAISingle(term, cfg, API_KEY, url) {
  log(`Einzelverarbeitung: "${term}"`);
  const catCodes = cfg.categories.map(c => c.code).join(', ');
  const payload  = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `Kategorisiere im Bereich "${cfg.industry}". Kategorien: ${catCodes}. Nur JSON: {"category":"...","confidence":0.0,"reason":"..."}` },
      { role: 'user',   content: `Suchbegriff: "${term}"` }
    ],
    temperature: 0.1
  };
  try {
    const response  = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + API_KEY.trim() },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    const content   = JSON.parse(response.getContentText()).choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { category: 'Unklar', confidence: 0.0, reason: 'Parse-Fehler' };
    return JSON.parse(jsonMatch[0]);
  } catch(e) {
    log(`Fehler Einzelverarbeitung "${term}": ${e}`);
    return { category: 'Error', confidence: 0.0, reason: e.toString().substring(0, 50) };
  }
}

// ─────────────────────────────────────────────────────────────
// SCHRITT 3: EXPORT (SearchTerms → Export-Sheets)
// ─────────────────────────────────────────────────────────────
function exportValidated() {
  log('exportValidated() gestartet');
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = getConfig();
  const ui  = SpreadsheetApp.getUi();

  const response = ui.prompt(
    'Export-Ziel',
    'Name der Negativ-Liste (Standard: ' + cfg.defaultList + '):',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const finalTarget = response.getResponseText().trim() || cfg.defaultList;
  log('Export-Ziel: "' + finalTarget + '"');

  const actionMap = {};
  cfg.categories.forEach(function(c) { actionMap[c.code] = c.action; });

  let negatives = [], expansionIdeas = [], skipped = 0;

  const sheet = ss.getSheetByName(SEARCH_SHEET_NAME);
  if (!sheet) { ui.alert('❌ Sheet nicht gefunden: ' + SEARCH_SHEET_NAME); return; }

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const COL = {
    camp:       headers.indexOf('Campaign'),
    searchTerm: headers.indexOf('SearchTerm'),
    clicks:     headers.indexOf('Clicks'),
    conv:       headers.indexOf('Conversions'),
    classif:    headers.indexOf('Classification'),
    korrektur:  headers.indexOf('Korrektur'),
    validiert:  headers.indexOf('Validiert ✅'),
    match:      headers.indexOf('Target Match Type'),
    exportZiel: headers.indexOf('Export Ziel'),
    status:     headers.indexOf('Status')
  };

  // Start at i=2 to skip header + hint row
  for (var i = 2; i < data.length; i++) {
    if (data[i][COL.validiert] !== true || String(data[i][COL.status]) === 'Verarbeitet') continue;

    const aiCat    = String(data[i][COL.classif]   || '').replace('⚠️ Prüfen: ', '').trim();
    const manualCat= String(data[i][COL.korrektur] || '').trim();
    const finalCat = manualCat || aiCat;

    if (finalCat === '⚠️ Conv-Schutz') { skipped++; continue; }

    const kw     = data[i][COL.searchTerm];
    // Brand Noise + Mitbewerber default to Exact if Target Match Type not set
    const matchFallback = (finalCat === 'Brand Noise' || finalCat === 'Mitbewerber') ? 'Exact' : 'Phrase';
    const match  = data[i][COL.match]      || matchFallback;
    const camp   = data[i][COL.camp];
    const action = actionMap[finalCat]     || 'Review';
    // Brand Noise gets its own dedicated list fallback; all others use finalTarget
    const dest   = data[i][COL.exportZiel] ||
                   (finalCat === 'Brand Noise' ? cfg.brandNoiseList : finalTarget);

    log(`Export: "${kw}" → ${finalCat} (${action})`);
    if (action === 'Negativ')   negatives.push([dest, kw, match, camp, finalCat]);
    if (action === 'Expansion') expansionIdeas.push([kw, finalCat, camp, data[i][COL.clicks], data[i][COL.conv], new Date()]);

    sheet.getRange(i + 1, COL.status + 1).setValue('Verarbeitet');
  }

  if (negatives.length > 0)
    writeSheet('Negative_Export',  ['Liste/Ziel', 'Keyword', 'Match Type', 'Herkunftskampagne', 'Kategorie'], negatives);
  if (expansionIdeas.length > 0)
    writeSheet('Expansion_Ideen', ['Potenzielles Keyword', 'KI-Kategorie', 'Quelle-Kampagne', 'Klicks', 'Conversions', 'Datum'], expansionIdeas);

  const summary =
    'Export abgeschlossen!\n\n' +
    'Negatives: '  + negatives.length     + '\n' +
    'Expansion: '  + expansionIdeas.length + '\n' +
    'Conv-Schutz übersprungen: ' + skipped;
  log(summary);
  ui.alert(summary);
}

// ─────────────────────────────────────────────────────────────
// SCHRITT 4: LEARNING LOOP
// Keyword terms  → 'Keyword Lists' (A:F)
// AI examples    → 'AI Config'     (H:I)
// ─────────────────────────────────────────────────────────────
function learningLoop() {
  log('learningLoop() gestartet');
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const kwSheet = ss.getSheetByName(KW_LISTS_NAME);
  const aiSheet = ss.getSheetByName(AI_CONFIG_NAME);
  const ui      = SpreadsheetApp.getUi();

  if (!kwSheet) { ui.alert(`❌ "${KW_LISTS_NAME}" Sheet fehlt!`); return; }
  if (!aiSheet) { ui.alert(`❌ "${AI_CONFIG_NAME}" Sheet fehlt!`); return; }

  var toAdd         = { A: [], B: [], C: [], D: [], E: [], F: [] };
  var toAddExamples = [];

  const sheet = ss.getSheetByName(SEARCH_SHEET_NAME);
  if (!sheet) { ui.alert(`❌ "${SEARCH_SHEET_NAME}" Sheet fehlt!`); return; }

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const COL = {
    searchTerm: headers.indexOf('SearchTerm'),
    classif:    headers.indexOf('Classification'),
    korrektur:  headers.indexOf('Korrektur'),
    status:     headers.indexOf('Status')
  };

  for (var i = 2; i < data.length; i++) {
    var corr   = String(data[i][COL.korrektur] || '').trim();
    var term   = String(data[i][COL.searchTerm]|| '').trim().toLowerCase();
    var status = String(data[i][COL.status]    || '').trim();
    var aiCat  = String(data[i][COL.classif]   || '').replace('⚠️ Prüfen: ', '').trim();

    if (status !== 'Verarbeitet' || !corr || !term) continue;

    var kiWasWrong = (corr !== aiCat && aiCat !== '' && aiCat !== 'Pending');

    if      (corr === 'Brand Pure')      { toAdd.A.push(term); }
    else if (corr === 'Brand Kombi')     { toAdd.B.push(term); }
    else if (corr === 'Bestand (Aktiv)') { toAdd.C.push(term); }
    else if (corr === 'Junk')            { toAdd.D.push(term); }
    else if (corr === 'Mitbewerber')     { toAdd.E.push(term); }
    else if (corr === 'Brand Noise') {
      toAdd.F.push(term);
      toAddExamples.push({ term: term, category: 'Brand Noise' });
    }
    else if (corr === 'Informational-Potential') {
      toAddExamples.push({ term: term, category: 'Informational-Potential' });
    }

    if (kiWasWrong && corr !== 'Informational-Potential' && corr !== 'Brand Noise') {
      toAddExamples.push({ term: term, category: corr });
    }
  }
  log('Learning Loop Zeilen geprüft: ' + (data.length - 2));

  if (toAdd.A.length + toAdd.B.length + toAdd.C.length + toAdd.D.length + toAdd.E.length + toAdd.F.length + toAddExamples.length === 0) {
    ui.alert('ℹ️  Keine verarbeiteten Korrekturen gefunden.\n\nHinweis: Der Learning Loop schaut nur auf Zeilen mit Status "Verarbeitet" und einer Korrektur in Spalte J.');
    return;
  }

  // ── Duplikat-Check: Keyword Lists (A4:F1000) ───────────────
  var existingLists = kwSheet.getRange('A4:F1000').getValues();
  var existing = { A: {}, B: {}, C: {}, D: {}, E: {}, F: {} };
  existingLists.forEach(function(row) {
    if (row[0]) existing.A[String(row[0]).toLowerCase().trim()] = true; // Brand Pure
    if (row[1]) existing.B[String(row[1]).toLowerCase().trim()] = true; // Brand Kombi
    if (row[2]) existing.C[String(row[2]).toLowerCase().trim()] = true; // Bestand
    if (row[3]) existing.D[String(row[3]).toLowerCase().trim()] = true; // Sperrbegriffe
    if (row[4]) existing.E[String(row[4]).toLowerCase().trim()] = true; // Mitbewerber
    if (row[5]) existing.F[String(row[5]).toLowerCase().trim()] = true; // Brand Noise Terms
  });

  // ── Duplikat-Check: AI Config examples (H1:I50) ────────────
  var existingExamples = aiSheet.getRange('H1:I50').getValues();
  var existingExSet = {};
  existingExamples.forEach(function(row) {
    if (row[0]) existingExSet[String(row[0]).toLowerCase().trim()] = true;
  });

  var newA  = toAdd.A.filter(function(t) { return !existing.A[t]; });
  var newB  = toAdd.B.filter(function(t) { return !existing.B[t]; });
  var newC  = toAdd.C.filter(function(t) { return !existing.C[t]; });
  var newD  = toAdd.D.filter(function(t) { return !existing.D[t]; });
  var newE  = toAdd.E.filter(function(t) { return !existing.E[t]; });
  var newF  = toAdd.F.filter(function(t) { return !existing.F[t]; });
  var newEx = toAddExamples.filter(function(e) { return !existingExSet[e.term.toLowerCase()]; });

  var newTotal = newA.length + newB.length + newC.length + newD.length + newE.length + newF.length + newEx.length;
  var dupTotal = (toAdd.A.length - newA.length) + (toAdd.B.length - newB.length) +
                 (toAdd.C.length - newC.length) + (toAdd.D.length - newD.length) +
                 (toAdd.E.length - newE.length) + (toAdd.F.length - newF.length) +
                 (toAddExamples.length - newEx.length);

  if (newTotal === 0) {
    ui.alert('ℹ️  Alle Begriffe bereits vorhanden.\n(' + dupTotal + ' Duplikate übersprungen)');
    return;
  }

  var msg = 'Learning Loop — Neue Einträge:\n\n';
  if (newA.length)  msg += 'Brand Pure (Keyword Lists A):\n   '        + newA.join(', ') + '\n\n';
  if (newB.length)  msg += 'Brand Kombi (Keyword Lists B):\n   '       + newB.join(', ') + '\n\n';
  if (newC.length)  msg += 'Bestand (Keyword Lists C):\n   '           + newC.join(', ') + '\n\n';
  if (newD.length)  msg += 'Sperrbegriffe (Keyword Lists D):\n   '     + newD.join(', ') + '\n\n';
  if (newE.length)  msg += 'Mitbewerber (Keyword Lists E):\n   '       + newE.join(', ') + '\n\n';
  if (newF.length)  msg += 'Brand Noise Terms (Keyword Lists F):\n   ' + newF.join(', ') + '\n\n';
  if (newEx.length) msg += 'KI-Beispiele (AI Config H:I):\n   '        + newEx.map(function(e) { return e.term + ' → ' + e.category; }).join('\n   ') + '\n\n';
  if (dupTotal > 0) msg += 'Duplikate übersprungen: ' + dupTotal + '\n\n';
  msg += 'Eintragen?';

  if (ui.alert(msg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  // ── In Keyword Lists schreiben ──────────────────────────────
  var styleListCell = function(cell) {
    cell.setFontFamily('Arial').setFontSize(10).setFontWeight('normal')
        .setFontColor('#1A1A2E').setBackground('#FFFFFF').setFontStyle('normal')
        .setHorizontalAlignment('left').setVerticalAlignment('center').setWrap(false)
        .setBorder(true, true, true, true, true, true, '#D0D0D0', SpreadsheetApp.BorderStyle.SOLID);
  };
  var writeListCell = function(sheet, row, col, value) {
    var cell = sheet.getRange(row, col);
    cell.setValue(value);
    styleListCell(cell);
  };

  var nextRowA = 4, nextRowB = 4, nextRowC = 4, nextRowD = 4, nextRowE = 4, nextRowF = 4;
  existingLists.forEach(function(row, idx) {
    var sheetRow = idx + 4;
    if (row[0]) nextRowA = Math.max(nextRowA, sheetRow + 1);
    if (row[1]) nextRowB = Math.max(nextRowB, sheetRow + 1);
    if (row[2]) nextRowC = Math.max(nextRowC, sheetRow + 1);
    if (row[3]) nextRowD = Math.max(nextRowD, sheetRow + 1);
    if (row[4]) nextRowE = Math.max(nextRowE, sheetRow + 1);
    if (row[5]) nextRowF = Math.max(nextRowF, sheetRow + 1);
  });

  newA.forEach(function(t) { writeListCell(kwSheet, nextRowA, 1, t); nextRowA++; });
  newB.forEach(function(t) { writeListCell(kwSheet, nextRowB, 2, t); nextRowB++; });
  newC.forEach(function(t) { writeListCell(kwSheet, nextRowC, 3, t); nextRowC++; });
  newD.forEach(function(t) { writeListCell(kwSheet, nextRowD, 4, t); nextRowD++; });
  newE.forEach(function(t) { writeListCell(kwSheet, nextRowE, 5, t); nextRowE++; });
  newF.forEach(function(t) { writeListCell(kwSheet, nextRowF, 6, t); nextRowF++; });

  // ── In AI Config H:I schreiben ──────────────────────────────
  if (newEx.length > 0) {
    var lastExRow = existingExamples.reduce(function(max, row, idx) {
      return (row[0] || row[1]) ? idx : max;
    }, -1);
    var nextExRow = Math.max(lastExRow + 2, 3); // H:I data starts row 3 in AI Config

    newEx.forEach(function(e) {
      var hCell = aiSheet.getRange(nextExRow, 8);
      hCell.clearFormat();
      hCell.setValue(e.term)
           .setFontFamily('Arial').setFontSize(10).setFontWeight('normal')
           .setFontColor('#1A1A2E').setBackground('#FFFFFF').setFontStyle('normal')
           .setHorizontalAlignment('left').setVerticalAlignment('center').setWrap(false)
           .setBorder(true, true, true, true, true, true, '#D0D0D0', SpreadsheetApp.BorderStyle.SOLID);

      var iCell = aiSheet.getRange(nextExRow, 9);
      iCell.clearFormat();
      iCell.setValue(e.category)
           .setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
           .setFontColor('#000000').setBackground('#FFFFFF').setFontStyle('normal')
           .setHorizontalAlignment('center').setVerticalAlignment('center').setWrap(false)
           .setBorder(true, true, true, true, true, true, '#D0D0D0', SpreadsheetApp.BorderStyle.SOLID);
      nextExRow++;
    });
  }

  var summary =
    'Eingetragen!\n\n' +
    (newA.length  ? 'Brand Pure (KW Lists A):         +' + newA.length  + '\n' : '') +
    (newB.length  ? 'Brand Kombi (KW Lists B):        +' + newB.length  + '\n' : '') +
    (newC.length  ? 'Bestand (KW Lists C):            +' + newC.length  + '\n' : '') +
    (newD.length  ? 'Sperrbegriffe (KW Lists D):      +' + newD.length  + '\n' : '') +
    (newE.length  ? 'Mitbewerber (KW Lists E):        +' + newE.length  + '\n' : '') +
    (newF.length  ? 'Brand Noise Terms (KW Lists F):  +' + newF.length  + '\n' : '') +
    (newEx.length ? 'KI-Beispiele (AI Config H:I):    +' + newEx.length + '\n' : '') +
    (dupTotal > 0 ? '\nDuplikate übersprungen: ' + dupTotal : '');
  log(summary);
  ui.alert(summary);
}

// ─────────────────────────────────────────────────────────────
// HILFSFUNKTION: Sheet schreiben + stylen
// ─────────────────────────────────────────────────────────────
function writeSheet(name, headers, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); }

  // Write header row if sheet is empty
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }

  const firstDataRow = s.getLastRow() + 1;
  s.getRange(firstDataRow, 1, rows.length, rows[0].length).setValues(rows);
  _styleExportSheet(name);
  log(rows.length + ' Zeilen in "' + name + '" geschrieben und gestylt');
}

// ─────────────────────────────────────────────────────────────
// HILFSFUNKTION: Export-Sheets leeren
// ─────────────────────────────────────────────────────────────
function clearExportSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🧹 Export-Sheets leeren',
    'Sollen "Negative_Export" und "Expansion_Ideen" (ab Zeile 3) geleert werden?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  ['Negative_Export', 'Expansion_Ideen'].forEach(function(name) {
    const s = ss.getSheetByName(name);
    if (s && s.getLastRow() > 2) {
      s.getRange(3, 1, s.getLastRow() - 2, s.getLastColumn()).clearContent();
      log(name + ' geleert');
    }
  });
  ui.alert('✅ Export-Sheets geleert.');
}
