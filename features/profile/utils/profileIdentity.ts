/** The account fields Profile reads; mirrors the relevant slice of Clerk's user. */
export interface IdentitySource {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
}

const FALLBACK_DISPLAY_NAME = "Your account";

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function emailLocalPart(email: string | null | undefined): string {
  return clean(email).split("@")[0] ?? "";
}

/** First character of a word, by code point so non-Latin letters stay whole. */
function firstLetter(word: string): string {
  return Array.from(word)[0]?.toUpperCase() ?? "";
}

/**
 * The name Profile greets the user with: first name (as Home does), then the
 * full name, username, the email's local part, and finally a neutral label.
 */
export function getDisplayName(source: IdentitySource): string {
  return (
    clean(source.firstName) ||
    clean(source.fullName) ||
    clean(source.username) ||
    emailLocalPart(source.email) ||
    FALLBACK_DISPLAY_NAME
  );
}

/**
 * Up to two initials: first and last name ("Ada Lovelace" → "AL"), the first
 * and last words of the full name, or the first letter of the username or
 * email. Empty when none of those exist, so the avatar can show an icon.
 */
export function getInitials(source: IdentitySource): string {
  const names = [clean(source.firstName), clean(source.lastName)].filter(Boolean);
  const words = names.length > 0 ? names : clean(source.fullName).split(/\s+/).filter(Boolean);

  if (words.length > 0) {
    const ends = words.length === 1 ? words : [words[0], words[words.length - 1]];
    return ends.map(firstLetter).join("");
  }

  return firstLetter(clean(source.username) || emailLocalPart(source.email));
}
