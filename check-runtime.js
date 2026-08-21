import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:3005/public/torneio/fbbdeb69-042c-467c-9007-81f24adf07f5/inscricao');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
