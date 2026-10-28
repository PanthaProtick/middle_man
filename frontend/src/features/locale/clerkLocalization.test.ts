import type { ClerkProviderProps } from '@clerk/react';
import { describe, expect, it } from 'vitest';
import { clerkBengaliLocalization } from './clerkLocalization';

type ClerkLocalizationResource = NonNullable<ClerkProviderProps['localization']>;

function flatten(value: unknown, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([^}|]+?)(?:\|[^}]+)?\s*\}\}/g)]
    .map((match) => match[1])
    .sort();
}

/**
 * Placeholder names from the corresponding Clerk English resource. Clerk keeps
 * the parameter syntax inside the translated string while substituting the
 * runtime value.
 */
const ENGLISH_PLACEHOLDERS: Record<string, string[]> = {
  socialButtonsBlockButton: ['provider'],
  socialButtonsBlockButtonManyInView: ['provider'],
  'signIn.start.alternativePhoneCodeProvider.label': ['provider'],
  'signIn.start.alternativePhoneCodeProvider.subtitle': ['provider'],
  'signIn.start.alternativePhoneCodeProvider.title': ['provider'],
  'signIn.alternativePhoneCodeProvider.title': ['provider'],
  'signIn.alternativeMethods.blockButton__emailLink': ['identifier'],
  'signIn.alternativeMethods.blockButton__emailCode': ['identifier'],
  'signIn.alternativeMethods.blockButton__phoneCode': ['identifier'],
};

const REQUIRED_PATHS = [
  'formFieldLabel__emailAddress',
  'formFieldLabel__phoneNumber',
  'formFieldLabel__password',
  'formFieldInputPlaceholder__emailAddress',
  'formFieldInputPlaceholder__phoneNumber',
  'formFieldAction__forgotPassword',
  'formButtonPrimary',
  'formButtonPrimary__verify',
  'signIn.start.title',
  'signIn.start.actionLink__use_email',
  'signIn.start.actionLink__use_phone',
  'signIn.password.title',
  'signIn.password.actionLink',
  'signIn.forgotPassword.title',
  'signIn.forgotPassword.resendButton',
  'signIn.resetPassword.title',
  'signIn.resetPassword.successMessage',
  'signIn.emailCode.title',
  'signIn.emailCode.resendButton',
  'signIn.phoneCode.title',
  'signIn.phoneCode.resendButton',
  'signIn.emailLink.title',
  'signIn.emailLink.expired.title',
  'signIn.emailLink.loading.title',
  'signIn.alternativeMethods.title',
  'signIn.alternativeMethods.getHelp.title',
  'signIn.alternativeMethods.blockButton__password',
  'signIn.noAvailableMethods.title',
  'signIn.protectCheck.loading',
  'reverification.emailCode.title',
  'reverification.phoneCode.title',
  'unstable__errors.form_identifier_not_found',
  'unstable__errors.form_password_incorrect',
  'unstable__errors.form_code_incorrect',
  'unstable__errors.ticket_expired_code',
  'footerActionLink__useAnotherMethod',
  'footerPageLink__help',
  'footerPageLink__privacy',
  'footerPageLink__terms',
  'userButton.action__signOut',
];

const resource: ClerkLocalizationResource = clerkBengaliLocalization;
const entries = flatten(resource);
const resourcePaths = new Set(entries.map(([path]) => path));

describe('Bengali Clerk localization resource', () => {
  it('provides non-empty Bengali copy for sign-in, verification, recovery, and error paths', () => {
    expect(entries.length).toBeGreaterThan(60);
    for (const [path, value] of entries) {
      expect(value.trim(), `${path} should not be empty`).not.toBe('');
    }
    for (const path of REQUIRED_PATHS) {
      expect(resourcePaths.has(path), `${path} should be supplied`).toBe(true);
    }
  });

  it('preserves every Clerk parameter placeholder used by the English resource', () => {
    for (const [path, value] of entries) {
      const expected = ENGLISH_PLACEHOLDERS[path] ?? [];
      expect(placeholders(value), `${path} placeholders`).toEqual([...expected].sort());
    }
    for (const path of Object.keys(ENGLISH_PLACEHOLDERS)) {
      expect(resourcePaths.has(path), `${path} should be supplied`).toBe(true);
    }
  });
});
