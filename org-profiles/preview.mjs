// Renders the generated profile pages through GitHub's markdown API, the
// renderer of github.com, into preview/index.html: one tab per organization and
// a light/dark switch. Run it after update.mjs, before pushing.
//
//   node preview.mjs && open preview/index.html

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { fetchWithRetry, githubToken } from './http.mjs';
import { ORGANIZATIONS } from './organizations.mjs';

const { values } = parseArgs({
  options: { root: { type: 'string', default: join(homedir(), 'git') } },
});

const sections = [];
for (const { login, title } of ORGANIZATIONS) {
  const directory = join(values.root, login, '.github', 'profile');
  const response = await fetchWithRetry('https://api.github.com/markdown', {
    method: 'POST',
    headers: { authorization: `bearer ${githubToken()}` },
    body: JSON.stringify({
      text: readFileSync(join(directory, 'README.md'), 'utf8'),
      mode: 'gfm',
      context: `${login}/.github`,
    }),
  });
  if (!response.ok) throw new Error(`GitHub markdown: HTTP ${response.status}`);
  // The profile images are not pushed yet: embed the local files, which also
  // keeps the page viewable where file:// URLs are blocked (IDE previews).
  const html = (await response.text()).replaceAll(
    /(src|srcset)="[^"]*?([\w-]+-(?:light|dark)\.svg)"/g,
    (match, attribute, file) =>
      `${attribute}="data:image/svg+xml;base64,${readFileSync(join(directory, file)).toString('base64')}"`,
  );
  sections.push(`<section data-org="${login}">
  <header><img src="https://github.com/${login}.png?size=96" alt=""><h1>${title}</h1><span>github.com/${login}</span></header>
  <article class="markdown">${html}</article>
</section>`);
}

const tabs = ORGANIZATIONS.map(
  ({ login, title }) => `<button data-tab="${login}">${title}</button>`,
).join('');
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Organization profiles</title>
<style>
:root { --bg: #ffffff; --canvas: #f6f8fa; --border: #d1d9e0; --text: #1f2328; --muted: #59636e; --link: #0969da; --row: #f6f8fa; color-scheme: light; }
:root[data-theme="dark"] { --bg: #0d1117; --canvas: #010409; --border: #3d444d; --text: #f0f6fc; --muted: #9198a1; --link: #4493f8; --row: #151b23; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--canvas); color: var(--text); font: 16px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif; }
nav { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 12px 16px; background: var(--bg); border-bottom: 1px solid var(--border); }
nav .spacer { flex: 1; }
button { font: inherit; font-size: 14px; padding: 5px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--canvas); color: var(--text); cursor: pointer; }
button[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
main { max-width: 920px; margin: 0 auto; padding: 24px 16px 64px; }
section[hidden] { display: none; }
section header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
section header img { width: 64px; height: 64px; border-radius: 12px; border: 1px solid var(--border); }
section header h1 { margin: 0; font-size: 24px; }
section header span { color: var(--muted); font-size: 14px; }
.markdown { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 24px; overflow-wrap: break-word; }
.markdown > :first-child { margin-top: 0; }
.markdown a { color: var(--link); text-decoration: none; }
.markdown a:hover { text-decoration: underline; }
.markdown img { max-width: 100%; }
.markdown img[align="left"] { padding-right: 16px; }
.markdown h3 { font-size: 20px; margin: 24px 0 16px; }
.markdown p { margin: 0 0 16px; }
.markdown table { border-collapse: collapse; display: block; width: max-content; max-width: 100%; overflow: auto; margin: 0 0 16px; }
.markdown th, .markdown td { padding: 6px 13px; border: 1px solid var(--border); }
.markdown th { font-weight: 600; }
.markdown tr:nth-child(2n) { background: var(--row); }
.markdown sub { font-size: 12px; color: var(--muted); }
</style>
</head>
<body>
<nav>${tabs}<span class="spacer"></span><button data-theme="light">Light</button><button data-theme="dark">Dark</button></nav>
<main>
${sections.join('\n')}
</main>
<script>
const sources = [...document.querySelectorAll('picture source')];
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  for (const source of sources) source.media = theme === 'dark' ? 'all' : 'not all';
  for (const button of document.querySelectorAll('[data-theme]')) {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', button.dataset.theme === theme);
  }
}
function showTab(login) {
  for (const section of document.querySelectorAll('section')) section.hidden = section.dataset.org !== login;
  for (const button of document.querySelectorAll('[data-tab]')) button.setAttribute('aria-pressed', button.dataset.tab === login);
}
for (const button of document.querySelectorAll('button[data-theme]')) button.addEventListener('click', () => setTheme(button.dataset.theme));
for (const button of document.querySelectorAll('[data-tab]')) button.addEventListener('click', () => showTab(button.dataset.tab));
setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
showTab('${ORGANIZATIONS[0].login}');
</script>
</body>
</html>
`;

const directory = join(import.meta.dirname, 'preview');
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, 'index.html'), page);
console.log(join(directory, 'index.html'));
