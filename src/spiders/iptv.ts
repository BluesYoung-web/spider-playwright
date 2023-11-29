/*
 * @Author: zhangyang
 * @Date: 2023-11-26 17:05:09
 * @LastEditTime: 2023-11-29 15:39:57
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
  
  let DataBase: Record<string, IPTVItem> = {}

  try {
    const str = await readFile(data_path, 'utf-8');
    DataBase = JSON.parse(str)
    console.log('history', DataBase)
  } catch (error) {
    console.log('no history')
  }

  const browser = await chromium.launch({
    // headless: false,
    timeout: 0,
    channel: 'msedge'
  });
  const page = await browser.newPage({
    extraHTTPHeaders: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      // !!! fix 无头模式数据异常
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    },
    
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.62'
  });

  async function getTVSrc(name: string) {
    await page.goto(src_prefix + name.trim(), { waitUntil: 'domcontentloaded' });
    
    // 先写死取第一条，后面优化
    const results = await page.$$('.tables > .result')
    console.log(`总计：${results.length} 条`)

    const avaliable: {
      channel: string;
      rgb: number;
      src: string;
    }[] = []

    const regexp = /rgb\((\d{1,3}(?:\.\d+)?)\s*,\s*(\d{1,3}(?:\.\d+)?)\s*,\s*(\d{1,3}(?:\.\d+)?)\)/

    for (const result of results) {
      const [
        channel,
        rgb,
        src
      ] = await Promise.all([
        (await (await result.$('.channel'))?.innerText() ?? '').trim(),
        await (await result.$('.nu'))?.getAttribute('style') ?? '',
        (await (await result.$('.m3u8'))?.innerText() ?? '').trim()
      ])

      const invalidDomain = [
        'cfss.cc'
      ]

      // 过滤频道
      // 过滤 ipv6 的地址
      // 过滤 无效网址
      if (
        channel.toLowerCase() === name.trim().toLowerCase()
         && !/\[.*?\]/.test(src)
         && !invalidDomain.some((domain) => src.includes(domain))
        ) {
        avaliable.push({
          channel,
          rgb: +(rgb.match(regexp)?.[1] ?? '255'),
          src
        })
      }
    }

    avaliable.sort((a, b) => a.rgb - b.rgb)
    console.log(`可用：${avaliable.length} 条`)

    if (avaliable.length) {
      console.log("🚀 ~ file: iptv.ts:91 ~ getTVSrc ~ avaliable[0].src:", avaliable[0].src)
      return avaliable[0].src
    } else {
      throw new Error(`${name} 获取失败！`)
    }
  }

  const tvs = rawM3U8.match(/(?<=#EXTINF:-1\s)(.*\n.*)/img)?.filter((tv: string) => tv.includes('tvg-id')) ?? []

  const failTVs: IPTVItem[] = []

  for (const tv of tvs) {
    const [str, src] = tv.split('\n')
    // 提取tvg-id的值
    const tvgId = str.match(/tvg-id="(.*?)"/)?.[1] ?? ''
    console.log("🚀 ~ file: iptv.ts:103 ~ generateIPTVSrc ~ tvgId:", tvgId)

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
    console.log('开始错误重试。。。', failTVs.length)
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