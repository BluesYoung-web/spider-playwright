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

const GIST_MIRRORS = [
  { name: 'ghproxy', base: 'https://ghproxy.net' },
  { name: 'v2gh', base: 'https://proxy.v2gh.com' },
  { name: 'gh-proxy', base: 'https://gh-proxy.com' },
];

function buildMirrorUrl(mirrorBase: string, rawUrl: string) {
  return `${mirrorBase}/${rawUrl}`;
}

async function postDingTalk(webhook: string, payload: Record<string, unknown>) {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`钉钉发送失败: ${res.status} ${err}`);
  }
}

async function createGistAndSendDingTalk(result: SpoilerV2) {
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

  const cardText = [
    `更新时间：${timestampDisplay}`,
    '',
    '长按链接可复制，或点下方按钮直接打开：',
    '',
    'Gist 直链',
    rawUrl,
    '',
    ...GIST_MIRRORS.map(({ name }, index) => [`${name} 镜像`, mirrorUrls[index]].join('\n')),
  ].join('\n');

  const dingtalkWebhook = process.env.VITE_DINGTALK_WEBHOOK || process.env.DINGTALK_WEBHOOK;
  if (!dingtalkWebhook) {
    console.error('缺少 VITE_DINGTALK_WEBHOOK 或 DINGTALK_WEBHOOK 环境变量');
    return;
  }

  await postDingTalk(dingtalkWebhook, {
    msgtype: 'actionCard',
    actionCard: {
      title: '免费节点更新',
      text: cardText,
      btnOrientation: '0',
      btns: [
        { title: 'Gist 直链', actionURL: rawUrl },
        ...GIST_MIRRORS.map(({ name }, index) => ({
          title: `${name} 镜像`,
          actionURL: mirrorUrls[index],
        })),
      ],
    },
  });

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
  const yamlUrl = await extractSubscriptionUrl(page);
  if (!yamlUrl) {
    throw new Error('未找到免费节点订阅链接');
  }

  console.log('识别到的内容：', yamlUrl);
  const rawConfig = await fetchClashConfig(yamlUrl);
  console.log('rawConfig length: ', rawConfig.length);

  const result: SpoilerV2 = {
    yamlUrl,
    rawConfig,
  };

  await createGistAndSendDingTalk(result);

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