# Category Scraper

This project scrapes category pages from Ace Hardware’s website (by default) to validate that the category path in the URL matches product metadata (`item_category`, `item_category2`, `item_category3`) captured in the `view_item_list` event from the website’s `dataLayer`.

---

## ⚙️ Prerequisites

Make sure you have:

- Node.js v18+ installed
- All dependencies installed:

```bash
npm install
```

---

## 🚀 Running the Scraper

There are **two modes** of running the script:

### ✅ Normal Mode (from sitemap)
Scrapes fresh category list from sitemap and analyzes each one.

```bash
node scraper_headless.js
```

### 🔁 Retry Mode (failed categories)
Use this to retry failed URLs from a previous run:

```bash
node scraper_headless.js retry
```

---

## 🐞 Debug Mode (Optional)
Enable verbose debug logs:

```bash
DEBUG_MODE=true node scraper_headless.js
```

With retry:

```bash
DEBUG_MODE=true node scraper_headless.js retry
```

---

## 📁 Output Files
After execution, these files are generated in the root folder:

| File                          | Description                                                 |
|-------------------------------|-------------------------------------------------------------|
| `successful_headless.json`    | URLs where category matched correctly                       |
| `mismatches_headless.json`    | URLs where category didn’t match metadata                   |
| `failed_headless.json`        | URLs that timed out or errored during main run              |
| `retry_failed_headless.json`  | Failed again during retry run                               |
| `no_productlist_headless.json`| Pages with no product list or 'no-results' message detected |

---

## ⏱️ Progress and Summary

- Progress updates every 5% of total work
- Final summary includes:
  - Total scanned URLs
  - Eligible product category pages
  - Success, mismatch, fail, and empty product list breakdown
  - Total execution time

---

## 💡 Notes
- The scraper runs headless using Puppeteer Extra with Stealth Plugin
- Requests for images, fonts, and stylesheets are blocked to speed up scraping
- Set concurrency in code via the `CONCURRENCY` constant (default: 10)

---

Feel free to fork and improve. For issues or enhancements, raise a GitHub issue.
