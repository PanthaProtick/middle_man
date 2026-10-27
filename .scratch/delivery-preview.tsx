import React from 'react';
import { createRoot } from 'react-dom/client';
import { CourierWorkspace } from '/src/features/seller/CourierWorkspace';
import { BuyerLinkAccess } from '/src/features/seller/BuyerLinkAccess';
import '/src/index.css';
import '/src/features/seller/BuyerCorrection.css';
import '/src/features/seller/OrderDetailModal.css';
createRoot(document.getElementById('root')).render(<main className="order-detail-dialog"><CourierWorkspace orderId="preview" token="synthetic" /><BuyerLinkAccess order={{id:'preview',version:1,lifecycle:'confirmed'}} token="synthetic" onUpdated={()=>{}} /></main>);
