import { chromium, Page } from 'playwright';

interface Spoiler {
  pwd: string;
  url: string;
  config?: string;
}

async function sendDingTalkMessage(lastTwoSpoilers: Spoiler[], version: string) {
  // 通过 钉钉 的 webhook 发消息给自己
  // @ts-expect-error
  const dingtalkWebhook = import.meta.env.VITE_DINGTALK_WEBHOOK;
  await fetch(dingtalkWebhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        title: '免费节点(v2ray)----${version}',
        text: `### 免费节点更新----${version}\n
${lastTwoSpoilers.map((s, i) => `
#### 配置 ${i + 1}
- **密码：** \`${s.pwd}\`
- **链接：** ${s.url}
${s.config ? `- **配置：** \`\`\`\n${s.config}\n\`\`\`` : ''}
`).join('\n')}\n\n
> 更新时间：${new Date().toLocaleString()}
`,
      },
    }),
  })
  
  const res = await fetch(dingtalkWebhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      msgtype: 'feedCard',
      feedCard: {
        links: lastTwoSpoilers.map((s, i) => ({
          title: `v2ray (password: ${s.pwd})---${version}`,
          description: `密码: ${s.pwd}\n更新时间: ${new Date().toLocaleString()}`,
          picURL: 'https://static.dingtalk.com/media/lQLPM4Gc03xjIbPNAgDNAgCwkVfi2qTLIAMHyvWcQlngAA_512_512.png', // 你可以替换成自己的图片
          messageURL: s.url
        }))
      }
    }),
  });
  console.log('钉钉消息发送结果：', await res.json());
}


async function runNewSpier(page: Page) {
  // 获取所有 <tg-spoiler>
  const spoilers: Spoiler[] = await page.$$eval('.tgme_widget_message_text', (elements) => {
    // 取最后两条
    const lastTwoSpoilers = Array.from(elements).slice(-2);
    
    return lastTwoSpoilers.map(element => {
      const url = element.querySelector('a')?.href;
      // 节点密码：stilly
      const pwd = element.innerText.match(/节点密码：(\w+)/)?.[1];
      return { url, pwd };
    });
  });

  console.log('识别到的内容：', spoilers);

  await sendDingTalkMessage(spoilers, 'new');
  console.log('todo: 自动抓取 clash 配置')
  return spoilers;
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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  });
  const page = await context.newPage();

  try {
    // 访问页面
    await page.goto(targetPage, {
      timeout: 0,
    });

    await page.waitForLoadState('domcontentloaded');

    let newSpoilers: Spoiler[] = [];
    try {
      console.log('run new spier')
      newSpoilers = await runNewSpier(page);
    } catch (error) {
      console.error('Error:', error);
    }

    return newSpoilers;
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    // 关闭浏览器
    await browser.close();
  }
}