# GitHub organization profiles

Generates the page shown on https://github.com/cheminfo, https://github.com/mljs
and https://github.com/image-js: `profile/README.md`, a light/dark banner
(`profile/stats-*.svg`) and a chart of the monthly downloads over the last 12
months (`profile/downloads-*.svg`) in each `<org>/.github` repository. The
numbers of each organization are kept in `data/<month>.json` of its repository.

The numbers come from the APIs, nothing is typed by hand:

- **Created**: month the GitHub organization was created.
- **Repositories**: public repositories, forks excluded (archived ones included).
- **Packages on npm**: names from each repository's `package.json` (and its
  workspaces) that are published on npm and whose manifest points to the
  organization, or shares a maintainer with the packages that do.
- **Downloads**: npm downloads of those packages in the last complete calendar
  month, and in each of the 12 months ending with it.

## Automatic update

`.github/workflows/update-profile.yml`, identical in the `.github` repository of
each organization, runs on the 3rd of every month: it checks out this generator,
collects the numbers of the three organizations (each page links to the other
two) and commits its own `profile/` and `data/` with the built-in
`GITHUB_TOKEN`, so no secret is needed. Run it by hand from the Actions tab
("Run workflow"), optionally for a given month.

## Running it locally

```sh
node update.mjs                   # last complete month, all three pages
node update.mjs --month 2026-10   # a given month
node update.mjs --org mljs        # one page only
```

It writes into `~/git/<org>/.github` (change with `--root`). Check the result,
rendered by GitHub's markdown API with a light/dark switch:

```sh
node preview.mjs && open preview/index.html
```

No dependencies; the GitHub token comes from `GITHUB_TOKEN`, `GH_TOKEN` or
`gh auth token`.
