# F-Commerce Order Confirmation

Language for collecting delivery advances and confirming chat-negotiated orders.

## Language

**Phase 1 self-test**:
A private exercise in which the project owner acts as seller and buyer using synthetic orders and payment evidence. It does not involve real seller operations or establish pilot readiness.

**Buyer link**:
An order-specific link whose possession permits viewing public order terms and status and making the initial buyer submission. It does not establish the holder's identity or grant seller authority or access to private buyer details and evidence.

**Delivery advance**:
A payment collected before dispatch toward the agreed order total, leaving a remaining amount payable on delivery.

**Order total**:
The final amount agreed between seller and buyer, including delivery charges where applicable.
_Avoid_: Product price (when referring to the entire amount due)

**Remaining COD balance**:
The amount still payable on delivery: the agreed order total minus the advance actually accepted by the seller.

**Confirmed order**:
An order the seller has accepted, including acceptance of its delivery advance. Confirmation alone does not mean a payment provider independently verified receipt.
_Avoid_: Verified order

**Seller transaction record**:
Details of a received payment supplied by the seller, primarily from an incoming payment SMS or manually from the seller's payment app.

**Buyer payment proof**:
The buyer's submitted payment details, optionally supported by a screenshot. It is a claim of payment, not independent evidence of receipt by the seller.

**Buyer contact number**:
The phone number supplied for contacting the buyer about the order or delivery. It need not be the number used to send the advance.

**Payment sender number**:
The number of the payment account used to send the delivery advance. The buyer supplies it separately from their contact number, including when another person pays on their behalf.

**Payment match**:
Agreement between a buyer's payment claim and a received-payment record belonging to the same shop and designated receiving account. It includes both TrxID and payment sender number, alongside the provider and amount checks; it does not independently prove receipt through the payment provider.
