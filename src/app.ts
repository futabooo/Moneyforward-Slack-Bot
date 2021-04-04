import { App, LogLevel } from "@slack/bolt";
import puppeteer, { Browser, Page } from "puppeteer";

const baseUrl = 'https://moneyforward.com';

const mailAddress = process.env.MONEYFORWARD_MAIL_ADDRESS;
const password = process.env.MONEYFORWARD_PASSWORD;
const groupId = process.env.MONEYFORWARD_GROUP_ID ?? '0';

const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  logLevel: process.env.ENVIRONMENT == 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
  processBeforeResponse: true,
});

(async () => {
  await slackApp.start(process.env.PORT || 3000);
  console.log("⚡️ Bolt app is running!");
})();

slackApp.message('ping', async ({ say }) => {
  console.log("[receive] ping");
  say('pong')
});

slackApp.command('/moneyforward', async ({ command, ack, say, context }) => {
  await ack();

  const commandText = command.text.toLowerCase();
  const commandInputs = commandText ? commandText.split(/\s+/) : [];
  const mode = commandInputs.length > 0 ? commandInputs[0] : 'budget';

  switch (mode) {
    case 'budget':
      try {
        // CloudRunのCold Startに当たると3秒以上かかるのでSlackにエラーが表示されたあと画像が返ってくる
        const image = await budgetCapture();
        await slackApp.client.files.upload({
          token: context.botToken,
          channels: command.channel_id,
          file: image,
        });
      } catch (err) {
        console.log(err)
        say(`画像の取得に失敗しました`);
      }
      break;
    case 'actual':
      const today = new Date();
      const yearMonth = commandInputs.length > 1 ? commandInputs[1] : '';
      const year = yearMonth.length > 0 ? yearMonth.substr(0, 4) : today.getFullYear().toString();
      const month = yearMonth.length > 0 ? yearMonth.substr(4, 2).replace('0', '') : (today.getMonth() + 1).toString();
      try {
        // CloudRunのCold Startに当たると3秒以上かかるのでSlackにエラーが表示されたあと画像が返ってくる
        const image = await actualCapture(year, month);
        await slackApp.client.files.upload({
          token: context.botToken,
          channels: command.channel_id,
          file: image,
        });
      } catch (err) {
        console.log(err)
        say(`画像の取得に失敗しました`);
      }
      break;
    default:
      say(`${mode}は対応していないコマンドです`);
  }
});

async function budgetCapture(): Promise<Buffer | undefined> {
  const browser = await createBrowser();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36');
  await openLogin(page);
  await login(page, mailAddress, password);
  await page.waitForNavigation();
  await selectGroup(page, groupId);
  await openSpendingSummaries(page);
  await page.waitForTimeout(2000); // FIXME: グラフが表示されるのを待つ
  const element = await page.$('#main-container');
  const imageBuffer = await element?.screenshot({ encoding: 'binary' });
  await browser.close;
  return imageBuffer;
}

async function actualCapture(year: string, month: string): Promise<Buffer | undefined> {
  const browser = await createBrowser();
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36');
  await openLogin(page);
  await login(page, mailAddress, password);
  await page.waitForNavigation();
  await selectGroup(page, groupId);
  await openCf(page);
  await page.$eval(`[data-year="${year}"] [data-month="${month}"]`, el => (el as HTMLElement).click());
  await page.waitForTimeout(2000); // FIXME: 月を選択したあと表示が完了するのを待つ
  await openCfSummary(page);
  await page.waitForTimeout(2000); // FIXME: グラフが表示されるのを待つ
  const element = await page.$('#summary-info-content');
  const imageBuffer = await element?.screenshot({ encoding: 'binary' });
  await browser.close;
  return imageBuffer;
}

async function createBrowser(): Promise<Browser> {
  return await puppeteer.launch({
    headless: true,
    executablePath: 'google-chrome-stable',
    defaultViewport: {
      width: 1024,
      height: 768
    },
    args: [
      // Required for Docker version of Puppeteer
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // This will write shared memory files into /tmp instead of /dev/shm,
      // because Docker’s default for /dev/shm is 64MB
      '--disable-dev-shm-usage',
      // improves a little the speed
      // https://github.com/puppeteer/puppeteer/issues/3120#issuecomment-415553869
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ]
  });
}

async function login(page: Page, mailAddress: string, password: string) {
  await Promise.all([
    page.waitForNavigation(),
    page.click('.buttonWrapper .blockContent a'),
  ]);

  await Promise.all([
    page.waitForSelector('input[name="mfid_user[email]"]'),
    page.type('input[name="mfid_user[email]"]', mailAddress),
  ]);
  await page.click('input[type="submit"]');

  await Promise.all([
    await page.waitForSelector('input[name="mfid_user[password]"]'),
    await page.type('input[name="mfid_user[password]"]', password),
  ]);
  await page.click('input[type="submit"]');
}

async function selectGroup(page: Page, groupId: string) {
  await page.select('select#group_id_hash', groupId)
  await page.waitForSelector('.alert-success');
}

async function openLogin(page: Page) {
  await page.goto(baseUrl);
  await Promise.all([
    page.waitForNavigation(),
    page.click('.web-sign-in a'),
  ]);
}

async function openSpendingSummaries(page: Page) {
  await page.goto(`${baseUrl}/spending_summaries`);
  await page.waitForSelector('#page-spending-summaries');
}

async function openCf(page: Page) {
  await page.goto(`${baseUrl}/cf`);
  await page.waitForSelector('#calendar');
}

async function openCfSummary(page: Page) {
  await page.goto(`${baseUrl}/cf/summary`);
  await page.waitForSelector('#cf-summary');
}