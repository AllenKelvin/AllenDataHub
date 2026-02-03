import { User } from "./models/user";

export async function resetDailyTotals() {
  try {
    await User.updateMany({}, { $set: { totalOrdersToday: 0, totalGBSentToday: 0, totalSpentToday: 0 } });
    console.log("Daily totals reset to zero (GMT 00:00)");
  } catch (err) {
    console.error("Failed resetting daily totals:", err);
  }
}

export function startDailyReset() {
  // compute ms until next 00:00 GMT
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const nextMidnight = new Date(Date.UTC(utcYear, utcMonth, utcDate + 1, 0, 0, 0));
  const msUntil = nextMidnight.getTime() - now.getTime();

  setTimeout(() => {
    resetDailyTotals();
    setInterval(resetDailyTotals, 24 * 60 * 60 * 1000);
  }, msUntil);

  console.log(`Scheduled daily reset in ${msUntil}ms (next GMT midnight)`);
}
