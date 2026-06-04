const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const storybookStatic = path.resolve(__dirname, '../frontend/storybook-static');
const outputDir = path.resolve(__dirname, '../docs/public/ui-snapshots/stories');
const baseUrl = process.env.STORYBOOK_URL || 'http://127.0.0.1:6006';

async function capture() {
  const indexPath = path.join(storybookStatic, 'index.json');
  if (!fs.existsSync(indexPath)) {
    console.error('storybook-static/index.json not found — run build-storybook first');
    process.exit(1);
  }

  const { entries } = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  const stories = Object.values(entries).filter(
    (e) => e.type === 'story' && e.subtype === 'story',
  );

  console.log(`Found ${stories.length} stories to capture`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const story of stories) {
    const url = `${baseUrl}/iframe.html?id=${story.id}&viewMode=story`;
    const outPath = path.join(outputDir, `${story.id}.png`);

    process.stdout.write(`  ${story.title} / ${story.name} ... `);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      // Extra wait for recharts animations and async data fetches
      await page.waitForTimeout(1500);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('ok');
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\nScreenshots written to ${path.relative(process.cwd(), outputDir)}`);
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
