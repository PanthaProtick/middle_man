import { useEffect, useRef, type ReactNode } from 'react';

export function AssistantResult({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  const result = useRef<HTMLElement>(null);
  useEffect(() => { result.current?.focus({ preventScroll: true }); }, []);
  return <section ref={result} tabIndex={-1} aria-label={label} className="assistant-result">
    {children}
  </section>;
}
