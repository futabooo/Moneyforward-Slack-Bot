import { App, LogLevel } from "@slack/bolt";
import puppeteer, { Page } from "puppeteer";

const baseUrl = 'https://moneyforward.com';

const mailAddress = process.env.MONEYFORWARD_MAIL_ADDRESS;
const password = process.env.MONEYFORWARD_PASSWORD;
const groupId = process.env.MONEYFORWARD_GROUP_ID ?? '0';

const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.DEBUG,
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

slackApp.command('/moneyforward', async ({ command, ack, context }) => {
  console.log("[receive] サマリーくれ with slach command");
  await ack();

  // 3秒以上かかるのでSlackにエラーが表示されたあと画像が返ってくる
  try {
    const image = await summariesImage();
    await slackApp.client.files.upload({
      token: context.botToken,
      channels: command.channel_id,
      file: image,
    });
  } catch (err) {
    console.log(err)
  }
});

async function summariesImage(): Promise<Buffer | undefined> {
  const browser = await puppeteer.launch({
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
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
  await openLogin(page);
  await login(page, mailAddress, password);
  await page.waitForNavigation();
  await openSpendingSummaries(page, groupId);
  await page.waitForTimeout(2000); // FIXME: グラフが表示されるのを待つ
  const element = await page.$('#main-container');
  const imageBuffer = await element?.screenshot({ encoding: 'binary' });
  await browser.close;
  return imageBuffer;
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

async function openLogin(page: Page) {
  await page.goto(baseUrl);
  await Promise.all([
    page.waitForNavigation(),
    page.click('.web-sign-in a'),
  ]);
}

async function openSpendingSummaries(page: Page, groupId: string) {
  await page.goto(`${baseUrl}/spending_summaries`);
  await page.waitForSelector('#page-spending-summaries');
  await page.select('select#group_id_hash', groupId)
}