import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PaymentAccount, SellerOrder } from './types';
import { createOrder } from './api';
import { useLocale } from '../locale/context';
import { orderCreationCopy, type CreationMessage } from '../locale/orderCreationCopy';
import { orderAmountMinor } from './orderNumbers';
import { useEarlyParcelDetails } from './useEarlyParcelDetails';
import { orderCreationError } from './orderCreationError';

export interface CreateOrderModalProps {
  accounts: PaymentAccount[];
  token?: string;
  onClose: () => void;
  onOrderCreated: (order: SellerOrder) => void;
  onError: (msg: { code: string }) => void;
}

export function useOrderCreation({ accounts, token, onClose, onOrderCreated, onError }: CreateOrderModalProps) {
  const { locale } = useLocale();
  const text = orderCreationCopy[locale];
  const formRef = useRef<HTMLFormElement>(null);
  const activeAccounts = accounts.filter((a) => a.is_active);

  const [productName, setProductName] = useState('');
  const [totalBdt, setTotalBdt] = useState('');
  const [advanceBdt, setAdvanceBdt] = useState('');
  const parcel = useEarlyParcelDetails();
  const [selectedAccountId, setSelectedAccountId] = useState(
    activeAccounts.length > 0 ? activeAccounts[0].id : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<CreationMessage | null>(null);
  const [validationField, setValidationField] = useState<string | null>(null);

  useEffect(() => {
    if (!submitting && validationField) {
      formRef.current?.querySelector<HTMLElement>(`[name="${validationField}"]`)?.focus();
    }
  }, [submitting, validationField, validationError]);

  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const productInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const closeCallback = useRef(onClose);
  useEffect(() => { closeCallback.current = onClose; }, [onClose]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    productInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        closeCallback.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  const totalNum = orderAmountMinor(totalBdt);
  const advanceNum = orderAmountMinor(advanceBdt);
  const expectedCod = Math.max(0, (totalNum ?? 0) - (advanceNum ?? 0));

  function invalid(code: CreationMessage, name: string) {
    setValidationError(code);
    setValidationField(name);
    formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setValidationError(null);
    setValidationField(null);

    const trimmedProduct = productName.trim();
    if (!trimmedProduct) {
      invalid('productRequired', 'productName');
      return;
    }
    if (Array.from(trimmedProduct).length > 200) { invalid('productLimit', 'productName'); return; }
    if (totalNum === null) {
      invalid('totalInvalid', 'totalBdt');
      return;
    }
    if (advanceNum === null) {
      invalid('advanceInvalid', 'advanceBdt');
      return;
    }
    if (advanceNum > totalNum) {
      invalid('advanceExceeds', 'advanceBdt');
      return;
    }
    if (!selectedAccountId) {
      invalid('accountRequired', 'paymentAccountId');
      return;
    }
    const parcelValues = parcel.validate();
    if (!parcelValues) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const order = await createOrder(
        {
          product_name: trimmedProduct,
          total_minor: totalNum,
          required_advance_minor: advanceNum,
          payment_account_id: selectedAccountId,
          ...parcelValues,
        },
        idempotencyKeyRef.current,
        token,
      );
      idempotencyKeyRef.current = crypto.randomUUID();
      onOrderCreated(order);
      onClose();
    } catch (err) {
      const failure = orderCreationError(err);
      if (failure.name) invalid(failure.message, failure.name);
      else setValidationError(failure.message);
      onError({ code: failure.code });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  function errorProps(name: string) {
    return { 'aria-invalid': validationField === name,
      'aria-describedby': validationField === name ? 'create-order-error' : undefined };
  }
  return { text, formRef, activeAccounts, productName, setProductName, totalBdt, setTotalBdt,
    advanceBdt, setAdvanceBdt, parcel, selectedAccountId, setSelectedAccountId, submitting,
    validationError, validationField, productInputRef, expectedCod, handleSubmit, errorProps };
}
