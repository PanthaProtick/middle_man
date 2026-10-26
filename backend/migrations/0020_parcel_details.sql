-- Optional early parcel facts; a draft owns an editable copy with optimistic versioning.
ALTER TABLE orders
    ADD COLUMN parcel_weight_grams INTEGER,
    ADD COLUMN parcel_quantity INTEGER,
    ADD CONSTRAINT ck_orders_parcel_weight CHECK (parcel_weight_grams BETWEEN 1 AND 1000000),
    ADD CONSTRAINT ck_orders_parcel_quantity CHECK (parcel_quantity BETWEEN 1 AND 10000);

ALTER TABLE courier_drafts
    ADD COLUMN parcel_weight_grams INTEGER,
    ADD COLUMN parcel_quantity INTEGER,
    ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT ck_courier_drafts_parcel_weight CHECK (parcel_weight_grams BETWEEN 1 AND 1000000),
    ADD CONSTRAINT ck_courier_drafts_parcel_quantity CHECK (parcel_quantity BETWEEN 1 AND 10000),
    ADD CONSTRAINT ck_courier_drafts_version CHECK (version > 0);
