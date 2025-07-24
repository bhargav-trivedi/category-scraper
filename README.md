# Category Scraper 🛒

This project uses Puppeteer with stealth plugin to scrape category pages from AceHardware.com and checks if the first product’s `item_category` matches the category name in the URL.

## 🚀 Features

- Headless scraping with Puppeteer
- Stealth mode to avoid bot detection
- Category mismatch detection
- Retry logic for failed categories
- Concurrency support
- Progress tracking

## 📦 Installation

```bash
git clone https://github.com/bhargav-trivedi/category-scraper.git
cd category-scraper
npm install
