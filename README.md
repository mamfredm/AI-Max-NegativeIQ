# Capybara NegativeIQ Search

**AI-powered search term classification for Google Ads. Free. Open source. No agency required.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Google Ads Scripts](https://img.shields.io/badge/Google%20Ads-Scripts-blue?logo=google)](https://ads.google.com)
[![Google Sheets](https://img.shields.io/badge/Google-Sheets-34A853?logo=google-sheets&logoColor=white)](https://sheets.google.com)
[![Language: DE](https://img.shields.io/badge/Language-German%20%F0%9F%87%A9%F0%9F%87%AA-lightgrey)](https://github.com/mamfredm/CapybaraNegativeIQ-Search)
[![English: Coming Soon](https://img.shields.io/badge/English-Coming%20Soon-orange)](https://github.com/mamfredm/CapybaraNegativeIQ-Search)

---

## The problem

Your Google Ads account is leaking budget on search terms that will never convert. Job seekers clicking your B2B ads. Competitors researching your pricing. Informational searches with zero purchase intent.

Manually reviewing search terms is slow, error-prone, and doesn't scale. Most accounts do it once a month — at best.

**Capybara NegativeIQ Search automates this entirely, using AI.**

---

## What it does

Every day, the script pulls your search terms from Google Ads into a Google Sheet. An AI then classifies each term based on your industry, your business context, and your actual conversion data — not generic rules.

Every search term comes back with:
- **A classification** (Relevant / Competitor / Informational / Junk / Unclear)
- **A confidence score** between 0.0 and 1.0, color-coded
- **A plain-language reason** explaining why the AI made that call

You review, correct what you disagree with, and push validated negatives back into your account in one click. The system learns from your corrections over time.

**What it never touches:** any search term that has already driven a conversion. Conversion protection is on by default.

---

## Architecture

```
[Google Ads Account]
        │
        ▼
[Script A: Fetcher]          ← Google Ads > Tools > Scripts
        │  Pulls search terms daily, deduplicates, aggregates 30-day clicks/conversions
        ▼
[Google Sheet]
  ├── SearchTerms             ← Your working surface
  ├── Config                  ← One-time setup per account
  ├── Negative_Export         ← Ready to push
  └── Expansion_Ideas         ← Terms worth building campaigns around
        │
        ▼
[Script B: Analyzer]         ← Sheet > Extensions > Apps Script
  Menu functions:
  1. Layout & Dropdowns       → Styles all tabs, sets up color coding
  2. AI Batch Classify        → Batches terms to AI, returns classifications
  3. Learning Loop            → Writes your corrections back to Config
  4. Export                   → Routes validated terms to the right tab
  🔍 Diagnostics              → Full status report for debugging
        │
        ▼
[Script C: Uploader]         ← Google Ads > Tools > Scripts
        │  Books Negative_Export as negatives, only removes successful rows
        ▼
[Google Ads — Negatives live]
```

---

## Why this is fast and cheap

| | Old approach | Capybara NegativeIQ |
|---|---|---|
| API calls per 100 terms | 100 | ~7 (batch of 15) |
| Processing time | ~400 seconds | ~30 seconds |
| Cost per 100 terms | ~$0.10 | ~$0.007 |
| Reasoning per term | None | Plain-language explanation |
| Conversion protection | Manual | Automatic |
| Confidence scoring | None | 0.0–1.0, color-coded |
| Learning loop | None | Corrections feed back to Config |

---

## What's included

| File | Description |
|---|---|
| `fetcher_v1.js` | Google Ads script — pulls search terms daily into your Sheet |
| `gas_zentral_v1.js` | Google Apps Script — AI classification engine, menu system, export logic |
| `uploader_v1.js` | Google Ads script — pushes validated negatives back into your account |
| `README.md` | This file |
| `Template` | [Google Sheet template — click to copy](https://docs.google.com/spreadsheets/d/1xHLd-H2uIfDsKvdKaW7OL3hR6xKbXT_3oYbZZRllQFw/copy) |

---

## Quick start — up and running in under 30 minutes

You don't need to know how to code.

**Step 1 — Copy the Google Sheet template**

Make a copy of the [Google Sheet template](https://docs.google.com/spreadsheets/d/1xHLd-H2uIfDsKvdKaW7OL3hR6xKbXT_3oYbZZRllQFw/copy) and fill in the `Config` tab:
- Your industry and business name
- 5–8 example search term classifications (this dramatically improves AI accuracy)
- Everything else has sensible defaults

**Step 2 — Add the Fetcher to Google Ads**

In Google Ads: `Tools → Scripts → New`

Paste the contents of `fetcher_v1.js`, replace `YOUR_SHEET_URL_HERE` with your Sheet URL, authorize, and set the schedule to **daily**.

**Step 3 — Add the Analyzer to your Sheet**

In your Google Sheet: `Extensions → Apps Script`

Paste the contents of `gas_zentral_v1.js`, save, and authorize. A new **Keyword Analyzer** menu will appear in your Sheet toolbar.

**Step 4 — Run the setup menu**

Click `Keyword Analyzer → Step 1: Layout & Dropdowns`. This styles all four tabs, adds color coding, and sets up the classification dropdowns.

**Step 5 — Let it run, then review**

The next day, open your Sheet. New search terms will have been pulled in automatically. Click `Step 2: AI Batch Classify` to run classification. Review the results, correct anything the AI got wrong, and click Export to push validated negatives.

---

## Config reference

The `Config` tab is the only thing you customize per account. Key fields:

| Field | Description | Default |
|---|---|---|
| `client_industry` | Describe your industry in plain language | Required |
| `client_name` | Your business name | Required |
| `conv_protect` | Never flag terms with conversions as negatives | `TRUE` |
| `confidence_warn` | Flag terms below this score for manual review | `0.7` |
| `batch_size` | Terms per AI API call (10–20 recommended) | `15` |

Categories (what the AI classifies terms into) are also defined in Config — not in the code. You can add, remove, or rename categories without touching a single line of JavaScript.

---

## API key setup

The AI runs via [aimlapi.com](https://aimlapi.com) — an API aggregator that provides access to `gpt-4o-mini` at very low cost (~$0.007 per 100 terms). You'll need a free account there to get a key.

Your API key is stored in **Apps Script Project Properties** — not in the sheet, not in the code. It never leaves your Google account.

In Apps Script: `Project Settings → Script Properties → Add property`
- Key: `AIML_API_KEY`
- Value: your aimlapi.com API key

Sign up at [aimlapi.com](https://aimlapi.com) to get your key. The free tier is enough to get started.

---

## Language

> **Note:** The current version (v1) is in German — menus, sheet labels, and AI prompts. An English version is in progress. If you'd like to be notified when it's ready, watch this repo.

For German-speaking Google Ads managers: everything is ready to use as-is.

---

## Requirements

- A Google Ads account with search campaigns
- A Google account (for Google Sheets + Apps Script)
- An [aimlapi.com](https://aimlapi.com) API key (costs ~$0.007 per 100 terms, free tier available)
- About 30 minutes for initial setup

---

## Contributing

Found a bug? Have an idea for a new feature? Open an issue or submit a pull request. This is a solo project — thoughtful contributions are welcome.

If this saves you time or budget, a ⭐ on GitHub helps other Google Ads specialists find it. 🐒

---

## About

Built by [Max](https://www.click-capybara.com) — freelance Google Ads specialist with 8+ years of hands-on experience.

**Capybara NegativeIQ Search** is part of the Capybara script family — free, open-source Google Ads tools built to give independent advertisers the same technical edge as large agencies.

→ [click-capybara.com](https://www.click-capybara.com)

---

## License

MIT License — free to use, modify, and distribute. See `LICENSE` for details.
