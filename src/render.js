import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";

const WIDTH = 1400;
const MARGIN_X = 72;
const HEADER_HEIGHT = 360;
const YEAR_HEIGHT = 188;
const FOOTER_HEIGHT = 88;
const GRID_X = 356;
const GRID_CELL = 12;
const GRID_GAP = 3;
const GRID_STEP = GRID_CELL + GRID_GAP;
const GRID_HEIGHT = GRID_CELL * 7 + GRID_GAP * 6;

const DEFAULT_PALETTE = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  zh: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
};

const COPY = {
  en: {
    titleSuffix: "'s GitHub Contributions",
    joined: "Joined",
    tracked: "Tracked",
    publicSource: "Built from public GitHub profile data.",
    graphqlSource: "Built from GitHub GraphQL data.",
    subtitlePrefix: "A year-by-year contribution calendar.",
    totalContributions: "Total contributions",
    activeDays: "Active days",
    bestYear: "Best year",
    bestDay: "Best day",
    acrossYears: "Across tracked years",
    daysWithContributions: "Days with at least one contribution",
    contributions: "contributions",
    yearlyTotals: "Yearly totals",
    firstTrackedYear: "First tracked year",
    partialYear: "Partial year, through",
    fullYear: "Full calendar year",
    vsPrevious: "vs previous year",
    newActivity: "New activity",
    active: "Active",
    maxDay: "Max day",
    source: "Source",
    publicProfile: "Public profile",
    breakdown: "Breakdown",
    unavailable: "Unavailable",
    days: "days",
    less: "Less",
    more: "More",
    scale: "Scale",
    generatedPublic: "Generated from public GitHub profile data.",
    generatedGraphql: "Generated from GitHub contributionCalendar data.",
    generated: "Generated",
    partialFooter: "is partial through",
    qrLabel: "www.gitgreen.me"
  },
  zh: {
    titleSuffix: "的 GitHub 贡献",
    joined: "注册",
    tracked: "统计",
    publicSource: "基于公开 GitHub 资料生成。",
    graphqlSource: "基于 GitHub GraphQL 数据生成。",
    subtitlePrefix: "逐年贡献日历。",
    totalContributions: "总贡献",
    activeDays: "活跃天数",
    bestYear: "最佳年份",
    bestDay: "最佳单日",
    acrossYears: "跨统计年份",
    daysWithContributions: "至少一次贡献的天数",
    contributions: "次贡献",
    yearlyTotals: "年度总览",
    firstTrackedYear: "最早统计年份",
    partialYear: "未完整年份，截至",
    fullYear: "完整自然年",
    vsPrevious: "较上一年",
    newActivity: "新增活动",
    active: "活跃",
    maxDay: "峰值日",
    source: "来源",
    publicProfile: "公开资料",
    breakdown: "分类",
    unavailable: "不可用",
    days: "天",
    less: "少",
    more: "多",
    scale: "色阶",
    generatedPublic: "由公开 GitHub 资料生成。",
    generatedGraphql: "由 GitHub contributionCalendar 数据生成。",
    generated: "生成日期",
    partialFooter: "截至",
    qrLabel: "www.gitgreen.me"
  }
};

export function renderPosterSvg(data) {
  const years = data.years;
  const palette = data.palette ?? DEFAULT_PALETTE;
  const options = {
    showMonthLabels: true,
    showYearlyTotals: true,
    sortNewestFirst: true,
    language: data.language ?? "zh",
    ...(data.options ?? {})
  };
  const lang = options.language === "en" ? "en" : "zh";
  const copy = COPY[lang];
  const displayYears = options.sortNewestFirst ? [...years].reverse() : [...years];
  const yearByNumber = new Map(years.map((year) => [year.year, year]));
  const height = HEADER_HEIGHT + years.length * YEAR_HEIGHT + FOOTER_HEIGHT;
  const thresholds = buildThresholds(
    years.flatMap((year) => year.days.map((day) => day.contributionCount))
  );
  const summary = summarize(data);

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">`,
    defs(),
    rect(0, 0, WIDTH, height, "#ffffff"),
    header(data, summary, thresholds, palette, options, copy, lang),
    options.showYearlyTotals ? yearlyBars(years, summary, 72, 258, 1256, 70) : ""
  ];

  displayYears.forEach((year, index) => {
    const previousYear = yearByNumber.get(year.year - 1) ?? null;
    parts.push(yearBlock(year, previousYear, thresholds, HEADER_HEIGHT + index * YEAR_HEIGHT, palette, options, copy, lang));
  });

  parts.push(footer(data, thresholds, height - FOOTER_HEIGHT + 28, palette, copy));
  parts.push("</svg>");

  return parts.join("");
}

export async function writePosterFiles({ svg, outPath, format, pixelRatio }) {
  const written = [];
  const resolved = path.resolve(outPath);
  const parsed = path.parse(resolved);
  const extension = parsed.ext.toLowerCase();
  const basePath = extension ? path.join(parsed.dir, parsed.name) : resolved;

  if (format === "svg" || format === "both") {
    const svgPath = extension === ".svg" && format === "svg" ? resolved : `${basePath}.svg`;
    await fs.mkdir(path.dirname(svgPath), { recursive: true });
    await fs.writeFile(svgPath, svg, "utf8");
    written.push(svgPath);
  }

  if (format === "png" || format === "both") {
    const pngPath = extension === ".png" && format === "png" ? resolved : `${basePath}.png`;
    await fs.mkdir(path.dirname(pngPath), { recursive: true });
    await sharp(Buffer.from(svg), { density: 72 * pixelRatio })
      .png({ compressionLevel: 9 })
      .toFile(pngPath);
    written.push(pngPath);
  }

  return written;
}

function header(data, summary, thresholds, palette, options, copy, lang) {
  const displayName = data.name || data.login;
  const title = data.title || `${displayName}${copy.titleSuffix}`;
  const joined = formatDate(data.createdAt);
  const range = `${data.years[0].year} - ${data.years[data.years.length - 1].year}`;
  const avatar = avatarMarkup(data, 72, 58, 96);
  const sourceLabel =
    data.source === "public"
      ? copy.publicSource
      : copy.graphqlSource;

  return [
    avatar,
    text(title, 190, 78, {
      size: 42,
      weight: 800,
      fill: "#24292f"
    }),
    text(`@${data.login}  ${copy.joined} ${joined}  ${copy.tracked} ${range}`, 190, 116, {
      size: 19,
      fill: "#57606a"
    }),
    text(`${copy.subtitlePrefix} ${sourceLabel}`, 190, 148, {
      size: 17,
      fill: "#6e7781"
    }),
    stylizedQr("https://www.gitgreen.me", palette, 1190, 42, 108, copy.qrLabel),
    metricCard(72, 176, 292, copy.totalContributions, formatNumber(summary.total), copy.acrossYears),
    metricCard(384, 176, 292, copy.activeDays, formatNumber(summary.activeDays), copy.daysWithContributions),
    metricCard(696, 176, 292, copy.bestYear, `${summary.bestYear.year}`, `${formatNumber(summary.bestYear.totalContributions)} ${copy.contributions}`),
    metricCard(1008, 176, 320, copy.bestDay, summary.bestDay.date || "n/a", `${formatNumber(summary.bestDay.contributionCount)} ${copy.contributions}`),
    options.showYearlyTotals ? text(copy.yearlyTotals, 72, 250, { size: 14, weight: 700, fill: "#57606a" }) : "",
    options.showYearlyTotals ? "" : legend(thresholds, palette, 72, 252, copy)
  ].join("");
}

function avatarMarkup(data, x, y, size) {
  if (data.avatarDataUrl) {
    return [
      `<clipPath id="avatarClip"><circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}"/></clipPath>`,
      `<image href="${data.avatarDataUrl}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>`,
      `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2 - 1}" fill="none" stroke="#d0d7de" stroke-width="2"/>`
    ].join("");
  }

  return [
    circle(x + size / 2, y + size / 2, size / 2, "#24292f"),
    text(initials(data.name || data.login), x + size / 2, y + 61, {
      size: 34,
      weight: 800,
      fill: "#ffffff",
      anchor: "middle"
    })
  ].join("");
}

function metricCard(x, y, width, label, value, caption) {
  return [
    rect(x, y, width, 70, "#f6f8fa", "#d0d7de", 1, 8),
    text(label, x + 18, y + 24, { size: 13, weight: 700, fill: "#57606a" }),
    text(value, x + 18, y + 48, { size: 25, weight: 800, fill: "#24292f" }),
    text(caption, x + width - 18, y + 48, {
      size: 12,
      fill: "#6e7781",
      anchor: "end"
    })
  ].join("");
}

function yearlyBars(years, summary, x, y, width, height) {
  const max = Math.max(1, summary.bestYear.totalContributions);
  const gap = 7;
  const barWidth = Math.max(10, (width - gap * (years.length - 1)) / years.length);
  const parts = [
    line(x, y + height, x + width, y + height, "#d8dee4", 1)
  ];

  years.forEach((year, index) => {
    const barHeight = Math.max(2, (year.totalContributions / max) * (height - 18));
    const barX = x + index * (barWidth + gap);
    const barY = y + height - barHeight;
    const color = year.isPartial ? "#54aeff" : "#2da44e";
    parts.push(rect(barX, barY, barWidth, barHeight, color, null, 1, 4));
    if (years.length <= 12 || index % 2 === 0) {
      parts.push(text(String(year.year), barX + barWidth / 2, y + height + 20, {
        size: 11,
        fill: "#6e7781",
        anchor: "middle"
      }));
    }
  });

  return parts.join("");
}

function yearBlock(year, previousYear, thresholds, y, palette, options, copy, lang) {
  const gridY = y + 56;
  const gridWidth = 53 * GRID_STEP - GRID_GAP;
  const total = year.totalContributions;
  const delta = previousYear ? total - previousYear.totalContributions : null;
  const deltaLabel = previousYear ? formatDelta(delta, previousYear.totalContributions, copy) : copy.firstTrackedYear;
  const deltaFill = delta === null ? "#6e7781" : delta >= 0 ? "#1a7f37" : "#cf222e";
  const note = year.isPartial ? `${copy.partialYear} ${formatDate(year.to)}` : copy.fullYear;

  return [
    line(MARGIN_X, y + 1, WIDTH - MARGIN_X, y + 1, "#d8dee4", 1),
    text(String(year.year), MARGIN_X, y + 40, {
      size: 34,
      weight: 850,
      fill: "#24292f"
    }),
    text(formatNumber(total), MARGIN_X, y + 72, {
      size: 24,
      weight: 800,
      fill: "#24292f"
    }),
    text(copy.contributions, MARGIN_X, y + 96, {
      size: 13,
      weight: 700,
      fill: "#57606a"
    }),
    text(deltaLabel, MARGIN_X, y + 126, {
      size: 15,
      weight: 800,
      fill: deltaFill
    }),
    text(note, MARGIN_X, y + 150, {
      size: 12,
      fill: "#6e7781"
    }),
    options.showMonthLabels ? monthLabels(year, GRID_X, gridY - 16, lang) : "",
    contributionGrid(year, thresholds, palette, GRID_X, gridY),
    rect(GRID_X, y + 166, gridWidth, 1, "#f6f8fa"),
    yearStats(year, GRID_X + gridWidth + 30, y + 60, copy)
  ].join("");
}

function monthLabels(year, x, y, lang) {
  const parts = [];
  let lastMonth = -1;
  let lastX = -100;

  year.weeks.forEach((week, weekIndex) => {
    for (const day of week.contributionDays) {
      const date = new Date(`${day.date}T00:00:00Z`);
      const month = date.getUTCMonth();
      const dayOfMonth = date.getUTCDate();
      const labelX = x + weekIndex * GRID_STEP;

      if (dayOfMonth <= 7 && month !== lastMonth && labelX - lastX > 38) {
        parts.push(text(MONTHS[lang][month], labelX, y, {
          size: 11,
          fill: "#6e7781"
        }));
        lastMonth = month;
        lastX = labelX;
      }
    }
  });

  return parts.join("");
}

function contributionGrid(year, thresholds, palette, x, y) {
  const parts = [];

  year.weeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day) => {
      const cellX = x + weekIndex * GRID_STEP;
      const cellY = y + day.weekday * GRID_STEP;
      const level = contributionLevel(day.contributionCount, thresholds);
      parts.push(rect(cellX, cellY, GRID_CELL, GRID_CELL, palette[level], "#ffffff", 0.8, 2));
    });
  });

  return parts.join("");
}

function yearStats(year, x, y, copy) {
  if (year.source === "public" || year.totalCommitContributions === null) {
    const rows = [
      [copy.active, `${formatNumber(year.activeDays)} ${copy.days}`],
      [copy.maxDay, `${formatNumber(year.maxDay.contributionCount)}`],
      [copy.source, copy.publicProfile],
      [copy.breakdown, copy.unavailable]
    ];

    return rows
      .map((row, index) => {
        const rowY = y + index * 20;
        return [
          text(row[0], x, rowY, { size: 12, weight: 700, fill: "#6e7781" }),
          text(row[1], x + 92, rowY, { size: 12, weight: 800, fill: "#24292f" })
        ].join("");
      })
      .join("");
  }

  const rows = [
    ["Active", `${formatNumber(year.activeDays)} days`],
    ["Max day", `${formatNumber(year.maxDay.contributionCount)}`],
    ["Commits", formatNumber(year.totalCommitContributions)],
    ["PRs", formatNumber(year.totalPullRequestContributions)],
    ["Reviews", formatNumber(year.totalPullRequestReviewContributions)],
    ["Issues", formatNumber(year.totalIssueContributions)]
  ];

  if (year.restrictedContributionsCount > 0) {
    rows.push(["Private", formatNumber(year.restrictedContributionsCount)]);
  }

  return rows
    .map((row, index) => {
      const rowY = y + index * 20;
      return [
        text(row[0], x, rowY, { size: 12, weight: 700, fill: "#6e7781" }),
        text(row[1], x + 92, rowY, { size: 12, weight: 800, fill: "#24292f" })
      ].join("");
    })
    .join("");
}

function legend(thresholds, palette, x, y, copy) {
  const labels = [
    "0",
    `1-${thresholds[0]}`,
    `${thresholds[0] + 1}-${thresholds[1]}`,
    `${thresholds[1] + 1}-${thresholds[2]}`,
    `${thresholds[2] + 1}+`
  ];
  const parts = [text(copy.less, x - 38, y + 12, { size: 11, fill: "#6e7781" })];

  palette.forEach((color, index) => {
    parts.push(rect(x + index * 19, y, 13, 13, color, "#ffffff", 0.8, 2));
  });

  parts.push(text(copy.more, x + 100, y + 12, { size: 11, fill: "#6e7781" }));
  parts.push(text(`${copy.scale}: ${labels.join(" / ")}`, x - 38, y + 34, {
    size: 10,
    fill: "#8c959f"
  }));
  return parts.join("");
}

function footer(data, thresholds, y, palette, copy) {
  const current = data.years.find((year) => year.isPartial);
  const partialText = current ? ` ${current.year} ${copy.partialFooter} ${formatDate(current.to)}.` : "";
  const sourceText =
    data.source === "public"
      ? copy.generatedPublic
      : copy.generatedGraphql;
  return [
    line(MARGIN_X, y - 28, WIDTH - MARGIN_X, y - 28, "#d8dee4", 1),
    legend(thresholds, palette, MARGIN_X, y + 8, copy),
    text(`${sourceText} ${copy.generated} ${formatDate(data.generatedAt)}.${partialText}`, 380, y + 20, {
      size: 13,
      fill: "#57606a"
    }),
    text("github-contrib-poster", WIDTH - MARGIN_X, y + 20, {
      size: 13,
      weight: 800,
      fill: "#24292f",
      anchor: "end"
    })
  ].join("");
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
      (best, day) =>
        day.contributionCount > best.contributionCount ? day : best,
      { date: null, contributionCount: 0 }
    );

  return { total, activeDays, bestYear, bestDay };
}

function buildThresholds(counts) {
  const nonZero = counts.filter((count) => count > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) {
    return [1, 3, 8];
  }

  const thresholds = [0.25, 0.5, 0.75].map((point) =>
    quantile(nonZero, point)
  );

  for (let index = 0; index < thresholds.length; index += 1) {
    if (index === 0) {
      thresholds[index] = Math.max(1, thresholds[index]);
    } else {
      thresholds[index] = Math.max(thresholds[index], thresholds[index - 1] + 1);
    }
  }

  return thresholds;
}

function contributionLevel(count, thresholds) {
  if (count <= 0) {
    return 0;
  }
  if (count <= thresholds[0]) {
    return 1;
  }
  if (count <= thresholds[1]) {
    return 2;
  }
  if (count <= thresholds[2]) {
    return 3;
  }
  return 4;
}

function quantile(values, point) {
  const index = Math.floor((values.length - 1) * point);
  return values[index];
}

function stylizedQr(url, palette, x, y, size, label) {
  const qr = QRCode.create(url, {
    errorCorrectionLevel: "H"
  });
  const moduleCount = qr.modules.size;
  const quiet = 2;
  const totalModules = moduleCount + quiet * 2;
  const cell = size / totalModules;
  const accent = palette[4] ?? "#216e39";
  const mid = palette[3] ?? accent;
  const light = palette[1] ?? "#9be9a8";
  const parts = [
    rect(x - 12, y - 12, size + 24, size + 44, "#f6f8fa", "#d0d7de", 1, 12),
    rect(x, y, size, size, "#ffffff", null, 1, 10)
  ];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.modules.get(row, col)) {
        continue;
      }

      if (isFinderModule(row, col, moduleCount)) {
        continue;
      }

      const moduleX = x + (col + quiet) * cell;
      const moduleY = y + (row + quiet) * cell;
      const rhythm = (row * 13 + col * 7) % 5;
      const fill = rhythm === 0 ? mid : accent;
      const radius = cell * (0.26 + rhythm * 0.025);
      parts.push(circle(moduleX + cell * 0.5, moduleY + cell * 0.5, radius, fill));
    }
  }

  parts.push(...qrEye(x + quiet * cell, y + quiet * cell, cell * 7, accent, mid, light));
  parts.push(...qrEye(x + (quiet + moduleCount - 7) * cell, y + quiet * cell, cell * 7, accent, mid, light));
  parts.push(...qrEye(x + quiet * cell, y + (quiet + moduleCount - 7) * cell, cell * 7, accent, mid, light));
  parts.push(rect(x + size * 0.37, y + size * 0.37, size * 0.26, size * 0.26, "#ffffff", null, 1, 8));
  parts.push(circle(x + size / 2, y + size / 2, size * 0.075, light));
  parts.push(text(label, x + size / 2, y + size + 25, {
    size: 12,
    weight: 800,
    fill: accent,
    anchor: "middle"
  }));

  return parts.join("");
}

function isFinderModule(row, col, size) {
  const inTopLeft = row < 7 && col < 7;
  const inTopRight = row < 7 && col >= size - 7;
  const inBottomLeft = row >= size - 7 && col < 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

function qrEye(x, y, size, accent, mid, light) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  return [
    circle(cx, cy, size * 0.46, accent),
    circle(cx, cy, size * 0.34, "#ffffff"),
    circle(cx, cy, size * 0.2, mid),
    circle(cx, cy, size * 0.07, light)
  ];
}

function formatDelta(delta, previousTotal, copy) {
  if (previousTotal === 0 && delta > 0) {
    return copy.newActivity;
  }

  const percent = previousTotal === 0 ? 0 : Math.round((delta / previousTotal) * 100);
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${formatNumber(delta)} (${sign}${percent}%) ${copy.vsPrevious}`;
}

function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function initials(value) {
  return value
    .split(/\s|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function defs() {
  return `
  <style>
    text {
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      dominant-baseline: auto;
    }
  </style>
  `;
}

function rect(x, y, width, height, fill, stroke = null, strokeWidth = 1, radius = 0) {
  const strokeAttrs = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : "";
  const radiusAttrs = radius ? ` rx="${radius}" ry="${radius}"` : "";
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" fill="${fill}"${strokeAttrs}${radiusAttrs}/>`;
}

function circle(cx, cy, r, fill) {
  return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" fill="${fill}"/>`;
}

function line(x1, y1, x2, y2, stroke, strokeWidth) {
  return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function text(value, x, y, options = {}) {
  const {
    size = 16,
    weight = 400,
    fill = "#24292f",
    anchor = "start"
  } = options;

  return `<text x="${round(x)}" y="${round(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(String(value))}</text>`;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function round(value) {
  return Number(value.toFixed(2));
}
