/*
 * @Author: zhangyang
 * @Date: 2022-09-24 18:23:13
 * @LastEditTime: 2023-11-28 15:19:17
 * @Description: 
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

/**
 * 获取某年的节假日
 * @param year 默认今年
 *  eg: 2022
 * @returns Record<date, isHoliday> 某一天是否为假节日
 *  eg: { 20221001: true }
 */
export const getFullYearData = async (year?: string) => {
  if (!year) {
    year = process.env.SPIDER_HOLIDAY_YEAR || new Date().getFullYear().toString()
  }
  console.log("🚀 ~ file: holiday.ts:19 ~ getFullYearData ~ year:", year)

  const src_prefix = `https://wannianrili.bmcx.com/${year}-`;
  const src_affix = `-01__wannianrili/`;
  
  let database: Record<string, boolean> = {};

  const month = new Array(12).fill(0).map((_, i) => `${i + 1}`.padStart(2, '0'));

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

  const traverseMonth = async (m: string) => {
    const box = await page.locator('#jie_guo > .wnrl_k > .wnrl_k_zuo .wnrl_riqi');
    const days = await box.elementHandles();

    /**
     * 假日情况：
     *  周末 wnrl_riqi_mo
     *  调休 wnrl_riqi_xiu
     */
    for (const day of days) {
      const container = await day.$('a');
      if (container) {
        const date = await (await container.$('.wnrl_td_gl'))?.innerHTML();
        const isFree = 
          // 节假日
          ['wnrl_riqi_mo', 'wnrl_riqi_xiu'].includes(await container.getAttribute('class') as string)
          // 周五
          || new Date(`${year}-${m}-${date}`).getDay() === 5
        ;
        if (isFree) {
          database[`${year}${m}${date}`] = isFree;
        }
      }
      
    }
  };

  for (const m of month) {
    console.log('start', `${src_prefix}${m}${src_affix}`)
    await page.goto(`${src_prefix}${m}${src_affix}`, { waitUntil: 'domcontentloaded' });
    await traverseMonth(m);
    console.log('end', `${src_prefix}${m}${src_affix}`)
  }

  const data_path = new URL(`../assets/holiday-${year}.json`, import.meta.url);
  await writeFile(data_path, JSON.stringify(database), 'utf-8');
  // await writeFile(data_path, JSON.stringify(database, null, 2), 'utf-8');
  return database;
};

/**
 * 判断某个日期是否为假期
 * @param day today
 * eg: 20220918
 */
export const isHoliday = async (day?: string) => {
  let database: Record<string, boolean> = {};

  const today = new Date();
  day = day || `${today.getFullYear()}${`${today.getMonth() + 1}`.padStart(2, '0')}${`${today.getDate()}`.padStart(2, '0')}`;
  const year = day.substring(0, 4);

  try {
    const data_path = new URL(`../assets/holiday-${year}.json`, import.meta.url);
    const json = await readFile(data_path, 'utf-8');
    database = JSON.parse(json);
  } catch (error) {
    console.log('🚀 ~ file: holiday.ts ~ line 18 ~ error', error);
    database = await getFullYearData(year);
  }
  
  return !!database[day];
};