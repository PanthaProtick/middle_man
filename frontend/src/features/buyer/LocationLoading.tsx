import './LocationLoading.css';

/** Shared feedback for buyer and seller location catalog requests. */
export function LocationLoading({ children }: { children: string }) {
  return (
    <span className="location-loading" role="status" aria-atomic="true">
      <svg className="location-loading-map" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path className="location-loading-route" d="M6 35h11c8 0 5-12 13-12h12" />
        <circle className="location-loading-traveller" cx="6" cy="35" r="3" />
        <g className="location-loading-pin">
          <path d="M34 16c0 7-10 14-10 14s-10-7-10-14a10 10 0 1 1 20 0Z" />
          <circle cx="24" cy="16" r="3" />
        </g>
      </svg>
      <strong>{children}</strong>
    </span>
  );
}
