# Moneyforward-Slack-Notifier

MoneyForwardの予算タブのスクリーンショットを撮影してSlackに通知する

## Usage

1. .env.templateを参考に.envを作成して必要な項目を埋める

```.env
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=
SLACK_CHANNEL=

MONEYFORWARD_MAIL_ADDRESS=
MONEYFORWARD_PASSWORD=
MONEYFORWARD_GROUP_ID=
```

2. dockerで動かす
```
$ docker build -t  moneyforward-slack-notifier .
$ docker run moneyforward-slack-notifier
```