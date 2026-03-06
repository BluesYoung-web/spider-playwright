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
  'https://ghproxy.com',
  'https://ghproxy.net',
  'https://mirror.ghproxy.com',
  'https://proxy.v2gh.com',
  'https://gh-proxy.com',
  'https://ui.ghproxy.cc',
  'https://github.akams.cn',
  'https://ghproxy.cn',
  'https://gh.api.99988866.xyz',
];

async function createGistAndSendDingTalk(result: SpoilerV2) {
  const token = process.env.YOUNG_GITHUB_GIST_TOKEN;
  if (!token) {
    console.error('缺少 YOUNG_GITHUB_GIST_TOKEN 环境变量');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
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

  const mirrorLines = GIST_MIRRORS.map(m => `  - ${m}/${rawUrl}`).join('\n');
  const timestampDisplay = new Date().toLocaleString();

  const markdownText = `### 免费节点更新

- **订阅链接：** ${result.yamlUrl}

- **Gist 直链：** ${rawUrl}

- **国内镜像：**
${mirrorLines}

> 更新时间：${timestampDisplay}`;

  const dingtalkWebhook = process.env.DINGTALK_WEBHOOK;
  if (!dingtalkWebhook) {
    console.error('缺少 DINGTALK_WEBHOOK 环境变量');
    return;
  }

  await fetch(dingtalkWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        title: '免费节点(v2ray)',
        text: markdownText,
      },
    }),
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
  return await res.text();
}


async function runNewSpier(page: Page) {
  const yamlUrl = await page.$$eval('.tgme_widget_message_text', (elements) => {
    // 取最后 1 条消息
    const lastMsg = Array.from(elements).pop();

    const allATags = lastMsg.querySelectorAll('a');
    const allLinks = Array.from(allATags).map((tag: any) => tag.href);

    const yamlUrl = allLinks.find(link => link.endsWith('.yaml') || link.endsWith('.yml'));
    
    return yamlUrl;
  });

  console.log('识别到的内容：', yamlUrl);
  const rawConfig = await fetchClashConfig(yamlUrl);
  console.log('rawConfig: ', rawConfig);

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