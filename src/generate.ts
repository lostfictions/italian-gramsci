import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { PERSIST_DIR } from "./env";

const vowel = /[aeiouAEIOU]/;
const letter = /[a-zA-Z]/;
const punc = /[,:.!]/;
const isUpper = (c: string) => c === c.toUpperCase();

const mappings = new Map<string, string>([
  // could be contextual: 'de elite' vs 'da tendentiousness'
  // the: "da",
  ["then", "den"],
  ["this", "dis"],
  ["that", "dat"],
  ["these", "dese"],
  ["those", "doze"],
  ["they", "dey"],
  ["there", "dere"],
  ["their", "dere"],
]);

const itals = new Set(
  [...mappings.values()]
    .concat([...mappings.values()].map((w) => w.toUpperCase()))
    .concat("da", "de", "DA", "DE"),
);

// extra replacements, but which don't cause "do-a de" inflections
for (const [from, to] of [
  // more to come?
  ["italy", "Italy (Italia)"],
]) {
  mappings.set(from, to);
}

const exclamations = [
  "Capisce?",
  "Mamma mia!",
  "Che bene.",
  "🤌",
  "Eccolo!",
  "Ma dai!",
  "Bene.",
  "Eyyy.",
];
let exclamationIdx = 0;

const transformMatchingCase = (from: string, to: string): string => {
  if (isUpper(from)) {
    return to.toUpperCase();
  }
  if (isUpper(from[0])) {
    return `${to[0].toUpperCase()}${to.slice(1)}`;
  }
  return to;
};

const isWord = (lhs: string, rhs: string): boolean =>
  lhs.toLowerCase() === rhs.toLowerCase();

const wordRep = (w: string) => {
  let adjusted = [w];
  if (punc.test(w.at(-1)!)) {
    adjusted = [w.slice(0, -1), w.at(-1)!];
  }

  const r = mappings.get(adjusted[0].toLowerCase());
  if (!r) return w;

  adjusted[0] = transformMatchingCase(adjusted[0], r);

  return adjusted.join("");
};

function italianize(sentence: string): string {
  const words = sentence
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .map((w) => wordRep(w));

  const debugLog = false;

  // inflect negations
  for (let i = 0; i < words.length - 2; i++) {
    // const a = words[i];
    const b = words[i + 1];
    const c = words[i + 2];

    if (c === "not") {
      if (b === "were") {
        words[i + 1] = "no";
        words[i + 2] = "were";
        continue;
      }

      if (b === "was") {
        words[i + 1] = "no";
        words[i + 2] = "was";
        continue;
      }

      if (b === "is") {
        words[i + 1] = "no";
        words[i + 2] = "is";
        continue;
      }

      if (b === "do" || b === "does") {
        words[i + 1] = "no";
        words[i + 2] = "";
        continue;
      }
    }
  }

  // determiners => de/da
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i];
    const b = words[i + 1];

    // is a, of an => is-a da, of-a de
    if (
      ["is", "was", "of", "as", "by"].some((w) => isWord(w, a)) &&
      ["a", "an"].some((w) => isWord(w, b))
    ) {
      words[i + 1] = transformMatchingCase(b, isWord(b, "a") ? "da" : "de");
    } else if (isWord(a, "the")) {
      words[i] = transformMatchingCase(a, vowel.test(b[0]) ? "de" : "da");
    }
  }

  // the essential -a
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i];
    const b = words[i + 1];

    if (itals.has(b)) {
      const last = a.at(-1)!;
      if (!vowel.test(last) && !isWord(last, "s") && letter.test(last)) {
        words[i] = transformMatchingCase(a, `${a}-a`);
        continue;
      }
    }
  }

  // it's-a
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i];
    if (["its", "it's", "of"].includes(a.toLowerCase())) {
      words[i] = transformMatchingCase(a, `${a}-a`);
    }
  }

  const res = words.filter((w) => w.length > 0).join(" ");
  if (debugLog) {
    console.log(`${sentence}\n=>\n${res}\n\n`);
  }
  return res;
}

export function generate() {
  const paras = readFileSync(
    join(__dirname, "..", "text", "cleaned.txt"),
    "utf-8",
  )
    .split("\n")
    .filter((l) => l.trim().length > 0);
  // filter section heads
  // .filter((l) => l !== l.toUpperCase());

  const sentences = paras
    .flatMap((par) => {
      const ss = par
        // naive sentence split adapted from https://stackoverflow.com/a/18914855
        .replaceAll(/(?<![A-Z\d]+)([.?!])\s*(?=[A-Z])/g, "$1|")
        .split("|");

      // could alternately insert a marker instead of an exclamation proper and
      // have logic later to decide whether to insert or ignore
      if (ss.length > 3) {
        return ss.concat(exclamations[exclamationIdx++ % exclamations.length]);
      }
      return ss;
    })
    // offset for debugging
    .slice(0);

  const MAX_LENGTH = 280;

  const tweets: (string | string[])[] = [];

  let tweet = "";

  for (const s of sentences) {
    const italianized = italianize(s);

    // if the whole thing is uppercase, it's a title, tweet it solo
    if (isUpper(italianized)) {
      if (tweet.length > 0) {
        tweets.push(tweet.trim());
        tweet = "";
      }
      tweets.push(italianized);
      continue;
    }

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
        `unsplittable token: ${words.find((w) => w.length > MAX_LENGTH - 1)}`,
      );
    }

    // tweet group (gruppa).
    const group: string[] = [];

    while (words.length > 0) {
      const w = words.shift()!;
      if (tweet.length + 1 + w.length < MAX_LENGTH - 1) {
        tweet += ` ${w}`;
      } else {
        tweet += "…";
        group.push(tweet.trim());
        tweet = `…${w}`;
      }
    }

    if (tweet.trim().length > 0) {
      group.push(tweet.trim());
      tweet = "";
    }
    tweets.push(group);
  }

  return tweets;
}

export function generateAndWrite() {
  const tweets = generate();

  writeFileSync(
    join(PERSIST_DIR, "statuses.json"),
    JSON.stringify(tweets, undefined, 2),
  );
}
