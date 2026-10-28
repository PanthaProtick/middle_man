import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../locale';
import { addressAssistanceCopy } from '../locale/addressAssistanceCopy';
import type { Locale } from '../locale/storage';

const fields = ['district', 'thana', 'area', 'street_line', 'landmark'] as const;
type AddressField = typeof fields[number];
type Suggestions = Record<AddressField, string | null> & { needs_clarification: boolean; clarification_question: string | null };
type Review = { source: string; token: string; values: Suggestions; language: Locale | null };


function parseSuggestions(value: unknown): { values: Suggestions; language: Locale | null } {
  if (!value || typeof value !== 'object') throw new Error('Invalid suggestions');
  const body = value as Record<string, unknown>;
  if (body.available !== true || body.review_required !== true || !body.suggestions || typeof body.suggestions !== 'object') throw new Error('Unavailable');
  const result = body.suggestions as Record<string, unknown>;
  if (typeof result.needs_clarification !== 'boolean') throw new Error('Invalid clarification flag');
  for (const field of [...fields, 'clarification_question']) {
    const text = result[field];
    const max = field === 'clarification_question' ? 500 : field === 'street_line' || field === 'landmark' ? 200 : 100;
    if (text !== null && (typeof text !== 'string' || text.length > max)) throw new Error('Invalid field');
  }
  return { values: result as Suggestions, language: body.explanation_language === 'bn' || body.explanation_language === 'en' ? body.explanation_language : null };
}

interface Props { portalToken: string; address: string; onUse: (value: string) => void; disabled: boolean }

export function AddressAssistance({ portalToken, address, onUse, disabled }: Props) {
  const { locale } = useLocale();
  const text = addressAssistanceCopy[locale];
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState<boolean | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mutation = useRef<{ source: string; token: string; key: string } | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, [address, portalToken, disabled]);
  const visibleReview = review?.source === address && review.token === portalToken && !disabled ? review : null;

  async function requestSuggestions() {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    if (mutation.current?.source !== address || mutation.current.token !== portalToken) mutation.current = { source: address, token: portalToken, key: crypto.randomUUID() };
    const timeout = window.setTimeout(() => request.abort(), 10000);
    setLoading(true); setError(null); setReview(null); setShowOriginal(null);
    try {
      const response = await fetch(`/api/public/orders/${encodeURIComponent(portalToken)}/address-extraction`, {
        method: 'POST', signal: request.signal, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': mutation.current.key },
        body: JSON.stringify({ raw_text: address, ai_opt_in: true, language: locale }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
        const detail = data.error ?? data.detail;
        const code = detail && typeof detail === 'object' ? (detail as Record<string, unknown>).code : null;
        if (controller.current === request) setError(typeof code === 'string' ? code : 'UNKNOWN');
        return;
      }
      const result = parseSuggestions(await response.json());
      if (!request.signal.aborted) setReview({ source: address, token: portalToken, ...result });
    } catch {
      if (controller.current === request) setError('UNKNOWN');
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === request) setLoading(false);
    }
  }
  const errorText = error === 'ADDRESS_ASSISTANCE_LIMIT' ? text.limit : error === 'IDEMPOTENCY_KEY_REUSED' ? text.conflict : error === 'EXPIRED_SUBMISSION' || error === 'BUYER_LINK_REVOKED' || error === 'RECORD_UNAVAILABLE' || error === 'NOT_FOUND' ? text.expired : error === 'ORDER_ALREADY_SUBMITTED' ? text.submitted : text.unavailable;
  return <section lang={locale} aria-label={text.label} style={{ marginBottom: 16 }}>
    <p>{text.consent}</p>
    <button type="button" disabled={disabled || loading || !address.trim()} onClick={() => { void requestSuggestions(); }}>{loading ? text.loading : text.send}</button>
    {loading && <p role="status">{text.pending}</p>}
    {error && <p role="alert">{errorText}</p>}
    {visibleReview && <fieldset>
      <legend>{text.review}</legend>
      {fields.map(field => <label key={field} style={{ display: 'block' }}>{text[field]}
        <input value={visibleReview.values[field] ?? ''} maxLength={field === 'street_line' || field === 'landmark' ? 200 : 100}
          onChange={event => setReview({ ...visibleReview, values: { ...visibleReview.values, [field]: event.target.value || null } })} />
      </label>)}
      {visibleReview.values.clarification_question && <div>
        {visibleReview.language !== locale && <p>{text.originalNotice}</p>}
        <button type="button" aria-expanded={showOriginal ?? visibleReview.language === locale} onClick={() => setShowOriginal(!(showOriginal ?? visibleReview.language === locale))}>{(showOriginal ?? visibleReview.language === locale) ? text.hide : text.show}</button>
        {(showOriginal ?? visibleReview.language === locale) && <p lang={visibleReview.language ?? undefined}>{visibleReview.values.clarification_question}</p>}
      </div>}
      <button type="button" onClick={() => {
        const value = (['street_line', 'area', 'thana', 'district', 'landmark'] as const).map(field => visibleReview.values[field]?.trim()).filter(Boolean).join(', ');
        if (value) { onUse(value); setReview(null); }
      }}>{text.use}</button>
      <button type="button" onClick={() => setReview(null)}>{text.manual}</button>
    </fieldset>}
  </section>;
}
