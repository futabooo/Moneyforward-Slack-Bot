# Moneyforward-Slack-Bot

MoneyForwardの予算タブのスクリーンショットを撮影してSlackに通知する

<img width="640" src="https://user-images.githubusercontent.com/944185/104848123-df01d280-5926-11eb-8ae2-6be60ca3e722.png">

# Usage
## ローカル環境

## Cloud Run

1. .env.templateを参考に.envを作成して必要な項目を埋める

```.env
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=

MONEYFORWARD_MAIL_ADDRESS=
MONEYFORWARD_PASSWORD=
MONEYFORWARD_GROUP_ID=
```

2. dockerで動かす
```
$ docker build -t  moneyforward-slack-notifier .
$ docker run moneyforward-slack-notifier
```