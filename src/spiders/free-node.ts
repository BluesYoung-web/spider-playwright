import { chromium, Page } from 'playwright';

interface Spoiler {
  pwd: string;
  url: string;
  config?: string;
}

interface SpoilerV2 {
  /**
   * yaml 配置文件的 url
   * 订阅地址
   */
  yamlUrl: string;
  /**
   * 上面订阅地址抓取到的文件内容
   */
  rawConfig: string;
}

// 按实测延迟从低到高排序（proxy.v2gh.com 已超时不可用）
const GIST_MIRRORS = [
  { name: 'gh-proxy', base: 'https://gh-proxy.com' },
  { name: 'ghproxy', base: 'https://ghproxy.net' },
  { name: 'ghfast', base: 'https://ghfast.top' },
];

const DINGTALK_KEYWORD = '免费节点';
const ACTION_CARD_TEXT_LIMIT = 1000;
const ACTION_CARD_BTNS_LIMIT = 1000;

// ! 官方能直连的域名，替换获取到的主机地址即可
const OFFICIAL_DIRECT_DOMAIN = process.env.OFFICIAL_DIRECT_DOMAIN || '';

function getOfficialDirectUrl(url: string): string | undefined {
  if (!OFFICIAL_DIRECT_DOMAIN) return undefined;
  try {
    const parsed = new URL(url);
    parsed.hostname = OFFICIAL_DIRECT_DOMAIN;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function buildMirrorUrl(mirrorBase: string, rawUrl: string) {
  return `${mirrorBase}/${rawUrl}`;
}

function buildDingTalkText(
  directUrl: string | undefined,
  rawUrl: string,
  mirrorUrls: string[],
  timestampDisplay: string,
) {
  return [
    `${DINGTALK_KEYWORD}更新`,
    `更新时间：${timestampDisplay}`,
    '',
    ...(directUrl
      ? ['官方直连：', directUrl, '']
      : []),
    'Gist 直链：',
    rawUrl,
    '',
    '国内镜像：',
    ...GIST_MIRRORS.map(({ name }, index) => `${name}：\n${mirrorUrls[index]}`),
  ].join('\n');
}

function buildDingTalkActionCard(
  directUrl: string | undefined,
  rawUrl: string,
  mirrorUrls: string[],
  timestampDisplay: string,
) {
  const cardText = [
    `${DINGTALK_KEYWORD}更新`,
    `更新时间：${timestampDisplay}`,
    '',
    ...(directUrl
      ? ['官方直连（长按复制）：', directUrl, '']
      : []),
    'Gist 直链（长按复制）：',
    rawUrl,
    '',
    '国内镜像请点下方按钮打开。',
  ].join('\n');

  const btns = [
    ...(directUrl
      ? [{ title: '官方直连', actionURL: directUrl }]
      : []),
    { title: 'Gist 直链', actionURL: rawUrl },
    ...GIST_MIRRORS.map(({ name }, index) => ({
      title: `${name} 镜像`,
      actionURL: mirrorUrls[index],
    })),
  ];

  return {
    msgtype: 'actionCard',
    actionCard: {
      title: `${DINGTALK_KEYWORD}更新`,
      text: cardText,
      btnOrientation: '0',
      btns,
    },
  };
}

function canUseActionCard(payload: ReturnType<typeof buildDingTalkActionCard>) {
  const text = payload.actionCard.text;
  const btnsJson = JSON.stringify(payload.actionCard.btns);
  return text.length <= ACTION_CARD_TEXT_LIMIT && btnsJson.length <= ACTION_CARD_BTNS_LIMIT;
}

async function postDingTalk(webhook: string, payload: Record<string, unknown>) {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const bodyText = await res.text();
  let data: { errcode?: number; errmsg?: string } = {};
  try {
    data = JSON.parse(bodyText) as { errcode?: number; errmsg?: string };
  } catch {
    throw new Error(`钉钉响应非 JSON: ${bodyText}`);
  }
  if (!res.ok || data.errcode !== 0) {
    throw new Error(`钉钉发送失败: errcode=${data.errcode ?? 'unknown'} errmsg=${data.errmsg ?? bodyText}`);
  }
}

function printResultLinks(
  directUrl: string | undefined,
  rawUrl: string,
  mirrorUrls: string[],
  timestampDisplay: string,
) {
  console.log('\n=== 最终订阅链接 ===');
  console.log(`更新时间：${timestampDisplay}`);
  if (directUrl) {
    console.log(`官方直连：${directUrl}`);
  }
  console.log(`Gist 直链：${rawUrl}`);
  GIST_MIRRORS.forEach(({ name }, index) => {
    console.log(`${name} 镜像：${mirrorUrls[index]}`);
  });
  console.log('====================\n');
}

async function sendDingTalkNotification(
  webhook: string,
  directUrl: string | undefined,
  rawUrl: string,
  mirrorUrls: string[],
  timestampDisplay: string,
) {
  const textPayload = {
    msgtype: 'text',
    text: {
      content: buildDingTalkText(directUrl, rawUrl, mirrorUrls, timestampDisplay),
    },
  };

  const actionCardPayload = buildDingTalkActionCard(directUrl, rawUrl, mirrorUrls, timestampDisplay);

  if (canUseActionCard(actionCardPayload)) {
    try {
      await postDingTalk(webhook, actionCardPayload);
      console.log('已发送钉钉 ActionCard 通知');
      return;
    } catch (error) {
      console.warn('ActionCard 发送失败，降级为纯文本:', error);
    }
  } else {
    console.warn(
      `ActionCard 超出限制（text=${actionCardPayload.actionCard.text.length}, btns=${JSON.stringify(actionCardPayload.actionCard.btns).length}），改用纯文本`,
    );
  }

  await postDingTalk(webhook, textPayload);
  console.log('已发送钉钉纯文本通知');
}

async function createGistAndSendDingTalk(result: SpoilerV2, directUrl?: string) {
  const token = process.env.YOUNG_GITHUB_GIST_TOKEN;
  if (!token) {
    console.error('缺少 YOUNG_GITHUB_GIST_TOKEN 环境变量');
    return;
  }

  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace(/[-:T.Z\s\/]/g, '_');
  const filename = `free-node-${timestamp}.yaml`;

  const gistRes = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      public: true,
      files: {
        [filename]: { content: result.rawConfig },
      },
    }),
  });

  if (!gistRes.ok) {
    const err = await gistRes.text();
    throw new Error(`创建 Gist 失败: ${gistRes.status} ${err}`);
  }

  const gist = await gistRes.json() as { files: Record<string, { raw_url?: string }> };
  const fileInfo = gist.files[filename];
  const rawUrl = fileInfo?.raw_url;
  if (!rawUrl) {
    throw new Error('无法获取 Gist raw URL');
  }

  const mirrorUrls = GIST_MIRRORS.map(({ base }) => buildMirrorUrl(base, rawUrl));
  const timestampDisplay = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  printResultLinks(directUrl, rawUrl, mirrorUrls, timestampDisplay);

  const dingtalkWebhook = process.env.VITE_DINGTALK_WEBHOOK || process.env.DINGTALK_WEBHOOK;
  if (!dingtalkWebhook) {
    console.error('缺少 VITE_DINGTALK_WEBHOOK 或 DINGTALK_WEBHOOK 环境变量');
    return;
  }

  await sendDingTalkNotification(dingtalkWebhook, directUrl, rawUrl, mirrorUrls, timestampDisplay);

  console.log('已创建 Gist 并发送钉钉通知');
}

async function fetchClashConfig(url: string) {
  // !!! mock clash app user-agent
  const userAgent = 'FlClash/v0.8.33 clash-verge/v1.6.6 Platform/android';

  const res = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
    },
  });
  if (!res.ok) {
    throw new Error(`拉取订阅配置失败: ${res.status} ${url}`);
  }
  return await res.text();
}

export async function extractSubscriptionUrl(page: Page): Promise<string | undefined> {
  const wraps = page.locator('.tgme_widget_message_wrap');
  const count = await wraps.count();

  for (let i = count - 1; i >= 0; i--) {
    const wrap = wraps.nth(i);
    const textEl = wrap.locator('.tgme_widget_message_text').first();
    if (await textEl.count() === 0) continue;

    const text = await textEl.textContent();
    if (!text?.includes('高速免费节点分享')) continue;

    const clashBtn = wrap.locator('.tgme_widget_message_inline_button.url_button', { hasText: 'Clash/Mihomo' });
    if (await clashBtn.count() > 0) {
      const href = await clashBtn.first().getAttribute('href');
      if (href) return href;
    }

    const links = textEl.locator('a');
    const linkCount = await links.count();
    for (let j = 0; j < linkCount; j++) {
      const href = await links.nth(j).getAttribute('href');
      if (href && /\.ya?ml(?:\?|$)/i.test(href)) return href;
    }
    for (let j = 0; j < linkCount; j++) {
      const href = await links.nth(j).getAttribute('href');
      if (href && /\/download(?:\?|$)/.test(href) && (href.includes('nodebuf.com') || href.includes('v2rayse.com'))) {
        return href;
      }
    }

    return undefined;
  }

  return undefined;
}


async function runNewSpier(page: Page) {
  const rawYamlUrl = await extractSubscriptionUrl(page);
  if (!rawYamlUrl) {
    throw new Error('未找到免费节点订阅链接');
  }

  const directUrl = getOfficialDirectUrl(rawYamlUrl);
  const yamlUrl = directUrl ?? rawYamlUrl;
  console.log('识别到的内容：', rawYamlUrl);
  if (directUrl) {
    console.log('替换直连域名后：', directUrl);
  }
  const rawConfig = await fetchClashConfig(rawYamlUrl);
  console.log('rawConfig length: ', rawConfig.length);

  const result: SpoilerV2 = {
    yamlUrl,
    rawConfig,
  };

  await createGistAndSendDingTalk(result, directUrl);

  return result;
}

export async function getFreeNode() {
  const targetPage = 'https://t.me/s/changfengchannel';
  
  // 启动浏览器
  const browser = await chromium.launch({
    // headless: false,
    channel: 'msedge',
    timeout: 0,
  });
  const context = await browser.newContext({
    extraHTTPHeaders: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    },
    viewport: {
      width: 1024,
      height: 768,
    },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0',
  });
  const page = await context.newPage();

  try {
    // 访问页面
    await page.goto(targetPage, {
      timeout: 0,
    });

    await page.waitForLoadState('domcontentloaded');

    let newSpoilers: SpoilerV2 | undefined;
    try {
      console.log('run new spier')
      newSpoilers = await runNewSpier(page);
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }

    return [newSpoilers];
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    // 关闭浏览器
    await browser.close();
  }
}