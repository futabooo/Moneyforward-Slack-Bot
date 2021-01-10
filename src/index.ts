import puppeteer, { Page } from "puppeteer";

(async () => {
  const mailAddress = process.env.MAIL_ADDRESS;
  const password = process.env.PASSWORD;
  const groupId = process.env.GROUP_ID ?? '0';

  if (mailAddress != null && password != null) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://moneyforward.com/');
    await login(page, mailAddress, password);
    await page.waitForNavigation();
    await page.goto('https://moneyforward.com/spending_summaries');
    await openSpendingSummaries(page, groupId);
    await page.waitForTimeout(2000); // FIXME: グラフが表示されるのを待つ
    await saveScreenShot(page);
    await browser.close;
  } else {
    if (mailAddress == undefined) console.error('Please set the environment variable MAIL_ADDRESS');
    if (password === undefined) console.error('Please set the environment variable PASSWORD');
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
    await element?.screenshot({ path: 'summaries.png' })
  }
})();