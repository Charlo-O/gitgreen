const WIDTH = 1400;
const MARGIN_X = 72;
const HEADER_HEIGHT = 360;
const YEAR_HEIGHT = 188;
const FOOTER_HEIGHT = 88;
const GRID_X = 356;
const GRID_CELL = 12;
const GRID_GAP = 3;
const GRID_STEP = GRID_CELL + GRID_GAP;

const DEFAULT_PALETTE = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
const QR_CODE_URL = "https://gitgreen.me";
const QR_CODE_ROWS = [
  "11111110001100011101101111111",
  "10000010110000111010101000001",
  "10111010101000100111101011101",
  "10111010111000011110101011101",
  "10111010101101101010001011101",
  "10000010110000011110101000001",
  "11111110101010101010101111111",
  "00000000011001000100000000000",
  "00100111100110000100110111110",
  "10011000101001000100101101011",
  "11111010101011111100110010101",
  "10011100110001111111101111000",
  "11011010110110001000111001010",
  "10111101011111001011101001001",
  "00010011001100011011001001101",
  "11110001100110100111110001001",
  "10101111100000111001011100011",
  "01001000110001111010000101001",
  "11110010101011011111000100101",
  "00101101010001000000011111011",
  "11111010011000010101111111011",
  "00000000101100101000100011011",
  "11111110100001010110101011101",
  "10000010110001000001100011011",
  "10111010001011111001111110001",
  "10111010011010111011100111110",
  "10111010101111111100010011011",
  "10000010011101100110011000000",
  "11111110000100000010010111001"
];
const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  zh: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
};

const COPY = {
  en: {
    titleSuffix: "'s GitHub Contributions",
    joined: "Joined",
    tracked: "Tracked",
    publicSource: "Built from public GitHub contribution data.",
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
    generatedPublic: "Generated in browser from public GitHub contribution data.",
    generated: "Generated",
    partialFooter: "is partial through",
    qrLabel: "gitgreen.me"
  },
  zh: {
    titleSuffix: "的 GitHub 贡献",
    joined: "注册",
    tracked: "统计",
    publicSource: "基于公开 GitHub 贡献数据生成。",
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
    partialYear: "未完整年份，截止",
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
    generatedPublic: "由浏览器基于公开 GitHub 贡献数据生成。",
    generated: "生成日期",
    partialFooter: "截止",
    qrLabel: "gitgreen.me"
  }
};

let activeLanguage = "zh";

export function normalizeContributionApiPayload({
  user,
  contributionPayload,
  language,
  title,
  palette,
  options,
  avatarDataUrl
}) {
  const today = new Date().toISOString().slice(0, 10);
  const joinedDay = new Date(user.created_at).toISOString().slice(0, 10);
  const rawDays = Array.isArray(contributionPayload?.contributions)
    ? contributionPayload.contributions
    : [];

  const daysByYear = new Map();
  for (const rawDay of rawDays) {
    const date = rawDay.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < joinedDay || date > today) {
      continue;
    }

    const year = Number(date.slice(0, 4));
    if (!daysByYear.has(year)) {
      daysByYear.set(year, []);
    }
    daysByYear.get(year).push({
      date,
      contributionCount: Number(rawDay.count ?? 0),
      contributionLevel: publicLevelName(Number(rawDay.level ?? 0)),
      color: null,
      weekday: new Date(`${date}T00:00:00Z`).getUTCDay()
    });
  }

  const currentYear = new Date().getFullYear();
  const years = [...daysByYear.keys()]
    .sort((a, b) => a - b)
    .map((year) => normalizeApiYear(year, daysByYear.get(year), year === currentYear, today));

  if (!years.length) {
    throw new Error("No public contribution history was returned for this GitHub user.");
  }

  return {
    source: "public-api",
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    avatarDataUrl,
    url: user.html_url,
    createdAt: user.created_at,
    title,
    palette: palette ?? DEFAULT_PALETTE,
    options: {
      language,
      showMonthLabels: true,
      showYearlyTotals: true,
      showQrCode: true,
      sortNewestFirst: true,
      ...options
    },
    generatedAt: new Date().toISOString(),
    years
  };
}

export function summarizePoster(data) {
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

export function renderPosterSvg(data) {
  activeLanguage = data.options?.language === "en" ? "en" : "zh";
  const years = data.years;
  const palette = data.palette ?? DEFAULT_PALETTE;
  const options = {
    showMonthLabels: true,
    showYearlyTotals: true,
    showQrCode: true,
    sortNewestFirst: true,
    language: activeLanguage,
    ...(data.options ?? {})
  };
  const copy = COPY[activeLanguage];
  const displayYears = options.sortNewestFirst ? [...years].reverse() : [...years];
  const yearByNumber = new Map(years.map((year) => [year.year, year]));
  const height = HEADER_HEIGHT + years.length * YEAR_HEIGHT + FOOTER_HEIGHT;
  const thresholds = buildThresholds(
    years.flatMap((year) => year.days.map((day) => day.contributionCount))
  );
  const summary = summarizePoster(data);

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">`,
    defs(),
    rect(0, 0, WIDTH, height, "#ffffff"),
    header(data, summary, thresholds, palette, options, copy, activeLanguage),
    options.showYearlyTotals ? yearlyBars(years, summary, 72, 258, 1256, 70) : ""
  ];

  displayYears.forEach((year, index) => {
    const previousYear = yearByNumber.get(year.year - 1) ?? null;
    parts.push(yearBlock(year, previousYear, thresholds, HEADER_HEIGHT + index * YEAR_HEIGHT, palette, options, copy, activeLanguage));
  });

  parts.push(footer(data, thresholds, height - FOOTER_HEIGHT + 28, palette, copy));
  parts.push("</svg>");

  return parts.join("");
}

export async function fetchAvatarDataUrl(url) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Could not fetch avatar: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function createSvgObjectUrl(svg) {
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
}

export async function svgToPngObjectUrl(svg, pixelRatio = 2) {
  const sourceUrl = createSvgObjectUrl(svg);
  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Could not render SVG preview for PNG export."));
    });
    image.src = sourceUrl;
    await loaded;

    const { width, height } = readSvgSize(svg);
    const canvas = document.createElement("canvas");
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) {
          resolve(value);
        } else {
          reject(new Error("Could not export PNG from the generated poster."));
        }
      }, "image/png");
    });
    return URL.createObjectURL(blob);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function normalizeApiYear(year, rawDays, isPartial, today) {
  const daysByDate = new Map(rawDays.map((day) => [day.date, day]));
  const endDate = isPartial ? today : `${year}-12-31`;
  const days = [];
  for (
    let date = new Date(Date.UTC(year, 0, 1));
    date <= new Date(`${endDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const iso = date.toISOString().slice(0, 10);
    const existing = daysByDate.get(iso);
    days.push(existing ?? {
      date: iso,
      contributionCount: 0,
      contributionLevel: "NONE",
      color: null,
      weekday: date.getUTCDay()
    });
  }

  const totalContributions = days.reduce((sum, day) => sum + day.contributionCount, 0);
  const activeDays = days.filter((day) => day.contributionCount > 0).length;
  const maxDay = days.reduce(
    (best, day) =>
      day.contributionCount > best.contributionCount ? day : best,
    { date: null, contributionCount: 0 }
  );

  return {
    year,
    from: `${year}-01-01T00:00:00Z`,
    to: isPartial ? new Date().toISOString() : `${year}-12-31T23:59:59Z`,
    isPartial,
    source: "public",
    totalContributions,
    totalCommitContributions: null,
    totalIssueContributions: null,
    totalPullRequestContributions: null,
    totalPullRequestReviewContributions: null,
    totalRepositoryContributions: null,
    restrictedContributionsCount: null,
    activeDays,
    maxDay,
    weeks: groupDaysIntoWeeks(days),
    days
  };
}

function groupDaysIntoWeeks(days) {
  const weeks = [];
  let currentWeek = null;

  for (const day of days) {
    if (!currentWeek || day.weekday === 0) {
      currentWeek = {
        firstDay: day.date,
        contributionDays: []
      };
      weeks.push(currentWeek);
    }
    currentWeek.contributionDays.push(day);
  }

  return weeks;
}

function header(data, summary, thresholds, palette, options, copy, lang) {
  const displayName = data.name || data.login;
  const title = data.title || `${displayName}${copy.titleSuffix}`;
  const joined = formatDate(data.createdAt);
  const range = `${data.years[0].year} - ${data.years[data.years.length - 1].year}`;

  return [
    avatarMarkup(data, 72, 58, 96),
    text(title, 190, 78, {
      size: 42,
      weight: 800,
      fill: "#24292f"
    }),
    text(`@${data.login}  ${copy.joined} ${joined}  ${copy.tracked} ${range}`, 190, 116, {
      size: 19,
      fill: "#57606a"
    }),
    text(`${copy.subtitlePrefix} ${copy.publicSource}`, 190, 148, {
      size: 17,
      fill: "#6e7781"
    }),
    options.showQrCode ? realQr(QR_CODE_URL, palette, 1200, 42, 111) : "",
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
  return [
    line(MARGIN_X, y - 28, WIDTH - MARGIN_X, y - 28, "#d8dee4", 1),
    legend(thresholds, palette, MARGIN_X, y + 8, copy),
    text(`${copy.generatedPublic} ${copy.generated} ${formatDate(data.generatedAt)}.${partialText}`, 380, y + 20, {
      size: 13,
      fill: "#57606a"
    }),
    text("GitGreen Studio", WIDTH - MARGIN_X, y + 20, {
      size: 13,
      weight: 800,
      fill: "#24292f",
      anchor: "end"
    })
  ].join("");
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

function realQr(url, palette, x, y, size) {
  const rows = QR_CODE_ROWS;
  const quiet = 4;
  const moduleCount = rows.length;
  const cell = size / (moduleCount + quiet * 2);
  const fill = palette[4] ?? "#1f2328";
  const parts = [
    `<g data-qr-url="${escapeXml(url)}">`
  ];

  rows.forEach((row, rowIndex) => {
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      if (row[colIndex] !== "1") {
        continue;
      }

      parts.push(rect(
        x + (colIndex + quiet) * cell,
        y + (rowIndex + quiet) * cell,
        cell,
        cell,
        fill
      ));
    }
  });

  parts.push("</g>");
  return parts.join("");
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
  return new Intl.NumberFormat(activeLanguage === "zh" ? "zh-CN" : "en-US").format(value);
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
      font-family: Inter, "Segoe UI", "Microsoft YaHei", Arial, sans-serif;
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

function readSvgSize(svg) {
  const width = Number(svg.match(/\bwidth="(\d+(?:\.\d+)?)"/)?.[1] ?? WIDTH);
  const height = Number(svg.match(/\bheight="(\d+(?:\.\d+)?)"/)?.[1] ?? WIDTH);
  return { width, height };
}

function round(value) {
  return Number(value.toFixed(2));
}

function publicLevelName(level) {
  return ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"][level] ?? "NONE";
}
