import { fetchMonthlyDownloads } from './downloads.mjs';
import { fetchWithRetry, graphql, mapLimit } from './http.mjs';

const REPOSITORIES_QUERY = `
query ($org: String!, $cursor: String) {
  organization(login: $org) {
    createdAt
    repositories(first: 100, after: $cursor, privacy: PUBLIC, isFork: false) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        isArchived
        stargazerCount
        packageJson: object(expression: "HEAD:package.json") { ... on Blob { text } }
      }
    }
  }
}`;

/**
 * Collects the public repositories of a GitHub organization, the npm packages
 * they publish, and how often each was downloaded in each of several months.
 * @param {string} org - GitHub organization login.
 * @param {Array<{ month: string, start: string, end: string }>} months - Consecutive calendar months, oldest first; the last one is the month reported.
 * @returns {Promise<object>} Repositories, packages (sorted by downloads in the last month) and totals.
 */
export async function collectOrganization(org, months) {
  const { createdAt, repositories } = await listRepositories(org);
  const candidates = [];
  for (const repository of repositories) {
    candidates.push(...(await packagesOfRepository(org, repository)));
  }
  const manifests = await mapLimit(candidates, 8, (candidate) =>
    fetchLatest(candidate.name),
  );
  const maintainers = new Set();
  for (const manifest of manifests) {
    if (manifest && repositoryOwner(manifest) === org.toLowerCase()) {
      for (const maintainer of manifest.maintainers ?? []) {
        maintainers.add(maintainer.name);
      }
    }
  }
  const unique = new Map();
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    const manifest = manifests[index];
    if (!manifest || unique.has(candidate.name)) continue;
    // A repository name can collide with someone else's npm package, so the
    // manifest must point to the organization, or, when its repository field
    // is missing or outdated, share a maintainer with the packages that do.
    const ours =
      repositoryOwner(manifest) === org.toLowerCase() ||
      (manifest.maintainers ?? []).some((maintainer) =>
        maintainers.has(maintainer.name),
      );
    if (!ours) continue;
    unique.set(candidate.name, {
      ...candidate,
      description: manifest.description ?? '',
      deprecated: Boolean(manifest.deprecated),
    });
  }
  const packages = [...unique.values()];
  const downloads = await fetchMonthlyDownloads(
    packages.map((item) => item.name),
    months,
  );
  const monthlyDownloads = new Array(months.length).fill(0);
  for (const item of packages) {
    item.monthly = downloads.get(item.name);
    item.downloads = item.monthly.at(-1);
    item.periodDownloads = 0;
    for (let index = 0; index < months.length; index++) {
      item.periodDownloads += item.monthly[index];
      monthlyDownloads[index] += item.monthly[index];
    }
  }
  let periodDownloads = 0;
  for (let index = 0; index < months.length; index++) {
    periodDownloads += monthlyDownloads[index];
  }
  packages.sort((a, b) => b.downloads - a.downloads);
  let stars = 0;
  for (const repository of repositories) stars += repository.stargazerCount;
  return {
    org,
    createdAt,
    repositories: repositories.length,
    archived: repositories.filter((repository) => repository.isArchived).length,
    stars,
    packages,
    totalDownloads: monthlyDownloads.at(-1),
    monthlyDownloads,
    periodDownloads,
  };
}

async function listRepositories(org) {
  const repositories = [];
  let cursor = null;
  let createdAt;
  do {
    const data = await graphql(REPOSITORIES_QUERY, { org, cursor });
    const { repositories: page } = data.organization;
    createdAt = data.organization.createdAt;
    repositories.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return { createdAt, repositories };
}

async function packagesOfRepository(org, repository) {
  const root = parsePackageJson(repository.packageJson?.text);
  if (!root) return [];
  const result = [];
  if (root.name && !root.private) {
    result.push({ name: root.name, repository: repository.name });
  }
  const workspaces = Array.isArray(root.workspaces)
    ? root.workspaces
    : (root.workspaces?.packages ?? []);
  for (const pattern of workspaces) {
    for (const manifest of await workspaceManifests(
      org,
      repository.name,
      pattern,
    )) {
      if (manifest.name && !manifest.private) {
        result.push({ name: manifest.name, repository: repository.name });
      }
    }
  }
  return result;
}

async function workspaceManifests(org, name, pattern) {
  const directory = pattern.replace(/\/\*{1,2}$/, '').replace(/^\.\//, '');
  let paths = [directory];
  if (directory !== pattern.replace(/^\.\//, '')) {
    const data = await graphql(
      `
        query ($org: String!, $name: String!, $expression: String!) {
          repository(owner: $org, name: $name) {
            object(expression: $expression) {
              ... on Tree {
                entries {
                  name
                  type
                }
              }
            }
          }
        }
      `,
      { org, name, expression: `HEAD:${directory}` },
    );
    const entries = data.repository.object?.entries ?? [];
    paths = entries
      .filter((entry) => entry.type === 'tree')
      .map((entry) => `${directory}/${entry.name}`);
  }
  if (paths.length === 0) return [];
  const aliases = paths
    .map(
      (path, index) =>
        `p${index}: object(expression: ${JSON.stringify(`HEAD:${path}/package.json`)}) { ... on Blob { text } }`,
    )
    .join('\n');
  const data = await graphql(
    `query ($org: String!, $name: String!) {
      repository(owner: $org, name: $name) { ${aliases} }
    }`,
    { org, name },
  );
  return Object.values(data.repository)
    .map((blob) => parsePackageJson(blob?.text))
    .filter(Boolean);
}

function parsePackageJson(text) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function repositoryOwner(manifest) {
  const url =
    typeof manifest.repository === 'string'
      ? manifest.repository
      : manifest.repository?.url;
  return /github(?:\.com)?[/:]([^/]+)\//i.exec(url ?? '')?.[1]?.toLowerCase();
}

async function fetchLatest(name) {
  const response = await fetchWithRetry(
    `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`,
  );
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`npm registry ${name}: HTTP ${response.status}`);
  }
  return response.json();
}
