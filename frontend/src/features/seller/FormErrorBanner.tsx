import { AlertCircle } from 'lucide-react';

export function FormErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        padding: '10px 14px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '6px',
        color: 'var(--rose-accent)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        fontSize: '0.875rem',
      }}
    >
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  );
}
