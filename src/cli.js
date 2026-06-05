#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchAvatarDataUrl,
  fetchGithubContributionData,
  fetchPublicGithubContributionData,
  normalizeGithubLogin
} from "./github.js";
import { createDemoData } from "./demo.js";
import { renderPosterSvg, writePosterFiles } from "./render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

loadEnvFile(path.join(projectRoot, ".env"));

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const pixelRatio = Number(options.pixelRatio ?? 2);
  if (!Number.isFinite(pixelRatio) || pixelRatio < 1 || pixelRatio > 4) {
    throw new Error("--pixel-ratio must be a number between 1 and 4.");
  }

  const format = options.format ?? "both";
  if (!["png", "svg", "both"].includes(format)) {
    throw new Error("--format must be one of: png, svg, both.");
  }

  const login = normalizeGithubLogin(options.user ?? process.env.GITHUB_USER);
  const outPath =
    options.out ??
    path.join(
      projectRoot,
      "dist",
      `${options.demo ? "demo" : login}-github-contributions.png`
    );

  let data;
  if (options.demo) {
    console.log("Generating a demo poster with sample contribution data...");
    data = createDemoData();
  } else {
    if (!login) {
      throw new Error("Missing GitHub username or profile URL. Use --user <login-or-url> or set GITHUB_USER.");
    }

    const token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    const fetchOptions = {
      login,
      fromYear: parseOptionalYear(options.fromYear, "--from-year"),
      toYear: parseOptionalYear(options.toYear, "--to-year"),
      onProgress: (year, total) => {
        console.log(`  ${year}: ${formatNumber(total)} contributions`);
      }
    };

    if (token) {
      console.log(`Fetching GitHub contributions for @${login} with GraphQL...`);
      data = await fetchGithubContributionData({
        ...fetchOptions,
        token
      });
    } else {
      console.log(`Fetching public GitHub contributions for @${login} without a token...`);
      data = await fetchPublicGithubContributionData(fetchOptions);
    }

    if (data.avatarUrl) {
      data.avatarDataUrl = await fetchAvatarDataUrl(data.avatarUrl).catch(() => null);
    }
  }

  if (options.title) {
    data.title = options.title;
  }

  const svg = renderPosterSvg(data);
  const written = await writePosterFiles({
    svg,
    outPath,
    format,
    pixelRatio
  });

  for (const filePath of written) {
    console.log(`Wrote ${path.resolve(filePath)}`);
  }
}

function parseArgs(argv) {
  const options = {};
  const aliases = {
    "-u": "user",
    "--user": "user",
    "-t": "token",
    "--token": "token",
    "-o": "out",
    "--out": "out",
    "--format": "format",
    "--title": "title",
    "--from-year": "fromYear",
    "--to-year": "toYear",
    "--pixel-ratio": "pixelRatio"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--demo") {
      options.demo = true;
      continue;
    }

    const eqIndex = arg.indexOf("=");
    const flag = eqIndex > -1 ? arg.slice(0, eqIndex) : arg;
    const valueFromEquals = eqIndex > -1 ? arg.slice(eqIndex + 1) : null;
    const key = aliases[flag];

    if (key) {
      const value = valueFromEquals ?? argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${flag} requires a value.`);
      }
      options[key] = value;
      if (valueFromEquals === null) {
        index += 1;
      }
      continue;
    }

    if (!arg.startsWith("-") && !options.user) {
      options.user = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseOptionalYear(value, label) {
  if (value === undefined) {
    return undefined;
  }

  const year = Number(value);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2008 || year > currentYear) {
    throw new Error(`${label} must be a year between 2008 and ${currentYear}.`);
  }

  return year;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function printHelp() {
  console.log(`
GitHub Contribution Poster

Usage:
  npm run poster -- --user <login> --token <token>
  npm run poster -- --user https://github.com/<login>
  npm run poster -- <login>
  npm run demo

Options:
  -u, --user <login/url>    GitHub username or profile URL. Can also use GITHUB_USER.
  -t, --token <token>       Optional GitHub token. Can also use GITHUB_TOKEN or GH_TOKEN.
  -o, --out <path>          Output path. Defaults to ./dist/<user>-github-contributions.png.
      --format <type>       png, svg, or both. Defaults to both.
      --from-year <year>    Optional override for the first year.
      --to-year <year>      Optional override for the last year.
      --title <text>        Custom poster title.
      --pixel-ratio <n>     PNG scale, 1 to 4. Defaults to 2.
      --demo                Generate a sample poster without GitHub API access.
  -h, --help                Show this help.

Token note:
  Without a token, the tool reads public profile data only. With a token, it uses
  GitHub GraphQL and can include private contribution counts when your GitHub
  profile settings and token permissions allow that.
`.trim());
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
