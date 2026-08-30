/**
 * Deterministic background colour for an initials avatar, in the style Gmail
 * uses for contacts without a photo.
 *
 * Derived from the whole name rather than just the first letter: hashing only
 * the initial would give every "A" the same colour, so a list of people whose
 * names start alike would come out as a block of one shade. Hashing the full
 * string spreads them out while staying stable — the same person is always the
 * same colour, on every device, with no state to store.
 *
 * All values are dark enough for white text to clear WCAG AA at the sizes
 * these avatars are drawn.
 */
const PALETTE = [
  "#1e88e5", // blue
  "#d81b60", // pink
  "#8e24aa", // purple
  "#00897b", // teal
  "#e53935", // red
  "#43a047", // green
  "#6d4c41", // brown
  "#3949ab", // indigo
  "#f4511e", // deep orange
  "#00838f", // cyan
  "#5e35b1", // deep purple
  "#2e7d32", // dark green
];

export const avatarColour = (seed: string): string => {
  const name = seed?.trim() || "?";

  // djb2. Cheap, stable, and spreads short strings well.
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i);
  }

  return PALETTE[Math.abs(hash) % PALETTE.length];
};
