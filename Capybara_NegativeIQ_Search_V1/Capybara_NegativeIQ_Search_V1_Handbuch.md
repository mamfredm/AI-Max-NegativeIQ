# 🐾 Capybara NegativeIQ Search V1 — Master-Handbuch
**by Click-Capybara · [click-capybara.com/free-script.html](https://www.click-capybara.com/free-script.html)**

*Multi-Account · Config-driven · Batched AI · Agency Edition*

> Dieses Handbuch enthält alles: Architektur, Setup-Anleitung, täglichen Workflow, Config-Referenz und alle drei Skripte als fertige Copy-Paste-Blöcke.

---

## Features

| Feature | V2 | V1 |
|---|---|---|
| Branchenanpassung | Script editieren | Nur Config-Sheet befüllen |



| Audit-Trail | Keine Begründung | KI-Begründung pro Begriff |
| Conversion-Schutz | Nicht vorhanden | Automatisch aktiv |
| Confidence Score | Nicht vorhanden | 0.0–1.0 pro Begriff, farbkodiert |
| Duplikate im Sheet | Neue Zeile pro Tag | Klicks/Conversions aggregiert |
| Learning Loop | Nicht vorhanden | Korrekturen → Config zurückschreiben |
| Styling | Manuell | Vollautomatisch via Menü Schritt 1 |
| Logger | Keiner | Vollständig, inkl. Diagnose-Funktion |

---

## 1. Architektur — Was ist was

```
[Google Ads Konto]
        │
        ▼
[Skript A: Fetcher]          ← Google Ads > Tools > Skripte
        │  Holt täglich Suchbegriffe, dedupliciert, aggregiert Klicks/Conv
        ▼
[Google Sheet]
  ├── SearchTerms             ← Arbeitsfläche (Header Zeile 1, Hinweis Zeile 2, Daten ab Zeile 3)
  ├── Config                  ← Einzige Kundenanpassung
  ├── Negative_Export         ← Warteschlange für den Upload
  └── Expansion_Ideen         ← Potenziale für neue Kampagnen
        │
        ▼
[Skript B: GAS Zentral]      ← Sheet > Erweiterungen > Apps Script
  Menü-Funktionen:
  1. Layout & Dropdowns       → Styling ALLER 3 Sheets + Dropdowns + Checkboxen
  2. KI-Batch klassifizieren  → Config-Check → Batch-API → Confidence
  3. Learning Loop            → Korrekturen → Config zurückschreiben
  4. Export                   → Validierte Zeilen routen
  🧹 Export-Sheets leeren     → Neustart ohne Beispieldaten
  🔍 Diagnose & Debug         → Vollständiger Status-Report
        │
        ▼
[Skript C: Uploader]         ← Google Ads > Tools > Skripte
        │  Bucht Negative_Export ins Konto, löscht nur Erfolgreiche
        ▼
[Google Ads — Negatives live]
```

Der **API-Key** bleibt in den Skript-Eigenschaften des Apps Script Projekts — genau wie in V2.

---

## 2. Einmaliges Setup (Phase 1)

### Schritt 1 — Template als Google Sheet importieren

Das Template (`KI_Keyword_Analyzer_V1_Template.xlsx`) enthält alle vier Reiter bereits fertig formatiert mit Beispieldaten:

1. Datei in **Google Drive** hochladen
2. Rechtsklick → **Öffnen mit → Google Tabellen**
3. Fertig — alle Reiter sind vorhanden: `SearchTerms` · `Config` · `Negative_Export` · `Expansion_Ideen`

> **Kein manuelles Anlegen nötig.** Die Reiter, Header, Beispieldaten und das Basis-Styling sind bereits enthalten. Nur den Config-Tab auf den Kunden anpassen (Schritt 2).

---

### Schritt 2 — Config-Sheet befüllen

Das Config-Sheet ist die **einzige Stelle** die sich pro Kunde unterscheidet.

#### Bereich 1: Zellen A1:B7 — Client-Profil

| Zelle A | Eigenschaft | Beispielwert Messebau | Beispielwert Restaurant |
|---|---|---|---|
| A1 | `client_industry` | Messebau und Ausstellungssysteme | Restaurant-Gutscheine und Gastronomie |
| A2 | `client_name` | Muster Messebau GmbH | YOVITE GmbH |
| A3 | `client_language` | Deutsch | Deutsch |
| A4 | `default_neg_list` | Wettbewerber_Global | Wettbewerber |
| A5 | `conv_protect` | TRUE | TRUE |
| A6 | `confidence_warn` | 0.7 | 0.7 |
| A7 | `batch_size` | 15 | 15 |

- `conv_protect`: TRUE = Keywords mit Conversions > 0 werden als `⚠️ Conv-Schutz` markiert, nie exportiert.
- `confidence_warn`: Unter diesem Wert erscheint `⚠️ Prüfen: [Kategorie]` — KI-Vorschlag sichtbar, aber geflaggt.
- `batch_size`: Keywords pro API-Call, 10–20 empfohlen.

#### Bereich 2: Spalten E:G ab Zeile 1 — Kategorien

Die Dropdowns im SearchTerms-Sheet werden **automatisch** daraus aufgebaut.

| E — Kategorie-Code | F — Beschreibung für die KI | G — Aktion |
|---|---|---|
| Mitbewerber | Firmenname eines anderen Unternehmens in der Branche | Negativ |
| Ort | Stadt, Region, Land — geografische Angabe | Expansion |
| Informational | Allgemeine Info-Suche ohne Kaufabsicht | Negativ |
| Junk | Jobs, Gehalt, Forum, Wiki, DIY — kein kommerzielles Intent | Negativ |
| Unklar | Passt in keine andere Kategorie | Review |

Aktionen: `Negativ` → Negative_Export | `Expansion` → Expansion_Ideen | `Review` → bleibt in SearchTerms

#### Bereich 3: Spalten A:D ab Zeile 12 — Listen-Matching

Werden **vor dem API-Call** geprüft — kostenlos, instant.

| A — Brand | B — Bestand | C — Sperrbegriffe | D — Mitbewerber |
|---|---|---|---|
| muster messebau | messestand mieten | jobs | schaufler ag |
| muster gmbh | messebau kosten | stellenangebot | expotrade |

#### Bereich 4: Spalten H:I ab Zeile 1 — KI-Beispiele

5–8 Beispiele verbessern die Trefferquote drastisch.

| H — Suchbegriff | I — Korrekte Kategorie |
|---|---|
| Expotrade GmbH | Mitbewerber |
| Hannover | Ort |
| Messestand selbst bauen | Junk |

---

### Schritt 3 — GAS Zentral V1 einfügen

Sheet → **Erweiterungen > Apps Script** → alten Code löschen → Code aus Abschnitt "Skript B" einfügen → Speichern.
API-Key bleibt unverändert in den Skript-Eigenschaften.

### Schritt 4 — Fetcher in Google Ads installieren

Tools > Skripte → Neu → Code aus "Skript A" → `DEINE_SHEET_URL_HIER` ersetzen → Autorisieren → **Zeitplan: Täglich**.

### Schritt 5 — Uploader in Google Ads installieren

Tools > Skripte → Neu → Code aus "Skript C" → URL ersetzen → Autorisieren → manuell oder per Zeitplan.

---

## 3. Spalten-Legende SearchTerms

| Spalte | Name | Inhalt |
|---|---|---|
| A | Campaign | Kampagnenname |
| B | SearchTerm | Der Suchbegriff |
| C | Triggered Keyword | Auslösendes Keyword |
| D | Triggered Match | Match-Type |
| E | Clicks | 30 Tage, aggregiert |
| F | Conversions | 30 Tage, aggregiert |
| G | Classification | KI-Urteil, farbkodiert |
| H | Confidence | 0.0–1.0, grün/gelb/rot |
| I | KI-Begründung | Audit-Trail, 1 Satz |
| J | Korrektur | Manuell, überschreibt KI beim Export |
| K | Validiert ✅ | Checkbox, nur validierte werden exportiert |
| L | Target Match Type | Exact / Phrase / Broad |
| M | Export Ziel | Ziel-Negativ-Liste |
| N | Status | Pending / Verarbeitet |

**Zeile 1** = farbiger Header | **Zeile 2** = Hinweiszeile (kursiv) | **Ab Zeile 3** = Daten

---

## 4. Täglicher Workflow

**A — Automatisch:** Fetcher holt Suchbegriffe, neue → Pending, bekannte → Klicks aggregiert.

**B — Menü 1:** Erst nach dem ersten Fetcher-Lauf ausführen. Stylt alle drei Sheets auf einmal.

**C — Menü 2:** KI klassifiziert alle Pending-Zeilen. Config-Listen zuerst (kostenlos), Rest per API.

**D — Manueller Review:** G+H+I lesen → bei Bedarf Korrektur in J → Haken in K. Kein Auto-Export.

**E — Menü 1 (nochmal):** Nach Klassifizierung ausführen um das neue Styling anzuwenden.

**F — Menü 3 (optional):** Korrekturen in Config zurückschreiben. Spart zukünftige API-Kosten.

**G — Menü 4:** Export der validierten Zeilen. Export-Hint im Alert-Fenster erinnert an Schritt 1.

**H — Menü 1 (nochmal):** Export-Sheets stylen lassen.

**I — Uploader:** Negatives live buchen. Nur erfolgreiche Zeilen werden gelöscht.

> **Menü 1 ist idempotent** — jederzeit ausführbar ohne Datenverlust.

---

## 5. Neuen Kunden ausrollen

1. Sheet **duplizieren**
2. **Config-Tab** anpassen
3. Fetcher + Uploader: **Sheet-URL** aktualisieren, neu autorisieren
4. GAS Zentral: **nichts anfassen**

---

## 6. Troubleshooting

| Problem | Lösung |
|---|---|
| "Keine Keywords zum Klassifizieren" | 🔍 Diagnose ausführen |
| Kategorien 0 Einträge | Config E:G befüllen, dann Menü 1 |
| Confidence immer < 0.7 | Mehr Beispiele in Config H:I |
| Export-Sheets unformatiert | Menü 1 ausführen |
| Uploader findet Liste nicht | Groß-/Kleinschreibung in Config B4 prüfen |
| Doppelter onOpen-Fehler | Script komplett ersetzen, nicht nur Teile |
| Neue Reiter nötig | Template importieren statt manuell anlegen |

---

## Skript A: Fetcher V1
**Ort: Google Ads > Tools > Skripte | Zeitplan: Täglich**

```javascript
// ============================================================
// KI-Keyword-Analyzer V1 — Fetcher Script
// ============================================================

function main() {
  const SPREADSHEET_URL = 'DEINE_SHEET_URL_HIER';
  const SHEET_NAME      = 'SearchTerms';
  const LOOKBACK_DAYS   = 'LAST_30_DAYS';
  const MIN_CLICKS      = 1;

  const ss    = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  let sheet   = ss.getSheetByName(SHEET_NAME);

  const headers = [
    'Campaign', 'SearchTerm', 'Triggered Keyword', 'Triggered Match',
    'Clicks', 'Conversions', 'Classification', 'Confidence',
    'KI-Begründung', 'Korrektur', 'Validiert ✅', 'Target Match Type',
    'Export Ziel', 'Status'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }

  const existingData = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues() : [];

  const existingIndex = {};
  existingData.forEach((row, idx) => {
    if (String(row[13]).trim() !== 'Verarbeitet') {
      existingIndex[`${row[0]}|||${row[1]}`] = idx + 2;
    }
  });

  const query = `
    SELECT campaign.name, search_term_view.search_term,
           segments.keyword.info.text, segments.keyword.info.match_type,
           metrics.clicks, metrics.conversions
    FROM search_term_view
    WHERE metrics.clicks >= ${MIN_CLICKS}
    AND segments.date DURING ${LOOKBACK_DAYS}
    ORDER BY metrics.clicks DESC`;

  const report = AdsApp.search(query);
  const newRows = []; let updatedCount = 0;

  while (report.hasNext()) {
    const row   = report.next();
    const camp  = row.campaign.name;
    const term  = row.searchTermView.searchTerm;
    const kw    = row.segments.keyword.info.text;
    const match = row.segments.keyword.info.matchType;
    const clicks = row.metrics.clicks;
    const conv   = row.metrics.conversions;
    const key    = `${camp}|||${term}`;

    if (existingIndex.hasOwnProperty(key) && existingIndex[key] > 0) {
      const sr = existingIndex[key];
      sheet.getRange(sr, 5).setValue((Number(sheet.getRange(sr, 5).getValue()) || 0) + clicks);
      sheet.getRange(sr, 6).setValue((Number(sheet.getRange(sr, 6).getValue()) || 0) + conv);
      updatedCount++;
    } else if (!existingIndex.hasOwnProperty(key)) {
      newRows.push([camp, term, kw, match, clicks, conv, 'Pending', '', '', '', false, '', '', '']);
      existingIndex[key] = 0;
    }
  }

  if (newRows.length > 0) {
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      SpreadsheetApp.flush();
    }
    const firstDataRow = sheet.getLastRow() + 1;
    if (firstDataRow >= 2) {
      sheet.getRange(firstDataRow, 1, newRows.length, headers.length).setValues(newRows);
    }
  }

  console.log(`Fetcher: ${newRows.length} neu, ${updatedCount} aggregiert`);
}
```

---

## Skript B: GAS Zentral V1
**Ort: Google Sheet > Erweiterungen > Apps Script**
**API-Key: Zahnrad > Skripteigenschaften > `AIML_API_KEY`**

```javascript
// ============================================================
// KI-Keyword-Analyzer V1 — GAS Zentral-Skript
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 Keyword-Analyzer V1')
    .addItem('1. Layout & Dropdowns vorbereiten',          'setupLayout')
    .addItem('2. Neue Keywords klassifizieren (KI-Batch)', 'classifyBatch')
    .addItem('3. Korrekturen in Config zurückschreiben',   'learningLoop')
    .addItem('4. Validierte Daten exportieren',            'exportValidated')
    .addSeparator()
    .addItem('🧹 Export-Sheets leeren (Neustart)',         'clearExportSheets')
    .addItem('🔍 Diagnose & Debug',                        'debugDiagnose')
    .addToUi();
}

function log(msg) { console.log('[KWA] ' + msg); }

// ── DIAGNOSE ─────────────────────────────────────────────────
function debugDiagnose() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  let r = '🔍 DIAGNOSE-REPORT\n══════════════════\n\n';
  ['SearchTerms','Config','Negative_Export','Expansion_Ideen'].forEach(n => {
    r += (ss.getSheetByName(n) ? '  ✅ ' : '  ❌ FEHLT: ') + n + '\n';
  });
  const st = ss.getSheetByName('SearchTerms');
  if (st) {
    const hdrs = st.getLastRow() > 0 ? st.getRange(1,1,1,st.getLastColumn()).getValues()[0] : [];
    r += '\n📊 SEARCHTERMS HEADER:\n';
    ['Campaign','SearchTerm','Triggered Keyword','Triggered Match','Clicks','Conversions',
     'Classification','Confidence','KI-Begründung','Korrektur','Validiert ✅',
     'Target Match Type','Export Ziel','Status'].forEach(col => {
      const idx = hdrs.indexOf(col);
      r += (idx >= 0 ? `  ✅ "${col}" → Sp. ${idx+1}\n` : `  ❌ FEHLT: "${col}"\n`);
    });
    r += `  Zeilen gesamt: ${st.getLastRow()}\n`;
    if (st.getLastRow() > 2) {
      const ci = hdrs.indexOf('Classification');
      const data = st.getRange(3,1,st.getLastRow()-2,st.getLastColumn()).getValues();
      const counts = {};
      data.forEach(row => { const v = String(row[ci]||'leer').trim()||'leer'; counts[v]=(counts[v]||0)+1; });
      r += '\n  Classification:\n';
      Object.entries(counts).forEach(([k,v]) => r += `    "${k}": ${v}x\n`);
    }
  }
  const cfg = ss.getSheetByName('Config');
  if (cfg) {
    r += '\n⚙️ CONFIG:\n';
    cfg.getRange('A1:B7').getValues().forEach(row => { if (row[0]) r += `  ${row[0]}: "${row[1]}"\n`; });
    const cats = cfg.getRange('E1:G50').getValues().filter(x => x[0]!=='');
    r += `\n  Kategorien: ${cats.length} Einträge\n`;
    cats.forEach(x => r += `    "${x[0]}" → ${x[2]}\n`);
    const lists = cfg.getRange('A12:D200').getValues();
    r += `  Brand:${lists.filter(x=>x[0]).length} Bestand:${lists.filter(x=>x[1]).length} Ignore:${lists.filter(x=>x[2]).length} Competitor:${lists.filter(x=>x[3]).length}\n`;
    r += `  KI-Beispiele: ${cfg.getRange('H1:I20').getValues().filter(x=>x[0]!=='').length}\n`;
  }
  const k = PropertiesService.getScriptProperties().getProperty('AIML_API_KEY');
  r += k&&k.trim().length>10 ? `\n🔑 API-KEY: ✅ (${k.trim().length} Zeichen, ...${k.trim().slice(-4)})\n`
                              : `\n🔑 API-KEY: ❌ FEHLT → Zahnrad > Skripteigenschaften > AIML_API_KEY\n`;
  console.log(r); ui.alert(r);
}

// ── CONFIG LESEN ─────────────────────────────────────────────
function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = ss.getSheetByName('Config');
  if (!cfg) throw new Error('Config-Sheet nicht gefunden!');
  const cp = {};
  cfg.getRange('A1:B7').getValues().forEach(row => { if (row[0]) cp[String(row[0]).trim()] = row[1]; });
  log('Config: ' + JSON.stringify(cp));
  const categories = cfg.getRange('E1:G50').getValues().filter(r=>r[0]!=='')
    .map(r=>({code:String(r[0]).trim(),description:String(r[1]).trim(),action:String(r[2]).trim()}));
  const ld = cfg.getRange('A12:D200').getValues();
  const examples = cfg.getRange('H1:I20').getValues().filter(r=>r[0]!=='').map(r=>({term:r[0],category:r[1]}));
  const convProtectRaw = cp['conv_protect'];
  return {
    industry:    String(cp['client_industry']  || 'Online-Marketing'),
    defaultList: String(cp['default_neg_list'] || 'Wettbewerber_Global'),
    convProtect: convProtectRaw!==false && String(convProtectRaw).toUpperCase()!=='FALSE',
    confWarn:    parseFloat(cp['confidence_warn']) || 0.7,
    batchSize:   parseInt(cp['batch_size'])        || 15,
    categories,
    brandList:      ld.map(r=>String(r[0]).toLowerCase()).filter(Boolean),
    existingList:   ld.map(r=>String(r[1]).toLowerCase()).filter(Boolean),
    ignoreList:     ld.map(r=>String(r[2]).toLowerCase()).filter(Boolean),
    competitorList: ld.map(r=>String(r[3]).toLowerCase()).filter(Boolean),
    examples
  };
}

// ── SCHRITT 1: LAYOUT + STYLING ──────────────────────────────
function setupLayout() {
  log('setupLayout()');
  const ss = SpreadsheetApp.getActiveSpreadsheet(), cfg = getConfig();
  const sheet = ss.getSheetByName('SearchTerms');
  if (!sheet) { SpreadsheetApp.getUi().alert('❌ SearchTerms nicht gefunden!'); return; }

  sheet.setHiddenGridlines(true);
  [180,260,180,110,70,100,150,95,300,150,95,130,180,120].forEach((w,i) => sheet.setColumnWidth(i+1,w));

  const headers = ['Campaign','SearchTerm','Triggered Keyword','Triggered Match',
    'Clicks','Conversions','Classification','Confidence','KI-Begründung',
    'Korrektur','Validiert ✅','Target Match Type','Export Ziel','Status'];
  const hdrColors = ['#1A1A2E','#1A1A2E','#1A1A2E','#1A1A2E','#1A1A2E','#1A1A2E',
    '#0F3460','#0F3460','#0F3460','#CC0000','#0F6E56','#555555','#555555','#555555'];

  sheet.setRowHeight(1,30);
  sheet.getRange(1,1,1,14).setValues([headers])
       .setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
       .setFontColor('#FFFFFF').setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(false);
  hdrColors.forEach((c,i) => sheet.getRange(1,i+1).setBackground(c));

  sheet.setRowHeight(2,18);
  sheet.getRange(2,1,1,14).setValues([['↑ aus Google Ads','↑ aus Google Ads','↑ aus Google Ads','↑ aus Google Ads',
    '30 Tage','30 Tage','KI-Urteil','0.0–1.0','Warum?',
    'Manuell korrigieren','✓ = exportieren','Exact/Phrase/Broad','Ziel-Liste','Pending / Verarbeitet']])
       .setFontFamily('Arial').setFontSize(8).setFontWeight('normal')
       .setFontColor('#888888').setFontStyle('italic').setBackground('#F8F9FA')
       .setHorizontalAlignment('center').setVerticalAlignment('middle');

  sheet.setFrozenRows(2); sheet.setFrozenColumns(2);

  const lastRow = sheet.getLastRow(); let stRows = 0;
  if (lastRow >= 3) {
    stRows = lastRow - 2;
    const catCodes = cfg.categories.map(c=>c.code);
    if (catCodes.length > 0) {
      sheet.getRange(3,10,stRows).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(catCodes,true).build());
    }
    sheet.getRange(3,11,stRows).insertCheckboxes();
    sheet.getRange(3,12,stRows).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Exact','Phrase','Broad'],true).build());
    _styleSearchTermRows(sheet, 3, lastRow);
  }

  _styleExportSheet(ss, 'Negative_Export');
  _styleExportSheet(ss, 'Expansion_Ideen');

  SpreadsheetApp.getUi().alert('✅ Layout & Styling abgeschlossen!\n\nSearchTerms: '+stRows+' Zeilen\nNegative_Export: ✅\nExpansion_Ideen: ✅');
}

function _styleSearchTermRows(sheet, fromRow, toRow) {
  if (toRow < fromRow) return;
  const cc = {
    'Mitbewerber':{bg:'#FFE5E5',fg:'#CC0000'},'Ort':{bg:'#E8FDF5',fg:'#0F6E56'},
    'Informational':{bg:'#FFE5E5',fg:'#CC0000'},'Junk':{bg:'#FFE5E5',fg:'#CC0000'},
    'Eigene Marke':{bg:'#E8F4FD',fg:'#185FA5'},'Bestand (Aktiv)':{bg:'#E8F4FD',fg:'#185FA5'},
    'Unklar':{bg:'#FFF8E1',fg:'#854F0B'}
  };
  const numRows = toRow-fromRow+1, data = sheet.getRange(fromRow,1,numRows,14).getValues();
  sheet.getRange(fromRow,1,numRows,14)
       .setFontFamily('Arial').setFontSize(10).setFontColor('#1A1A2E')
       .setVerticalAlignment('middle').setHorizontalAlignment('left')
       .setBorder(true,true,true,true,true,true,'#D0D0D0',SpreadsheetApp.BorderStyle.SOLID).setWrap(false);
  for (let r=0;r<numRows;r++) {
    const sr=fromRow+r;
    sheet.setRowHeight(sr,22);
    sheet.getRange(sr,1,1,14).setBackground(r%2===0?'#FFFFFF':'#F8F9FA');
    const ck = String(data[r][6]||'').replace('⚠️ Prüfen: ','').trim();
    if (ck===''||ck==='Pending'||ck==='⚠️ Conv-Schutz') {
      sheet.getRange(sr,7).setBackground('#FFF8E1').setFontColor('#854F0B').setFontWeight('bold').setHorizontalAlignment('center');
    } else {
      const bk = Object.keys(cc).find(k=>ck.startsWith(k));
      if (bk) sheet.getRange(sr,7).setBackground(cc[bk].bg).setFontColor(cc[bk].fg).setFontWeight('bold').setHorizontalAlignment('center');
    }
    const cv = data[r][7];
    if (cv!==''&&cv!==null) {
      const conf=parseFloat(cv)||0;
      sheet.getRange(sr,8)
           .setBackground(conf>=0.8?'#E8FDF5':conf>=0.7?'#FFF8E1':'#FFE5E5')
           .setFontColor(conf>=0.8?'#0F6E56':conf>=0.7?'#854F0B':'#CC0000')
           .setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('0.00');
    }
    sheet.getRange(sr,5,1,2).setHorizontalAlignment('center');
    sheet.getRange(sr,9).setWrap(true);
    if (String(data[r][13]).trim()==='Verarbeitet') sheet.getRange(sr,14).setFontColor('#888888').setFontStyle('italic');
  }
}

function _styleExportSheet(ss, name) {
  const s = ss.getSheetByName(name);
  if (!s||s.getLastRow()<1) return;
  const isNeg=name==='Negative_Export', HDR=isNeg?'#CC0000':'#0F6E56', BNR=isNeg?'#FFF8E1':'#E8FDF5', BD='#D0D0D0';
  const catC={'Mitbewerber':{bg:'#FFE5E5',fg:'#CC0000'},'Junk':{bg:'#FFE5E5',fg:'#CC0000'},
    'Informational':{bg:'#FFE5E5',fg:'#CC0000'},'Ort':{bg:'#E8FDF5',fg:'#0F6E56'},
    'Expansion':{bg:'#E8FDF5',fg:'#0F6E56'},'Unklar':{bg:'#F8F9FA',fg:'#555555'}};
  s.setHiddenGridlines(true);
  const nc=s.getLastColumn(), lr=s.getLastRow();
  (isNeg?[220,260,100,240,130]:[260,130,220,80,110,100]).forEach((w,i)=>s.setColumnWidth(i+1,w));
  s.getRange(1,1,1,nc).setFontFamily('Arial').setFontSize(10).setFontWeight('bold')
   .setFontColor('#FFFFFF').setBackground(HDR).setHorizontalAlignment('center').setVerticalAlignment('middle')
   .setBorder(true,true,true,true,true,true,BD,SpreadsheetApp.BorderStyle.SOLID);
  s.setRowHeight(1,28);
  if (lr>=2) {
    const bt=isNeg?'ℹ️  Der Uploader löscht nur erfolgreich hochgeladene Zeilen. Fehlgeschlagene bleiben stehen. Listennamen Groß-/Kleinschreibungs-sensitiv!'
                  :'ℹ️  Hier landen Begriffe mit Aktion "Expansion" — Städte, Regionen, Produktvarianten mit Potenzial. Basis für neue Kampagnen-Strukturen.';
    try { s.getRange(2,1,1,nc).breakApart(); } catch(e) {}
    s.getRange(2,1,1,nc).merge().setValue(bt).setFontFamily('Arial').setFontSize(9).setFontStyle('italic')
     .setFontColor('#555555').setBackground(BNR).setWrap(true).setVerticalAlignment('middle')
     .setBorder(true,true,true,true,false,false,BD,SpreadsheetApp.BorderStyle.SOLID);
    s.setRowHeight(2,38);
  }
  s.setFrozenRows(2);
  if (lr<3) return;
  const nd=lr-2, data=s.getRange(3,1,nd,nc).getValues();
  s.getRange(3,1,nd,nc).setFontFamily('Arial').setFontSize(10).setFontColor('#1A1A2E')
   .setVerticalAlignment('middle').setHorizontalAlignment('left')
   .setBorder(true,true,true,true,true,true,BD,SpreadsheetApp.BorderStyle.SOLID).setWrap(false);
  for (let r=0;r<nd;r++) {
    const sr=3+r, rb=r%2===0?'#FFFFFF':'#F8F9FA';
    s.setRowHeight(sr,22); s.getRange(sr,1,1,nc).setBackground(rb);
    if (isNeg) {
      s.getRange(sr,3).setHorizontalAlignment('center');
      const c=catC[String(data[r][4])]||{bg:rb,fg:'#1A1A2E'};
      s.getRange(sr,5).setBackground(c.bg).setFontColor(c.fg).setFontWeight('bold').setHorizontalAlignment('center');
    } else {
      const c=catC[String(data[r][1])]||{bg:rb,fg:'#1A1A2E'};
      s.getRange(sr,2).setBackground(c.bg).setFontColor(c.fg).setFontWeight('bold').setHorizontalAlignment('center');
      s.getRange(sr,4,1,2).setHorizontalAlignment('center');
      s.getRange(sr,6).setNumberFormat('DD.MM.YYYY').setHorizontalAlignment('center');
    }
  }
}

// ── SCHRITT 2: KI-BATCH ──────────────────────────────────────
function classifyBatch() {
  log('classifyBatch()');
  const ss=SpreadsheetApp.getActiveSpreadsheet(), sheet=ss.getSheetByName('SearchTerms');
  if (!sheet) { SpreadsheetApp.getUi().alert('❌ SearchTerms nicht gefunden!'); return; }
  const cfg=getConfig(), data=sheet.getDataRange().getValues(), hdrs=data[0];
  const COL={searchTerm:hdrs.indexOf('SearchTerm'),clicks:hdrs.indexOf('Clicks'),
    conv:hdrs.indexOf('Conversions'),classif:hdrs.indexOf('Classification'),
    conf:hdrs.indexOf('Confidence'),reason:hdrs.indexOf('KI-Begründung'),
    match:hdrs.indexOf('Target Match Type'),exportZiel:hdrs.indexOf('Export Ziel'),status:hdrs.indexOf('Status')};
  const missing=Object.entries(COL).filter(([k,v])=>v===-1).map(([k])=>k);
  if (missing.length) { SpreadsheetApp.getUi().alert('❌ Fehlende Spalten:\n'+missing.join(', ')+'\n\n→ Bitte "1. Layout" ausführen!'); return; }

  const pendingRows=[];
  for (let i=2;i<data.length;i++) {
    const cv=String(data[i][COL.classif]??'').trim(), sv=String(data[i][COL.status]??'').trim();
    if ((cv==='Pending'||cv==='')&&sv!=='Verarbeitet') pendingRows.push(i);
  }
  if (!pendingRows.length) { SpreadsheetApp.getUi().alert('Keine neuen Keywords zum Klassifizieren.'); return; }

  const toAI=[]; let hits=0, prot=0;
  for (const i of pendingRows) {
    const term=String(data[i][COL.searchTerm]??'').trim(), tL=term.toLowerCase();
    const conv=Number(data[i][COL.conv])||0;
    if (cfg.convProtect&&conv>0) {
      sheet.getRange(i+1,COL.classif+1).setValue('⚠️ Conv-Schutz');
      sheet.getRange(i+1,COL.conf+1).setValue(1.0);
      sheet.getRange(i+1,COL.reason+1).setValue('Conversions vorhanden — manuell prüfen');
      SpreadsheetApp.flush(); prot++; continue;
    }
    let cat=null, rsn='';
    if      (cfg.brandList.some(b=>b&&tL.includes(b)))       { cat='Eigene Marke';    rsn='Brand-Liste (Config)'; }
    else if (cfg.ignoreList.some(b=>b&&tL.includes(b)))      { cat='Junk';             rsn='Sperrbegriff (Config)'; }
    else if (cfg.existingList.some(b=>b&&tL===b))            { cat='Bestand (Aktiv)'; rsn='Aktives Keyword (Config)'; }
    else if (cfg.competitorList.some(b=>b&&tL.includes(b)))  { cat='Mitbewerber';      rsn='Mitbewerber-Liste (Config)'; }
    if (cat) {
      sheet.getRange(i+1,COL.classif+1).setValue(cat);
      sheet.getRange(i+1,COL.conf+1).setValue(1.0);
      sheet.getRange(i+1,COL.reason+1).setValue(rsn);
      if (cat==='Mitbewerber') { sheet.getRange(i+1,COL.match+1).setValue('Phrase'); sheet.getRange(i+1,COL.exportZiel+1).setValue(cfg.defaultList); }
      SpreadsheetApp.flush(); hits++;
    } else { toAI.push({rowIdx:i,term}); }
  }

  if (!toAI.length) { SpreadsheetApp.getUi().alert('✅ Abgeschlossen!\nConfig: '+hits+'\nConv-Schutz: '+prot+'\nKI: 0'); return; }

  let processed=0; const tb=Math.ceil(toAI.length/cfg.batchSize);
  for (let b=0;b<toAI.length;b+=cfg.batchSize) {
    const chunk=toAI.slice(b,b+cfg.batchSize), results=callAIBatch(chunk.map(c=>c.term),cfg);
    for (let k=0;k<chunk.length;k++) {
      const ri=chunk[k].rowIdx, res=results[k]||{category:'Unklar',confidence:0,reason:'Kein Ergebnis'};
      const cat=res.category||'Unklar', conf=parseFloat(res.confidence)||0;
      const dc=(conf<cfg.confWarn&&cat!=='Unklar')?'⚠️ Prüfen: '+cat:cat;
      sheet.getRange(ri+1,COL.classif+1).setValue(dc);
      sheet.getRange(ri+1,COL.conf+1).setValue(conf);
      sheet.getRange(ri+1,COL.reason+1).setValue(res.reason||'');
      if (cat==='Mitbewerber') { sheet.getRange(ri+1,COL.match+1).setValue('Phrase'); sheet.getRange(ri+1,COL.exportZiel+1).setValue(cfg.defaultList); }
      SpreadsheetApp.flush(); processed++;
    }
    if (b+cfg.batchSize<toAI.length) Utilities.sleep(2000);
  }
  SpreadsheetApp.getUi().alert('✅ KI abgeschlossen!\nConfig: '+hits+'\nConv-Schutz: '+prot+'\nKI: '+processed+' in '+tb+' Batch(es)\n\n→ Jetzt "1. Layout" ausführen für das Styling.');
}

function callAIBatch(terms, cfg) {
  const KEY=PropertiesService.getScriptProperties().getProperty('AIML_API_KEY');
  if (!KEY) return terms.map(()=>({category:'Error',confidence:0,reason:'API-Key fehlt'}));
  const url='https://api.aimlapi.com/chat/completions';
  const catLines=cfg.categories.map(c=>`  - "${c.code}": ${c.description}`).join('\n');
  const exLines=cfg.examples.length?'Beispiele:\n'+cfg.examples.map(e=>`  - "${e.term}" → ${e.category}`).join('\n'):'';
  const sys=`Du bist Experte für Google Ads Keyword-Analyse im Bereich "${cfg.industry}".\n\nKategorien:\n${catLines}\n\n${exLines}\n\nAntworte NUR mit JSON-Array: [{"term":"...","category":"...","confidence":0.85,"reason":"..."}]`;
  const usr=`Analysiere ${terms.length} Suchbegriffe:\n`+terms.map((t,i)=>`${i+1}. ${t}`).join('\n');
  try {
    const resp=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
      headers:{Authorization:'Bearer '+KEY.trim()},
      payload:JSON.stringify({model:'gpt-4o-mini-search-preview',web_search_options:{},
        messages:[{role:'system',content:sys},{role:'user',content:usr}],temperature:0.1}),
      muteHttpExceptions:true});
    if (resp.getResponseCode()!==200) throw new Error('HTTP '+resp.getResponseCode());
    const content=JSON.parse(resp.getContentText()).choices[0].message.content.trim();
    log('API: '+content.substring(0,200));
    const m=content.match(/\[[\s\S]*\]/);
    if (!m) throw new Error('Kein JSON-Array');
    const p=JSON.parse(m[0]);
    return terms.map((t,i)=>p[i]||{category:'Unklar',confidence:0,reason:'Kein Ergebnis'});
  } catch(e) {
    log('BATCH FEHLER: '+e+' — FALLBACK');
    return terms.map(t=>callAISingle(t,cfg,KEY,url));
  }
}

function callAISingle(term, cfg, KEY, url) {
  const cc=cfg.categories.map(c=>c.code).join(', ');
  try {
    const resp=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
      headers:{Authorization:'Bearer '+KEY.trim()},
      payload:JSON.stringify({model:'gpt-4o-mini-search-preview',web_search_options:{},
        messages:[{role:'system',content:`Kategorisiere "${cfg.industry}". Kategorien: ${cc}. Nur JSON: {"category":"...","confidence":0,"reason":"..."}`},
          {role:'user',content:`"${term}"`}],temperature:0.1}),muteHttpExceptions:true});
    const content=JSON.parse(resp.getContentText()).choices[0].message.content.trim();
    const m=content.match(/\{[\s\S]*\}/);
    return m?JSON.parse(m[0]):{category:'Unklar',confidence:0,reason:'Parse-Fehler'};
  } catch(e) { return {category:'Error',confidence:0,reason:e.toString().substring(0,50)}; }
}

// ── SCHRITT 3: LEARNING LOOP ─────────────────────────────────
function learningLoop() {
  const ss=SpreadsheetApp.getActiveSpreadsheet(), sheet=ss.getSheetByName('SearchTerms');
  const cfgSheet=ss.getSheetByName('Config'), ui=SpreadsheetApp.getUi();
  const data=sheet.getDataRange().getValues(), hdrs=data[0];
  const COL={st:hdrs.indexOf('SearchTerm'),kk:hdrs.indexOf('Korrektur'),sv:hdrs.indexOf('Status')};
  const comp=[], junk=[];
  for (let i=1;i<data.length;i++) {
    const corr=String(data[i][COL.kk]??'').trim(), term=String(data[i][COL.st]??'').trim().toLowerCase();
    if (String(data[i][COL.sv]??'').trim()!=='Verarbeitet'||!corr||!term) continue;
    if (corr==='Mitbewerber') comp.push(term);
    if (corr==='Junk')        junk.push(term);
  }
  if (!comp.length&&!junk.length) { ui.alert('Keine Korrekturen gefunden.'); return; }
  const msg='Learning Loop:\n\n'+(comp.length?'Mitbewerber → Config D:\n'+comp.join(', ')+'\n\n':'')
            +(junk.length?'Junk → Config C:\n'+junk.join(', ')+'\n\n':'')+'\nIn Config eintragen?';
  if (ui.alert(msg,ui.ButtonSet.YES_NO)!==ui.Button.YES) return;
  const cd=cfgSheet.getRange('A12:D200').getValues();
  let nr=cd.reduce((max,row,idx)=>(row[0]||row[1]||row[2]||row[3])?idx:max,-1)+13;
  comp.forEach(t=>{cfgSheet.getRange(nr,4).setValue(t);nr++;});
  junk.forEach(t=>{cfgSheet.getRange(nr,3).setValue(t);nr++;});
  ui.alert('✅ Config aktualisiert.');
}

// ── SCHRITT 4: EXPORT ────────────────────────────────────────
function exportValidated() {
  const ss=SpreadsheetApp.getActiveSpreadsheet(), sheet=ss.getSheetByName('SearchTerms');
  const cfg=getConfig(), ui=SpreadsheetApp.getUi();
  const resp=ui.prompt('Export-Ziel','Name der Negativ-Liste (Standard: '+cfg.defaultList+'):',ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton()!==ui.Button.OK) return;
  const target=resp.getResponseText().trim()||cfg.defaultList;
  const data=sheet.getDataRange().getValues(), hdrs=data[0];
  const COL={camp:hdrs.indexOf('Campaign'),st:hdrs.indexOf('SearchTerm'),
    cl:hdrs.indexOf('Clicks'),co:hdrs.indexOf('Conversions'),cf:hdrs.indexOf('Classification'),
    kk:hdrs.indexOf('Korrektur'),vl:hdrs.indexOf('Validiert ✅'),mt:hdrs.indexOf('Target Match Type'),
    ez:hdrs.indexOf('Export Ziel'),sv:hdrs.indexOf('Status')};
  const am={}; cfg.categories.forEach(c=>{am[c.code]=c.action;});
  let neg=[], exp=[], skip=0;
  for (let i=2;i<data.length;i++) {
    if (data[i][COL.vl]!==true||String(data[i][COL.sv])==='Verarbeitet') continue;
    const ai=String(data[i][COL.cf]??'').replace('⚠️ Prüfen: ','').trim();
    const man=String(data[i][COL.kk]??'').trim(), fc=man||ai;
    if (fc==='⚠️ Conv-Schutz') { skip++; continue; }
    const kw=data[i][COL.st], mt=data[i][COL.mt]||'Phrase', camp=data[i][COL.camp];
    const action=am[fc]||'Review', dest=data[i][COL.ez]||target;
    if (action==='Negativ')   neg.push([dest,kw,mt,camp,fc]);
    if (action==='Expansion') exp.push([kw,fc,camp,data[i][COL.cl],data[i][COL.co],new Date()]);
    sheet.getRange(i+1,COL.sv+1).setValue('Verarbeitet');
  }
  if (neg.length) writeSheet('Negative_Export',['Liste/Ziel','Keyword','Match Type','Herkunftskampagne','Kategorie'],neg);
  if (exp.length) writeSheet('Expansion_Ideen',['Potenzielles Keyword','KI-Kategorie','Quelle-Kampagne','Klicks','Conversions','Datum'],exp);
  ui.alert('✅ Export!\nNegatives: '+neg.length+'\nExpansion: '+exp.length+'\nConv-Schutz: '+skip+'\n\n→ Jetzt "1. Layout" für das Styling ausführen.');
}

// ── HILFSFUNKTIONEN ──────────────────────────────────────────
function writeSheet(name, headers, rows) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let s=ss.getSheetByName(name);
  if (!s) { s=ss.insertSheet(name); }
  if (s.getLastRow()===0) {
    s.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
    s.getRange(2,1).setValue('→ Menü: 1. Layout & Dropdowns vorbereiten zum Stylen');
  }
  s.getRange(s.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
}

function clearExportSheets() {
  const ui=SpreadsheetApp.getUi();
  if (ui.alert('Export-Sheets leeren','Alle Inhalte aus Negative_Export und Expansion_Ideen löschen?',ui.ButtonSet.YES_NO)!==ui.Button.YES) return;
  ['Negative_Export','Expansion_Ideen'].forEach(n=>{
    const s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
    if (s&&s.getLastRow()>0) { s.clearContents(); s.clearFormats(); }
  });
  ui.alert('✅ Export-Sheets geleert.');
}
```

---

## Skript C: Uploader V1
**Ort: Google Ads > Tools > Skripte**

```javascript
// ============================================================
// KI-Keyword-Analyzer V1 — Uploader Script
// Hinweis: Daten starten ab Zeile 3 (Zeile 2 = Banner)
// ============================================================

function main() {
  const SPREADSHEET_URL   = 'DEINE_SHEET_URL_HIER';
  const EXPORT_SHEET_NAME = 'Negative_Export';

  const ss=SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  const sheet=ss.getSheetByName(EXPORT_SHEET_NAME);
  if (!sheet||sheet.getLastRow()<3) { console.log('Keine Daten zum Hochladen.'); return; }

  // Ab Zeile 3 lesen (Zeile 1=Header, Zeile 2=Banner)
  const data=sheet.getRange(3,1,sheet.getLastRow()-2,5).getValues();
  let ok=0, err=0; const okRows=[];

  console.log('--- Upload: '+data.length+' Keywords ---');

  for (let i=0;i<data.length;i++) {
    const target=String(data[i][0]).trim(), kw=String(data[i][1]).trim();
    const mt=String(data[i][2]).trim(), camp=String(data[i][3]).trim();
    if (!kw||!target) { console.log('⚠️ Zeile '+(i+3)+': leer — übersprungen'); err++; continue; }
    const fmt=mt==='Exact'?'['+kw+']':mt==='Phrase'?'"'+kw+'"':kw;
    try {
      if (target.toLowerCase()==='kampagne') {
        const it=AdsApp.campaigns().withCondition('Name = "'+camp+'"').get();
        if (it.hasNext()) { it.next().createNegativeKeyword(fmt); console.log('✅ Kampagne "'+camp+'": '+fmt); ok++; okRows.push(i); }
        else { console.log('⚠️ Kampagne nicht gefunden: "'+camp+'"'); err++; }
      } else {
        const it=AdsApp.negativeKeywordLists().withCondition('Name = "'+target+'"').get();
        if (it.hasNext()) { it.next().addNegativeKeyword(fmt); console.log('✅ Liste "'+target+'": '+fmt); ok++; okRows.push(i); }
        else { console.log('⚠️ Liste nicht gefunden: "'+target+'" — Groß-/Kleinschreibung prüfen!'); err++; }
      }
    } catch(e) { console.log('❌ Fehler "'+kw+'": '+e); err++; }
  }

  // Erfolgreiche Zeilen löschen (von unten, +3 wegen Header+Banner)
  if (okRows.length>0) {
    okRows.map(i=>i+3).sort((a,b)=>b-a).forEach(row=>sheet.deleteRow(row));
    console.log('🗑️ '+okRows.length+' Zeilen entfernt.');
  }
  console.log('--- Fertig | Erfolgreich: '+ok+' | Fehler: '+err+' ---');
}
```


---

*🐾 Capybara NegativeIQ Search — by [Click-Capybara](https://www.click-capybara.com/free-script.html) · [GitHub](https://github.com/mamfredm/CapybaraNegativeIQ-Search)*
