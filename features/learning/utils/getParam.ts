/** Expo Router search params may be `string | string[]`; take the first value. */
export function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
