const FALLBACK_TIME_ZONE = "UTC";

/**
 * The device's IANA timezone, e.g. "Asia/Kolkata".
 *
 * The backend resolves every activity's calendar day against this, so the
 * streak follows the user's own midnight rather than the server's. Falls back
 * to UTC on any runtime without a resolvable zone, which the backend also
 * accepts, so Momentum still loads.
 */
export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}
