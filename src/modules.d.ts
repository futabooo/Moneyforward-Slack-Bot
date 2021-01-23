declare namespace NodeJS {
  // 環境変数名の定義
  export interface ProcessEnv {
    /** 現在の Node.js 実行環境 */
    readonly NODE_ENV: 'development' | 'production' | 'test';
    readonly SLACK_BOT_TOKEN: string;
    readonly SLACK_SIGNING_SECRET: string;
    readonly MONEYFORWARD_MAIL_ADDRESS: string;
    readonly MONEYFORWARD_PASSWORD: string;
    readonly MONEYFORWARD_GROUP_ID?: string;
  }
}