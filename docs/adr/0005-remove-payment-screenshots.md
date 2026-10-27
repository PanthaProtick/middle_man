# Remove buyer payment screenshots

Buyers provide payment details as a claim; seller-supplied receipts and recorded
seller decisions continue to determine confirmation under ADR-0001. We remove
payment screenshot collection, private viewing, and Gemini payment extraction,
and permanently erase existing screenshot files, metadata, extraction records,
and upload replays rather than waiting for retention expiry. This reduces buyer
friction and private-data storage at the cost of losing a visual aid in disputes;
manual payment details, SMS reconciliation, address assistance, and development
screenshots remain in scope of the existing system.

Stop old application processes before the forward migration and file purge.
Filesystem deletion cannot be rolled back by PostgreSQL; verify the storage root
and retain retryable progress until files and database removal are both verified.
