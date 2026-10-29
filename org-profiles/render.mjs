const integer = new Intl.NumberFormat('en-US');

const TOP_PACKAGES = 10;

/**
 * Renders profile/README.md of one organization.
 * @param {object} organization - Entry of ORGANIZATIONS.
 * @param {object} stats - Result of collectOrganization for this organization.
 * @param {Array<{ organization: object, stats: object }>} siblings - The other organizations.
 * @param {{ month: string, firstMonth: string, months: number, today: string }} context - Reported month, first month of the period, number of months and update date.
 * @returns {string} Markdown.
 */
export function renderReadme(organization, stats, siblings, context) {
  const { login, title } = organization;
  const created = monthLabel(stats.createdAt);
  const period = `the last ${context.months} months`;
  const alt = `${title}: ${integer.format(stats.repositories)} repositories, ${integer.format(stats.packages.length)} packages on npm, ${compactWords(stats.totalDownloads)} downloads in ${context.month}, ${compactWords(stats.periodDownloads)} in ${period}. GitHub organization created in ${created} in the group of Luc Patiny at EPFL.`;
  const lines = [
    ...picture('stats', alt),
    '',
    `The **${title}** organization on GitHub was created in ${created} in the group of [Luc Patiny](https://github.com/lpatiny) at [EPFL](https://www.epfl.ch). ${organization.about}`,
    '',
    `It contains **${integer.format(stats.repositories)} public repositories** and **${integer.format(stats.packages.length)} packages published on npm**, downloaded **${integer.format(stats.totalDownloads)} times in ${context.month}** and **${integer.format(stats.periodDownloads)} times in ${period}** (${context.firstMonth} to ${context.month}). Many of these packages are currently maintained by [Zakodium Sàrl](https://www.zakodium.com).`,
    '',
    ...picture(
      'downloads',
      `npm downloads per month, ${context.firstMonth} to ${context.month}: ${compactWords(stats.periodDownloads)} in total.`,
    ),
    '',
    `### Most downloaded in ${context.month}`,
    '',
    `| | Package | ${context.shortMonth} | ${context.months} months | |`,
    '|--:|---|--:|--:|---|',
  ];
  const top = stats.packages.slice(0, TOP_PACKAGES);
  for (let index = 0; index < top.length; index++) {
    const { name, downloads, periodDownloads, description } = top[index];
    lines.push(
      `| ${index + 1} | [${name}](https://www.npmjs.com/package/${name}) | ${integer.format(downloads)} | ${integer.format(periodDownloads)} | ${cell(description)} |`,
    );
  }
  lines.push('', '### Sister organizations', '', '<table>', '<tr>');
  for (const sibling of siblings) {
    const url = `https://github.com/${sibling.organization.login}`;
    lines.push(
      `<td width="${Math.floor(100 / siblings.length)}%">`,
      `<a href="${url}"><img src="${url}.png?size=96" width="48" height="48" align="left" alt=""></a>`,
      `<b><a href="${url}">${sibling.organization.title}</a></b><br>`,
      `${sibling.organization.tagline}<br>`,
      `<sub>${integer.format(sibling.stats.packages.length)} npm packages, ${compactWords(sibling.stats.periodDownloads)} downloads in ${period}</sub>`,
      '</td>',
    );
  }
  lines.push(
    '</tr>',
    '</table>',
    '',
    `<sub>Updated on ${context.today} from the GitHub and npm APIs. Repositories are the public ones of [${login}](https://github.com/${login}), forks excluded. Downloads are those reported by npm for whole calendar months.</sub>`,
    '',
  );
  return lines.join('\n');
}

/**
 * Formats an ISO date as "October 2012".
 * @param {string} date - ISO date, or YYYY-MM.
 * @returns {string} Month and year in English.
 */
export function monthLabel(date) {
  return new Date(date.length === 7 ? `${date}-01` : date).toLocaleString(
    'en-US',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  );
}

/**
 * Formats a large count for the banner: 12.7 M, 104 M, 35 k.
 * @param {number} value - Count.
 * @returns {string} Short form with a unit.
 */
export function compact(value) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} B`;
  if (value >= 1e8) return `${Math.round(value / 1e6)} M`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} M`;
  if (value >= 1e4) return `${Math.round(value / 1e3)} k`;
  return integer.format(value);
}

function compactWords(value) {
  return compact(value)
    .replace(/ k$/, ' thousand')
    .replace(/ M$/, ' million')
    .replace(/ B$/, ' billion');
}

function cell(text) {
  const clean = text.replaceAll(/\s+/g, ' ').replaceAll('|', '\\|').trim();
  return clean.length > 90 ? `${clean.slice(0, 89).trimEnd()}…` : clean;
}

function picture(name, alt) {
  return [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${name}-dark.svg">`,
    `  <img alt="${alt}" src="${name}-light.svg" width="100%">`,
    '</picture>',
  ];
}
