/*
 * @Author: zhangyang
 * @Date: 2024-07-11 17:27:04
 * @LastEditTime: 2024-07-11 19:21:13
 * @Description: 
 * @LastEditors: Please set LastEditors
 * Copyright (c) 2024 to current by BluesYoung-web, All Rights Reserved. 
 */
import { chromium } from 'playwright';
import { writeFile, readFile } from 'node:fs/promises';

interface CcmihbArticleItem {
  id: number
  title: string
  type: string
  area: string
  person: string
  phone: string
  info: string
  img: string
}

/**
 * 随机延时 5-15 秒
 */
export async function randomDelay() {
  return new Promise(resolve => {
    setTimeout(resolve, Math.random() * 10000 + 5000);
  });
}

export async function spiderCcmihb() {
  const browser = await chromium.launch({
    // headless: false,
    // timeout: 0,
    channel: 'msedge'
  });
  const page = await browser.newPage({
    extraHTTPHeaders: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      // !!! fix 无头模式数据异常
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    },

    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.1938.62'
  });

  const MaxId = 199
  const data_path = new URL(`../assets/ccmihb-data-1-199.json`, import.meta.url);

  // @ts-expect-error
  const target = import.meta.env.VITE_CCMIHB_TARGET
  console.log('target: ', target)

  

  let json: CcmihbArticleItem[] = []
  try {
    const str = await readFile(data_path, 'utf-8');
    json = JSON.parse(str)
    console.log('history', json)
  } catch (error) {
    console.log('no history')
  }
  
  for (let i = 1; i <= MaxId; i++) {
    if (json[i - 1]) {
      continue
    }

    try {
      console.log('ccmihb start: ', `${target}?id=${i}`)
      await page.goto(`${target}?id=${i}`, { waitUntil: 'domcontentloaded' });
      const box = await page.locator('.left');
      const article: CcmihbArticleItem = {
        id: 0,
        title: '',
        type: '',
        area: '',
        person: '',
        phone: '',
        info: '',
        img: ''
      }
  
      article.id = i
      article.title = await box.locator('.js_right > h2').innerText()
      article.type = await box.locator('.js_right > ul > li:nth-child(1)').innerText()
      article.area = await box.locator('.js_right > ul > li:nth-child(2)').innerText()
      article.person = await box.locator('.js_right > ul > li:nth-child(3)').innerText()
      article.phone = await box.locator('.js_right > ul > li:nth-child(4)').innerText()
  
      article.info = await box.locator('.kcjs2 > .content-wrap').innerHTML()
      article.img = await box.locator('.js_left > img').getAttribute('src') || ''
  
      json.push(article)
    } catch (error) {
      console.log('error jump: ', error)
    }
    
    await randomDelay()
  }

  await writeFile(data_path, JSON.stringify(json, null, 2), 'utf-8');
}