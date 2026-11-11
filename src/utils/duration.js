const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** '15m' -> 900000. Throws on anything unexpected. */
export function parseDuration(value) {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  return Number(match[1]) * UNITS[match[2]];
}
