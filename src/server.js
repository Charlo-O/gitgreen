import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  fetchAvatarDataUrl,
  fetchPublicGithubContributionData,
  normalizeGithubLogin
} from "./github.js";
import { formatPosterSvg, renderPosterSvg, writePosterFiles } from "./render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const outputDir = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.join(projectRoot, "dist", "studio");

const PALETTES = {
  github: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  ocean: ["#ebedf0", "#dff6ff", "#9bd8ee", "#43a6d7", "#006b9a"],
  violet: ["#ebedf0", "#eee7fb", "#d2b8f0", "#9a6dd7", "#5b2b91"]
};

const DEFAULT_TITLES = {
  zh: "GitHub 贡献",
  en: "GitHub Contributions"
};

const app = express();
const port = Number(process.env.PORT ?? 4173);
const contributionCache = new Map();

app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));
app.use("/output", express.static(outputDir));
app.use("/icons", express.static(path.join(projectRoot, "node_modules", "lucide-static", "icons")));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/generate", async (request, response) => {
  try {
    const profile = String(request.body.profile ?? "").trim();
    const login = normalizeGithubLogin(profile);
    const paletteName = String(request.body.palette ?? "github");
    const palette = PALETTES[paletteName] ?? PALETTES.github;
    const language = request.body.language === "en" ? "en" : "zh";
    const title = cleanText(request.body.title, 64);
    const showMonthLabels = request.body.showMonthLabels !== false;
    const showYearlyTotals = request.body.showYearlyTotals !== false;
    const showQrCode = request.body.showQrCode !== false;
    const outputSize = normalizeOutputSize(request.body.outputSize);

    if (!login) {
      throw new Error("Paste a GitHub username or profile URL first.");
    }

    const data = await fetchPublicDataWithCache(login);
    data.language = language;
    data.title = title || `${data.name || data.login} ${DEFAULT_TITLES[language]}`;
    data.palette = palette;
    data.options = {
      language,
      showMonthLabels,
      showYearlyTotals,
      showQrCode,
      sortNewestFirst: true
    };
    data.avatarDataUrl = data.avatarUrl
      ? await fetchAvatarDataUrl(data.avatarUrl).catch(() => null)
      : null;

    const svg = formatPosterSvg(renderPosterSvg(data), outputSize);
    const id = `${data.login}-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto
      .randomBytes(3)
      .toString("hex")}`;
    const outPath = path.join(outputDir, `${id}.png`);
    const written = await writePosterFiles({
      svg,
      outPath,
      format: "both",
      pixelRatio: 2
    });

    const files = Object.fromEntries(
      written.map((filePath) => [
        path.extname(filePath).slice(1),
        absoluteUrl(request, `/output/${path.basename(filePath)}`)
      ])
    );

    response.json({
      ok: true,
      user: {
        login: data.login,
        name: data.name,
        avatarUrl: data.avatarUrl,
        url: data.url,
        createdAt: data.createdAt
      },
      summary: summarize(data),
      files,
      source: "public",
      generatedAt: data.generatedAt,
      outputSize
    });
  } catch (error) {
    console.error(`Generate failed: ${error.message}`);
    response.status(400).json({
      ok: false,
      message: error.message
    });
  }
});

await fs.mkdir(outputDir, { recursive: true });

app.listen(port, () => {
  console.log(`GitGreen Studio running at http://localhost:${port}`);
});

async function fetchPublicDataWithCache(login) {
  const cached = contributionCache.get(login);
  const maxAgeMs = 10 * 60 * 1000;

  if (cached && Date.now() - cached.cachedAt < maxAgeMs) {
    const data = structuredClone(cached.data);
    data.generatedAt = new Date().toISOString();
    return data;
  }

  try {
    const data = await fetchPublicGithubContributionData({ login });
    contributionCache.set(login, {
      cachedAt: Date.now(),
      data: structuredClone(data)
    });
    return data;
  } catch (error) {
    if (cached) {
      const data = structuredClone(cached.data);
      data.generatedAt = new Date().toISOString();
      console.warn(`Using cached public contribution data for ${login}: ${error.message}`);
      return data;
    }
    throw error;
  }
}

function summarize(data) {
  const years = data.years;
  const total = years.reduce((sum, year) => sum + year.totalContributions, 0);
  const activeDays = years.reduce((sum, year) => sum + year.activeDays, 0);
  const bestYear = years.reduce((best, year) =>
    year.totalContributions > best.totalContributions ? year : best
  );
  const bestDay = years
    .flatMap((year) => year.days)
    .reduce(
      (best, day) => (day.contributionCount > best.contributionCount ? day : best),
      { date: null, contributionCount: 0 }
    );

  return {
    total,
    activeDays,
    bestYear: {
      year: bestYear.year,
      totalContributions: bestYear.totalContributions
    },
    bestDay,
    startYear: years[0]?.year,
    endYear: years[years.length - 1]?.year,
    yearCount: years.length,
    currentYearPartial: years.some((year) => year.isPartial)
  };
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeOutputSize(value) {
  return ["ratio-3-4", "ratio-9-16"].includes(value) ? value : "original";
}

function absoluteUrl(request, pathname) {
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (configured) {
    return `${configured}${pathname}`;
  }

  const protocol = request.headers["x-forwarded-proto"] ?? request.protocol;
  const host = request.headers["x-forwarded-host"] ?? request.headers.host;
  return `${protocol}://${host}${pathname}`;
}
