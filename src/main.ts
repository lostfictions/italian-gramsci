require("source-map-support").install();

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { strict as assert } from "assert";

import Masto from "masto";
import { TwitterClient } from "twitter-api-client";
import retry from "async-retry";
import { v4 as uuid } from "uuid";

import {
  DATA_DIR,
  MASTODON_SERVER,
  MASTODON_TOKEN,
  TWITTER_ACCESS_KEY,
  TWITTER_ACCESS_SECRET,
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
} from "./env";

import { generateAndWrite } from "./generate";

function makeStatus(i?: number) {
  if (i == null) {
    // eslint-disable-next-line no-param-reassign
    i = parseInt(readFileSync(join(DATA_DIR, "last"), "utf-8"));
  }
  const statuses = JSON.parse(
    readFileSync(join(DATA_DIR, "statuses.json"), "utf-8")
  );
  assert.ok(Array.isArray(statuses));

  const next = (i + 1) % statuses.length;

  return [next, statuses[next] as string | string[]] as const;
}

async function doTwoot(): Promise<void> {
  const [next, s] = makeStatus();
  const statuses = typeof s === "string" ? [s] : s;

  const rets = await Promise.allSettled([
    // doToot(statuses),
    doTweet(statuses),
  ]);

  if (rets.some((r) => r.status === "fulfilled")) {
    writeFileSync(join(DATA_DIR, "last"), JSON.stringify(next));
    console.log("wrote latest i: ", next);
  }

  console.log("Done", rets);
}

async function doToot(statuses: string[]): Promise<void> {
  const masto = await retry(() =>
    Masto.login({
      uri: MASTODON_SERVER,
      accessToken: MASTODON_TOKEN,
    })
  );

  let inReplyToId: string | null | undefined = null;

  for (const status of statuses) {
    const idempotencyKey = uuid();

    // eslint-disable-next-line no-await-in-loop
    const publishedToot = await retry(
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      () =>
        masto.createStatus(
          {
            status,
            visibility: "public",
            inReplyToId,
          },
          idempotencyKey
        ),
      { retries: 5 }
    );

    inReplyToId = publishedToot.id;

    console.log("======\n", status);
    console.log(`${publishedToot.createdAt} -> ${publishedToot.uri}\n======`);

    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((res) => {
      setTimeout(() => {
        res();
      }, 3000);
    });
  }
}

async function doTweet(statuses: string[]): Promise<void> {
  const twitterClient = new TwitterClient({
    apiKey: TWITTER_CONSUMER_KEY,
    apiSecret: TWITTER_CONSUMER_SECRET,
    accessToken: TWITTER_ACCESS_KEY,
    accessTokenSecret: TWITTER_ACCESS_SECRET,
  });

  let inReplyToId: string | undefined = undefined;

  for (const status of statuses) {
    // eslint-disable-next-line no-await-in-loop
    const publishedTweet = await retry(
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      () =>
        twitterClient.tweets.statusesUpdate({
          status,
          in_reply_to_status_id: inReplyToId,
          auto_populate_reply_metadata: true,
        }),
      { retries: 5 }
    );

    inReplyToId = publishedTweet.id_str;

    console.log("======\n", status);
    console.log(
      [
        `${publishedTweet.created_at} -> `,
        `https://twitter.com/${publishedTweet.user.screen_name}/status/${publishedTweet.id_str}\n======`,
      ].join("")
    );

    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((res) => {
      setTimeout(() => {
        res();
      }, 3000);
    });
  }
}

const argv = process.argv.slice(2);

if (argv.includes("local")) {
  console.log("Running locally!");

  if (argv.includes("regen")) {
    console.log("generating and writing...");
    generateAndWrite();
    console.log("done writing.");
  }

  let i = 0;

  setInterval(() => {
    const [n, l] = makeStatus(i);
    console.log(n, ":", l);
    i = n;
    console.log(`(${l.length})\n`);
  }, 2000);
} else {
  console.log("Running in production!");
  void doTwoot().then(() => process.exit(0));
}
