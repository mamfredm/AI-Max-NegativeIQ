// ============================================================
// AI Max Negative IQ v1 — GAS Central Script
// Google Sheet > Extensions > Apps Script
// ============================================================

// ─────────────────────────────────────────────────────────────
// MENU
// ─────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛠️ AI Max NegativeIQ Search')
    .addItem('1. Prepare Layout',                          'setupLayout')
    .addItem('2. Classify SearchTerms (AI)',               'classifyBatch')
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
// 🔍 DIAGNOSE — Menu > Diagnose & Debug
// Shows exactly what the script reads, without changing anything
// ─────────────────────────────────────────────────────────────
function debugDiagnose() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ui  = SpreadsheetApp.getUi();
  let report = '🔍 DIAGNOSIS REPORT\n';
  report += '══════════════════════════════\n\n';

  // ── 1. Check sheet tabs ──
  const requiredSheets = ['SearchTerms', 'Config', 'Negative_Export', 'Expansion_Ideas'];
  report += '📋 SHEET TABS:\n';
  requiredSheets.forEach(name => {
    const s = ss.getSheetByName(name);
    report += (s ? '  ✅ ' : '  ❌ MISSING: ') + name + '\n';
  });
  report += '\n';

  // ── 2. Check SearchTerms headers ──
  const stSheet = ss.getSheetByName('SearchTerms');
  if (stSheet) {
    const headers = stSheet.getLastRow() > 0
      ? stSheet.getRange(1, 1, 1, stSheet.getLastColumn()).getValues()[0]
      : [];
    const requiredCols = [
      'Campaign', 'SearchTerm', 'Triggered Keyword', 'Triggered Match',
      'Clicks', 'Conversions', 'Classification', 'Confidence',
      'AI Reason', 'Correction', 'Validated ✅', 'Target Match Type',
      'Export Target', 'Status'
    ];
    report += '📊 SEARCHTERMS HEADERS:\n';
    requiredCols.forEach(col => {
      const idx = headers.indexOf(col);
      report += (idx >= 0 ? `  ✅ "${col}" → Column ${idx + 1}\n` : `  ❌ MISSING: "${col}"\n`);
    });
    report += `  Total rows: ${stSheet.getLastRow()} (incl. header)\n`;

    // Classification distribution
    if (stSheet.getLastRow() > 1) {
      const classifIdx = headers.indexOf('Classification');
      const statusIdx  = headers.indexOf('Status');
      if (classifIdx >= 0 && statusIdx >= 0) {
        const data = stSheet.getRange(2, 1, stSheet.getLastRow() - 1, stSheet.getLastColumn()).getValues();
        const counts = {};
        data.forEach(row => {
          const val = String(row[classifIdx] || 'empty').trim() || 'empty';
          counts[val] = (counts[val] || 0) + 1;
        });
        report += '\n  Classification distribution:\n';
        Object.entries(counts).forEach(([k, v]) => report += `    "${k}": ${v}x\n`);
      }
    }
    report += '\n';
  }

  // ── 3. Check Config ──
  const cfgSheet = ss.getSheetByName('Config');
  if (cfgSheet) {
    report += '⚙️ CONFIG CLIENT PROFILE (A1:B7):\n';
    const profile = cfgSheet.getRange('A1:B7').getValues();
    profile.forEach(row => {
      if (row[0]) report += `  ${row[0]}: "${row[1]}"\n`;
    });

    const cats = cfgSheet.getRange('E1:G50').getValues().filter(r => r[0] !== '');
    report += `\n  Categories (E:G): ${cats.length} entries\n`;
    cats.forEach(r => report += `    "${r[0]}" → Action: "${r[2]}"\n`);

    const lists      = cfgSheet.getRange('A12:D200').getValues();
    const brandCount = lists.filter(r => r[0]).length;
    const exstCount  = lists.filter(r => r[1]).length;
    const ignCount   = lists.filter(r => r[2]).length;
    const compCount  = lists.filter(r => r[3]).length;
    report += `\n  List matching (from row 12):\n`;
    report += `    Brand (A):        ${brandCount} entries\n`;
    report += `    Existing (B):     ${exstCount} entries\n`;
    report += `    Block terms (C):  ${ignCount} entries\n`;
    report += `    Competitors (D):  ${compCount} entries\n`;

    const examples = cfgSheet.getRange('H1:I20').getValues().filter(r => r[0] !== '');
    report += `\n  AI Examples (H:I): ${examples.length} entries\n\n`;
  }

  // ── 4. Check API key ──
  const apiKey = PropertiesService.getScriptProperties().getProperty('AIML_API_KEY');
  if (apiKey && apiKey.trim().length > 10) {
    report += `🔑 API KEY: ✅ Present (${apiKey.trim().length} chars, ends with "...${apiKey.trim().slice(-4)}")\n`;
  } else {
    report += `🔑 API KEY: ❌ MISSING or too short!\n  → Gear icon > Script properties > AIML_API_KEY\n`;
  }

  console.log(report);
  ui.alert(report);
}

// ─────────────────────────────────────────────────────────────
// READ CONFIG
// ─────────────────────────────────────────────────────────────
function getConfig() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = ss.getSheetByName('Config');
  if (!cfg) throw new Error('Config sheet not found!');

  const profile = cfg.getRange('A1:B7').getValues();
  const clientProfile = {};
  profile.forEach(row => { if (row[0]) clientProfile[String(row[0]).trim()] = row[1]; });
  log('Config loaded: ' + JSON.stringify(clientProfile));

  const catData    = cfg.getRange('E1:G50').getValues().filter(r => r[0] !== '');
  const categories = catData.map(r => ({
    code: String(r[0]).trim(), description: String(r[1]).trim(), action: String(r[2]).trim()
  }));
  log('Categories: ' + categories.map(c => c.code).join(', '));

  const listData       = cfg.getRange('A12:D200').getValues();
  const brandList      = listData.map(r => String(r[0]).toLowerCase()).filter(Boolean);
  const existingList   = listData.map(r => String(r[1]).toLowerCase()).filter(Boolean);
  const ignoreList     = listData.map(r => String(r[2]).toLowerCase()).filter(Boolean);
  const competitorList = listData.map(r => String(r[3]).toLowerCase()).filter(Boolean);
  log(`Lists: Brand=${brandList.length}, Existing=${existingList.length}, Block=${ignoreList.length}, Competitor=${competitorList.length}`);

  const exampleData = cfg.getRange('H1:I20').getValues().filter(r => r[0] !== '');
  const examples    = exampleData.map(r => ({ term: r[0], category: r[1] }));

  const convProtectRaw = clientProfile['conv_protect'];
  const convProtect    = convProtectRaw !== false && String(convProtectRaw).toUpperCase() !== 'FALSE';

  return {
    industry:      String(clientProfile['client_industry']  || 'Online Marketing'),
    clientName:    String(clientProfile['client_name']      || ''),
    defaultList:   String(clientProfile['default_neg_list'] || 'Competitors_Global'),
    convProtect,
    confWarn:      parseFloat(clientProfile['confidence_warn']) || 0.7,
    batchSize:     parseInt(clientProfile['batch_size'])        || 15,
    categories, brandList, existingList, ignoreList, competitorList, examples
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 1: LAYOUT & DROPDOWNS + STYLING ALL SHEETS
// ─────────────────────────────────────────────────────────────
function setupLayout() {
  log('setupLayout() started');
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = getConfig();

  const sheet = ss.getSheetByName('SearchTerms');
  if (!sheet) { SpreadsheetApp.getUi().alert('❌ SearchTerms sheet not found!'); return; }

  sheet.setHiddenGridlines(true);
  const colWidths = [180, 260, 180, 110, 70, 100, 150, 95, 300, 150, 95, 130, 180, 120];
  colWidths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  const headers = [
    'Campaign', 'SearchTerm', 'Triggered Keyword', 'Triggered Match',
    'Clicks', 'Conversions', 'Classification', 'Confidence', 'AI Reason',
    'Correction', 'Validated ✅', 'Target Match Type', 'Export Target', 'Status'
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
    '↑ from Google Ads','↑ from Google Ads','↑ from Google Ads','↑ from Google Ads',
    '30 days','30 days','AI verdict','0.0–1.0','Why?',
    'Correct manually','✓ = export','Exact/Phrase/Broad','Target list','Pending / Processed'
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
    log('Dropdowns + styling for ' + stRows + ' rows');
    if (catCodes.length > 0) {
      sheet.getRange(3, 10, stRows).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(catCodes, true).build()
      );
    }
    sheet.getRange(3, 11, stRows).clearDataValidations();
    sheet.getRange(3, 11, stRows).insertCheckboxes();
    sheet.getRange(3, 12, stRows).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Exact', 'Phrase', 'Broad'], true).build()
    );
    _styleSearchTermRows(sheet, 3, lastRow);
  }

  _styleExportSheet('Negative_Export');
  _styleExportSheet('Expansion_Ideas');

  log('setupLayout() complete');
  SpreadsheetApp.getUi().alert(
    '🐾 Capybara NegativeIQ — Layout complete!\n\n' +
    'SearchTerms:    ' + stRows + ' rows styled\n' +
    'Negative_Export: ✅\n' +
    'Expansion_Ideas: ✅'
  );
}

// ─────────────────────────────────────────────────────────────
// HELPER: Style SearchTerms rows
// ─────────────────────────────────────────────────────────────
function _styleSearchTermRows(sheet, fromRow, toRow) {
  if (toRow < fromRow) return;

  // Load colours dynamically from Config G (Action)
  var classifColors = {
    'Own Brand':       { bg: '#FFF3E0', fg: '#E65100' },
    'Existing (Active)':{ bg: '#FFF3E0', fg: '#E65100' },
    'Unclear':         { bg: '#FFF3E0', fg: '#E65100' },
  };
  var cfgSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  if (cfgSheet) {
    var catData = cfgSheet.getRange('E1:G50').getValues().filter(function(r) { return r[0] !== ''; });
    catData.forEach(function(row) {
      var code   = String(row[0]).trim();
      var action = String(row[2]).trim();
      if      (action === 'Negative')   classifColors[code] = { bg: '#FFE5E5', fg: '#CC0000' };
      else if (action === 'Expansion')  classifColors[code] = { bg: '#E8FDF5', fg: '#0F6E56' };
      else if (action === 'Review')     classifColors[code] = { bg: '#FFF3E0', fg: '#E65100' };
      else                              classifColors[code] = { bg: '#FFF8E1', fg: '#854F0B' };
    });
  }
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

    // Classification (column 7)
    const rawClass = String(data[r][6] || '');
    const classKey = rawClass.replace('⚠️ Check: ', '').trim();
    if (classKey === 'Pending' || classKey === '') {
      sheet.getRange(sr, 7).setBackground('#FFF8E1').setFontColor('#854F0B')
           .setFontWeight('bold').setHorizontalAlignment('center');
    } else if (classKey === '⚠️ Conv-Protected') {
      sheet.getRange(sr, 7).setBackground('#FFF8E1').setFontColor('#854F0B')
           .setFontWeight('bold').setHorizontalAlignment('center');
    } else {
      var exactMatch = classifColors[classKey];
      var baseKey = exactMatch ? classKey : Object.keys(classifColors).find(function(k) { return classKey.startsWith(k) && k.length > classKey.indexOf(k); });
      var matchedColor = classifColors[classKey] || (baseKey ? classifColors[baseKey] : null);
      if (matchedColor) {
        sheet.getRange(sr, 7).setBackground(matchedColor.bg).setFontColor(matchedColor.fg)
             .setFontWeight('bold').setHorizontalAlignment('center');
      }
    }

    // Confidence (column 8)
    const confVal = data[r][7];
    if (confVal !== '' && confVal !== null) {
      const conf = parseFloat(confVal) || 0;
      const cbg = conf >= 0.8 ? '#E8FDF5' : conf >= 0.7 ? '#FFF8E1' : '#FFE5E5';
      const cfg2 = conf >= 0.8 ? '#0F6E56' : conf >= 0.7 ? '#854F0B' : '#CC0000';
      sheet.getRange(sr, 8).setBackground(cbg).setFontColor(cfg2)
           .setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('0.00');
    }

    // Clicks + Conv (5+6) centred
    sheet.getRange(sr, 5, 1, 2).setHorizontalAlignment('center');
    // AI Reason (9) wrap
    sheet.getRange(sr, 9).setWrap(true);
    // Status (14) greyed out when Processed
    if (String(data[r][13]).trim() === 'Processed') {
      sheet.getRange(sr, 14).setFontColor('#888888').setFontStyle('italic');
    }
  }
  log('_styleSearchTermRows: ' + numRows + ' rows');
}

// ─────────────────────────────────────────────────────────────
// HELPER: Style export sheet
// ─────────────────────────────────────────────────────────────
function _styleExportSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = ss.getSheetByName(name);
  if (!s || s.getLastRow() < 1) { log('"' + name + '" empty'); return; }
  const isNeg  = name === 'Negative_Export';
  const HDR_BG = isNeg ? '#CC0000' : '#0F6E56';
  const BNR_BG = isNeg ? '#FFF8E1' : '#E8FDF5';
  const BORDER = '#D0D0D0';

  // Load category colours dynamically from Config G (Action)
  var catColors = { 'Unclear': { bg: '#F8F9FA', fg: '#555555' } };
  var _cfg = ss.getSheetByName('Config');
  if (_cfg) {
    _cfg.getRange('E1:G50').getValues().filter(function(r){ return r[0] !== ''; }).forEach(function(row) {
      var code = String(row[0]).trim(), action = String(row[2]).trim();
      if      (action === 'Negative')   catColors[code] = { bg: '#FFE5E5', fg: '#CC0000' };
      else if (action === 'Expansion')  catColors[code] = { bg: '#E8FDF5', fg: '#0F6E56' };
      else if (action === 'Review')     catColors[code] = { bg: '#FFF3E0', fg: '#E65100' };
      else                              catColors[code] = { bg: '#FFF8E1', fg: '#854F0B' };
    });
  }
  s.setHiddenGridlines(true);
  const numCols = s.getLastColumn();
  const lastRow = s.getLastRow();
  const widths  = isNeg ? [220,260,100,240,130] : [260,130,220,80,110,100];
  widths.forEach((w, i) => s.setColumnWidth(i + 1, w));

  // Header row 1
  s.getRange(1, 1, 1, numCols)
   .setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
   .setFontColor('#FFFFFF').setBackground(HDR_BG)
   .setHorizontalAlignment('center').setVerticalAlignment('middle')
   .setBorder(true,true,true,true,true,true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  s.setRowHeight(1, 28);

  // Banner row 2
  if (lastRow >= 2) {
    const bannerText = isNeg
      ? 'ℹ️  The uploader only deletes successfully uploaded rows. Failed rows remain. List names are case-sensitive!'
      : 'ℹ️  Terms with action "Expansion" land here — cities, regions, product variants with potential. Basis for new campaign structures.';
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
      s.getRange(sr, 6).setNumberFormat('MM/DD/YYYY').setHorizontalAlignment('center');
    }
  }
  log('_styleExportSheet "' + name + '": ' + numData + ' rows');
}

// ─────────────────────────────────────────────────────────────
// STEP 2: AI BATCH CLASSIFICATION
// ─────────────────────────────────────────────────────────────
function classifyBatch() {
  log('classifyBatch() started');
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('SearchTerms');
  if (!sheet) { SpreadsheetApp.getUi().alert('❌ SearchTerms sheet not found!'); return; }

  const cfg     = getConfig();
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  log('Header row: ' + JSON.stringify(headers));

  // ── Column validation ────────────────────────────────────
  const COL = {
    searchTerm: headers.indexOf('SearchTerm'),
    clicks:     headers.indexOf('Clicks'),
    conv:       headers.indexOf('Conversions'),
    classif:    headers.indexOf('Classification'),
    conf:       headers.indexOf('Confidence'),
    reason:     headers.indexOf('AI Reason'),
    match:      headers.indexOf('Target Match Type'),
    exportZiel: headers.indexOf('Export Target'),
    status:     headers.indexOf('Status')
  };
  log('Column index map: ' + JSON.stringify(COL));

  const missingCols = Object.entries(COL).filter(([k, v]) => v === -1).map(([k]) => k);
  if (missingCols.length > 0) {
    const msg = `❌ Missing columns in SearchTerms:\n${missingCols.join(', ')}\n\nPlease run "1. Prepare Layout" first!`;
    log('ABORT — missing columns: ' + missingCols.join(', '));
    SpreadsheetApp.getUi().alert(msg);
    return;
  }

  if (data.length < 2) {
    SpreadsheetApp.getUi().alert('No data rows in the SearchTerms sheet.');
    return;
  }

  // ── Collect Pending rows (from i=2: row 1=header, row 2=hint row) ──
  const pendingRows = [];
  for (let i = 2; i < data.length; i++) {
    const classVal  = String(data[i][COL.classif] ?? '').trim();
    const statusVal = String(data[i][COL.status]  ?? '').trim();
    if ((classVal === 'Pending' || classVal === '') && statusVal !== 'Processed') {
      pendingRows.push(i);
    }
  }
  log(`Pending rows: ${pendingRows.length} of ${data.length - 2}`);

  if (pendingRows.length === 0) {
    SpreadsheetApp.getUi().alert('No new keywords to classify.\nAll rows already have a status.');
    return;
  }

  // ── Pre-classification via Config lists ──────────────────
  log('Starting Config list check...');
  const toAI = [];
  let configHits = 0, convProtected = 0;

  for (const i of pendingRows) {
    const term   = String(data[i][COL.searchTerm] ?? '').trim();
    const tLower = term.toLowerCase();
    const conv   = Number(data[i][COL.conv]) || 0;

    if (cfg.convProtect && conv > 0) {
      log(`Conv-Protected: "${term}" (${conv} conv)`);
      sheet.getRange(i + 1, COL.classif  + 1).setValue('⚠️ Conv-Protected');
      sheet.getRange(i + 1, COL.conf     + 1).setValue(1.0);
      sheet.getRange(i + 1, COL.reason   + 1).setValue('Has conversions — review manually');
      SpreadsheetApp.flush();
      convProtected++;
      continue;
    }

    let category = null, reason = '';
    if      (cfg.brandList.some(b => b && tLower.includes(b)))      { category = 'Own Brand';         reason = 'Match in brand list (Config)'; }
    else if (cfg.ignoreList.some(ign => ign && tLower.includes(ign))){ category = 'Junk';              reason = 'Match in block term list (Config)'; }
    else if (cfg.existingList.some(ex => ex && tLower === ex))       { category = 'Existing (Active)'; reason = 'Identical to active keyword (Config)'; }
    else if (cfg.competitorList.some(c => c && tLower.includes(c))) { category = 'Competitor';         reason = 'Match in competitor list (Config)'; }

    if (category) {
      log(`Config match: "${term}" → ${category}`);
      sheet.getRange(i + 1, COL.classif  + 1).setValue(category);
      sheet.getRange(i + 1, COL.conf     + 1).setValue(1.0);
      sheet.getRange(i + 1, COL.reason   + 1).setValue(reason);
      if (category === 'Competitor') {
        sheet.getRange(i + 1, COL.match     + 1).setValue('Phrase');
        sheet.getRange(i + 1, COL.exportZiel+ 1).setValue(cfg.defaultList);
      }
      SpreadsheetApp.flush();
      configHits++;
    } else {
      toAI.push({ rowIdx: i, term });
    }
  }

  log(`Config check: ${configHits} matches, ${convProtected} conv-protected, ${toAI.length} to AI`);

  if (toAI.length === 0) {
    const msg = `✅ Classification complete!\n\nConfig matches: ${configHits}\nConv-protected: ${convProtected}\nSent to AI: 0`;
    log(msg); SpreadsheetApp.getUi().alert(msg); return;
  }

  // ── Batch processing via AI ──────────────────────────────
  log(`AI batch for ${toAI.length} terms (batch size: ${cfg.batchSize})...`);
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
      const res    = results[k] || { category: 'Unclear', confidence: 0.0, reason: 'No result' };
      const cat    = res.category || 'Unclear';
      const conf   = parseFloat(res.confidence) || 0.0;
      const displayCat = (conf < cfg.confWarn && cat !== 'Unclear') ? ('⚠️ Check: ' + cat) : cat;

      log(`  "${term}" → ${displayCat} (${conf.toFixed(2)}) | ${res.reason}`);

      sheet.getRange(rowIdx + 1, COL.classif  + 1).setValue(displayCat);
      sheet.getRange(rowIdx + 1, COL.conf     + 1).setValue(conf);
      sheet.getRange(rowIdx + 1, COL.reason   + 1).setValue(res.reason || '');
      if (cat === 'Competitor') {
        sheet.getRange(rowIdx + 1, COL.match     + 1).setValue('Phrase');
        sheet.getRange(rowIdx + 1, COL.exportZiel+ 1).setValue(cfg.defaultList);
      }
      SpreadsheetApp.flush();
      processed++;
    }

    if (b + cfg.batchSize < toAI.length) { log('Pause 2s...'); Utilities.sleep(2000); }
  }

  const summary = `✅ AI analysis complete!\n\nConfig matches: ${configHits}\nConv-protected: ${convProtected}\nAI processed: ${processed} in ${totalBatches} batch(es)`;
  log(summary);
  SpreadsheetApp.getUi().alert(summary);
}

// ─────────────────────────────────────────────────────────────
// AI API: BATCH CALL
// ─────────────────────────────────────────────────────────────
function callAIBatch(terms, cfg) {
  const API_KEY = PropertiesService.getScriptProperties().getProperty('AIML_API_KEY');
  if (!API_KEY) {
    log('ERROR: AIML_API_KEY not set!');
    return terms.map(() => ({ category: 'Error', confidence: 0.0, reason: 'API key missing' }));
  }

  const url      = 'https://api.aimlapi.com/chat/completions';
  const catLines = cfg.categories.map(c => `  - "${c.code}": ${c.description}`).join('\n');
  const exLines  = cfg.examples.length > 0
    ? 'Examples:\n' + cfg.examples.map(e => `  - "${e.term}" → ${e.category}`).join('\n')
    : '';

  const systemPrompt =
    `You are an expert in Google Ads keyword analysis in the "${cfg.industry}" sector.\n\n` +
    `Available categories:\n${catLines}\n\n${exLines}\n\n` +
    `Respond EXCLUSIVELY with a valid JSON array. No other text, no markdown.\n` +
    `Format: [{"term":"...","category":"...","confidence":0.85,"reason":"..."}]\n` +
    `confidence: 0.0 (very uncertain) to 1.0 (very certain). reason: max. 12 words in English.`;

  const userPrompt = `Analyse these ${terms.length} search terms:\n` + terms.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const payload = {
    model: 'gpt-4o-mini-search-preview',
    web_search_options: {},
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    temperature: 0.1
  };

  try {
    log(`API call: ${terms.length} terms`);
    const response   = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + API_KEY.trim() },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    log(`API response code: ${statusCode}`);

    if (statusCode !== 200) {
      log(`API error: ${response.getContentText().substring(0, 300)}`);
      throw new Error(`HTTP ${statusCode}`);
    }

    const json    = JSON.parse(response.getContentText());
    const content = json.choices[0].message.content.trim();
    log(`API response (first 300 chars): ${content.substring(0, 300)}`);

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');

    const parsed = JSON.parse(jsonMatch[0]);
    log(`JSON parsed: ${parsed.length} results`);
    return terms.map((t, i) => parsed[i] || { category: 'Unclear', confidence: 0.0, reason: 'No result' });

  } catch (e) {
    log(`BATCH ERROR: ${e} — falling back to single processing`);
    return terms.map(t => callAISingle(t, cfg, API_KEY, url));
  }
}

// ─────────────────────────────────────────────────────────────
// AI API: FALLBACK SINGLE CALL
// ─────────────────────────────────────────────────────────────
function callAISingle(term, cfg, API_KEY, url) {
  log(`Single processing: "${term}"`);
  const catCodes = cfg.categories.map(c => c.code).join(', ');
  const payload  = {
    model: 'gpt-4o-mini-search-preview', web_search_options: {},
    messages: [
      { role: 'system', content: `Categorise in the "${cfg.industry}" sector. Categories: ${catCodes}. JSON only: {"category":"...","confidence":0.0,"reason":"..."}` },
      { role: 'user',   content: `Search term: "${term}"` }
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
    log(`Single response "${term}": ${content.substring(0, 100)}`);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { category: 'Unclear', confidence: 0.0, reason: 'Parse error' };
    return JSON.parse(jsonMatch[0]);
  } catch(e) {
    log(`Error single processing "${term}": ${e}`);
    return { category: 'Error', confidence: 0.0, reason: e.toString().substring(0, 50) };
  }
}

// ─────────────────────────────────────────────────────────────
// STEP 3: LEARNING LOOP
// Learns from ALL manual corrections:
//   Own Brand         → Config column A (Brand Terms)
//   Existing (Active) → Config column B
//   Junk              → Config column C (Block Terms)
//   Competitor        → Config column D
//   All corrections   → Config H:I (AI Examples, when AI was wrong)
// With duplicate check, loop from i=2
// ─────────────────────────────────────────────────────────────
function learningLoop() {
  log('learningLoop() started');
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const sheet    = ss.getSheetByName('SearchTerms');
  const cfgSheet = ss.getSheetByName('Config');
  const ui       = SpreadsheetApp.getUi();
  const data     = sheet.getDataRange().getValues();
  const headers  = data[0];

  const COL = {
    searchTerm: headers.indexOf('SearchTerm'),
    classif:    headers.indexOf('Classification'),
    korrektur:  headers.indexOf('Correction'),
    status:     headers.indexOf('Status')
  };

  var toAdd = { A: [], B: [], C: [], D: [] };
  var toAddExamples = [];

  // Loop from i=2 — i=0 header, i=1 hint row
  for (var i = 2; i < data.length; i++) {
    var corr   = String(data[i][COL.korrektur] || '').trim();
    var term   = String(data[i][COL.searchTerm]|| '').trim().toLowerCase();
    var status = String(data[i][COL.status]    || '').trim();
    var aiCat  = String(data[i][COL.classif]   || '').replace('⚠️ Check: ', '').trim();

    if (status !== 'Processed' || !corr || !term) continue;

    var kiWasWrong = (corr !== aiCat && aiCat !== '' && aiCat !== 'Pending');

    if      (corr === 'Own Brand')          { toAdd.A.push(term); }
    else if (corr === 'Existing (Active)')  { toAdd.B.push(term); }
    else if (corr === 'Junk')               { toAdd.C.push(term); }
    else if (corr === 'Competitor')         { toAdd.D.push(term); }
    else if (corr === 'Informational-Potential') {
      toAddExamples.push({ term: term, category: 'Informational-Potential' });
    }

    if (kiWasWrong && corr !== 'Informational-Potential') {
      toAddExamples.push({ term: term, category: corr });
    }
  }

  var totalLists    = toAdd.A.length + toAdd.B.length + toAdd.C.length + toAdd.D.length;
  var totalExamples = toAddExamples.length;
  log('Learning Loop: A=' + toAdd.A.length + ' B=' + toAdd.B.length + ' C=' + toAdd.C.length + ' D=' + toAdd.D.length + ' Examples=' + totalExamples);

  if (totalLists === 0 && totalExamples === 0) {
    ui.alert('ℹ️  No processed corrections found.\n\nNote: The Learning Loop only looks at rows with Status "Processed" and a correction in column J.');
    return;
  }

  // ── Duplicate check against existing Config entries ──────
  var existingLists = cfgSheet.getRange('A12:D200').getValues();
  var existing = { A: {}, B: {}, C: {}, D: {} };
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
    ui.alert('ℹ️  All terms already in Config.\n(' + dupTotal + ' duplicates skipped)');
    return;
  }

  // ── Show summary ─────────────────────────────────────────
  var msg = 'Learning Loop — New entries:\n\n';
  if (newA.length)  msg += 'Brand Terms (Config A):\n   '    + newA.join(', ')  + '\n\n';
  if (newB.length)  msg += 'Existing/Active (Config B):\n   ' + newB.join(', ')  + '\n\n';
  if (newC.length)  msg += 'Block Terms (Config C):\n   '    + newC.join(', ')  + '\n\n';
  if (newD.length)  msg += 'Competitors (Config D):\n   '    + newD.join(', ')  + '\n\n';
  if (newEx.length) msg += 'AI Examples (Config H:I):\n   '  + newEx.map(function(e) { return e.term + ' -> ' + e.category; }).join('\n   ') + '\n\n';
  if (dupTotal > 0) {
    var skipList = [];
    toAdd.A.filter(function(t){ return existing.A[t]; }).forEach(function(t){ skipList.push('Brand: ' + t); });
    toAdd.B.filter(function(t){ return existing.B[t]; }).forEach(function(t){ skipList.push('Existing: ' + t); });
    toAdd.C.filter(function(t){ return existing.C[t]; }).forEach(function(t){ skipList.push('Junk: ' + t); });
    toAdd.D.filter(function(t){ return existing.D[t]; }).forEach(function(t){ skipList.push('Competitor: ' + t); });
    toAddExamples.filter(function(e){ return existingExSet[e.term.toLowerCase()]; }).forEach(function(e){ skipList.push('Example: ' + e.term); });
    msg += 'Already present (skipped):\n   ' + skipList.join('\n   ') + '\n\n';
  }
  msg += 'Add to Config?';

  if (ui.alert(msg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  // ── Write to Config lists ─────────────────────────────────
  var lastUsedRow = existingLists.reduce(function(max, row, idx) {
    return (row[0]||row[1]||row[2]||row[3]) ? idx : max;
  }, -1);
  var nextListRow = lastUsedRow + 13;

  // Styling helper for Config list cells
  var styleListCell = function(cell) {
    cell.setFontFamily('Arial').setFontSize(10).setFontWeight('normal')
        .setFontColor('#1A1A2E').setBackground('#FFFFFF').setFontStyle('normal')
        .setHorizontalAlignment('left').setVerticalAlignment('center').setWrap(false)
        .setBorder(true, true, true, true, true, true,
          '#D0D0D0', SpreadsheetApp.BorderStyle.SOLID);
  };
  var writeListCell = function(row, col, value) {
    var cell = cfgSheet.getRange(row, col);
    cell.setValue(value);
    styleListCell(cell);
  };

  // Determine last filled row per column separately
  var nextRowA = 13, nextRowB = 13, nextRowC = 13, nextRowD = 13;
  existingLists.forEach(function(row, idx) {
    var sheetRow = idx + 12;
    if (row[0]) nextRowA = Math.max(nextRowA, sheetRow + 1);
    if (row[1]) nextRowB = Math.max(nextRowB, sheetRow + 1);
    if (row[2]) nextRowC = Math.max(nextRowC, sheetRow + 1);
    if (row[3]) nextRowD = Math.max(nextRowD, sheetRow + 1);
  });

  newA.forEach(function(t) { writeListCell(nextRowA, 1, t); nextRowA++; });
  newB.forEach(function(t) { writeListCell(nextRowB, 2, t); nextRowB++; });
  newC.forEach(function(t) { writeListCell(nextRowC, 3, t); nextRowC++; });
  newD.forEach(function(t) { writeListCell(nextRowD, 4, t); nextRowD++; });

  // Category colours for AI examples
  if (newEx.length > 0) {
    var lastExRow = existingExamples.reduce(function(max, row, idx) {
      return (row[0] || row[1]) ? idx : max;
    }, -1);
    var nextExRow = lastExRow + 2;
    if (nextExRow < 4) nextExRow = 4;

    var exColors = { 'Unclear': { bg: '#FFF3E0', fg: '#E65100' } };
    cfgSheet.getRange('E1:G50').getValues().filter(function(r){ return r[0] !== ''; }).forEach(function(row) {
      var code = String(row[0]).trim(), action = String(row[2]).trim();
      if      (action === 'Negative')   exColors[code] = { bg: '#FFE5E5', fg: '#CC0000' };
      else if (action === 'Expansion')  exColors[code] = { bg: '#E8FDF5', fg: '#0F6E56' };
      else                              exColors[code] = { bg: '#FFF3E0', fg: '#E65100' };
    });

    newEx.forEach(function(e) {
      var c = exColors[e.category] || { bg: '#FFF3E0', fg: '#E65100' };

      var hCell = cfgSheet.getRange(nextExRow, 8);
      hCell.clearFormat();
      hCell.setValue(e.term)
           .setFontFamily('Arial').setFontSize(10).setFontWeight('normal')
           .setFontColor('#1A1A2E').setBackground('#FFFFFF').setFontStyle('normal')
           .setHorizontalAlignment('left').setVerticalAlignment('center').setWrap(false)
           .setBorder(true, true, true, true, true, true,
             '#D0D0D0', SpreadsheetApp.BorderStyle.SOLID);

      var iCell = cfgSheet.getRange(nextExRow, 9);
      iCell.clearFormat();
      iCell.setValue(e.category)
           .setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
           .setFontColor('#000000').setBackground('#FFFFFF').setFontStyle('normal')
           .setHorizontalAlignment('center').setVerticalAlignment('center').setWrap(false)
           .setBorder(true, true, true, true, true, true,
             '#D0D0D0', SpreadsheetApp.BorderStyle.SOLID);

      nextExRow++;
    });
  }

  var summary = 'Config updated!\n\n' +
    (newA.length  ? 'Brand Terms:    +' + newA.length  + '\n' : '') +
    (newB.length  ? 'Existing:       +' + newB.length  + '\n' : '') +
    (newC.length  ? 'Block Terms:    +' + newC.length  + '\n' : '') +
    (newD.length  ? 'Competitors:    +' + newD.length  + '\n' : '') +
    (newEx.length ? 'AI Examples:    +' + newEx.length + '\n' : '') +
    (dupTotal > 0 ? '\nDuplicates skipped: ' + dupTotal : '');

  log(summary);
  ui.alert(summary);
}

// ─────────────────────────────────────────────────────────────
// STEP 4: EXPORT
// ─────────────────────────────────────────────────────────────
function exportValidated() {
  log('exportValidated() started');
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('SearchTerms');
  const cfg   = getConfig();
  const ui    = SpreadsheetApp.getUi();

  const response = ui.prompt('Export Target', 'Name of the negative list (default: ' + cfg.defaultList + '):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const finalTarget = response.getResponseText().trim() || cfg.defaultList;
  log('Export target: "' + finalTarget + '"');

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const COL = {
    camp:       headers.indexOf('Campaign'),
    searchTerm: headers.indexOf('SearchTerm'),
    clicks:     headers.indexOf('Clicks'),
    conv:       headers.indexOf('Conversions'),
    classif:    headers.indexOf('Classification'),
    korrektur:  headers.indexOf('Correction'),
    validiert:  headers.indexOf('Validated ✅'),
    match:      headers.indexOf('Target Match Type'),
    exportZiel: headers.indexOf('Export Target'),
    status:     headers.indexOf('Status')
  };

  const actionMap = {};
  cfg.categories.forEach(function(c) { actionMap[c.code] = c.action; });

  var negatives = [], expansionIdeas = [], skipped = 0;

  for (var i = 2; i < data.length; i++) {
    if (data[i][COL.validiert] !== true || String(data[i][COL.status]) === 'Processed') continue;

    const aiCat    = String(data[i][COL.classif]   || '').replace('⚠️ Check: ', '').trim();
    const manualCat= String(data[i][COL.korrektur] || '').trim();
    const finalCat = manualCat || aiCat;

    if (finalCat === '⚠️ Conv-Protected') { skipped++; continue; }

    const kw     = data[i][COL.searchTerm];
    const match  = data[i][COL.match]      || 'Phrase';
    const camp   = data[i][COL.camp];
    const action = actionMap[finalCat]     || 'Review';
    const dest   = data[i][COL.exportZiel] || finalTarget;

    log('Export: "' + kw + '" -> ' + finalCat + ' (' + action + ')');
    if (action === 'Negative')   negatives.push([dest, kw, match, camp, finalCat]);
    if (action === 'Expansion') expansionIdeas.push([kw, finalCat, camp, data[i][COL.clicks], data[i][COL.conv], new Date()]);

    sheet.getRange(i + 1, COL.status + 1).setValue('Processed');
  }

  if (negatives.length > 0)
    writeSheet('Negative_Export', ['List/Target','Keyword','Match Type','Source Campaign','Category'], negatives);
  if (expansionIdeas.length > 0)
    writeSheet('Expansion_Ideas', ['Potential Keyword','AI Category','Source Campaign','Clicks','Conversions','Date'], expansionIdeas);

  const summary = 'Export complete!\n\nNegatives: ' + negatives.length + '\nExpansion ideas: ' + expansionIdeas.length + '\nConv-protected skipped: ' + skipped;
  log(summary);
  ui.alert(summary);
}

// ─────────────────────────────────────────────────────────────
// HELPER: Write sheet with full formatting
// ─────────────────────────────────────────────────────────────
function writeSheet(name, headers, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); log('"' + name + '" created'); }

  // Set header if sheet is empty
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, headers.length).setValues([headers])
     .setFontWeight('bold');
    s.getRange(2, 1).setValue('→ Menu: 1. Prepare Layout to apply styling');
  }

  // Write data from next free row
  const firstRow = s.getLastRow() + 1;
  s.getRange(firstRow, 1, rows.length, rows[0].length).setValues(rows);
  log(rows.length + ' rows written to "' + name + '" (styling via setupLayout)');
}

// ─────────────────────────────────────────────────────────────
// UTILITY: Clear export sheets
// ─────────────────────────────────────────────────────────────
function clearExportSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const sheets = ['Negative_Export', 'Expansion_Ideas'];
  var cleared = [];
  sheets.forEach(function(name) {
    var s = ss.getSheetByName(name);
    if (s && s.getLastRow() > 1) {
      s.getRange(3, 1, s.getLastRow() - 2, s.getLastColumn()).clearContent();
      cleared.push(name);
      log('"' + name + '" cleared (rows 3+)');
    }
  });
  ui.alert(cleared.length > 0
    ? '🧹 Cleared:\n' + cleared.join('\n')
    : 'ℹ️  No data rows found to clear.');
}
