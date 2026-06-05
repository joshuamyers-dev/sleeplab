const { chromium } = require('playwright');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, '../snapshots.yml');
const outputDir = path.resolve(__dirname, '../docs/public/ui-snapshots');

async function capture() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileContents = fs.readFileSync(configPath, 'utf8');
  const data = yaml.load(fileContents);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  await context.addInitScript(() => {
    const isAuthPage = ['/', '/login', '/register'].includes(window.location.pathname);
    if (!isAuthPage) {
      window.localStorage.setItem('cpap_auth_token', 'mock_token');
    } else {
      window.localStorage.removeItem('cpap_auth_token');
    }
  });

  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.route('**/*', route => {
    const url = route.request().url();
    // Only intercept requests to the API domain
    if (url.includes('127.0.0.1:8000') || url.includes('/api/')) {
      // Mock CORS headers
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      };

      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 200, headers });
      }

      if (url.includes('/auth/me')) {
        return route.fulfill({
          status: 200,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({
            user_id: '123',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User'
          })
        });
      }

      // Default mock for all other API endpoints
      return route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    }

    // Let all non-API requests (assets, fonts, HTML) continue
    return route.continue();
  });

  for (const snapshot of data.snapshots) {
    const url = `http://127.0.0.1:4173${snapshot.url}`;
    console.log(`Capturing ${snapshot.name} from ${url}`);
    
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(1000); // Wait for React renders
    
    const filename = `${snapshot.name}.png`;
    await page.screenshot({ path: path.join(outputDir, filename) });
  }

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
