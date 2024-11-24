const isVowel = (char: string) => /^[aeiou]$/i.test(char);
export default function pluralize(word: string) {
  if (word.length === 0) return word;
  switch (word.at(-1)!.toLowerCase()) {
    case "s":
    case "h":
    case "x":
      return `${word}es`;
    case "y":
      return !isVowel(word.at(-2)!) ? `${word.slice(0, -1)}ies` : `${word}s`;
    default:
      return `${word}s`;
  }
}
