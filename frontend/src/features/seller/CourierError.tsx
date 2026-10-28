import { useCourierText } from '../locale/courierCopy';
import { courierErrorText } from './courierErrorText';
import { SellerApiError } from './api';

// This evidence is only rendered beneath authenticated seller request results.
// Unknown source language is explicit; never normalize or translate identifiers/text.
export function OriginalCourierEvidence({ text }: { text?: string | null }) {
  const t = useCourierText();
  return text ? <details><summary>{t('View original evidence')}</summary><p lang="">{text}</p></details> : null;
}

export function CourierError({ error }: { error: Error }) {
  const t = useCourierText();
  return <>
    {courierErrorText(error instanceof SellerApiError ? error.code : null, t)}
    <OriginalCourierEvidence text={error.message} />
  </>;
}



