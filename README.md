# GitHub Contribution Poster

Generate a long PNG poster that compares GitHub contribution calendars year by year, starting from the account creation year.

You can run it without a token by passing a public GitHub username or profile URL. A token is optional and gives more complete data through GitHub GraphQL.

## Setup

```bash
npm install
```

## Run The Local Website

```bash
npm run web
```

Open:

```text
http://localhost:4173
```

The website version is tokenless. Paste a GitHub username or profile URL, generate from public contribution data, preview the poster, then download PNG or SVG.

Current website behavior:

- Defaults to Chinese, with a Chinese / English switch in the settings panel.
- Renders years newest-first, so the latest contribution year appears at the top of the long poster.
- Adds a themed dot-matrix QR badge in the poster's upper-right corner for `www.gitgreen.me`.
- Recolors the QR badge with the selected contribution theme.

Generated web exports are written to:

```text
dist/studio/
```

Create a `.env` file if you do not want to pass values every time:

```bash
GITHUB_USER=your-github-login
GITHUB_TOKEN=ghp_your_token_here
```

`GITHUB_TOKEN` is optional.

## Generate

CLI mode still works.

Without a token:

```bash
npm run poster -- --user https://github.com/your-github-login
npm run poster -- --user your-github-login
```

With a token:

```bash
npm run poster -- --user your-github-login --token ghp_your_token_here
```

Or with `.env`:

```bash
npm run poster
```

Output defaults to:

```text
dist/<user>-github-contributions.png
dist/<user>-github-contributions.svg
```

## Demo

You can test the renderer without GitHub API access:

```bash
npm run demo
```

## Options

```bash
npm run poster -- --help
```

Useful options:

```bash
npm run poster -- --user yourname --out ./dist/my-poster.png
npm run poster -- --user https://github.com/yourname --format png
npm run poster -- --user yourname --format png
npm run poster -- --user yourname --from-year 2020 --to-year 2026
npm run poster -- --user yourname --title "My GitHub Years"
```

## Token Notes

Tokenless mode:

- Reads public user profile data from GitHub's public REST endpoint.
- Reads public contribution-calendar HTML from the public profile contribution endpoint.
- Can generate the year-by-year heatmap from public contribution counts.
- Cannot show commit / PR / review / issue breakdowns.
- Cannot include private contribution counts that are not publicly visible.

Token mode:

- Uses GitHub GraphQL `contributionsCollection`.
- Can include richer contribution breakdowns.
- Can include your own private contribution counts when your token and GitHub profile settings allow it.

Private repository details are still anonymized by GitHub.
