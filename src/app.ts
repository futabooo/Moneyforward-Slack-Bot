import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { App, LogLevel } from "@slack/bolt";
import dotenv from 'dotenv';
import puppeteer, { Page } from "puppeteer";

dotenv.config()

const baseUrl = 'https://moneyforward.com';

var mailAddress: string;
var password: string;
var groupId: string;

/**
* Returns the secret string from Google Cloud Secret Manager
* @param {string} name The name of the secret.
* @return {payload} The string value of the secret.
*/
async function accessSecretVersion(name: string) {
  const client = new SecretManagerServiceClient();
  const projectId = process.env.PROJECT_ID;
  const [version] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/1`,
  });
  // Extract the payload as a string.
  const payload = version.payload?.data?.toString();
  return payload;
}

async function init() {
  // FIXME: 型をいい感じにしたい
  const m = process.env.MONEYFORWARD_MAIL_ADDRESS || await accessSecretVersion('moneyforward-mail-address');
  const p = process.env.MONEYFORWARD_PASSWORD || await accessSecretVersion('moneyforward-password');
  groupId = (process.env.MONEYFORWARD_GROUP_ID || await accessSecretVersion('moneyforward-group-id')) ?? '0';
  if (m == null || p == null) {
    if (m === undefined) console.error('Please set the environment variable MONEYFORWARD_MAIL_ADDRESS');
    if (p === undefined) console.error('Please set the environment variable MONEYFORWARD_PASSWORD');
    return;
  }
  mailAddress = m as string;
  password = p as string;

  const slackApp = new App({
    token: process.env.SLACK_BOT_TOKEN || await accessSecretVersion('slack-bot-token'),
    signingSecret: process.env.SLACK_SIGNING_SECRET || await accessSecretVersion('slack-signing-secret'),
    logLevel: LogLevel.DEBUG,
    processBeforeResponse: true,
  });

  slackApp.message('ping', async ({ say }) => {
    console.log("[receive] ping");
    say('pong')
  });

  slackApp.message('サマリーくれ', async ({ message, context, say }) => {
    console.log("[receive] サマリーくれ");
    say('サマリー取得中');
    try {
      const image = await summariesImage();
      await slackApp.client.files.upload({
        token: context.botToken,
        channels: message.channel,
        file: image,
      });
    } catch (err) {
      console.log(err)
    }
  });

  slackApp.command('/moneyforward', async ({ command, ack, say }) => {
    console.log("[receive] サマリーくれ with slach command");
    await ack();
    say('サマリー取得中');
    try {
      const image = await summariesImage();
      await slackApp.client.files.upload({
        token: command.botToken,
        channels: command.channel_id,
        file: image,
      });
    } catch (err) {
      console.log(err)
    }
  });

  await slackApp.start(process.env.PORT || 3000);
  console.log("⚡️ Bolt app is running!");
}

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
  await openSummaries(page, groupId);
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

async function openSummaries(page: Page, groupId: string) {
  await page.goto(`${baseUrl}/spending_summaries`);
  await page.waitForSelector('#page-spending-summaries');
  await page.select('select#group_id_hash', groupId)
}

(async () => {
  init();
})();