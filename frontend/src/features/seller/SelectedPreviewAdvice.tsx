import { paymentReason } from '../locale/paymentExceptionCopy';
import type { Locale } from '../locale/storage';
import type { ReviewAssistanceResponse } from './reviewAssistanceApi';
import { formatBdt } from '../locale/format';
import { selectedPreviewCopy } from '../locale/selectedPreviewCopy';

export function SelectedPreviewAdvice({ assistance, locale }: {
  assistance: ReviewAssistanceResponse; locale: Locale;
}): React.JSX.Element {
  const text = selectedPreviewCopy[locale];
  const blockers = assistance.preview_blockers ?? [];
  return <section aria-label={text.scope}>
    <p>{text.intro}</p>
    <ul>{(assistance.preview_conditions ?? []).map(code => <li key={code}>
      {paymentReason(code, locale)}
    </li>)}</ul>
    {assistance.facts.total_minor !== undefined && <p>
      {text.total}: {formatBdt(assistance.facts.total_minor)}
    </p>}
    <p>{blockers.length ? text.blocked : text.decision}</p>
  </section>;
}
