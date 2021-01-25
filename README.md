# Moneyforward-Slack-Bot

MoneyForwardの予算タブのスクリーンショットを撮影してSlackに通知する

<img width="640" src="https://user-images.githubusercontent.com/944185/105710364-5bfdff00-5f5a-11eb-8520-8d4d13b806ee.png">

## How to run this app

### Create a Slack App

https://api.slack.com/apps

* Features > OAuth & Permissions:
  * Scopes:
    * "bot"
    * "commands"
    * "files:write:user"
  * Click "Save Changes"
* Features > Slash Commands:
  * Click "Create New Command"
    * Command
      * Set `/moneyforward`
    * Request URL
      * Set `{your cloud run url}/slack/events`
    * Short Description
      * Set something helpful for users
    * Click "Save"
* Features > Bot User:
  * Click "Add a Bot User"
  * Click "Add Bot User"
* Settings > Install App:
  * Complete "Install App"

### Run the app on your local machine

```
$ cp .env.template .
```

```
SLACK_SIGNING_SECRET=xxxxxxxxx
SLACK_BOT_TOKEN=xoxb-xxxxxxxxx

MONEYFORWARD_MAIL_ADDRESS=xxxxxxxxx
MONEYFORWARD_PASSWORD=xxxxxxxxx
MONEYFORWARD_GROUP_ID=xxxxxxxxx
```

```
$ npm build
$ docker-compose build
$ docker-compose up

# on another terminal window
# https://ngrok.com/
$ ngrok http 3000
```

change Slack App Request URL
https://{random string}.ngrok.io/slack/events


### Deploy the app onto Google Clour Run
See [Moneyforward-Slack_bot/.github/workflows/build-and-deploy.yaml](https://github.com/futabooo/Moneyforward-Slack-Bot/blob/main/.github/workflows/build-and-deploy.yaml)