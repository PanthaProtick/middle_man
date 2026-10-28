import { AlertCircle } from 'lucide-react';

export function WorkspaceErrorBanner({ message }: { message: string }): React.JSX.Element {
  return <div id="workspace-error" role="alert" style={{ margin: '16px 0', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: 'var(--rose-accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
    <AlertCircle size={18} />
    <span>{message}</span>
  </div>;
}
