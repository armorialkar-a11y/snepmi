/** Public catalogue presentation; does not mutate admin or database records. */
const PRICE_TEXT = /[₽$€£¥]|\b(?:USD|EUR|RUB|KZT)\b|руб(?:л[ьяейю]|\.)?|стоимост|цен(?:а|ы|у|е|ой|ник)|прайс|бесплат|бюджет|оплат|бартер|скидк|тариф|договорн/iu;

export function withoutPrices(lines) {
  return (Array.isArray(lines) ? lines : [])
    .filter((line) => typeof line === 'string')
    .filter((line) => !PRICE_TEXT.test(line));
}

export function normalizeTopics(topics) {
  return [...new Set((Array.isArray(topics) ? topics : []).map((topic) => {
    const value = String(topic).trim();
    return /^(?:лайф|лайфстайл)$/iu.test(value) ? 'лайфстайл' : value;
  }).filter(Boolean))];
}

export function publicBlogger(blogger) {
  return {
    ...blogger,
    price: null,
    topics: normalizeTopics(blogger.topics),
    // No advertising terms/guarantees are shown in public cards.
    ad_terms: [],
    ad_restrictions: withoutPrices(blogger.ad_restrictions),
  };
}
