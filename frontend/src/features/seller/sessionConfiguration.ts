/** Validate the seller entry point before choosing a Clerk or local tree. */
export function validateSessionConfiguration(
  publishableKey: string | undefined, production: boolean, publicPortal: boolean,
): void {
  if (production && !publicPortal && !/^pk_live_.+$/.test(publishableKey ?? '')) {
    throw new Error('Production seller sign-in requires a Clerk production publishable key.');
  }
}
