import { useState } from 'react';
import { LocaleProvider, LocaleSwitch } from '../../../frontend/src/features/locale';
import { BuyerCorrection } from '../../../frontend/src/features/seller/BuyerCorrection';
import { OrderOutcomes } from '../../../frontend/src/features/seller/OrderOutcomes';
import { OrderPaymentDetails } from '../../../frontend/src/features/seller/OrderPaymentDetails';
import { EvidenceResolution } from '../../../frontend/src/features/seller/EvidenceResolution';
import { BuyerLinkAccess } from '../../../frontend/src/features/seller/BuyerLinkAccess';
import { orders, account, receipt } from './data';

// Isolated production components expose conditional states without pretending to be
// an integrated journey. Real app captures remain separately named in the manifest.
export function Specimens({ scenario }: { scenario: string }) {
  const [order, setOrder] = useState(orders[1]);
  return <LocaleProvider><main className="container">
    <LocaleSwitch /><h1>Conditional baseline specimen</h1>
    {scenario === 'specimen-correction' && <BuyerCorrection orderId={order.id}
      token="synthetic-baseline-token" onCorrected={setOrder} />}
    {scenario === 'specimen-outcomes' && <OrderOutcomes order={order}
      token="synthetic-baseline-token" onUpdated={setOrder} onReplaced={setOrder} />}
    {scenario === 'specimen-payment' && <OrderPaymentDetails order={order}
      token="synthetic-baseline-token" onCorrected={setOrder} />}
    {scenario === 'specimen-evidence' && <EvidenceResolution receiptId={receipt.id}
      token="synthetic-baseline-token" accounts={[account]} onResolved={() => undefined} />}
    {scenario === 'specimen-link' && <BuyerLinkAccess order={order}
      token="synthetic-baseline-token" onUpdated={setOrder} />}
  </main></LocaleProvider>;
}
