import { readFileSync } from "fs";
import { join } from "path";
import { strict as assert } from "assert";
import { writeFile } from "fs/promises";

import { twoot } from "twoot";
import { close as flushSentry } from "@sentry/node";

import {
  BSKY_PASSWORD,
  BSKY_USERNAME,
  MASTODON_SERVER,
  MASTODON_TOKEN,
  PERSIST_DIR,
} from "./env";

import { generateAndWrite } from "./generate";

function makeStatus(i?: number) {
  if (i == null) {
    // eslint-disable-next-line no-param-reassign
    i = parseInt(readFileSync(join(PERSIST_DIR, "last"), "utf-8"));
  }
  const statuses = JSON.parse(
    readFileSync(join(PERSIST_DIR, "statuses.json"), "utf-8"),
  );
  assert.ok(Array.isArray(statuses));

  const next = (i + 1) % statuses.length;

  return [next, statuses[next] as string | string[]] as const;
}

async function doTwoot(): Promise<void> {
  const [next, stat] = makeStatus();
  const statuses = typeof stat === "string" ? [stat] : stat;

  const results = await twoot(statuses, [
    {
      type: "mastodon",
      server: MASTODON_SERVER,
      token: MASTODON_TOKEN,
    },
    {
      type: "bsky",
      username: BSKY_USERNAME,
      password: BSKY_PASSWORD,
    },
  ]);

  for (const res of results) {
    switch (res.type) {
      case "mastodon-chain":
        console.log(`tooted:\n${res.statuses.map((s) => s.url).join("\n")}\n`);
        break;
      case "bsky-chain":
        console.log(`skeeted:\n${res.statuses.map((s) => s.uri).join("\n")}\n`);
        break;
      case "error":
        console.error(`error while twooting:\n${res.message}`);
        break;
      default:
        throw new Error(`unexpected value:\n${JSON.stringify(res)}`);
    }
  }

  await writeFile(join(PERSIST_DIR, "last"), JSON.stringify(next));
  console.log("wrote latest i: ", next);
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
  void doTwoot()
    .then(() => flushSentry(2000))
    .then(() => {
      process.exit(0);
    });
}
