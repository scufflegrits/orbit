// Wording helpers shared by messages (2.2.1 render.js).

/**
 * "1 tab", "2 tabs", or with an irregular plural, "2 addresses".
 * @param {number} amount
 * @param {string} word
 * @param {string} [plural]
 */
export function counted(amount, word, plural = `${word}s`) {
  return `${amount} ${amount === 1 ? word : plural}`;
}
