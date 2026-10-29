export const THEMES = {
  light: {
    background: ['#ffffff', '#f6f8fa'],
    border: '#d0d7de',
    text: '#1f2328',
    muted: '#59636e',
    epfl: '#ff0000',
  },
  dark: {
    background: ['#0d1117', '#161b22'],
    border: '#30363d',
    text: '#f0f6fc',
    muted: '#9198a1',
    epfl: '#ffffff',
  },
};

const EPFL_LOGO = `<polygon points="0 21.6 11.43 21.6 11.43 9.8 38.34 9.8 38.34 0 0 0 0 21.6"/><polygon points="0 53 38.34 53 38.34 43.2 11.43 43.2 11.43 31.4 0 31.4 0 53"/><rect x="11.43" y="21.6" width="24.61" height="9.8"/><path d="M86,4.87a16.12,16.12,0,0,0-5.68-3.53A23.76,23.76,0,0,0,71.82,0H48.14V53H59.57V31.4H71.82a23.76,23.76,0,0,0,8.46-1.34A16.12,16.12,0,0,0,86,26.53a13.43,13.43,0,0,0,3.19-5,17.38,17.38,0,0,0,0-11.62A13.52,13.52,0,0,0,86,4.87ZM78,18.73a5.7,5.7,0,0,1-2.26,1.8,11.33,11.33,0,0,1-3.27.85,32,32,0,0,1-3.86.22H59.57V9.8h9.05a32,32,0,0,1,3.86.22,11,11,0,0,1,3.27.86A5.59,5.59,0,0,1,78,12.67a5,5,0,0,1,.86,3A5,5,0,0,1,78,18.73Z"/><polygon points="155.47 43.2 155.47 0 144.04 0 144.04 53 182.38 53 182.38 43.2 155.47 43.2"/><polygon points="97.42 21.6 108.85 21.6 108.85 9.8 135.76 9.8 135.76 0 97.42 0 97.42 21.6"/><rect x="97.42" y="31.4" width="11.43" height="21.6"/><rect x="108.85" y="21.6" width="24.61" height="9.8"/>`;

const WIDTH = 880;
const HEIGHT = 300;
const MARGIN = 44;

/**
 * Renders the banner shown at the top of an organization profile: name,
 * tagline, the EPFL credit and three headline numbers.
 * @param {object} options
 * @param {string} options.title - Organization display name.
 * @param {string} options.tagline - One-line description.
 * @param {string} options.created - Creation month, e.g. "October 2012".
 * @param {Array<{ value: string, label: string }>} options.stats - Headline numbers.
 * @param {{ light: string, dark: string, bar: string[] }} options.accent - Organization colours.
 * @param {'light' | 'dark'} options.theme - Colour scheme.
 * @returns {string} A standalone SVG document.
 */
export function renderCard({ title, tagline, created, stats, accent, theme }) {
  const colors = THEMES[theme];
  const accentColor = accent[theme];
  const column = (WIDTH - 2 * MARGIN) / stats.length;
  const tiles = stats
    .map((stat, index) => {
      const x = MARGIN + column * (index + 0.5);
      const separator =
        index === 0
          ? ''
          : `<line x1="${MARGIN + column * index}" y1="200" x2="${MARGIN + column * index}" y2="272" stroke="${colors.border}"/>`;
      return `${separator}
  <text x="${x}" y="240" text-anchor="middle" class="number" fill="${accentColor}">${escapeXml(stat.value)}</text>
  <text x="${x}" y="268" text-anchor="middle" class="label" fill="${colors.muted}">${escapeXml(stat.label)}</text>`;
    })
    .join('');
  const barStops = accent.bar
    .map(
      (color, index) =>
        `<stop offset="${index / Math.max(1, accent.bar.length - 1)}" stop-color="${color}"/>`,
    )
    .join('');
  const label = `${title}: ${stats.map((stat) => `${stat.value} ${stat.label}`).join(', ')}. GitHub organization created in ${created} in the group of Luc Patiny at EPFL.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(label)}">
  <title>${escapeXml(label)}</title>
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif; }
    .title { font-size: 44px; font-weight: 700; letter-spacing: -0.5px; }
    .tagline { font-size: 19px; }
    .credit { font-size: 15px; }
    .number { font-size: 50px; font-weight: 700; letter-spacing: -1px; }
    .label { font-size: 16px; }
  </style>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.background[0]}"/>
      <stop offset="1" stop-color="${colors.background[1]}"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">${barStops}</linearGradient>
    <clipPath id="card"><rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="16"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
    <rect width="${WIDTH}" height="7" fill="url(#bar)"/>
  </g>
  <rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="16" fill="none" stroke="${colors.border}"/>
  <text x="${MARGIN}" y="88" class="title" fill="${colors.text}">${escapeXml(title)}</text>
  <text x="${MARGIN}" y="126" class="tagline" fill="${colors.muted}">${escapeXml(tagline)}</text>
  <g transform="translate(${WIDTH - MARGIN - 120} 52) scale(${120 / 182.4})" fill="${colors.epfl}">${EPFL_LOGO}</g>
  <text x="${WIDTH - MARGIN}" y="116" text-anchor="end" class="credit" fill="${colors.muted}">Created in ${escapeXml(created)}</text>
  <text x="${WIDTH - MARGIN}" y="136" text-anchor="end" class="credit" fill="${colors.muted}">in the group of Luc Patiny</text>
  <line x1="${MARGIN}" y1="170" x2="${WIDTH - MARGIN}" y2="170" stroke="${colors.border}"/>${tiles}
</svg>
`;
}

/**
 * Escapes text for an SVG attribute or text node.
 * @param {unknown} text - Text to escape.
 * @returns {string} Escaped text.
 */
export function escapeXml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
