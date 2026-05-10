<div align="center">

<img src="assets/capybara_outine_bold.svg" width="80" alt="Click-Capybara Logo" />

# AI Max NegativeIQ

### AI-powered search term classification for Google Ads.
### No agency or emails required.
### Free. Open source. 

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-fcba02?style=flat-square)](https://opensource.org/licenses/MIT)
[![Google Ads Scripts](https://img.shields.io/badge/Google%20Ads-Scripts-4285F4?style=flat-square&logo=google)](https://ads.google.com)
[![Google Sheets](https://img.shields.io/badge/Google-Sheets-34A853?style=flat-square&logo=google-sheets&logoColor=white)](https://docs.google.com/spreadsheets/d/1QElpjSapCqKwZW2-WYUEGYwMJTvk2gxLkyawcTYFq7g/copy)

[![Language: DE](https://img.shields.io/badge/🇩🇪%20German-available-lightgrey?style=flat-square)]()
[![Version](https://img.shields.io/badge/version-1.5DE-success?style=flat-square)]()

</div>

---

## What is NegativeIQ?

Most Google Ads accounts are silently leaking budget every day, on job seekers, competitors, and irrelevant queries that will never convert. Manually reviewing search terms is slow, inconsistent, and doesn't scale.

**NegativeIQ automates the entire process.**

It fetches your search terms from Google Ads into a Google Sheet, classifies each one using AI, and lets you push confirmed negatives back into your campaigns with a single click. No data leaves your account. No subscriptions. No black box.

```
Fetch → Pre-classify → AI-classify → You review → Push negatives → System learns
```

---

## How it works

| Step | What happens |
|------|-------------|
| **1. Fetcher runs daily** | Pulls all search terms from your Search campaigns into the Google Sheet |
| **2. Pre-classify** | Rule-based pass against your keyword lists — zero API cost |
| **3. AI-classify** | Remaining terms sent to AI in batches — classified in seconds |
| **4. You review** | Check classification, confidence score, and AI reasoning. Override if needed |
| **5. Export** | Validated negatives written to staging sheet |
| **6. Uploader runs** | Books negatives into your campaigns or shared negative lists |
| **7. Learning loop** | Your corrections feed back into keyword lists and AI examples |

---

## Architecture

```
Google Ads
    │
    ├── Fetcher Script (Google Ads Scripts — runs daily)
    │       → Writes search terms to Google Sheet
    │
Google Sheet (Apps Script)
    ├── AI Config       — client profile, categories, AI examples, neg_lists registry
    ├── Keyword Lists   — Brand Pure / Brand Kombi / Bestand / Sperrbegriffe / Mitbewerber / Brand Noise
    ├── SearchTerms     — search campaign terms
    ├── Negative_Export — staging area for the uploader
    └── Expansion_Ideen — keywords flagged as expansion opportunities
    │
    └── Uploader Script (Google Ads Scripts)
            Books Negative_Export rows into Google Ads
            Deletes successfully uploaded rows from the sheet
```

---

## Files

| File | Where it lives | What it does |
|------|---------------|-------------|
| `AI_Max_NegativeIQ_V1_5DE_GAS.js` | Google Sheet → Extensions → Apps Script | Main Apps Script — classification, export, learning loop |
| `AI_Max_NegativeIQ_V1_5DE_fetcher.js` | Google Ads → Tools → Scripts | Fetches search terms into the Sheet |
| `AI_Max_NegativeIQ_V1_5_uploader.js` | Google Ads → Tools → Scripts | Reads `Negative_Export` and books negatives into Google Ads |
| `AI_Max_NegativeIQ_V1_5DE_Template.xlsx` | — | Sheet template reference |

---

## Setup

### 1. Google Sheet

Create a new Google Sheet with these tabs (exact names, case-sensitive):

`SearchTerms` · `AI Config` · `Keyword Lists` · `Negative_Export` · `Expansion_Ideen`

Or [**copy the template directly →**](https://docs.google.com/spreadsheets/d/1QElpjSapCqKwZW2-WYUEGYwMJTvk2gxLkyawcTYFq7g/copy)

### 2. Apps Script

Open the Sheet → **Extensions → Apps Script**. Paste `AI_Max_NegativeIQ_V1_5DE_GAS.js` and save.

Set your API key: gear icon → **Script Properties** → add:

```
Key:   AIML_API_KEY
Value: your-api-key-here
```

Uses [AIML API](https://aimlapi.com/) with `gpt-4o-mini` by default. Swap model or endpoint in `callAIBatch()` if needed.

### 3. AI Config sheet

**A1:B7 — Client Profile**

| Key | Value |
|-----|-------|
| `client_name` | Your client or account name |
| `client_industry` | e.g. `E-Commerce`, `SaaS`, `Versicherung` |
| `default_neg_list` | Name of your default shared negative list in Google Ads |
| `brand_noise_list` | Name of your Brand Noise negative list |
| `conv_protect` | `TRUE` to skip terms with conversions |
| `confidence_warn` | Confidence threshold for warnings, e.g. `0.7` |
| `batch_size` | Terms per API call, e.g. `15` |

**A9:B30 — neg_lists registry** (one row per shared negative list, key `neg_lists`)

**E1:G50 — Categories**

| Code | Description | Action |
|------|-------------|--------|
| `Brand Pure` | Exact brand name or clear purchase intent | `Review` |
| `Brand Kombi` | Brand + geo/product, direct intent | `Review` |
| `Brand Noise` | Brand + research/dissatisfaction signal | `Negativ` |
| `Mitbewerber` | Competitor brand terms | `Negativ` |
| `Junk` | Irrelevant, no intent | `Negativ` |
| `Informational` | Research queries, no purchase intent | `Negativ` |
| `Informational-Potential` | Research with SEO opportunity | `Expansion` |
| `Bestand (Aktiv)` | Already covered by active keywords | `Review` |
| `Unklar` | AI could not classify confidently | `Review` |

**H1:I50 — AI Examples** (seed examples to guide the AI)

### 4. Keyword Lists sheet

Headers in row 3, data from row 4:

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Brand Pure | Brand Kombi | Bestand (Aktiv) | Sperrbegriffe | Mitbewerber | Brand Noise Terms |

Brand Noise Terms (col F) are noise modifiers: `erfahrungen`, `alternative`, `kündigen`, `test`, `probleme`, `fake` — not full terms.

### 5. Fetcher Script

Google Ads → **Tools → Bulk Actions → Scripts** → New script → paste `AI_Max_NegativeIQ_V1_5DE_fetcher.js`

Update the config block:

```javascript
const SPREADSHEET_URL = 'YOUR_SHEET_URL_HERE';
const SHEET_NAME      = 'SearchTerms';
const LOOKBACK_DAYS   = 'LAST_30_DAYS';  // LAST_7_DAYS | LAST_14_DAYS | LAST_30_DAYS
const MIN_CLICKS      = 1;
```

Set to run **daily**.

### 6. Uploader Script

Google Ads → **Tools → Bulk Actions → Scripts** → New script → paste `AI_Max_NegativeIQ_V2_3_uploader.js`

```javascript
const SPREADSHEET_URL   = 'YOUR_SHEET_URL_HERE';
const EXPORT_SHEET_NAME = 'Negative_Export';
```

Run manually after each export cycle, or schedule it.

---

## Pre-Classification Logic (Brand Tier)

```
Term contains brand name?
│
├── YES — Exact brand name only?           → Brand Pure (confidence 1.0)
├── YES — Brand + known noise modifier?   → Brand Noise → routes to brand_noise_list
├── YES — Exact match in Brand Kombi list? → Brand Kombi (confidence 1.0)
├── YES — Ambiguous modifier?             → AI Queue (AI decides: Kombi vs Noise)
└── NO  — Other list checks:
          Sperrbegriffe → Junk
          Bestand exact match → Bestand (Aktiv)
          Mitbewerber → Mitbewerber
          No match → AI Queue
```

> **Conv-Schutz** runs first. If a term has conversions and `conv_protect = TRUE`, it is flagged `⚠️ Conv-Schutz` and skipped during export regardless of classification.

---

## Workflow

```
[Fetcher — daily]       Appends new search terms to SearchTerms sheet

[Sheet Menu]
  1. Prepare Layout     Styles the sheet, sets up dropdowns
  2a. Pre-Classify      Config-list matching (no API cost)
  2b. AI-Classify       LLM classification for AI Queue rows only
  → Review col G (Classification), col H (Confidence), col I (Reason)
  → Override in col J (Korrektur)
  → Check col K (Validiert ✅) for rows ready to export
  3. Export             Writes to Negative_Export + Expansion_Ideen
  4. Update Config      Learning loop → updates Keyword Lists + AI examples

[Uploader]              Books Negative_Export into Google Ads, deletes uploaded rows
```

---

## Diagnose & Debug

Run **🔍 Diagnose & Debug** from the sheet menu for a full status report:
- Sheet tab presence · Column header validation · Classification distribution
- AI Config summary · neg_lists registry · Category list · Keyword Lists counts · API key check

---

## Changelog

<details>
<summary><strong>V1.5DE (current)</strong></summary>

- **Brand tier split** — `Eigene Marke` replaced with three granular categories: `Brand Pure`, `Brand Kombi`, `Brand Noise`
- **Keyword Lists** expanded to 6 columns
- **Pre-classify brand logic** updated with noise modifier routing
- **AI system prompt** updated with Brand tier rules
- **Match type defaults**: Mitbewerber + Brand Noise both default to `Exact`
- **Export**: Brand Noise auto-routes to `brand_noise_list`
- **Learning loop**: Brand tier corrections write to correct columns
- **Performance**: batch writes, reduced flush calls, sleep reduced from 2000ms → 500ms

</details>

<details>
<summary>V1.0DE</summary>

- Initial Search-only release
- Two-step classification: Pre-Classify → AI-Classify
- Conv-Schutz introduced
- Learning Loop introduced

</details>

---

## Notes

- **List names are case-sensitive** in Google Ads. Check spelling before running the uploader.
- **Brand_Noise_Negatives** list must be created manually in Google Ads first.
- The fetcher aggregates metrics for duplicate terms instead of creating new rows.
- Learning Loop only processes rows with `Status = Verarbeitet` and a value in col J.
- AI uses `gpt-4o-mini` via AIML API at `temperature: 0.1` for consistent output.

---

## Tech Debt

- Uploader reads/deletes rows one at a time — large exports are slow
- `_styleDataRows()` makes one `getRange` call per row — could be batched
- Fetcher aggregates metrics with individual `setValue` calls per duplicate row
- `writeSheet()` re-styles the full sheet on every export

---

<div align="center">

### If NegativeIQ saves your account money, a ⭐ on GitHub helps others find it.

<br/>

**If it really saves money — you can buy me a coffee :)**

<br/>

<a href="https://buymeacoffee.com/clickcapybara">
  <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
</a>

<br/><br/>

<img src="assets/qr-code.png" width="160" alt="Buy Me a Coffee QR Code" />

<br/>
<sub>Scan to support · or just use the tool for free, that's fine too 🐾</sub>

</div>

## License

MIT — free to use, modify, and share.

---
