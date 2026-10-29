import { fetchWithRetry, mapLimit } from './http.mjs';

const API = 'https://api.npmjs.org/downloads/range';

// Bulk queries cover at most 365 days, which twelve months exceed in a leap year.
const MONTHS_PER_QUERY = 6;

/**
 * Fetches the npm downloads of each package for consecutive calendar months.
 * @param {string[]} names - npm package names.
 * @param {Array<{ month: string, start: string, end: string }>} months - Oldest first.
 * @returns {Promise<Map<string, number[]>>} Downloads per month, in the order of `months`.
 */
export async function fetchMonthlyDownloads(names, months) {
  const monthIndex = new Map();
  for (let index = 0; index < months.length; index++) {
    monthIndex.set(months[index].month, index);
  }
  const result = new Map();
  for (const name of names) result.set(name, new Array(months.length).fill(0));
  function record(name, data) {
    const monthly = result.get(name);
    for (const { day, downloads } of data?.downloads ?? []) {
      const index = monthIndex.get(day.slice(0, 7));
      if (index !== undefined) monthly[index] += downloads;
    }
  }

  const unscoped = names.filter((name) => !name.startsWith('@'));
  const scoped = names.filter((name) => name.startsWith('@'));
  for (let first = 0; first < months.length; first += MONTHS_PER_QUERY) {
    const slice = months.slice(first, first + MONTHS_PER_QUERY);
    const range = `${API}/${slice[0].start}:${slice.at(-1).end}`;
    for (let index = 0; index < unscoped.length; index += 100) {
      const chunk = unscoped.slice(index, index + 100);
      const data = await getJson(`${range}/${chunk.join(',')}`);
      if (chunk.length === 1) {
        record(chunk[0], data);
      } else {
        for (const name of chunk) record(name, data[name]);
      }
    }
    // Scoped packages are not allowed in bulk queries.
    await mapLimit(scoped, 4, async (name) => {
      record(name, await getJson(`${range}/${name}`, { optional: true }));
    });
  }
  return result;
}

async function getJson(url, { optional = false } = {}) {
  const response = await fetchWithRetry(url);
  if (response.ok) return response.json();
  if (optional && response.status === 404) return undefined;
  throw new Error(`npm downloads: HTTP ${response.status} for ${url}`);
}
