/**
 * Timezone and day-boundary helpers for consistent daily calculations
 * Uses user/profile timezone or defaults to UTC
 */

/**
 * Get the timezone for a given profile or user
 * Priority: user.preferred_timezone > profile timezone > 'UTC'
 */
export async function getProfileTimezone(base44, profileId, userEmail) {
  if (!profileId && !userEmail) return 'UTC';
  
  // Try to get user timezone
  if (userEmail) {
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
      if (users[0]?.preferred_timezone) return users[0].preferred_timezone;
    } catch {}
  }
  
  // Default to UTC for now (can be extended to profile-level timezone later)
  return 'UTC';
}

/**
 * Get start and end timestamps for "today" in a given timezone
 * Returns { startMs, endMs, dateString }
 */
export function getTodayBoundaries(timezone = 'UTC') {
  const now = new Date();
  
  // For UTC, simple day boundary
  if (timezone === 'UTC') {
    const dateStr = now.toISOString().slice(0, 10);
    const startMs = new Date(`${dateStr}T00:00:00.000Z`).getTime();
    const endMs = new Date(`${dateStr}T23:59:59.999Z`).getTime();
    return { startMs, endMs, dateString: dateStr };
  }
  
  // For other timezones, compute local midnight
  // Note: This is approximate - for production consider using date-fns-tz
  const utcOffset = getTimezoneOffsetMinutes(timezone);
  const localMidnight = new Date(now);
  localMidnight.setUTCHours(0, 0, 0, 0);
  localMidnight.setUTCMinutes(localMidnight.getUTCMinutes() - utcOffset);
  
  const startMs = localMidnight.getTime();
  const endMs = startMs + 86400000 - 1;
  const dateString = new Date(startMs).toISOString().slice(0, 10);
  
  return { startMs, endMs, dateString };
}

/**
 * Check if a timestamp falls within "today" for a given timezone
 */
export function isToday(timestampMs, timezone = 'UTC') {
  const { startMs, endMs } = getTodayBoundaries(timezone);
  return timestampMs >= startMs && timestampMs <= endMs;
}

/**
 * Get timezone offset in minutes (rough approximation)
 * For production, use Intl.DateTimeFormat or date-fns-tz
 */
function getTimezoneOffsetMinutes(timezone) {
  const offsetMap = {
    'Asia/Omsk': 360,       // UTC+6
    'Europe/Moscow': 180,   // UTC+3
    'America/New_York': -300, // UTC-5 (approx, ignores DST)
    'UTC': 0,
  };
  return offsetMap[timezone] || 0;
}