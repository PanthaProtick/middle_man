/** Validate the seller entry point before choosing a Clerk or local tree. */
export function validateSessionConfiguration(
  publishableKey: string | undefined, production: boolean, publicPortal: boolean,
  deploymentEnvironment: string = '',
  appEnvironment: string = '',
): void {
  if (appEnvironment === 'hosted-development' && !publicPortal) {
    if (!/^pk_test_.+$/.test(publishableKey ?? '') || publishableKey?.includes('your_clerk')) {
      throw new Error('Hosted development seller sign-in requires a Clerk development publishable key.');
    }
    return;
  }
  if (production && deploymentEnvironment !== 'preview' && !publicPortal && !/^pk_live_.+$/.test(publishableKey ?? '')) {
    throw new Error('Production seller sign-in requires a Clerk production publishable key.');
  }
}
