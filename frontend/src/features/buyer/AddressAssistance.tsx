import { useEffect, useRef, useState } from 'react';

const fields = ['district', 'thana', 'area', 'street_line', 'landmark'] as const;
type AddressField = typeof fields[number];
type Suggestions = Record<AddressField, string | null> & { needs_clarification: boolean; clarification_question: string | null };
type Review = { source: string; token: string; values: Suggestions };

function parseSuggestions(value: unknown): Suggestions {
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
  return result as Suggestions;
}

interface Props {
  portalToken: string;
  address: string;
  onUse: (value: string) => void;
  disabled: boolean;
}

export function AddressAssistance({ portalToken, address, onUse, disabled }: Props) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const mutation = useRef<{ source: string; token: string; key: string } | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, [address, portalToken, disabled]);
  const visibleReview = review?.source === address && review.token === portalToken && !disabled ? review : null;

  async function requestSuggestions() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    if (mutation.current?.source !== address || mutation.current.token !== portalToken) {
      mutation.current = { source: address, token: portalToken, key: crypto.randomUUID() };
    }
    const timeout = window.setTimeout(() => request.abort(), 10000);
    setLoading(true); setError(''); setReview(null);
    try {
      const response = await fetch(`/api/public/orders/${encodeURIComponent(portalToken)}/address-extraction`, {
        method: 'POST', signal: request.signal,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': mutation.current.key },
        body: JSON.stringify({ raw_text: address, ai_opt_in: true }),
      });
      if (!response.ok) throw new Error('Assistance unavailable');
      const values = parseSuggestions(await response.json());
      if (!request.signal.aborted) setReview({ source: address, token: portalToken, values });
    } catch {
      if (controller.current === request) setError('Address assistance unavailable. Enter your address manually. Retry uses the same request key.');
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === request) setLoading(false);
    }
  }

  return <section aria-label="Optional address assistance" style={{ marginBottom: 16 }}>
    <p>Optional: send only your address text to Google Gemini for suggestions. Our raw request and response evidence is retained for up to 30 days from collection. Google processes it under the configured service terms. Review suggestions before use; you can always enter your address manually.</p>
    <button type="button" disabled={disabled || loading || !address.trim()} onClick={() => { void requestSuggestions(); }}>
      {loading ? 'Getting suggestions…' : 'Send address to Gemini (I agree)'}
    </button>
    {loading && <p role="status">You can keep editing or submit manually while assistance loads.</p>}
    {error && <p role="alert">{error}</p>}
    {visibleReview && <fieldset>
      <legend>Review and edit suggestions</legend>
      {fields.map(field => <label key={field} style={{ display: 'block' }}>{field.replace('_', ' ')}
        <input aria-label={`Suggested ${field}`} value={visibleReview.values[field] ?? ''}
          maxLength={field === 'street_line' || field === 'landmark' ? 200 : 100}
          onChange={event => setReview({ ...visibleReview, values: { ...visibleReview.values, [field]: event.target.value || null } })} />
      </label>)}
      {visibleReview.values.clarification_question && <p>{visibleReview.values.clarification_question}</p>}
      <button type="button" onClick={() => {
        const value = (['street_line', 'area', 'thana', 'district', 'landmark'] as const)
          .map(field => visibleReview.values[field]?.trim()).filter(Boolean).join(', ');
        if (value) { onUse(value); setReview(null); }
      }}>Use reviewed suggestions</button>
      <button type="button" onClick={() => setReview(null)}>Keep manual address</button>
    </fieldset>}
  </section>;
}
