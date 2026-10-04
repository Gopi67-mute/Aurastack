import { api, type GetToken } from "../../../lib/api";
import type { MomentumState } from "../types/progress";
import { getDeviceTimeZone } from "../utils/deviceTimeZone";

/**
 * The backend-authoritative Momentum/Streak state for the signed-in user.
 *
 * The device timezone is sent so the backend can turn each activity's stored
 * UTC timestamp into the right calendar day. The streak is never calculated
 * on the client.
 */
export async function getMomentum(getToken: GetToken): Promise<MomentumState> {
  const timezone = encodeURIComponent(getDeviceTimeZone());
  return api.get<MomentumState>(`/api/v1/momentum?timezone=${timezone}`, getToken);
}
