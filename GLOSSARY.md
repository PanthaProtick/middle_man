# F-Commerce Order Confirmation

Language for collecting delivery advances and confirming chat-negotiated orders.

## Language

**Phase 1 self-test**:
A private exercise in which the project owner acts as seller and buyer using synthetic orders and payment evidence. It does not involve real seller operations or establish pilot readiness.

**Buyer link**:
An order-specific link whose possession permits viewing public order terms and status and making the initial buyer submission. It does not establish the holder's identity or grant seller authority or access to private buyer details and evidence.

**Delivery advance**:
_Bengali_: ডেলিভারির আগে অগ্রিম

A payment collected before dispatch toward the agreed order total, leaving a remaining amount payable on delivery.

**Order total**:
The final amount agreed between seller and buyer, including delivery charges where applicable.
_Avoid_: Product price (when referring to the entire amount due)

**Remaining COD balance**:
_Bengali_: ডেলিভারির সময় বাকি পরিশোধ

The amount still payable on delivery: the agreed order total minus the advance actually accepted by the seller.

**Confirmed order**:
_Bengali_: নিশ্চিত করা অর্ডার

An order the seller has accepted, including acceptance of its delivery advance. Confirmation alone does not mean a payment provider independently verified receipt.
_Avoid_: Verified order

**Seller transaction record**:
Details of a received payment supplied by the seller, primarily from an incoming payment SMS or manually from the seller's payment app.

**Buyer payment proof**:
_Bengali_: ক্রেতার দেওয়া পেমেন্টের তথ্য
_UI label_: English surfaces use "payment claim" (buyer-facing) or "claim" (seller-facing comparison column). Bengali buyer-facing copy uses the neutral "পেমেন্টের তথ্য"; seller-facing correction labels use "পেমেন্টের দাবি".

The buyer's submitted payment details: provider, transaction ID, sender number, and claimed amount. It is a claim of payment, not independent evidence of receipt by the seller.

**Buyer contact number**:
The phone number supplied for contacting the buyer about the order or delivery. It need not be the number used to send the advance.

**Payment sender number**:
The number of the payment account used to send the delivery advance. The buyer supplies it separately from their contact number, including when another person pays on their behalf.

**Payment match**:
Agreement between a buyer's payment claim and a received-payment record belonging to the same shop and designated receiving account. It includes both TrxID and payment sender number, alongside the provider and amount checks; it does not independently prove receipt through the payment provider.

**Review assistant**:
An advisory aid that explains an unresolved order review and suggests a corrective action using the order and directly related records belonging to the same shop. Its advice is not payment verification or a seller decision.

**Courier draft**:
_Bengali_: কুরিয়ার অনুরোধের খসড়া

A proposed delivery request prepared in Middle Man when an order is confirmed, awaiting seller review and submission. It is not a booking with the courier.

**Pathao booking**:
A delivery request accepted by Pathao under the seller's own merchant account, with a consignment ID identifying the request.

**Pickup store**:
A location registered under the seller's Pathao merchant account from which parcels are to be collected.
