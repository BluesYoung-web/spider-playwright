/*
 * @Author: zhangyang
 * @Date: 2023-11-26 17:05:09
 * @LastEditTime: 2023-11-26 19:42:24
 * @Description: 
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
// @ts-ignore
import rawM3U8 from '../assets/global.m3u?raw';

interface IPTVItem {
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
  tvgSrc: string;
  groupTitle: string;
}

export async function generateIPTVSrc () {
  const src_prefix = `https://www.foodieguide.com/iptvsearch/?s=`;
  const data_path = new URL(`../assets/iptv.json`, import.meta.url);
  
  const DataBase: Record<string, IPTVItem> = {}

  try {
    const str = await readFile(data_path, 'utf-8');
    DataBase.iptv = JSON.parse(str);
    console.log('history', DataBase)
  } catch (error) {
    console.log('no history')
  }

  const browser = await chromium.launch({
    // !!! 无头模式数据异常
    headless: false,
    timeout: 0,
    channel: 'msedge'
  });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.62'
  });

  async function getTVSrc(name: string) {
    await page.goto(src_prefix + name.trim(), { waitUntil: 'domcontentloaded' });
    
    // 先写死取第一条，后面优化
    const tv = await page.$('.result > .m3u8')
    const m3u8 = await (await tv?.innerText() ?? '').trim()
    console.log("🚀 ~ file: iptv.ts:48 ~ getTVSrc ~ m3u8:", m3u8)

    return m3u8
  }

  const tvs = rawM3U8.match(/(?<=#EXTINF:-1\s)(.*\n.*)/img)?.filter((tv: string) => tv.includes('tvg-id')) ?? []

  const failTVs: IPTVItem[] = []

  for (const tv of tvs) {
    const [str, src] = tv.split('\n')
    // 提取tvg-id的值
    const tvgId = str.match(/tvg-id="(.*?)"/)?.[1] ?? ''

    // 提取tvg-name的值
    const tvgName = str.match(/tvg-name="(.*?)"/)?.[1] ?? ''

    // 提取tvg-logo的值
    const tvgLogo = str.match(/tvg-logo="(.*?)"/)?.[1] ?? ''

    // 提取group-title的值
    const groupTitle = str.match(/group-title="(.*?)"/)?.[1] ?? '其他'

    console.log('start: ', tvgName)

    try {
      const tvgSrc = await getTVSrc(tvgName)
    
      DataBase[tvgId] = {
        tvgId,
        tvgName,
        tvgLogo,
        tvgSrc,
        groupTitle
      }

      console.log('end: ', tvgName)
    } catch (error) {
      console.error('fail', tvgName)
      failTVs.push({
        tvgId,
        tvgName,
        tvgLogo,
        groupTitle,
        tvgSrc: ''
      })
    }
  }

  if (failTVs.length) {
    console.log('开始错误重试。。。')
    for (const f of failTVs) {
      try {
        console.log('开始重试', f.tvgName)
        const tvgSrc = await getTVSrc(f.tvgName)
        DataBase[f.tvgId].tvgSrc = tvgSrc
      } catch (error) {
        console.log('重试失败。。。', f.tvgName)
      }
    }
  }

  await writeFile(data_path, JSON.stringify(DataBase), 'utf-8');
  return DataBase;
};