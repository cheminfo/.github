import { execFileSync } from 'node:child_process';

let token;

/**
 * GitHub token from GITHUB_TOKEN, GH_TOKEN, or the gh CLI.
 * @returns {string} The token.
 */
export function githubToken() {
  token ??=
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  return token;
}

/**
 * Runs a query against the GitHub GraphQL API.
 * @param {string} query - GraphQL query.
 * @param {object} variables - Query variables.
 * @returns {Promise<object>} The data field of the response.
 */
export async function graphql(query, variables) {
  const response = await fetchWithRetry('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${githubToken()}` },
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json();
  if (result.errors) {
    throw new Error(`GitHub GraphQL: ${JSON.stringify(result.errors)}`);
  }
  return result.data;
}

/**
 * fetch() that retries with exponential backoff on 429 and 5xx responses.
 * @param {string} url - Address to fetch.
 * @param {RequestInit} [options] - fetch options.
 * @returns {Promise<Response>} The last response.
 */
export async function fetchWithRetry(url, options) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, options);
    if ((response.status !== 429 && response.status < 500) || attempt === 5) {
      return response;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 2000 * 2 ** attempt);
    });
  }
}

/**
 * Maps items with an async callback, at most `limit` calls at a time.
 * @param {Array} items - Items to map.
 * @param {number} limit - Maximum number of concurrent calls.
 * @param {Function} callback - Async mapping function.
 * @returns {Promise<Array>} Results in the order of the items.
 */
export async function mapLimit(items, limit, callback) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await callback(items[index]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}
