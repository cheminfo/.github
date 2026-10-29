import { escapeXml, THEMES } from './card.mjs';

const WIDTH = 880;
const HEIGHT = 290;
const MARGIN = 44;
const BASELINE = 228;
const BAR_HEIGHT = 130;
const FADED = { light: 0.55, dark: 0.75 };

/**
 * Renders a bar chart of the downloads of each month.
 * @param {object} options
 * @param {Array<{ month: string, value: number }>} options.months - Oldest first; month is YYYY-MM.
 * @param {string} options.total - Formatted sum of the period, e.g. "153 M".
 * @param {(value: number) => string} options.format - Formats a bar value.
 * @param {{ light: string, dark: string }} options.accent - Organization colours.
 * @param {'light' | 'dark'} options.theme - Colour scheme.
 * @returns {string} A standalone SVG document.
 */
export function renderChart({ months, total, format, accent, theme }) {
  const colors = THEMES[theme];
  const accentColor = accent[theme];
  let max = 0;
  for (const { value } of months) max = Math.max(max, value);
  const slot = (WIDTH - 2 * MARGIN) / months.length;
  const barWidth = slot * 0.62;
  const bars = [];
  for (let index = 0; index < months.length; index++) {
    const { month, value } = months[index];
    const last = index === months.length - 1;
    const height = max === 0 ? 0 : Math.max(2, (value / max) * BAR_HEIGHT);
    const center = MARGIN + slot * (index + 0.5);
    const date = new Date(`${month}-01T00:00:00Z`);
    const name = date.toLocaleString('en-US', {
      month: 'short',
      timeZone: 'UTC',
    });
    const year =
      index === 0 || month.endsWith('-01') ? String(date.getUTCFullYear()) : '';
    bars.push(
      `<rect x="${(center - barWidth / 2).toFixed(1)}" y="${(BASELINE - height).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${height.toFixed(1)}" rx="4" fill="${accentColor}" fill-opacity="${last ? 1 : FADED[theme]}"/>`,
      `<text x="${center.toFixed(1)}" y="${(BASELINE - height - 8).toFixed(1)}" text-anchor="middle" class="value${last ? ' last' : ''}" fill="${last ? accentColor : colors.muted}">${escapeXml(format(value))}</text>`,
      `<text x="${center.toFixed(1)}" y="${BASELINE + 22}" text-anchor="middle" class="month" fill="${colors.text}">${name}</text>`,
    );
    if (year) {
      bars.push(
        `<text x="${center.toFixed(1)}" y="${BASELINE + 41}" text-anchor="middle" class="year" fill="${colors.muted}">${year}</text>`,
      );
    }
  }
  const label = `Monthly npm downloads: ${months.map(({ month, value }) => `${month} ${value}`).join(', ')}. Total: ${total}.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(label)}">
  <title>${escapeXml(label)}</title>
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif; }
    .heading { font-size: 19px; font-weight: 600; }
    .total { font-size: 19px; font-weight: 700; }
    .value { font-size: 13px; }
    .last { font-weight: 700; }
    .month { font-size: 14px; }
    .year { font-size: 12px; }
  </style>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.background[0]}"/>
      <stop offset="1" stop-color="${colors.background[1]}"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="16" fill="url(#background)" stroke="${colors.border}"/>
  <text x="${MARGIN}" y="46" class="heading" fill="${colors.text}">npm downloads per month</text>
  <text x="${WIDTH - MARGIN}" y="46" text-anchor="end" class="total" fill="${accentColor}">${escapeXml(total)}<tspan class="heading" font-weight="400" fill="${colors.muted}"> in the last ${months.length} months</tspan></text>
  <line x1="${MARGIN}" y1="${BASELINE}" x2="${WIDTH - MARGIN}" y2="${BASELINE}" stroke="${colors.border}"/>
  ${bars.join('\n  ')}
</svg>
`;
}
