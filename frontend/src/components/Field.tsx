import React from 'react';

export interface FieldProps {
  id?: string;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  id,
  label,
  helperText,
  error,
  required,
  className = '',
  children,
}: FieldProps): React.JSX.Element {
  const autoId = React.useId();
  const controlId = id ?? autoId;
  const errorId = error ? `${controlId}-error` : undefined;
  const helperId = helperText && !error ? `${controlId}-helper` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`mm-field ${className}`.trim()}>
      {label && (
        <label htmlFor={controlId} className="mm-field__label">
          {label}
          {required && <span aria-hidden="true" style={{ color: 'var(--color-status-rose)', marginLeft: 4 }}>*</span>}
        </label>
      )}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>, {
            id: (children.props as { id?: string }).id ?? controlId,
            'aria-describedby': (children.props as { 'aria-describedby'?: string })['aria-describedby'] ?? describedBy,
            'aria-invalid': (children.props as { 'aria-invalid'?: boolean })['aria-invalid'] ?? (Boolean(error) || undefined),
          })
        : children}
      {error && (
        <span id={errorId} role="alert" className="mm-field__error">
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={helperId} className="mm-field__helper">
          {helperText}
        </span>
      )}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...props },
  ref,
) {
  return <input ref={ref} className={`mm-field__control ${className}`.trim()} {...props} />;
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = '', children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={`mm-field__control ${className}`.trim()} {...props}>
      {children}
    </select>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = '', ...props },
  ref,
) {
  return <textarea ref={ref} className={`mm-field__control ${className}`.trim()} {...props} />;
});
