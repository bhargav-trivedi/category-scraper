const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const sitemapURL = 'https://www.acehardware.com/sitemap.xml/categories';
const mode = process.argv[2]; // Optional argument: 'retry' or undefined
const failedFile = mode === 'retry' ? 'failed_headless.json' : null;
const retryFailedFile = 'retry_failed_headless.json';
const noProductListFile = 'no_productlist_headless.json';
const CONCURRENCY = 10;
const DEBUG = process.env.DEBUG_MODE === 'true';

const startTime = Date.now();

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    protocolTimeout: 120000,
    pipe: true
  });

  let categoryUrls = [];

  if (mode === 'retry' && fs.existsSync(failedFile)) {
    console.log('🔁 Running in retry mode...');
    categoryUrls = JSON.parse(fs.readFileSync(failedFile));
  } else {
    console.log('📥 Fetching sitemap...');
    const res = await fetch(sitemapURL);
    const sitemapText = await res.text();
    categoryUrls = [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  }

  const totalToProcess = categoryUrls.length;
  console.log(`Will evaluate : ${totalToProcess} categories`);

  let eligibleCategories = 0;
  const successful = fs.existsSync('successful_headless.json') ? JSON.parse(fs.readFileSync('successful_headless.json')) : [];
  const mismatches = fs.existsSync('mismatches_headless.json') ? JSON.parse(fs.readFileSync('mismatches_headless.json')) : [];
  const noProductList = fs.existsSync(noProductListFile) ? JSON.parse(fs.readFileSync(noProductListFile)) : [];
  const failed = [];

  let processedCount = 0;
  let nextLogPercent = 1;

  const chunks = [];
  for (let i = 0; i < categoryUrls.length; i += CONCURRENCY) {
    chunks.push(categoryUrls.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (url) => {
      if (!url.includes('/departments/')) {
        DEBUG && console.debug('⏭️ Skipping non-category URL: ' + url);
        return;
      }

      eligibleCategories++;

      DEBUG && console.debug("🔍 Evaluating URL: " + url);
      const page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118.0.5993.90 Safari/537.36'
      );

      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const blocked = ['image', 'stylesheet', 'font'];
        if (blocked.includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const hasProductList = await page.$('.mz-l-paginatedlist-wrapper') !== null;
        const hasNoResults = await page.$('.no-results') !== null;

        if (!hasProductList || hasNoResults) {
          DEBUG && console.debug(`⚠️ No product list container or 'no-results' found on: ${url}`);
          if (!noProductList.includes(url)) noProductList.push(url);
          await page.close().catch(() => {});
          return;
        }

        await page.evaluate(() => window.scrollBy(0, window.innerHeight));

        try {
          await page.waitForFunction(() => {
            return window.dataLayer?.some(e => e.event === 'view_item_list');
          }, { timeout: 10000 });
        } catch {}

        const viewItemList = await page.evaluate(() => {
          const entry = window.dataLayer?.find(e => e.event === 'view_item_list');
          return entry?.items || [];
        });

        const categoryNameFromUrl = url.split('/').filter(Boolean).pop()?.toLowerCase();

        if (viewItemList.length > 0) {
          const normalizedCategoryName = categoryNameFromUrl?.replace(/[\s_]+/g, '-');
          const categories = [
            viewItemList[0].item_category,
            viewItemList[0].item_category2,
            viewItemList[0].item_category3
          ].filter(Boolean).map(c => c.toLowerCase().replace(/[\s_]+/g, '-'));

          const matched = categories.some(cat => cat.includes(normalizedCategoryName));

          if (!matched) {
            if (!mismatches.some(entry => entry.url === url)) {
              mismatches.push({ url, categories });
              DEBUG && console.debug(`⚠️ Mismatch: ${categories.join(' | ')} ≠ ${normalizedCategoryName}`);
            }
          } else {
            if (!successful.includes(url)) successful.push(url);
            DEBUG && console.debug('✅ Matched');
          }
        } else {
          failed.push(url);
          DEBUG && console.debug(`❌ view_item_list still not found for: ${url}`);
        }

      } catch (err) {
        console.error('❌ Error for ' + url + ' ::: ' + err.message);
        failed.push(url);
      } finally {
        await page.close().catch(() => {});
        processedCount++;
        const progressPercent = Math.floor((processedCount / totalToProcess) * 100);
        if (progressPercent >= nextLogPercent) {
          console.log(`🚀 Progress: ${progressPercent}% complete (${processedCount}/${totalToProcess})`);
          const currTime = Date.now();
          const durationSec = Math.floor((currTime - startTime) / 1000);
          const minutes = Math.floor(durationSec / 60);
          const seconds = durationSec % 60;
          console.log('Execution Time for '+ progressPercent+'%: ' + (minutes ? `${minutes} min ` : '') + `${seconds} sec`);
          nextLogPercent += 1;
        }
      }
    });

    await Promise.all(promises);
  }

  fs.writeFileSync('successful_headless.json', JSON.stringify(successful, null, 2));
  fs.writeFileSync('mismatches_headless.json', JSON.stringify(mismatches, null, 2));
  fs.writeFileSync(noProductListFile, JSON.stringify(noProductList, null, 2));
  fs.writeFileSync(mode === 'retry' ? retryFailedFile : 'failed_headless.json', JSON.stringify(failed, null, 2));

  console.log('\n📊 Summary:');
  console.log(`Total Categories Scanned: ${totalToProcess}`);
  console.log(`Eligible / Processed Categories: ${eligibleCategories}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`⚠️ Mismatches: ${mismatches.length}`);
  console.log(`No Product List: ${noProductList.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  const endTime = Date.now();
  const durationSec = Math.floor((endTime - startTime) / 1000);
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  console.log('\n⏱️ Execution Time: ' + (minutes ? `${minutes} min ` : '') + `${seconds} sec`);

  await browser.close();
})();
