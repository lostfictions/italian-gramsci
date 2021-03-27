require("source-map-support").install();
import { readFileSync } from "fs";
import { join } from "path";

import Masto from "masto";
import retry from "async-retry";
import { v4 as uuid } from "uuid";

import { MASTODON_SERVER, MASTODON_TOKEN } from "./env";

const vowel = /[aeiou]/;
const letter = /[a-zA-Z]/;
const punc = /[,:.!]/;

const mappings: Record<string, string> = {
  // could be contextual: 'de elite' vs 'da tendentiousness'
  the: "da",
  then: "den",
  this: "dis",
  that: "dat",
  these: "dese",
  those: "doze",
  they: "dey",
  there: "dere",
};

const wordRep = (w: string) => {
  let adjusted = [w];
  if (punc.test(w[w.length - 1])) {
    adjusted = [w.slice(0, -1), w[w.length - 1]];
  }

  const r = mappings[adjusted[0].toLowerCase()];
  if (!r) return w;

  const upper = adjusted[0][0] === adjusted[0][0].toUpperCase();
  if (upper) {
    adjusted[0] = `${r[0].toUpperCase()}${r.slice(1)}`;
  } else {
    adjusted[0] = r;
  }

  return adjusted.join("");
};

function italianize(sentence: string): string {
  const words = sentence
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .map((w) => wordRep(w));

  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i];
    const b = words[i + 1];

    if ((a === "is" || a === "of") && (b === "a" || b === "an")) {
      words[i] = `${a}-a`;
      words[i + 1] = b === "a" ? "da" : "de";
      continue;
    }
    if (b === "da" || b === "dese" || b === "dey") {
      const last = a[a.length - 1];
      if (!vowel.test(last) && last !== "s" && letter.test(last)) {
        words[i] = `${a}-a`;
        continue;
      }
    }
  }

  const res = words.join(" ");
  // console.log(`${sentence} => ${res}`);
  return res;
}

const lines = readFileSync(
  join(__dirname, "..", "text", "cleaned.txt"),
  "utf-8"
)
  .split("\n")
  .filter((l) => l.trim().length > 0)
  .filter((l) => l !== l.toUpperCase());

// https://stackoverflow.com/a/18914855
const sentences = lines
  .flatMap((par) => par.replace(/([.?!])\s*(?=[A-Z])/g, "$1|").split("|"))
  .slice(100);

const MAX_LENGTH = 280;

const tweets: string[] = [];

let tweet = "";

for (const s of sentences) {
  const italianized = italianize(s);

  if (tweet.length + 1 + italianized.length < MAX_LENGTH) {
    tweet += ` ${italianized}`;
    continue;
  }

  // heuristic to improve.
  if (tweet.length > 0) {
    tweets.push(tweet.trim());

    if (italianized.length < MAX_LENGTH) {
      tweet = italianized;
      continue;
    }

    tweet = "";
  }

  const words = italianized
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  if (words.some((w) => w.length > MAX_LENGTH - 1)) {
    throw new Error(
      `unsplittable token: ${words.find((w) => w.length > MAX_LENGTH - 1)}`
    );
  }

  while (words.length > 0) {
    const w = words.shift()!;
    if (tweet.length + 1 + w.length < MAX_LENGTH - 1) {
      tweet += ` ${w}`;
    } else {
      tweet += "…";
      tweets.push(tweet.trim());
      tweet = "…";
    }
  }
}

console.log("done splitting.");

let i = 0;

function makeLine() {
  if (i >= tweets.length) i = 0;
  return tweets[i++];
}

async function doTwoot(): Promise<void> {
  const line = makeLine();

  const idempotencyKey = uuid();

  const status = await retry(
    async () => {
      const masto = await Masto.login({
        uri: MASTODON_SERVER,
        accessToken: MASTODON_TOKEN,
      });

      return masto.createStatus(
        {
          status: line,
          visibility: "public",
        },
        idempotencyKey
      );
    },
    { retries: 5 }
  );

  console.log(line);
  console.log(`${status.createdAt} -> ${status.uri}`);
}

const argv = process.argv.slice(2);

if (argv.includes("local")) {
  console.log("Running locally!");

  setInterval(() => {
    const l = makeLine();
    console.log(l);
    console.log(`(${l.length})\n`);
  }, 2000);
} else {
  console.log("Running in production!");
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  doTwoot().then(() => process.exit(0));
}
