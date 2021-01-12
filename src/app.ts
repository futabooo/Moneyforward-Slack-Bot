import { App } from "@slack/bolt";
import dotenv from 'dotenv';
import { createReadStream } from "fs";
import puppeteer, { Page } from "puppeteer";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

dotenv.config()

const baseUrl = 'https://moneyforward.com';
const fileName = 'summaries.png';
const fileDirectory = 'tmp';
const filePath = fileDirectory + '/' + fileName;

/**
 * Returns the secret string from Google Cloud Secret Manager
 * @param {string} name The name of the secret.
 * @return {string} The string value of the secret.
 */
async function accessSecretVersion(name: string) {
  const client = new SecretManagerServiceClient({ keyFilename: 'credentials.json' });
  const projectId = process.env.PROJECT_ID;
  const [version] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/latest`
  });

  // Extract the payload as a string.
  const payload = version.payload?.data?.toString();

  return payload
}

async function init() {
  const slackApp = new App({
    token: await accessSecretVersion('slack-bot-token'),
    signingSecret: await accessSecretVersion('slack-signing-secret')
  });

  slackApp.message('ping', async ({ say }) => {
    say('png')
  });

  slackApp.message('サマリーくれ', async ({ message, context }) => {
    await summaries();
    const result = await slackApp.client.files.upload({
      token: context.botToken,
      channels: message.channel,
      filename: fileName,
      file: createReadStream(filePath),
    });
  });

  await slackApp.start(process.env.PORT || 3000);
  console.log("⚡️ Bolt app is running!");
}

async function summaries() {
  const mailAddress = process.env.MONEYFORWARD_MAIL_ADDRESS;
  const password = process.env.MONEYFORWARD_PASSWORD;
  const groupId = process.env.MONEYFORWARD_GROUP_ID ?? '0';
  const channel = process.env.SLACK_CHANNEL ?? 'general';

  if (mailAddress != null && password != null) {
    const browser = await puppeteer.launch({
      headless: true,
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
        '--disable-dev-shm-usage'
      ]
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
    await page.goto(baseUrl);
    await login(page, mailAddress, password);
    await page.waitForNavigation();
    await page.goto(`${baseUrl}/spending_summaries`);
    await openSummaries(page, groupId);
    await page.waitForTimeout(2000); // FIXME: グラフが表示されるのを待つ
    await saveSummariesImage(page);
    await browser.close;
  } else {
    if (mailAddress == undefined) console.error('Please set the environment variable MONEYFORWARD_MAIL_ADDRESS');
    if (password === undefined) console.error('Please set the environment variable MONEYFORWARD_PASSWORD');
  }
}

async function login(page: Page, mailAddress: string, password: string) {
  await Promise.all([
    page.waitForNavigation(),
    page.click('.web-sign-in a'),
  ]);

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

async function openSummaries(page: Page, groupId: string) {
  await page.waitForSelector('#page-spending-summaries');
  await page.select('select#group_id_hash', groupId)
}

async function saveSummariesImage(page: Page) {
  const element = await page.$('#main-container');
  await element?.screenshot({ path: filePath })
}

(async () => {
  init();
})();