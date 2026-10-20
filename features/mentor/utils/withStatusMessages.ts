import { ApiError } from "../../../lib/api";

/**
 * Settles like `promise`, except that an `ApiError` whose status is in
 * `messages` rejects with that friendly message instead. The mentor
 * endpoints' error details aren't in the response envelope, so without this
 * the user would only see "Request failed with status …".
 */
export async function withStatusMessages<T>(
  promise: Promise<T>,
  messages: Readonly<Record<number, string>>,
): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof ApiError && messages[err.status]) {
      throw new ApiError(messages[err.status], err.status);
    }
    throw err;
  }
}
