-- A single bounded row shared by every API instance using this schema.
CREATE TABLE public_admission (
    id smallint PRIMARY KEY CHECK (id = 1),
    expires_at timestamptz NOT NULL,
    requests bigint NOT NULL CHECK (requests > 0)
);
