import {
  createSvgObjectUrl,
  fetchAvatarDataUrl,
  normalizeContributionApiPayload,
  renderPosterSvg,
  summarizePoster,
  svgToPngObjectUrl
} from "./poster-renderer.js?v=20260605-adaptive-ratios";

const form = document.querySelector("#generateForm");
const profileInput = document.querySelector("#profileInput");
const generateButton = document.querySelector("#generateButton");
const fetchStatus = document.querySelector("#fetchStatus");
const posterPreview = document.querySelector("#posterPreview");
const emptyPreview = document.querySelector("#emptyPreview");
const artboard = document.querySelector("#artboard");
const zoomLabel = document.querySelector("#zoomLabel");
const downloadPng = document.querySelector("#downloadPng");
const downloadSvg = document.querySelector("#downloadSvg");
const exportBadge = document.querySelector("#exportBadge");
const titleInput = document.querySelector("#titleInput");
const languageSelect = document.querySelector("#languageSelect");
const startYearInput = document.querySelector("#startYearInput");
const endYearInput = document.querySelector("#endYearInput");
const yearCountLabel = document.querySelector("#yearCountLabel");
const stepProfile = document.querySelector("#stepProfile");
const stepYears = document.querySelector("#stepYears");
const stepStatus = document.querySelector("#stepStatus");
const stepPalette = document.querySelector("#stepPalette");
const stepExport = document.querySelector("#stepExport");
const monthLabelsInput = document.querySelector("#monthLabelsInput");
const totalsInput = document.querySelector("#totalsInput");
const qrCodeInput = document.querySelector("#qrCodeInput");
const outputSizeInput = document.querySelector("#outputSize");
const API_BASE_URL = window.GITGREEN_API_BASE_URL ?? "";
const CONTRIBUTIONS_API_BASE_URL = "https://github-contributions-api.jogruber.de/v4";

const PALETTES = {
  github: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  ocean: ["#ebedf0", "#dff6ff", "#9bd8ee", "#43a6d7", "#006b9a"],
  violet: ["#ebedf0", "#eee7fb", "#d2b8f0", "#9a6dd7", "#5b2b91"]
};

const I18N = {
  zh: {
    brandSubtitle: "GitHub 贡献海报",
    pasteProfile: "粘贴 GitHub 主页",
    generatePoster: "生成海报",
    readyPublicData: "准备抓取公开数据",
    noTokenRequired: "无需 Token",
    publicOnly: "仅公开数据",
    stepInput: "输入",
    profile: "主页",
    years: "年份",
    waiting: "等待中",
    stepFetch: "抓取",
    source: "来源",
    githubPublicApi: "GitHub 公开数据",
    status: "状态",
    ready: "就绪",
    stepCompose: "合成",
    layout: "布局",
    yearlyHeatmapStack: "年度热力图堆叠",
    scale: "色阶",
    stepExport: "导出",
    readyLabel: "就绪",
    generateFirst: "先生成",
    publicNote: "这张海报只使用 GitHub 公开贡献数据，不需要私有数据或 Token。",
    poster: "海报",
    waitingInput: "等待输入",
    posterPreview: "海报预览",
    emptyPreviewText: "粘贴公开 GitHub 主页，生成年度贡献长图。",
    fitToWidth: "适应宽度",
    posterSettings: "海报设置",
    language: "语言",
    title: "标题",
    defaultTitle: "GitHub 贡献",
    subtitle: "副标题",
    subtitleValue: "基于公开贡献生成",
    dateRange: "日期范围",
    generatedAfterFetch: "生成后显示",
    outputSize: "输出尺寸",
    originalHighResolution: "原始尺寸",
    ratioThreeFour: "3:4 竖版",
    ratioNineSixteen: "9:16 竖版",
    originalReadable: "默认保留完整长图，3:4 和 9:16 会按比例重新排版。",
    colorScale: "主题色阶",
    basedOnPublicCounts: "基于公开贡献数量生成。",
    options: "选项",
    showMonthLabels: "显示月份标签",
    showYearlyTotals: "显示年度总览",
    showQrCode: "显示二维码",
    downloadPng: "下载 PNG",
    downloadSvg: "下载 SVG",
    downloadNote: "高清输出 · 仅公开数据",
    githubPalette: "GitHub 绿色",
    oceanPalette: "海洋蓝",
    violetPalette: "紫罗兰",
    pasteFirst: "请先粘贴 GitHub 主页",
    fetchingPublicData: "正在抓取公开数据",
    readingContributionYears: "正在读取公开贡献年份",
    working: "处理中",
    composing: "正在合成",
    generating: "生成中",
    generationFailed: "生成失败",
    tryAgain: "重试",
    needsAttention: "需要处理",
    fetchedPublicData: "已抓取公开数据",
    exportReady: "可导出",
    backendUnavailable: "后端服务未部署",
    backendUnavailableDetail: "GitHub Pages 不能运行生成接口，请先部署 API 或在本地运行 npm run web。",
    contributionsAcrossYears: (total, years) => `${total} 次贡献，跨 ${years} 年`,
    yearsAndContributions: (years, total) => `${years} 年 · ${total} 次贡献`
  },
  en: {
    brandSubtitle: "GitHub Contribution Poster",
    pasteProfile: "Paste GitHub profile",
    generatePoster: "Generate poster",
    readyPublicData: "Ready for public data",
    noTokenRequired: "No token required",
    publicOnly: "Public only",
    stepInput: "Input",
    profile: "Profile",
    years: "Years",
    waiting: "Waiting",
    stepFetch: "Fetch",
    source: "Source",
    githubPublicApi: "GitHub Public API",
    status: "Status",
    ready: "Ready",
    stepCompose: "Compose",
    layout: "Layout",
    yearlyHeatmapStack: "Yearly heatmap stack",
    scale: "Scale",
    stepExport: "Export",
    readyLabel: "Ready",
    generateFirst: "Generate first",
    publicNote: "This poster uses public GitHub contribution data only. No private data or token is requested.",
    poster: "Poster",
    waitingInput: "Waiting for input",
    posterPreview: "Poster preview",
    emptyPreviewText: "Paste a public GitHub profile and generate the yearly contribution image.",
    fitToWidth: "Fit to width",
    posterSettings: "Poster settings",
    language: "Language",
    title: "Title",
    defaultTitle: "GitHub Contributions",
    subtitle: "Subtitle",
    subtitleValue: "Generated from public contributions",
    dateRange: "Date range",
    generatedAfterFetch: "Generated after fetch",
    outputSize: "Output size",
    originalHighResolution: "Original size",
    ratioThreeFour: "3:4 portrait",
    ratioNineSixteen: "9:16 portrait",
    originalReadable: "Default keeps the full poster. 3:4 and 9:16 use ratio-aware layouts.",
    colorScale: "Color scale",
    basedOnPublicCounts: "Based on public contribution counts.",
    options: "Options",
    showMonthLabels: "Show month labels",
    showYearlyTotals: "Show yearly totals",
    showQrCode: "Show QR code",
    downloadPng: "Download PNG",
    downloadSvg: "Download SVG",
    downloadNote: "High resolution · Public data only",
    githubPalette: "GitHub Green",
    oceanPalette: "Ocean Blue",
    violetPalette: "Violet",
    pasteFirst: "Paste a GitHub profile first",
    fetchingPublicData: "Fetching public data",
    readingContributionYears: "Reading public contribution years",
    working: "Working",
    composing: "Composing",
    generating: "Generating",
    generationFailed: "Generation failed",
    tryAgain: "Try again",
    needsAttention: "Needs attention",
    fetchedPublicData: "Fetched public data",
    exportReady: "Export-ready",
    backendUnavailable: "Backend is not deployed",
    backendUnavailableDetail: "GitHub Pages cannot run the generation API. Deploy the API first or run npm run web locally.",
    contributionsAcrossYears: (total, years) => `${total} contributions across ${years} years`,
    yearsAndContributions: (years, total) => `${years} years · ${total} contributions`
  }
};

let zoom = 0.72;
let lastResult = null;
let titleTouched = false;
let resultObjectUrls = [];

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await generatePoster();
});

titleInput.addEventListener("input", () => {
  titleTouched = true;
});

languageSelect.addEventListener("change", async () => {
  const oldDefaults = [I18N.zh.defaultTitle, I18N.en.defaultTitle];
  if (!titleTouched || oldDefaults.includes(titleInput.value.trim())) {
    titleInput.value = t("defaultTitle");
    titleTouched = false;
  }
  applyLanguage();
  if (lastResult) {
    await generatePoster();
  }
});

document.querySelector("#zoomOut").addEventListener("click", () => setZoom(zoom - 0.08));
document.querySelector("#zoomIn").addEventListener("click", () => setZoom(zoom + 0.08));
document.querySelector("#fitWidth").addEventListener("click", () => setZoom(0.72));

document.querySelectorAll("input[name='palette']").forEach((input) => {
  input.addEventListener("change", () => {
    document.querySelectorAll(".palette-option").forEach((label) => {
      label.classList.toggle("selected", label.querySelector("input").checked);
    });
    stepPalette.textContent = paletteLabel(input.value);
    if (lastResult) {
      generatePoster();
    }
  });
});

profileInput.addEventListener("input", () => {
  stepProfile.textContent = extractLogin(profileInput.value) || t("waiting");
});

[monthLabelsInput, totalsInput, qrCodeInput, outputSizeInput].forEach((input) => {
  input.addEventListener("change", () => {
    if (lastResult) {
      generatePoster();
    }
  });
});

async function generatePoster() {
  const profile = profileInput.value.trim();
  if (!profile) {
    setStatus(t("pasteFirst"), t("noTokenRequired"), "error");
    return;
  }

  const payload = {
    profile,
    language: currentLanguage(),
    title: titleInput.value,
    palette: document.querySelector("input[name='palette']:checked").value,
    showMonthLabels: monthLabelsInput.checked,
    showYearlyTotals: totalsInput.checked,
    showQrCode: qrCodeInput.checked,
    outputSize: outputSizeInput.value
  };

  setGenerating(true);
  setWorkflow("fetch");
  setStatus(t("fetchingPublicData"), t("readingContributionYears"), "loading");
  stepProfile.textContent = extractLogin(profile) || profile;
  stepStatus.textContent = t("fetchingPublicData");
  stepStatus.classList.add("success");
  stepYears.textContent = t("working");
  stepExport.textContent = t("composing");
  exportBadge.textContent = t("generating");

  try {
    const body = shouldUseBrowserGenerator()
      ? await generateBrowserPoster(payload)
      : await generateServerPoster(payload);

    replaceResult(body);
  } catch (error) {
    setWorkflow("input");
    setStatus(t("generationFailed"), error.message, "error");
    stepStatus.textContent = t("generationFailed");
    stepStatus.classList.remove("success");
    stepExport.textContent = t("tryAgain");
    exportBadge.textContent = t("needsAttention");
  } finally {
    setGenerating(false);
  }
}

async function generateServerPoster(payload) {
  const response = await fetch(`${API_BASE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = await readJsonResponse(response);

  if (!response.ok || !body.ok) {
    throw new Error(body.message || "Could not generate poster.");
  }

  return body;
}

async function generateBrowserPoster(payload) {
  const login = normalizeGithubLogin(payload.profile);
  const [user, contributionPayload] = await Promise.all([
    fetchGithubUser(login),
    fetchContributionHistory(login)
  ]);
  const avatarDataUrl = user.avatar_url
    ? await fetchAvatarDataUrl(user.avatar_url).catch(() => null)
    : null;
  const data = normalizeContributionApiPayload({
    user,
    contributionPayload,
    language: payload.language,
    title: cleanTitle(payload.title),
    palette: PALETTES[payload.palette] ?? PALETTES.github,
    options: {
      language: payload.language,
      showMonthLabels: payload.showMonthLabels,
      showYearlyTotals: payload.showYearlyTotals,
      showQrCode: payload.showQrCode,
      sortNewestFirst: true
    },
    avatarDataUrl
  });
  const svg = renderPosterSvg(data, payload.outputSize);
  const svgUrl = createSvgObjectUrl(svg);
  const pngUrl = await svgToPngObjectUrl(svg, 2);
  const summary = summarizePoster(data);

  return {
    ok: true,
    user: {
      login: data.login,
      name: data.name,
      avatarUrl: data.avatarUrl,
      url: data.url,
      createdAt: data.createdAt
    },
    summary,
    files: {
      svg: svgUrl,
      png: pngUrl
    },
    source: "browser-public-api",
    generatedAt: data.generatedAt,
    outputSize: payload.outputSize,
    objectUrls: [svgUrl, pngUrl]
  };
}

async function fetchGithubUser(login) {
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.message ? `: ${body.message}` : "";
    throw new Error(`GitHub user request failed with HTTP ${response.status}${message}`);
  }

  return body;
}

async function fetchContributionHistory(login) {
  const response = await fetch(`${CONTRIBUTIONS_API_BASE_URL}/${encodeURIComponent(login)}`, {
    headers: {
      Accept: "application/json"
    }
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.error || body?.message;
    throw new Error(message || `Contribution history request failed with HTTP ${response.status}`);
  }

  return body;
}

function replaceResult(result) {
  cleanupResultObjectUrls();
  lastResult = result;
  resultObjectUrls = result.objectUrls ?? [];
  renderResult(result);
}

function cleanupResultObjectUrls() {
  for (const url of resultObjectUrls) {
    URL.revokeObjectURL(url);
  }
  resultObjectUrls = [];
}

function renderResult(result) {
  const summary = result.summary;
  const stamp = Date.now();

  emptyPreview.hidden = true;
  posterPreview.hidden = false;
  const previewUrl = assetUrl(result.files.svg);
  posterPreview.src = previewUrl.startsWith("blob:") ? previewUrl : `${previewUrl}?t=${stamp}`;

  downloadPng.href = assetUrl(result.files.png);
  downloadSvg.href = assetUrl(result.files.svg);
  const outputSuffix = result.outputSize && result.outputSize !== "original"
    ? `-${result.outputSize.replace("ratio-", "")}`
    : "";
  downloadPng.download = `${result.user.login}-github-contributions${outputSuffix}.png`;
  downloadSvg.download = `${result.user.login}-github-contributions${outputSuffix}.svg`;
  downloadPng.classList.remove("disabled");
  downloadSvg.classList.remove("disabled");

  profileInput.value = result.user.url;
  stepProfile.textContent = result.user.login;
  stepYears.textContent = `${summary.startYear} - ${summary.endYear}`;
  stepStatus.textContent = t("fetchedPublicData");
  stepStatus.classList.add("success");
  stepExport.textContent = t("exportReady");
  startYearInput.value = summary.startYear;
  endYearInput.value = summary.endYear;
  yearCountLabel.textContent = t("yearsAndContributions")(
    summary.yearCount,
    formatNumber(summary.total)
  );
  exportBadge.textContent = t("exportReady");

  setWorkflow("export");
  setStatus(
    t("fetchedPublicData"),
    t("contributionsAcrossYears")(formatNumber(summary.total), summary.yearCount),
    "success"
  );
}

function applyLanguage() {
  const lang = currentLanguage();
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    const value = t(key);
    if (typeof value === "string") {
      element.textContent = value;
    }
  });

  document.querySelectorAll("[data-i18n-value]").forEach((element) => {
    const key = element.dataset.i18nValue;
    const value = t(key);
    if (typeof value === "string") {
      element.value = value;
    }
  });

  stepPalette.textContent = paletteLabel(document.querySelector("input[name='palette']:checked").value);
  if (!lastResult) {
    stepYears.textContent = t("waiting");
    stepStatus.textContent = t("ready");
    stepExport.textContent = t("generateFirst");
    exportBadge.textContent = t("waitingInput");
    yearCountLabel.textContent = t("generatedAfterFetch");
    setStatus(t("readyPublicData"), t("noTokenRequired"), "success");
  } else {
    renderResult(lastResult);
  }
}

function setGenerating(isGenerating) {
  generateButton.disabled = isGenerating;
  generateButton.classList.toggle("loading", isGenerating);
}

function setStatus(title, detail, mode) {
  fetchStatus.querySelector("strong").textContent = title;
  fetchStatus.querySelector("span:not(.status-dot)").textContent = detail;
  fetchStatus.classList.toggle("error", mode === "error");
  fetchStatus.classList.toggle("loading", mode === "loading");
}

function setWorkflow(activeStep) {
  const order = ["input", "fetch", "compose", "export"];
  const activeIndex = order.indexOf(activeStep);
  document.querySelectorAll(".workflow-step").forEach((step) => {
    const index = order.indexOf(step.dataset.step);
    step.classList.toggle("done", index < activeIndex || activeStep === "export");
    step.classList.toggle("active", index === activeIndex && activeStep !== "export");
  });
}

function setZoom(value) {
  zoom = Math.min(1, Math.max(0.32, value));
  artboard.style.transform = `scale(${zoom})`;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

function normalizeGithubLogin(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/?/i);
  const login = match ? match[1] : trimmed.replace(/^@/, "");

  if (!/^[A-Za-z0-9-]+$/.test(login)) {
    throw new Error(`Invalid GitHub username or profile URL: ${value}`);
  }

  return login;
}

function extractLogin(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/?/i);
  return (match ? match[1] : trimmed.replace(/^@/, "")).replace(/[^A-Za-z0-9-]/g, "");
}

function paletteLabel(value) {
  if (value === "ocean") {
    return t("oceanPalette");
  }
  if (value === "violet") {
    return t("violetPalette");
  }
  return t("githubPalette");
}

function currentLanguage() {
  return languageSelect.value === "en" ? "en" : "zh";
}

function t(key) {
  return I18N[currentLanguage()][key];
}

function formatNumber(value) {
  return new Intl.NumberFormat(currentLanguage() === "zh" ? "zh-CN" : "en-US").format(value);
}

function assetUrl(value) {
  if (!value || !API_BASE_URL || !value.startsWith("/")) {
    return value;
  }

  return `${API_BASE_URL}${value}`;
}

function shouldUseBrowserGenerator() {
  return window.GITGREEN_FORCE_BROWSER_GENERATOR === true
    || new URLSearchParams(window.location.search).has("static")
    || isLocalStaticPreviewHost()
    || isStaticPagesHost();
}

function isLocalStaticPreviewHost() {
  if (API_BASE_URL) {
    return false;
  }

  const localHosts = ["127.0.0.1", "localhost", "::1"];
  return localHosts.includes(window.location.hostname) && window.location.port !== "4173";
}

function isStaticPagesHost() {
  if (API_BASE_URL) {
    return false;
  }

  return ["gitgreen.me", "www.gitgreen.me", "charlo-o.github.io"].includes(window.location.hostname);
}

function cleanTitle(value) {
  return typeof value === "string" ? value.trim().slice(0, 64) : "";
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  const summary = text.replace(/\s+/g, " ").trim().slice(0, 120);
  throw new Error(
    response.status === 405
      ? t("backendUnavailableDetail")
      : `Unexpected response from server: ${summary || response.statusText}`
  );
}

applyLanguage();
setZoom(zoom);
