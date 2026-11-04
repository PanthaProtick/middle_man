import { useId, type Ref } from 'react';
import type { PaymentAccount } from './types';

interface Props {
  accounts: PaymentAccount[];
  label: string;
  placeholder: string;
  name: string;
  value: string;
  disabled: boolean;
  invalid: boolean;
  inputRef?: Ref<HTMLSelectElement>;
  onChange: (value: string) => void;
}

export function AssistantAccountSelect({ accounts, label, placeholder, name, value,
  disabled, invalid, inputRef, onChange }: Props): React.JSX.Element {
  const id = useId();
  const activeAccounts = accounts.filter(account => account.is_active);
  const selected = activeAccounts.find(account => account.id === value);
  return <div className="assistant-account-select">
    <label htmlFor={id}>{label}</label>
    <select id={id} ref={inputRef} name={name} value={value} disabled={disabled}
      aria-invalid={invalid} aria-describedby={selected ? `${id}-details` : undefined}
      onChange={event => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {activeAccounts.map(account => <option key={account.id} value={account.id}>
        {account.provider} · {account.receiving_number}
      </option>)}
    </select>
    {selected && <p id={`${id}-details`} className="assistant-account-details">
      {selected.label} · {selected.provider} · <span className="assistant-numeric">{selected.receiving_number}</span>
    </p>}
  </div>;
}
