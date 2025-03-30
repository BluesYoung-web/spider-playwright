/*
 * @Author: zhangyang
 * @Date: 2024-03-30 12:53:00
 * @LastEditTime: 2024-03-30 12:53:00
 * @Description: YouTube直播页面截图OCR测试
 */
import { getFreeNode } from '../src'
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