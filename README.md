it's a me, italian gramsci! i tweet-a da thoughts i have while inna da prison.

pass these environment variables in if you want the bot to do stuff:

- `MASTODON_TOKEN`: a Mastodon user API token
- `MASTODON_SERVER`: the instance to which API calls should be made (usually
  where the bot user lives.) (default: https://mastodon.social)
- `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET`, `TWITTER_ACCESS_KEY`,
  `TWITTER_ACCESS_SECRET`: these are for twitter. why is twitter so needy.
- `DATA_DIR`: the directory in which to search for textual data and increment
  its position for subsequent runs. (default: 'persist')
- `CRON_RULE`: the interval between each post, in crontab format. (default:
  every four hours)

this bot uses the [envalid](https://github.com/af/envalid) package which in turn
wraps [dotenv](https://github.com/motdotla/dotenv), so you can alternately stick
any of the above environment variables in a file named `.env` in the project
root. (it's gitignored, so there's no risk of accidentally committing private
API tokens you put in there.)

code is written in typescript, and the dockerfile will compile to js as part of
its setup. run `yarn dev` if you're hacking on things and want to run locally
and rebuild on changes.


###### [more bots?](https://github.com/lostfictions?tab=repositories&q=botally)
