import { useUser } from "@clerk/expo";
import { useMemo } from "react";

import type { ProfileIdentity } from "../types/profile";
import { getDisplayName, getInitials, type IdentitySource } from "../utils/profileIdentity";

/**
 * The signed-in Clerk user as the Profile header shows it. Clerk always has an
 * `imageUrl` (a generated default when none was set), so `hasImage` decides
 * whether there is a real photo or the initials should show instead.
 */
export function useProfileIdentity(): ProfileIdentity {
  const { user } = useUser();

  return useMemo(() => {
    const email = user?.primaryEmailAddress?.emailAddress ?? null;
    const source: IdentitySource = {
      firstName: user?.firstName,
      lastName: user?.lastName,
      fullName: user?.fullName,
      username: user?.username,
      email,
    };
    return {
      displayName: getDisplayName(source),
      initials: getInitials(source),
      email,
      imageUrl: user?.hasImage && user.imageUrl ? user.imageUrl : null,
    };
  }, [user]);
}
