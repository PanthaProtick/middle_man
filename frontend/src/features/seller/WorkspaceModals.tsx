import React from 'react';
import { CreateOrderModal } from './CreateOrderModal';
import { ManualTransactionModal } from './ManualTransactionModal';
import type { PaymentAccount, ReceiptView, SellerOrder } from './types';

interface WorkspaceModalsProps {
  isCreateModalOpen: boolean;
  isRecordModalOpen: boolean;
  manualAccountId?: string;
  accounts: PaymentAccount[];
  token: string;
  ordersSearch: string;
  ordersFilter: string | null;
  ordersDateRange: unknown;
  onCloseCreateModal: () => void;
  onCloseRecordModal: () => void;
  onAddOrder: (newOrder: SellerOrder) => void;
  onReloadOrders: () => void;
  onTransactionRecorded: (tx: ReceiptView) => void;
  onError: (error: string | { code: string } | null) => void;
}

export function WorkspaceModals({
  isCreateModalOpen,
  isRecordModalOpen,
  manualAccountId,
  accounts,
  token,
  ordersSearch,
  ordersFilter,
  ordersDateRange,
  onCloseCreateModal,
  onCloseRecordModal,
  onAddOrder,
  onReloadOrders,
  onTransactionRecorded,
  onError,
}: WorkspaceModalsProps): React.JSX.Element | null {
  return (
    <>
      {isCreateModalOpen && (
        <CreateOrderModal
          accounts={accounts}
          token={token}
          onClose={onCloseCreateModal}
          onOrderCreated={(newOrder) => {
            if (ordersSearch.trim() || ordersFilter || ordersDateRange) onReloadOrders();
            else onAddOrder(newOrder);
          }}
          onError={onError}
        />
      )}

      {isRecordModalOpen && (
        <ManualTransactionModal
          initialAccountId={manualAccountId}
          accounts={accounts}
          token={token}
          onClose={onCloseRecordModal}
          onTransactionRecorded={onTransactionRecorded}
          onError={onError}
        />
      )}
    </>
  );
}
