export function createDemoData() {
  const currentYear = new Date().getFullYear();
  const startYear = 2018;
  const random = mulberry32(20260604);
  const years = [];

  for (let year = startYear; year <= currentYear; year += 1) {
    const isPartial = year === currentYear;
    const endDate = isPartial
      ? new Date()
      : new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    const days = buildDemoDays(year, endDate, random);
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

    years.push({
      year,
      from: `${year}-01-01T00:00:00Z`,
      to: endDate.toISOString(),
      isPartial,
      totalContributions,
      totalCommitContributions: Math.round(totalContributions * 0.76),
      totalIssueContributions: Math.round(totalContributions * 0.04),
      totalPullRequestContributions: Math.round(totalContributions * 0.13),
      totalPullRequestReviewContributions: Math.round(totalContributions * 0.06),
      totalRepositoryContributions: Math.max(1, Math.round(totalContributions / 280)),
      restrictedContributionsCount: 0,
      activeDays,
      maxDay,
      weeks,
      days
    });
  }

  return {
    login: "local-demo",
    name: "Local Demo",
    avatarUrl: null,
    avatarDataUrl: null,
    url: "https://github.com/local-demo",
    createdAt: `${startYear}-02-18T08:00:00Z`,
    generatedAt: new Date().toISOString(),
    years
  };
}

function buildDemoDays(year, endDate, random) {
  const days = [];
  const date = new Date(Date.UTC(year, 0, 1));
  const final = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate()
    )
  );
  const yearMomentum = Math.max(0.55, 1 + (year - 2020) * 0.1);

  while (date <= final) {
    const weekday = date.getUTCDay();
    const month = date.getUTCMonth();
    const weekdayBias = weekday === 0 || weekday === 6 ? 0.45 : 1;
    const seasonalBias = month >= 2 && month <= 9 ? 1.2 : 0.85;
    const burst = random() > 0.965 ? 18 + Math.floor(random() * 30) : 0;
    const active = random() < 0.58 * weekdayBias * seasonalBias;
    const base = active
      ? Math.floor((1 + random() * 8 + random() * 5) * yearMomentum)
      : 0;
    const contributionCount = Math.max(0, base + burst);

    days.push({
      date: toDateString(date),
      contributionCount,
      contributionLevel: "NONE",
      color: "#ebedf0",
      weekday
    });

    date.setUTCDate(date.getUTCDate() + 1);
  }

  return days;
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

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function mulberry32(seed) {
  return function next() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
