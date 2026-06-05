import { execFile } from "node:child_process";
import { promisify } from "node:util";

const GRAPHQL_URL = "https://api.github.com/graphql";
const REST_USER_URL = "https://api.github.com/users/";
const execFileAsync = promisify(execFile);

const USER_QUERY = `
query UserBasics($login: String!) {
  user(login: $login) {
    login
    name
    avatarUrl
    url
    createdAt
    contributionsCollection {
      contributionYears
    }
  }
}
`;

const YEAR_QUERY = `
query YearContributions($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          firstDay
          contributionDays {
            date
            contributionCount
            contributionLevel
            color
            weekday
          }
        }
      }
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalRepositoryContributions
      restrictedContributionsCount
    }
  }
}
`;

export async function fetchGithubContributionData({
  login,
  token,
  fromYear,
  toYear,
  onProgress
}) {
  const basics = await graphql(token, USER_QUERY, { login });
  const user = basics.user;

  if (!user) {
    throw new Error(`GitHub user not found: ${login}`);
  }

  const joinedYear = new Date(user.createdAt).getUTCFullYear();
  const currentYear = new Date().getFullYear();
  const startYear = fromYear ?? joinedYear;
  const endYear = toYear ?? currentYear;

  if (startYear < joinedYear) {
    throw new Error(`--from-year cannot be earlier than the account creation year (${joinedYear}).`);
  }

  if (endYear < startYear) {
    throw new Error("--to-year must be greater than or equal to --from-year.");
  }

  const years = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const from = `${year}-01-01T00:00:00Z`;
    const isPartial = year === currentYear;
    const to = isPartial ? new Date().toISOString() : `${year}-12-31T23:59:59Z`;

    const yearly = await graphql(token, YEAR_QUERY, { login, from, to });
    const collection = yearly.user?.contributionsCollection;
    if (!collection) {
      throw new Error(`Could not read contributions for ${year}.`);
    }

    const normalized = normalizeYear(year, from, to, isPartial, collection);
    years.push(normalized);
    onProgress?.(year, normalized.totalContributions);
  }

  return {
    source: "graphql",
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
    url: user.url,
    createdAt: user.createdAt,
    contributionYears: user.contributionsCollection.contributionYears,
    generatedAt: new Date().toISOString(),
    years
  };
}

export async function fetchPublicGithubContributionData({
  login,
  fromYear,
  toYear,
  onProgress
}) {
  const user = await fetchPublicUser(login);
  const joinedYear = new Date(user.created_at).getUTCFullYear();
  const currentYear = new Date().getFullYear();
  const startYear = fromYear ?? joinedYear;
  const endYear = toYear ?? currentYear;

  if (startYear < joinedYear) {
    throw new Error(`--from-year cannot be earlier than the account creation year (${joinedYear}).`);
  }

  if (endYear < startYear) {
    throw new Error("--to-year must be greater than or equal to --from-year.");
  }

  const years = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const isPartial = year === currentYear;
    const html = await fetchPublicContributionHtml(user.login, year);
    const normalized = normalizePublicYear(year, isPartial, html);
    years.push(normalized);
    onProgress?.(year, normalized.totalContributions);
  }

  return {
    source: "public",
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    url: user.html_url,
    createdAt: user.created_at,
    generatedAt: new Date().toISOString(),
    years
  };
}

export async function fetchAvatarDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch avatar: HTTP ${response.status}`);
  }

  const mimeType = response.headers.get("content-type") ?? "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export function normalizeGithubLogin(value) {
  if (!value) {
    return undefined;
  }

  const trimmed = String(value).trim();
  const urlMatch = trimmed.match(/^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/?/i);
  const login = urlMatch ? urlMatch[1] : trimmed.replace(/^@/, "");

  if (!/^[A-Za-z0-9-]+$/.test(login)) {
    throw new Error(`Invalid GitHub username or profile URL: ${value}`);
  }

  return login;
}

async function graphql(token, query, variables) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ? `: ${body.message}` : "";
    throw new Error(`GitHub API request failed with HTTP ${response.status}${message}`);
  }

  if (body?.errors?.length) {
    throw new Error(body.errors.map((error) => error.message).join("; "));
  }

  return body.data;
}

async function fetchPublicUser(login) {
  const response = await fetchWithRetry(`${REST_USER_URL}${encodeURIComponent(login)}`, {
    headers: {
      "User-Agent": "github-contrib-poster",
      Accept: "application/vnd.github+json"
    }
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ? `: ${body.message}` : "";
    throw new Error(`GitHub public user request failed with HTTP ${response.status}${message}`);
  }

  return body;
}

async function fetchPublicContributionHtml(login, year) {
  const params = new URLSearchParams({
    from: `${year}-12-01`,
    to: `${year}-12-31`
  });
  const url = `https://github.com/users/${encodeURIComponent(login)}/contributions?${params}`;
  const options = {
    headers: {
      "User-Agent": "github-contrib-poster",
      Accept: "text/html"
    }
  };

  if (process.platform === "win32") {
    try {
      return await fetchTextWithWindowsPowerShell(url, "text/html");
    } catch (error) {
      console.warn(`PowerShell fetch failed for ${url}: ${error.message}`);
    }
  }

  return fetchTextWithFetch(url, options);
}

async function fetchTextWithFetch(url, options) {
  const response = await fetchWithRetry(url, options);

  if (!response.ok) {
    throw new Error(`GitHub public contributions request failed with HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchTextWithWindowsPowerShell(url, accept) {
  const script = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$ProgressPreference = 'SilentlyContinue'",
    "$url = $env:GITGREEN_FETCH_URL",
    "$accept = $env:GITGREEN_FETCH_ACCEPT",
    "$headers = @{ 'User-Agent' = 'github-contrib-poster'; 'Accept' = $accept }",
    "$response = Invoke-WebRequest -Uri $url -UseBasicParsing -Headers $headers",
    "if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 300) { throw \"HTTP $($response.StatusCode)\" }",
    "[Console]::Out.Write($response.Content)"
  ].join("; ");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      env: {
        ...process.env,
        GITGREEN_FETCH_URL: url,
        GITGREEN_FETCH_ACCEPT: accept
      },
      maxBuffer: 10 * 1024 * 1024
    }
  );
  return stdout;
}

async function fetchWithRetry(url, options, attempts = 5) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500 || attempt === attempts) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      console.warn(`Fetch attempt ${attempt}/${attempts} failed for ${url}: ${error.message}`);
      if (attempt === attempts) {
        break;
      }
    }

    await delay(650 * attempt);
  }

  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeYear(year, from, to, isPartial, collection) {
  const calendar = collection.contributionCalendar;
  const weeks = calendar.weeks.map((week) => ({
    firstDay: week.firstDay,
    contributionDays: week.contributionDays.map((day) => ({
      date: day.date,
      contributionCount: day.contributionCount,
      contributionLevel: day.contributionLevel,
      color: day.color,
      weekday: day.weekday
    }))
  }));

  const days = weeks.flatMap((week) => week.contributionDays);
  const activeDays = days.filter((day) => day.contributionCount > 0).length;
  const maxDay = days.reduce(
    (best, day) =>
      day.contributionCount > best.contributionCount ? day : best,
    { date: null, contributionCount: 0 }
  );

  return {
    year,
    from,
    to,
    isPartial,
    totalContributions: calendar.totalContributions,
    totalCommitContributions: collection.totalCommitContributions,
    totalIssueContributions: collection.totalIssueContributions,
    totalPullRequestContributions: collection.totalPullRequestContributions,
    totalPullRequestReviewContributions: collection.totalPullRequestReviewContributions,
    totalRepositoryContributions: collection.totalRepositoryContributions,
    restrictedContributionsCount: collection.restrictedContributionsCount,
    activeDays,
    maxDay,
    weeks,
    days
  };
}

function normalizePublicYear(year, isPartial, html) {
  const parsedDays = parsePublicContributionDays(html);
  const days = parsedDays.filter((day) => day.date.startsWith(`${year}-`));
  const weeks = groupDaysIntoWeeks(days);
  const totalContributions = days.reduce(
    (sum, day) => sum + day.contributionCount,
    0
  );
  const activeDays = days.filter((day) => day.contributionCount > 0).length;
  const maxDay = days.reduce(
    (best, day) =>
      day.contributionCount > best.contributionCount ? day : best,
    { date: null, contributionCount: 0 }
  );
  const currentYear = new Date().getFullYear();
  const to = isPartial
    ? new Date().toISOString()
    : `${year}-12-31T23:59:59Z`;

  return {
    year,
    from: `${year}-01-01T00:00:00Z`,
    to,
    isPartial: year === currentYear,
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
    weeks,
    days
  };
}

function parsePublicContributionDays(html) {
  const tooltipCounts = new Map();
  const tooltipMatches = html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g);

  for (const match of tooltipMatches) {
    const attrs = parseAttributes(match[1]);
    if (!attrs.for) {
      continue;
    }
    tooltipCounts.set(attrs.for, parseContributionCount(stripTags(match[2])));
  }

  const days = [];
  const dayMatches = html.matchAll(/<td\b([^>]*\bContributionCalendar-day\b[^>]*)>/g);

  for (const match of dayMatches) {
    const attrs = parseAttributes(match[1]);
    const date = attrs["data-date"];
    if (!date) {
      continue;
    }

    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const level = Number(attrs["data-level"] ?? 0);
    days.push({
      date,
      contributionCount: tooltipCounts.get(attrs.id) ?? 0,
      contributionLevel: publicLevelName(level),
      color: null,
      weekday
    });
  }

  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function parseContributionCount(value) {
  if (/no contributions/i.test(value)) {
    return 0;
  }

  const match = value.match(/([\d,]+)\s+contribution/i);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
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

function parseAttributes(value) {
  const attrs = {};
  const matches = value.matchAll(/([:\w-]+)="([^"]*)"/g);
  for (const match of matches) {
    attrs[match[1]] = decodeHtml(match[2]);
  }
  return attrs;
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function publicLevelName(level) {
  return ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"][level] ?? "NONE";
}
