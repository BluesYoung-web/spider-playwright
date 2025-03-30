import { chromium } from 'playwright';

interface Spoiler {
  pwd: string;
  url: string;
  config?: string;
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
    // 获取所有 <tg-spoiler>
    const spoilers: Spoiler[] = await page.$$eval('tg-spoiler', (elements) => {
      return elements.map(element => {
        const pwd = element.innerText;
        const url = element.parentElement?.querySelector('a')?.href;
        return { pwd, url };
      });
    });
    console.log('识别到的内容：', spoilers);

    // 取最后两条
    const lastTwoSpoilers = spoilers.slice(-2);
    console.log('最后两条：', lastTwoSpoilers);

    // 通过 钉钉 的 webhook 发消息给自己
    // @ts-expect-error
    const dingtalkWebhook = import.meta.env.VITE_DINGTALK_WEBHOOK;
    const res = await fetch(dingtalkWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title: '免费节点(v2ray)',
          text: `### 免费节点更新\n
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
    });
    console.log('钉钉消息发送结果：', await res.json());
    console.log('todo: 自动抓取 clash 配置')
    return lastTwoSpoilers;


    // 遍历 lastTwoSpoilers ， 使用 playwright 打开 url
    for (const spoiler of lastTwoSpoilers) {
      const { pwd, url } = spoiler;
      const page = await context.newPage();
      
      // 设置页面超时时间为 0
      page.setDefaultTimeout(0);
      page.setDefaultNavigationTimeout(0);

      try {
        // 访问页面并等待加载
        await page.goto(url, {
          timeout: 0,
          waitUntil: 'networkidle'
        });

        // 等待页面加载完成
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');

        // 处理 Cookie 同意弹窗
        if (await page.$('.fc-consent-root')) {
          await page.click('.fc-consent-root .fc-cta-consent');
          await page.waitForTimeout(2000); // 等待弹窗消失
        }
        
        // 等待输入框出现并输入密码
        let input = await page.waitForSelector('#input-40', { timeout: 10000 });
        if (!input) {
          console.log('输入框未找到，跳过当前节点');
          continue;
        }

        await input.focus();
        await input.fill(pwd);

        // 等待并点击按钮
        const buttons = await page.$$('.v-card-actions button');
        if (buttons[1]) {
          await buttons[1].click();
          await page.waitForTimeout(2000);
        }

        // 等待操作按钮出现
        const operateButtons = await page.$$('.v-container button');
        if (!operateButtons.length) {
          console.log('操作按钮未找到，跳过当前节点');
          continue;
        }

        // 查找并点击全选按钮
        const allSelectButton = await operateButtons.find(async (button) => {
          const text = await button.innerText();
          return text === '全选';
        });
        
        if (allSelectButton) {
          await allSelectButton.click();
          console.log('全选完成');
          await page.waitForTimeout(2000);
        }

        // 查找并点击转换按钮
        const convertButton = await operateButtons.find(async (button) => {
          const text = await button.innerText();
          return text === '转换';
        });
        
        if (convertButton) {
          await convertButton.click();
          console.log('转换完成');
          await page.waitForTimeout(4000);
        }
        
        // 选择 clash 配置
        await page.click('.v-overlay-container .v-list .v-list-item:nth-child(2)');
        await page.waitForTimeout(4000);

        // 获取配置内容
        const clashConfig = await page.textContent('body > div.v-overlay-container > div.v-codemirror > div > div.cm-scroller > div.cm-content');
        if (clashConfig) {
          spoiler.config = clashConfig || undefined;
          console.log('成功获取配置');
        } else {
          console.log('未获取到配置内容');
        }

      } catch (error) {
        console.error('处理节点时出错：', error);
      } finally {
        // 关闭页面
        await page.close();
      }
    }
    
    return lastTwoSpoilers;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    // 关闭浏览器
    await browser.close();
  }
}