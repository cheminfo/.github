// Regenerates the GitHub profile page of the cheminfo, mljs and image-js
// organizations (profile/README.md, the stats-*.svg banner and the
// downloads-*.svg chart of the last 12 months) in the clone of each
// <org>/.github repository, from the GitHub and npm APIs. The numbers of each
// organization are also kept in data/<month>.json of its repository.
//
//   node update.mjs                   # downloads of the last complete month
//   node update.mjs --month 2026-10
//   node update.mjs --root ~/git      # where <org>/.github is cloned (default)
//   node update.mjs --org mljs        # write one page only (all are collected)
//
// GitHub token: GITHUB_TOKEN, GH_TOKEN, or `gh auth token`.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { renderCard } from './card.mjs';
import { renderChart } from './chart.mjs';
import { collectOrganization } from './collect.mjs';
import { ORGANIZATIONS } from './organizations.mjs';
import { compact, monthLabel, renderReadme } from './render.mjs';

const { values } = parseArgs({
  options: {
    month: { type: 'string' },
    org: { type: 'string' },
    root: { type: 'string', default: join(homedir(), 'git') },
  },
});

const months = resolveMonths(values.month);
const reported = months.at(-1).month;
const context = {
  month: monthLabel(reported),
  shortMonth: shortMonthLabel(reported),
  firstMonth: monthLabel(months[0].month),
  months: months.length,
  today: new Date().toISOString().slice(0, 10),
};

const targets = values.org
  ? ORGANIZATIONS.filter(({ login }) => login === values.org)
  : ORGANIZATIONS;
if (targets.length === 0) {
  throw new Error(
    `--org must be one of ${ORGANIZATIONS.map(({ login }) => login).join(', ')}`,
  );
}
for (const { login } of targets) {
  if (!existsSync(join(values.root, login, '.github'))) {
    throw new Error(
      `${join(values.root, login, '.github')} is missing: git clone https://github.com/${login}/.github`,
    );
  }
}

const results = [];
for (const organization of ORGANIZATIONS) {
  console.error(`Collecting ${organization.login}…`);
  results.push({
    organization,
    stats: await collectOrganization(organization.login, months),
  });
}

for (const { organization, stats } of results) {
  if (!targets.includes(organization)) continue;
  const repository = join(values.root, organization.login, '.github');
  const directory = join(repository, 'profile');
  mkdirSync(directory, { recursive: true });
  const siblings = results.filter((result) => result.stats !== stats);
  writeFileSync(
    join(directory, 'README.md'),
    renderReadme(organization, stats, siblings, context),
  );
  for (const theme of ['light', 'dark']) {
    const card = renderCard({
      title: organization.title,
      tagline: organization.tagline,
      created: monthLabel(stats.createdAt),
      stats: [
        {
          value: stats.repositories.toLocaleString('en-US'),
          label: 'repositories',
        },
        {
          value: stats.packages.length.toLocaleString('en-US'),
          label: 'packages on npm',
        },
        {
          value: compact(stats.totalDownloads),
          label: `downloads in ${context.shortMonth}`,
        },
        {
          value: compact(stats.periodDownloads),
          label: `in the last ${context.months} months`,
        },
      ],
      accent: organization.accent,
      theme,
    });
    writeFileSync(join(directory, `stats-${theme}.svg`), card);
    const chart = renderChart({
      months: months.map(({ month }, index) => ({
        month,
        value: stats.monthlyDownloads[index],
      })),
      total: compact(stats.periodDownloads),
      format: compact,
      accent: organization.accent,
      theme,
    });
    writeFileSync(join(directory, `downloads-${theme}.svg`), chart);
  }
  writeData(join(repository, 'data'), stats);
  console.log(
    `${organization.login.padEnd(9)} created ${monthLabel(stats.createdAt).padEnd(14)} ${String(stats.repositories).padStart(4)} repositories ${String(stats.packages.length).padStart(4)} npm packages ${stats.totalDownloads.toLocaleString('en-US').padStart(12)} downloads in ${context.month} ${stats.periodDownloads.toLocaleString('en-US').padStart(14)} in ${context.months} months  ->  ${directory}`,
  );
}

function writeData(directory, stats) {
  mkdirSync(directory, { recursive: true });
  const data = {
    month: reported,
    months: months.map(({ month }) => month),
    updated: context.today,
    createdAt: stats.createdAt,
    repositories: stats.repositories,
    archived: stats.archived,
    stars: stats.stars,
    totalDownloads: stats.totalDownloads,
    periodDownloads: stats.periodDownloads,
    monthlyDownloads: stats.monthlyDownloads,
    packages: stats.packages.map(
      ({ name, repository, downloads, periodDownloads, monthly }) => ({
        name,
        repository,
        downloads,
        periodDownloads,
        monthly,
      }),
    ),
  };
  // One package per line keeps the monthly diff readable.
  const { packages, ...summary } = data;
  const lines = Object.entries(summary).map(
    ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`,
  );
  lines.push(
    `  "packages": [\n${packages.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`,
  );
  writeFileSync(
    join(directory, `${reported}.json`),
    `{\n${lines.join(',\n')}\n}\n`,
  );
}

/**
 * The twelve calendar months ending with the requested one (default: the last
 * complete month), oldest first.
 */
function resolveMonths(requested) {
  const now = new Date();
  let year = now.getUTCFullYear();
  let monthIndex = now.getUTCMonth() - 1;
  if (requested) {
    const match = /^(?<y>\d{4})-(?<m>\d{2})$/.exec(requested);
    if (!match) throw new Error(`--month must be YYYY-MM, got ${requested}`);
    year = Number(match.groups.y);
    monthIndex = Number(match.groups.m) - 1;
  }
  const result = [];
  for (let offset = 11; offset >= 0; offset--) {
    const first = new Date(Date.UTC(year, monthIndex - offset, 1));
    const last = new Date(Date.UTC(year, monthIndex - offset + 1, 0));
    const start = first.toISOString().slice(0, 10);
    result.push({
      month: start.slice(0, 7),
      start,
      end: last.toISOString().slice(0, 10),
    });
  }
  if (result.at(-1).end >= now.toISOString().slice(0, 10)) {
    throw new Error(
      `${result.at(-1).month} is not over yet: npm only has complete numbers for past months`,
    );
  }
  return result;
}

function shortMonthLabel(month) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
