/*
 * @Author: zhangyang
 * @Date: 2024-03-30 12:53:00
 * @LastEditTime: 2024-03-30 12:53:00
 * @Description: YouTube直播页面截图OCR测试
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { extractSubscriptionUrl, getFreeNode } from '../src';
import { describe, it, expect } from 'vitest';

describe('Free Node Spider', () => {
  it('get free node from Telegram', async () => {
    try {
      const text = await getFreeNode();
      console.log('识别到的内容：', text);
      expect(text).toBeDefined();
      expect(text.length).toBeGreaterThan(0);
    } catch (error) {
      console.error('抓取失败：', error);
      throw error;
    }
  });
}); 

describe('extractSubscriptionUrl', () => {
  it('extracts the newest Clash subscription from the current page layout', async () => {
    const html = readFileSync(new URL('../src/spiders/target/free-node.html', import.meta.url), 'utf8');
    const browser = await chromium.launch({ channel: 'msedge', timeout: 0 });
    try {
      const page = await browser.newPage();
      await page.route(/^https?:\/\//, (route) => route.abort());
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await expect(extractSubscriptionUrl(page)).resolves.toBe(
        'https://nodebuf.com/node-sub/87f60bd676e5200f085d5dafe0acbfff229cd51597415a6233f5aabc753a1648/mihomo',
      );
    } finally {
      await browser.close();
    }
  });
});