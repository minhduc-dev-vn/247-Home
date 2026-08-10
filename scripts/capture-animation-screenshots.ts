import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3000';
const prefix = process.argv[3] ?? 'after';
const outputDirectory = path.resolve('docs/screenshots/animation');

const captures = [
  { height: 900, name: 'home-1440', path: '/', width: 1440 },
  { height: 1024, name: 'home-768', path: '/', width: 768 },
  { height: 844, name: 'home-390', path: '/', width: 390 },
  { height: 900, name: 'products-1440', path: '/products', width: 1440 },
] as const;

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const capture of captures) {
      const page = await browser.newPage({
        reducedMotion: 'no-preference',
        viewport: { height: capture.height, width: capture.width },
      });
      await page.goto(`${baseUrl}${capture.path}`, {
        waitUntil: 'domcontentloaded',
      });

      const reveals = page.locator('.motion-reveal');
      for (let index = 0; index < (await reveals.count()); index += 1) {
        const reveal = reveals.nth(index);
        await reveal.scrollIntoViewIfNeeded();
        await reveal
          .waitFor({ state: 'visible' })
          .catch(() => Promise.resolve());
      }
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.locator('body').screenshot({
        animations: 'disabled',
        path: path.join(outputDirectory, `${prefix}-${capture.name}.png`),
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

void main();
