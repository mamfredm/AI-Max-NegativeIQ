// ============================================================
// KI-Keyword-Analyzer V1 — GAS Zentral-Skript
// Google Sheet > Erweiterungen > Apps Script
// ============================================================

// ─────────────────────────────────────────────────────────────
// MENÜ
// ─────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🐾 Capybara NegativeIQ Search')
    .addItem('1. Layout & Dropdowns vorbereiten',         'setupLayout')
    .addItem('2. Neue Keywords klassifizieren (KI-Batch)', 'classifyBatch')
    .addItem('3. Korrekturen in Config zurückschreiben',  'learningLoop')
    .addItem('4. Validierte Daten exportieren',           'exportValidated')
    .addSeparator()
    .addItem('🧹 Export-Sheets leeren (Neustart)',        'clearExportSheets')
    .addItem('🔍 Diagnose & Debug',                       'debugDiagnose')
    .addToUi();
}

// ─────────────────────────────────────────────────────────────
// LOGGER HELPER
// ─────────────────────────────────────────────────────────────
function log(msg) {
  console.log('[Capybara] ' + msg);
}

// ─────────────────────────────────────────────────────────────
// 🔍 DIAGNOSE — Menü > Diagnose & Debug
// Zeigt exakt was das Script liest, ohne irgendetwas zu ändern
// ─────────────────────────────────────────────────────────────
function debugDiagnose() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ui  = SpreadsheetApp.getUi();
  let report = '🔍 DIAGNOSE-REPORT\n';
  report += '══════════════════════════════\n\n';

  // ── 1. Sheet-Reiter prüfen ──
  const requiredSheets = ['SearchTerms', 'Config', 'Negative_Export', 'Expansion_Ideen'];
  report += '📋 SHEET-REITER:\n';
  requiredSheets.forEach(name => {
    const s = ss.getSheetByName(name);
    report += (s ? '  ✅ ' : '  ❌ FEHLT: ') + name + '\n';
  });
  report += '\n';

  // ── 2. SearchTerms Header prüfen ──
  const stSheet = ss.getSheetByName('SearchTerms');
  if (stSheet) {
    const headers = stSheet.getLastRow() > 0
      ? stSheet.getRange(1, 1, 1, stSheet.getLastColumn()).getValues()[0]
      : [];
    const requiredCols = [
      'Campaign', 'SearchTerm', 'Triggered Keyword', 'Triggered Match',
      'Clicks', 'Conversions', 'Classification', 'Confidence',
      'KI-Begründung', 'Korrektur', 'Validiert ✅', 'Target Match Type',
      'Export Ziel', 'Status'
    ];
    report += '📊 SEARCHTERMS HEADER:\n';
    requiredCols.forEach(col => {
      const idx = headers.indexOf(col);
      report += (idx >= 0 ? `  ✅ "${col}" → Spalte ${idx + 1}\n` : `  ❌ FEHLT: "${col}"\n`);
    });
    report += `  Gesamt Zeilen: ${stSheet.getLastRow()} (inkl. Header)\n`;

    // Status-Verteilung
    if (stSheet.getLastRow() > 1) {
      const classifIdx = headers.indexOf('Classification');
      const statusIdx  = headers.indexOf('Status');
      if (classifIdx >= 0 && statusIdx >= 0) {
        const data = stSheet.getRange(2, 1, stSheet.getLastRow() - 1, stSheet.getLastColumn()).getValues();
        const counts = {};
        data.forEach(row => {
          const val = String(row[classifIdx] || 'leer').trim() || 'leer';
          counts[val] = (counts[val] || 0) + 1;
        });
        report += '\n  Classification-Verteilung:\n';
        Object.entries(counts).forEach(([k, v]) => report += `    "${k}": ${v}x\n`);
      }
    }
    report += '\n';
  }

  // ── 3. Config prüfen ──
  const cfgSheet = ss.getSheetByName('Config');
  if (cfgSheet) {
    report += '⚙️ CONFIG CLIENT-PROFIL (A1:B7):\n';
    const profile = cfgSheet.getRange('A1:B7').getValues();
    profile.forEach(row => {
      if (row[0]) report += `  ${row[0]}: "${row[1]}"\n`;
    });

    const cats = cfgSheet.getRange('E1:G50').getValues().filter(r => r[0] !== '');
    report += `\n  Kategorien (E:G): ${cats.length} Einträge\n`;
    cats.forEach(r => report += `    "${r[0]}" → Aktion: "${r[2]}"\n`);

    const lists      = cfgSheet.getRange('A12:D200').getValues();
    const brandCount = lists.filter(r => r[0]).length;
    const exstCount  = lists.filter(r => r[1]).length;
    const ignCount   = lists.filter(r => r[2]).length;
    const compCount  = lists.filter(r => r[3]).length;
    report += `\n  Listen-Matching (ab Zeile 12):\n`;
    report += `    Brand (A):         ${brandCount} Einträge\n`;
    report += `    Bestand (B):       ${exstCount} Einträge\n`;
    report += `    Sperrbegriffe (C): ${ignCount} Einträge\n`;
    report += `    Mitbewerber (D):   ${compCount} Einträge\n`;

    const examples = cfgSheet.getRange('H1:I20').getValues().filter(r => r[0] !== '');
    report += `\n  KI-Beispiele (H:I): ${examples.length} Einträge\n\n`;
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
// ─────────────────────────────────────────────────────────────
function getConfig() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = ss.getSheetByName('Config');
  if (!cfg) throw new Error('Config-Sheet nicht gefunden!');

  const profile = cfg.getRange('A1:B7').getValues();
  const clientProfile = {};
  profile.forEach(row => { if (row[0]) clientProfile[String(row[0]).trim()] = row[1]; });
  log('Config geladen: ' + JSON.stringify(clientProfile));

  const catData    = cfg.getRange('E1:G50').getValues().filter(r => r[0] !== '');
  const categories = catData.map(r => ({
    code: String(r[0]).trim(), description: String(r[1]).trim(), action: String(r[2]).trim()
  }));
  log('Kategorien: ' + categories.map(c => c.code).join(', '));

  const listData       = cfg.getRange('A12:D200').getValues();
  const brandList      = listData.map(r => String(r[0]).toLowerCase()).filter(Boolean);
  const existingList   = listData.map(r => String(r[1]).toLowerCase()).filter(Boolean);
  const ignoreList     = listData.map(r => String(r[2]).toLowerCase()).filter(Boolean);
  const competitorList = listData.map(r => String(r[3]).toLowerCase()).filter(Boolean);
  log(`Listen: Brand=${brandList.length}, Bestand=${existingList.length}, Ignore=${ignoreList.length}, Competitor=${competitorList.length}`);

  const exampleData = cfg.getRange('H1:I20').getValues().filter(r => r[0] !== '');
  const examples    = exampleData.map(r => ({ term: r[0], category: r[1] }));

  const convProtectRaw = clientProfile['conv_protect'];
  const convProtect    = convProtectRaw !== false && String(convProtectRaw).toUpperCase() !== 'FALSE';

  return {
    industry:      String(clientProfile['client_industry']  || 'Online-Marketing'),
    clientName:    String(clientProfile['client_name']      || ''),
    defaultList:   String(clientProfile['default_neg_list'] || 'Wettbewerber_Global'),
    convProtect,
    confWarn:      parseFloat(clientProfile['confidence_warn']) || 0.7,
    batchSize:     parseInt(clientProfile['batch_size'])        || 15,
    categories, brandList, existingList, ignoreList, competitorList, examples
  };
}

// ─────────────────────────────────────────────────────────────
// SCHRITT 1: LAYOUT & DROPDOWNS
// ─────────────────────────────────────────────────────────────
// SCHRITT 1: LAYOUT & DROPDOWNS + STYLING ALLER SHEETS
// ─────────────────────────────────────────────────────────────
function setupLayout() {
  log('setupLayout() gestartet');
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = getConfig();

  const sheet = ss.getSheetByName('SearchTerms');
  if (!sheet) { SpreadsheetApp.getUi().alert('❌ SearchTerms-Sheet nicht gefunden!'); return; }

  sheet.setHiddenGridlines(true);
  const colWidths = [180, 260, 180, 110, 70, 100, 150, 95, 300, 150, 95, 130, 180, 120];
  colWidths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  const headers = [
    'Campaign', 'SearchTerm', 'Triggered Keyword', 'Triggered Match',
    'Clicks', 'Conversions', 'Classification', 'Confidence', 'KI-Begründung',
    'Korrektur', 'Validiert ✅', 'Target Match Type', 'Export Ziel', 'Status'
  ];
  const hdrColors = [
    '#1A1A2E','#1A1A2E','#1A1A2E','#1A1A2E',
    '#1A1A2E','#1A1A2E',
    '#0F3460','#0F3460','#0F3460',
    '#CC0000','#0F6E56',
    '#555555','#555555','#555555'
  ];

  sheet.setRowHeight(1, 30);
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
       .setFontColor('#FFFFFF').setVerticalAlignment('middle')
       .setHorizontalAlignment('center').setWrap(false);
  hdrColors.forEach((c, i) => sheet.getRange(1, i + 1).setBackground(c));

  const hints = [
    '↑ aus Google Ads','↑ aus Google Ads','↑ aus Google Ads','↑ aus Google Ads',
    '30 Tage','30 Tage','KI-Urteil','0.0–1.0','Warum?',
    'Manuell korrigieren','✓ = exportieren','Exact/Phrase/Broad','Ziel-Liste','Pending / Verarbeitet'
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
  let stRows = 0;
  if (lastRow >= 3) {
    stRows = lastRow - 2;
    const catCodes = cfg.categories.map(c => c.code);
    log('Dropdowns + Styling fuer ' + stRows + ' Zeilen');
    if (catCodes.length > 0) {
      sheet.getRange(3, 10, stRows).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(catCodes, true).build()
      );
    }
    sheet.getRange(3, 11, stRows).insertCheckboxes();
    sheet.getRange(3, 12, stRows).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Exact', 'Phrase', 'Broad'], true).build()
    );
    _styleSearchTermRows(sheet, 3, lastRow);
  }

  _styleExportSheet(ss, 'Negative_Export');
  _styleExportSheet(ss, 'Expansion_Ideen');

  log('setupLayout() abgeschlossen');
  SpreadsheetApp.getUi().alert(
    '🐾 Capybara NegativeIQ — Layout abgeschlossen!\n\n' +
    'SearchTerms:     ' + stRows + ' Zeilen gestylt\n' +
    'Negative_Export: ✅\n' +
    'Expansion_Ideen: ✅'
  );
}

// ─────────────────────────────────────────────────────────────
// HELPER: SearchTerms Zeilen stylen
// ─────────────────────────────────────────────────────────────
function _styleSearchTermRows(sheet, fromRow, toRow) {
  if (toRow < fromRow) return;
  const classifColors = {
    'Mitbewerber':    { bg: '#FFE5E5', fg: '#CC0000' },
    'Ort':            { bg: '#E8FDF5', fg: '#0F6E56' },
    'Informational':  { bg: '#FFE5E5', fg: '#CC0000' },
    'Junk':           { bg: '#FFE5E5', fg: '#CC0000' },
    'Eigene Marke':   { bg: '#E8F4FD', fg: '#185FA5' },
    'Bestand (Aktiv)':{ bg: '#E8F4FD', fg: '#185FA5' },
    'Unklar':         { bg: '#FFF8E1', fg: '#854F0B' },
  };
  const numRows = toRow - fromRow + 1;
  const data = sheet.getRange(fromRow, 1, numRows, 14).getValues();

  sheet.getRange(fromRow, 1, numRows, 14)
       .setFontFamily('Arial').setFontSize(10).setFontColor('#1A1A2E')
       .setVerticalAlignment('middle').setHorizontalAlignment('left')
       .setBorder(true,true,true,true,true,true,'#D0D0D0', SpreadsheetApp.BorderStyle.SOLID)
       .setWrap(false);

  for (let r = 0; r < numRows; r++) {
    const sr    = fromRow + r;
    const rowBg = r % 2 === 0 ? '#FFFFFF' : '#F8F9FA';
    sheet.setRowHeight(sr, 22);
    sheet.getRange(sr, 1, 1, 14).setBackground(rowBg);

    // Classification (Spalte 7)
    const rawClass = String(data[r][6] || '');
    const classKey = rawClass.replace('⚠️ Prüfen: ', '').trim();
    if (classKey === 'Pending' || classKey === '') {
      sheet.getRange(sr, 7).setBackground('#FFF8E1').setFontColor('#854F0B')
           .setFontWeight('bold').setHorizontalAlignment('center');
    } else if (classKey === '⚠️ Conv-Schutz') {
      sheet.getRange(sr, 7).setBackground('#FFF8E1').setFontColor('#854F0B')
           .setFontWeight('bold').setHorizontalAlignment('center');
    } else {
      const baseKey = Object.keys(classifColors).find(k => classKey.startsWith(k));
      if (baseKey) {
        const cc = classifColors[baseKey];
        sheet.getRange(sr, 7).setBackground(cc.bg).setFontColor(cc.fg)
             .setFontWeight('bold').setHorizontalAlignment('center');
      }
    }

    // Confidence (Spalte 8)
    const confVal = data[r][7];
    if (confVal !== '' && confVal !== null) {
      const conf = parseFloat(confVal) || 0;
      const cbg = conf >= 0.8 ? '#E8FDF5' : conf >= 0.7 ? '#FFF8E1' : '#FFE5E5';
      const cfg2 = conf >= 0.8 ? '#0F6E56' : conf >= 0.7 ? '#854F0B' : '#CC0000';
      sheet.getRange(sr, 8).setBackground(cbg).setFontColor(cfg2)
           .setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('0.00');
    }

    // Clicks + Conv (5+6) zentriert
    sheet.getRange(sr, 5, 1, 2).setHorizontalAlignment('center');
    // KI-Begruendung (9) wrap
    sheet.getRange(sr, 9).setWrap(true);
    // Status (14) ausgegraut wenn Verarbeitet
    if (String(data[r][13]).trim() === 'Verarbeitet') {
      sheet.getRange(sr, 14).setFontColor('#888888').setFontStyle('italic');
    }
  }
  log('_styleSearchTermRows: ' + numRows + ' Zeilen');
}

// ─────────────────────────────────────────────────────────────
// HELPER: Export-Sheet stylen
// ─────────────────────────────────────────────────────────────
function _styleExportSheet(ss, name) {
  const s = ss.getSheetByName(name);
  if (!s || s.getLastRow() < 1) { log('"' + name + '" leer'); return; }
  const isNeg  = name === 'Negative_Export';
  const HDR_BG = isNeg ? '#CC0000' : '#0F6E56';
  const BNR_BG = isNeg ? '#FFF8E1' : '#E8FDF5';
  const BORDER = '#D0D0D0';
  const catColors = {
    'Mitbewerber':   { bg: '#FFE5E5', fg: '#CC0000' },
    'Junk':          { bg: '#FFE5E5', fg: '#CC0000' },
    'Informational': { bg: '#FFE5E5', fg: '#CC0000' },
    'Ort':           { bg: '#E8FDF5', fg: '#0F6E56' },
    'Expansion':     { bg: '#E8FDF5', fg: '#0F6E56' },
    'Unklar':        { bg: '#F8F9FA', fg: '#555555' },
  };
  s.setHiddenGridlines(true);
  const numCols = s.getLastColumn();
  const lastRow = s.getLastRow();
  const widths  = isNeg ? [220,260,100,240,130] : [260,130,220,80,110,100];
  widths.forEach((w, i) => s.setColumnWidth(i + 1, w));

  // Header Zeile 1
  s.getRange(1, 1, 1, numCols)
   .setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
   .setFontColor('#FFFFFF').setBackground(HDR_BG)
   .setHorizontalAlignment('center').setVerticalAlignment('middle')
   .setBorder(true,true,true,true,true,true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  s.setRowHeight(1, 28);

  // Banner Zeile 2
  if (lastRow >= 2) {
    const bannerText = isNeg
      ? 'ℹ️  Der Uploader löscht nur erfolgreich hochgeladene Zeilen. Fehlgeschlagene bleiben stehen. Listennamen Groß-/Kleinschreibungs-sensitiv!'
      : 'ℹ️  Hier landen Begriffe mit Aktion "Expansion" — Städte, Regionen, Produktvarianten mit Potenzial. Basis für neue Kampagnen-Strukturen.';
    try { s.getRange(2, 1, 1, numCols).breakApart(); } catch(e) {}
    s.getRange(2, 1, 1, numCols).merge().setValue(bannerText)
     .setFontFamily('Arial').setFontSize(9).setFontStyle('italic')
     .setFontColor('#555555').setBackground(BNR_BG).setWrap(true)
     .setVerticalAlignment('middle')
     .setBorder(true,true,true,true,false,false, BORDER, SpreadsheetApp.BorderStyle.SOLID);
    s.setRowHeight(2, 38);
  }
  s.setFrozenRows(2);

  if (lastRow < 3) return;
  const numData = lastRow - 2;
  const data = s.getRange(3, 1, numData, numCols).getValues();

  s.getRange(3, 1, numData, numCols)
   .setFontFamily('Arial').setFontSize(10).setFontColor('#1A1A2E')
   .setVerticalAlignment('middle').setHorizontalAlignment('left')
   .setBorder(true,true,true,true,true,true, BORDER, SpreadsheetApp.BorderStyle.SOLID)
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
// SCHRITT 2: KI-BATCH-KLASSIFIZIERUNG
// ─────────────────────────────────────────────────────────────
function classifyBatch() {
  log('classifyBatch() gestartet');
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('SearchTerms');
  if (!sheet) { SpreadsheetApp.getUi().alert('❌ SearchTerms-Sheet nicht gefunden!'); return; }

  const cfg     = getConfig();
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  log('Header-Zeile: ' + JSON.stringify(headers));

  // ── Spalten-Validierung ──────────────────────────────────
  const COL = {
    searchTerm: headers.indexOf('SearchTerm'),
    clicks:     headers.indexOf('Clicks'),
    conv:       headers.indexOf('Conversions'),
    classif:    headers.indexOf('Classification'),
    conf:       headers.indexOf('Confidence'),
    reason:     headers.indexOf('KI-Begründung'),
    match:      headers.indexOf('Target Match Type'),
    exportZiel: headers.indexOf('Export Ziel'),
    status:     headers.indexOf('Status')
  };
  log('Spalten-Index-Map: ' + JSON.stringify(COL));

  const missingCols = Object.entries(COL).filter(([k, v]) => v === -1).map(([k]) => k);
  if (missingCols.length > 0) {
    const msg = `❌ Fehlende Spalten in SearchTerms:\n${missingCols.join(', ')}\n\nBitte zuerst "1. Layout & Dropdowns vorbereiten" ausführen!`;
    log('ABBRUCH — fehlende Spalten: ' + missingCols.join(', '));
    SpreadsheetApp.getUi().alert(msg);
    return;
  }

  if (data.length < 2) {
    SpreadsheetApp.getUi().alert('Keine Datenzeilen im SearchTerms-Sheet.');
    return;
  }

  // ── Pending-Zeilen sammeln (ab i=2: Zeile 1=Header, Zeile 2=Hinweiszeile) ──
  const pendingRows = [];
  for (let i = 2; i < data.length; i++) {
    const classVal  = String(data[i][COL.classif] ?? '').trim();
    const statusVal = String(data[i][COL.status]  ?? '').trim();
    if ((classVal === 'Pending' || classVal === '') && statusVal !== 'Verarbeitet') {
      pendingRows.push(i);
    }
  }
  log(`Pending-Zeilen: ${pendingRows.length} von ${data.length - 2}`);

  if (pendingRows.length === 0) {
    SpreadsheetApp.getUi().alert('Keine neuen Keywords zum Klassifizieren.\nAlle Zeilen haben bereits einen Status.');
    return;
  }

  // ── Pre-Klassifizierung über Config-Listen ───────────────
  log('Starte Config-Listen-Check...');
  const toAI = [];
  let configHits = 0, convProtected = 0;

  for (const i of pendingRows) {
    const term   = String(data[i][COL.searchTerm] ?? '').trim();
    const tLower = term.toLowerCase();
    const conv   = Number(data[i][COL.conv]) || 0;

    if (cfg.convProtect && conv > 0) {
      log(`Conv-Schutz: "${term}" (${conv} Conv)`);
      sheet.getRange(i + 1, COL.classif  + 1).setValue('⚠️ Conv-Schutz');
      sheet.getRange(i + 1, COL.conf     + 1).setValue(1.0);
      sheet.getRange(i + 1, COL.reason   + 1).setValue('Conversions vorhanden — manuell prüfen');
      SpreadsheetApp.flush();
      convProtected++;
      continue;
    }

    let category = null, reason = '';
    if      (cfg.brandList.some(b => b && tLower.includes(b)))      { category = 'Eigene Marke';   reason = 'Treffer in Brand-Liste (Config)'; }
    else if (cfg.ignoreList.some(ign => ign && tLower.includes(ign))){ category = 'Junk';           reason = 'Treffer in Sperrbegriff-Liste (Config)'; }
    else if (cfg.existingList.some(ex => ex && tLower === ex))       { category = 'Bestand (Aktiv)';reason = 'Identisch mit aktivem Keyword (Config)'; }
    else if (cfg.competitorList.some(c => c && tLower.includes(c))) { category = 'Mitbewerber';    reason = 'Treffer in Mitbewerber-Whitelist (Config)'; }

    if (category) {
      log(`Config-Treffer: "${term}" → ${category}`);
      sheet.getRange(i + 1, COL.classif  + 1).setValue(category);
      sheet.getRange(i + 1, COL.conf     + 1).setValue(1.0);
      sheet.getRange(i + 1, COL.reason   + 1).setValue(reason);
      if (category === 'Mitbewerber') {
        sheet.getRange(i + 1, COL.match     + 1).setValue('Phrase');
        sheet.getRange(i + 1, COL.exportZiel+ 1).setValue(cfg.defaultList);
      }
      SpreadsheetApp.flush();
      configHits++;
    } else {
      toAI.push({ rowIdx: i, term });
    }
  }

  log(`Config-Check: ${configHits} Treffer, ${convProtected} Conv-Schutz, ${toAI.length} zur KI`);

  if (toAI.length === 0) {
    const msg = `✅ Klassifizierung abgeschlossen!\n\nConfig-Treffer: ${configHits}\nConv-Schutz: ${convProtected}\nZur KI: 0`;
    log(msg); SpreadsheetApp.getUi().alert(msg); return;
  }

  // ── Batch-Verarbeitung per KI ────────────────────────────
  log(`KI-Batch für ${toAI.length} Begriffe (Batch-Größe: ${cfg.batchSize})...`);
  let processed = 0;
  const totalBatches = Math.ceil(toAI.length / cfg.batchSize);

  for (let b = 0; b < toAI.length; b += cfg.batchSize) {
    const batchNum = Math.floor(b / cfg.batchSize) + 1;
    const chunk    = toAI.slice(b, b + cfg.batchSize);
    log(`Batch ${batchNum}/${totalBatches}: ${chunk.map(c => '"' + c.term + '"').join(', ')}`);

    const results = callAIBatch(chunk.map(c => c.term), cfg);

    for (let k = 0; k < chunk.length; k++) {
      const rowIdx = chunk[k].rowIdx;
      const term   = chunk[k].term;
      const res    = results[k] || { category: 'Unklar', confidence: 0.0, reason: 'Kein Ergebnis' };
      const cat    = res.category || 'Unklar';
      const conf   = parseFloat(res.confidence) || 0.0;
      const displayCat = (conf < cfg.confWarn && cat !== 'Unklar') ? ('⚠️ Prüfen: ' + cat) : cat;

      log(`  "${term}" → ${displayCat} (${conf.toFixed(2)}) | ${res.reason}`);

      sheet.getRange(rowIdx + 1, COL.classif  + 1).setValue(displayCat);
      sheet.getRange(rowIdx + 1, COL.conf     + 1).setValue(conf);
      sheet.getRange(rowIdx + 1, COL.reason   + 1).setValue(res.reason || '');
      if (cat === 'Mitbewerber') {
        sheet.getRange(rowIdx + 1, COL.match     + 1).setValue('Phrase');
        sheet.getRange(rowIdx + 1, COL.exportZiel+ 1).setValue(cfg.defaultList);
      }
      SpreadsheetApp.flush();
      processed++;
    }

    if (b + cfg.batchSize < toAI.length) { log('Pause 2s...'); Utilities.sleep(2000); }
  }

  const summary = `✅ KI-Analyse abgeschlossen!\n\nConfig-Treffer: ${configHits}\nConv-Schutz: ${convProtected}\nKI verarbeitet: ${processed} in ${totalBatches} Batch(es)`;
  log(summary);
  SpreadsheetApp.getUi().alert(summary);
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
    `Antworte AUSSCHLIESSLICH mit einem validen JSON-Array. Kein anderer Text, kein Markdown.\n` +
    `Format: [{"term":"...","category":"...","confidence":0.85,"reason":"..."}]\n` +
    `confidence: 0.0 (sehr unsicher) bis 1.0 (sehr sicher). reason: max. 12 Wörter auf Deutsch.`;

  const userPrompt = `Analysiere diese ${terms.length} Suchbegriffe:\n` + terms.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const payload = {
    model: 'gpt-4o-mini-search-preview',
    web_search_options: {},
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    temperature: 0.1
  };

  try {
    log(`API-Call: ${terms.length} Begriffe`);
    const response   = UrlFetchApp.fetch(url, {
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

    const json    = JSON.parse(response.getContentText());
    const content = json.choices[0].message.content.trim();
    log(`API Antwort (erste 300 Zeichen): ${content.substring(0, 300)}`);

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Kein JSON-Array in Antwort gefunden');

    const parsed = JSON.parse(jsonMatch[0]);
    log(`JSON geparst: ${parsed.length} Ergebnisse`);
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
    model: 'gpt-4o-mini-search-preview', web_search_options: {},
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
    log(`Einzelantwort "${term}": ${content.substring(0, 100)}`);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { category: 'Unklar', confidence: 0.0, reason: 'Parse-Fehler' };
    return JSON.parse(jsonMatch[0]);
  } catch(e) {
    log(`Fehler Einzelverarbeitung "${term}": ${e}`);
    return { category: 'Error', confidence: 0.0, reason: e.toString().substring(0, 50) };
  }
}

// ─────────────────────────────────────────────────────────────
// SCHRITT 3: LEARNING LOOP
// Lernt aus ALLEN manuellen Korrekturen:
//   Eigene Marke      → Config Spalte A (Brand-Terms)
//   Bestand (Aktiv)   → Config Spalte B
//   Junk              → Config Spalte C (Sperrbegriffe)
//   Mitbewerber       → Config Spalte D
//   Alle Korrekturen  → Config H:I (KI-Beispiele, wenn KI falsch lag)
// Mit Duplikat-Check, Loop ab i=2
// ─────────────────────────────────────────────────────────────
function learningLoop() {
  log('learningLoop() gestartet');
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const sheet    = ss.getSheetByName('SearchTerms');
  const cfgSheet = ss.getSheetByName('Config');
  const ui       = SpreadsheetApp.getUi();
  const data     = sheet.getDataRange().getValues();
  const headers  = data[0];

  const COL = {
    searchTerm: headers.indexOf('SearchTerm'),
    classif:    headers.indexOf('Classification'),
    korrektur:  headers.indexOf('Korrektur'),
    status:     headers.indexOf('Status')
  };

  var toAdd = { A: [], B: [], C: [], D: [] };
  var toAddExamples = [];

  // Loop ab i=2 — i=0 Header, i=1 Hinweiszeile
  for (var i = 2; i < data.length; i++) {
    var corr   = String(data[i][COL.korrektur] || '').trim();
    var term   = String(data[i][COL.searchTerm]|| '').trim().toLowerCase();
    var status = String(data[i][COL.status]    || '').trim();
    var aiCat  = String(data[i][COL.classif]   || '').replace('⚠️ Prüfen: ', '').trim();

    if (status !== 'Verarbeitet' || !corr || !term) continue;

    var kiWasWrong = (corr !== aiCat && aiCat !== '' && aiCat !== 'Pending');

    if      (corr === 'Eigene Marke')          { toAdd.A.push(term); }
    else if (corr === 'Bestand (Aktiv)')       { toAdd.B.push(term); }
    else if (corr === 'Junk')                  { toAdd.C.push(term); }
    else if (corr === 'Mitbewerber')           { toAdd.D.push(term); }
    else if (corr === 'Informational-Potential') {
      toAddExamples.push({ term: term, category: 'Informational-Potential' });
    }

    if (kiWasWrong && corr !== 'Informational-Potential') {
      toAddExamples.push({ term: term, category: corr });
    }
  }

  var totalLists    = toAdd.A.length + toAdd.B.length + toAdd.C.length + toAdd.D.length;
  var totalExamples = toAddExamples.length;
  log('Learning Loop: A=' + toAdd.A.length + ' B=' + toAdd.B.length + ' C=' + toAdd.C.length + ' D=' + toAdd.D.length + ' Beispiele=' + totalExamples);

  if (totalLists === 0 && totalExamples === 0) {
    ui.alert('ℹ️  Keine verarbeiteten Korrekturen gefunden.\n\nHinweis: Der Learning Loop schaut nur auf Zeilen mit Status "Verarbeitet" und einer Korrektur in Spalte J.');
    return;
  }

  // ── Duplikat-Check gegen bestehende Config-Einträge ──────────
  var existingLists = cfgSheet.getRange('A12:D200').getValues();
  var existing = {
    A: {},  B: {},  C: {},  D: {}
  };
  existingLists.forEach(function(row) {
    if (row[0]) existing.A[String(row[0]).toLowerCase().trim()] = true;
    if (row[1]) existing.B[String(row[1]).toLowerCase().trim()] = true;
    if (row[2]) existing.C[String(row[2]).toLowerCase().trim()] = true;
    if (row[3]) existing.D[String(row[3]).toLowerCase().trim()] = true;
  });

  var existingExamples = cfgSheet.getRange('H1:I50').getValues();
  var existingExSet = {};
  existingExamples.forEach(function(row) {
    if (row[0]) existingExSet[String(row[0]).toLowerCase().trim()] = true;
  });

  var newA  = toAdd.A.filter(function(t) { return !existing.A[t]; });
  var newB  = toAdd.B.filter(function(t) { return !existing.B[t]; });
  var newC  = toAdd.C.filter(function(t) { return !existing.C[t]; });
  var newD  = toAdd.D.filter(function(t) { return !existing.D[t]; });
  var newEx = toAddExamples.filter(function(e) { return !existingExSet[e.term.toLowerCase()]; });

  var newTotal = newA.length + newB.length + newC.length + newD.length + newEx.length;
  var dupTotal = (toAdd.A.length - newA.length) + (toAdd.B.length - newB.length) +
                 (toAdd.C.length - newC.length) + (toAdd.D.length - newD.length) +
                 (toAddExamples.length - newEx.length);

  if (newTotal === 0) {
    ui.alert('ℹ️  Alle Begriffe bereits in der Config vorhanden.\n(' + dupTotal + ' Duplikate übersprungen)');
    return;
  }

  // ── Zusammenfassung anzeigen ─────────────────────────────────
  var msg = 'Learning Loop - Neue Eintraege:\n\n';
  if (newA.length)  msg += 'Brand-Terms (Config A):\n   ' + newA.join(', ')  + '\n\n';
  if (newB.length)  msg += 'Bestand/Aktiv (Config B):\n   ' + newB.join(', ')  + '\n\n';
  if (newC.length)  msg += 'Sperrbegriffe (Config C):\n   ' + newC.join(', ')  + '\n\n';
  if (newD.length)  msg += 'Mitbewerber (Config D):\n   ' + newD.join(', ')  + '\n\n';
  if (newEx.length) msg += 'KI-Beispiele (Config H:I):\n   ' + newEx.map(function(e) { return e.term + ' -> ' + e.category; }).join('\n   ') + '\n\n';
  if (dupTotal > 0) msg += dupTotal + ' bereits vorhandene Eintraege uebersprungen.\n\n';
  msg += 'In Config eintragen?';

  if (ui.alert(msg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  // ── In Config-Listen schreiben ────────────────────────────────
  var lastUsedRow = existingLists.reduce(function(max, row, idx) {
    return (row[0]||row[1]||row[2]||row[3]) ? idx : max;
  }, -1);
  var nextListRow = lastUsedRow + 13;

  newA.forEach(function(t) { cfgSheet.getRange(nextListRow, 1).setValue(t); nextListRow++; });
  newB.forEach(function(t) { cfgSheet.getRange(nextListRow, 2).setValue(t); nextListRow++; });
  newC.forEach(function(t) { cfgSheet.getRange(nextListRow, 3).setValue(t); nextListRow++; });
  newD.forEach(function(t) { cfgSheet.getRange(nextListRow, 4).setValue(t); nextListRow++; });

  // ── In KI-Beispiele schreiben ────────────────────────────────
  if (newEx.length > 0) {
    var lastExRow = existingExamples.reduce(function(max, row, idx) {
      return (row[0] || row[1]) ? idx : max;
    }, -1);
    var nextExRow = lastExRow + 2;
    if (nextExRow < 4) nextExRow = 4;

    newEx.forEach(function(e) {
      cfgSheet.getRange(nextExRow, 8).setValue(e.term);
      cfgSheet.getRange(nextExRow, 9).setValue(e.category);
      nextExRow++;
    });
  }

  var summary = 'Config aktualisiert!\n\n' +
    (newA.length  ? 'Brand-Terms:   +' + newA.length  + '\n' : '') +
    (newB.length  ? 'Bestand:       +' + newB.length  + '\n' : '') +
    (newC.length  ? 'Sperrbegriffe: +' + newC.length  + '\n' : '') +
    (newD.length  ? 'Mitbewerber:   +' + newD.length  + '\n' : '') +
    (newEx.length ? 'KI-Beispiele:  +' + newEx.length + '\n' : '') +
    (dupTotal > 0 ? '\nDuplikate uebersprungen: ' + dupTotal : '');

  log(summary);
  ui.alert(summary);
}

// ─────────────────────────────────────────────────────────────
// SCHRITT 4: EXPORT
// ─────────────────────────────────────────────────────────────
function exportValidated() {
  log('exportValidated() gestartet');
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('SearchTerms');
  const cfg   = getConfig();
  const ui    = SpreadsheetApp.getUi();

  const response = ui.prompt('Export-Ziel', 'Name der Negativ-Liste (Standard: ' + cfg.defaultList + '):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const finalTarget = response.getResponseText().trim() || cfg.defaultList;
  log('Export-Ziel: "' + finalTarget + '"');

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

  const actionMap = {};
  cfg.categories.forEach(function(c) { actionMap[c.code] = c.action; });

  var negatives = [], expansionIdeas = [], skipped = 0;

  for (var i = 2; i < data.length; i++) {
    if (data[i][COL.validiert] !== true || String(data[i][COL.status]) === 'Verarbeitet') continue;

    const aiCat    = String(data[i][COL.classif]   || '').replace('⚠️ Prüfen: ', '').trim();
    const manualCat= String(data[i][COL.korrektur] || '').trim();
    const finalCat = manualCat || aiCat;

    if (finalCat === '⚠️ Conv-Schutz') { skipped++; continue; }

    const kw     = data[i][COL.searchTerm];
    const match  = data[i][COL.match]      || 'Phrase';
    const camp   = data[i][COL.camp];
    const action = actionMap[finalCat]     || 'Review';
    const dest   = data[i][COL.exportZiel] || finalTarget;

    log('Export: "' + kw + '" -> ' + finalCat + ' (' + action + ')');
    if (action === 'Negativ')   negatives.push([dest, kw, match, camp, finalCat]);
    if (action === 'Expansion') expansionIdeas.push([kw, finalCat, camp, data[i][COL.clicks], data[i][COL.conv], new Date()]);

    sheet.getRange(i + 1, COL.status + 1).setValue('Verarbeitet');
  }

  if (negatives.length > 0)
    writeSheet('Negative_Export', ['Liste/Ziel','Keyword','Match Type','Herkunftskampagne','Kategorie'], negatives);
  if (expansionIdeas.length > 0)
    writeSheet('Expansion_Ideen', ['Potenzielles Keyword','KI-Kategorie','Quelle-Kampagne','Klicks','Conversions','Datum'], expansionIdeas);

  const summary = 'Export abgeschlossen!\n\nNegatives: ' + negatives.length + '\nExpansion: ' + expansionIdeas.length + '\nConv-Schutz uebersprungen: ' + skipped + '\n\n-> Jetzt "1. Layout" fuer das Styling ausfuehren.';
  log(summary);
  ui.alert(summary);
}

// ─────────────────────────────────────────────────────────────
// HILFSFUNKTION: Sheet schreiben mit vollständigem Formatting
// ─────────────────────────────────────────────────────────────
function writeSheet(name, headers, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); log('"' + name + '" neu erstellt'); }

  // Header setzen falls Sheet leer
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, headers.length).setValues([headers])
     .setFontWeight('bold');
    // Platzhalter Zeile 2 fuer Banner (wird von setupLayout befuellt)
    s.getRange(2, 1).setValue('→ Menü: 1. Layout & Dropdowns vorbereiten zum Stylen');
  }

  // Daten ab naechster freier Zeile
  const firstRow = s.getLastRow() + 1;
  s.getRange(firstRow, 1, rows.length, rows[0].length).setValues(rows);
  log(rows.length + ' Zeilen in "' + name + '" geschrieben (Styling via setupLayout)');
}
