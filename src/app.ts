import { App } from "@slack/bolt";
import dotenv from 'dotenv';
import { createReadStream } from "fs";
import puppeteer, { Page } from "puppeteer";

dotenv.config()

const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const baseUrl = 'https://moneyforward.com';
const fileName = 'summaries.png';
const fileDirectory = 'tmp';
const filePath = fileDirectory + '/' + fileName;

(async () => {
  const mailAddress = process.env.MONEYFORWARD_MAIL_ADDRESS;
  const password = process.env.MONEYFORWARD_PASSWORD;
  const groupId = process.env.MONEYFORWARD_GROUP_ID ?? '0';
  const channel = process.env.SLACK_CHANNEL ?? 'general';

  if (mailAddress != null && password != null) {
    const browser = await puppeteer.launch({
      headless: false,
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
    await openSpendingSummaries(page, groupId);
    await page.waitForTimeout(2000); // FIXME: グラフが表示されるのを待つ
    await saveScreenShot(page);
    await browser.close;
    await slackApp.client.files.upload({
      token: process.env.SLACK_BOT_TOKEN,
      filename: fileName,
      file: createReadStream(filePath),
      channels: channel
    });
  } else {
    if (mailAddress == undefined) console.error('Please set the environment variable MONEYFORWARD_MAIL_ADDRESS');
    if (password === undefined) console.error('Please set the environment variable MONEYFORWARD_PASSWORD');
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

  async function openSpendingSummaries(page: Page, groupId: string) {
    await page.waitForSelector('#page-spending-summaries');
    await page.select('select#group_id_hash', groupId)
  }

  async function saveScreenShot(page: Page) {
    const element = await page.$('#main-container');
    await element?.screenshot({ path: filePath })
  }
})();