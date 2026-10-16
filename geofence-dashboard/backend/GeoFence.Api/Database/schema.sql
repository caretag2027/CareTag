CREATE TABLE IF NOT EXISTS devices (
    id BIGSERIAL PRIMARY KEY,
    external_key VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(128) NOT NULL,
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gsm_packets (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    packet_type VARCHAR(40) NOT NULL,
    captured_at_utc TIMESTAMPTZ NOT NULL,
    received_at_utc TIMESTAMPTZ NOT NULL,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    speed_kph DOUBLE PRECISION,
    heading_degrees DOUBLE PRECISION,
    accuracy_meters DOUBLE PRECISION,
    battery_percent INT,
    gps_enabled BOOLEAN,
    motion_state VARCHAR(32),
    routine_state VARCHAR(32),
    deviation_score NUMERIC(6,3),
    signal_rssi INT,
    raw_payload TEXT,
    correlation_id VARCHAR(80)
);

CREATE INDEX IF NOT EXISTS ix_gsm_packets_device_id_captured_at_utc
    ON gsm_packets(device_id, captured_at_utc DESC);

CREATE TABLE IF NOT EXISTS geofence_rules (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    label VARCHAR(120) NOT NULL,
    center_latitude NUMERIC(9,6) NOT NULL,
    center_longitude NUMERIC(9,6) NOT NULL,
    radius_meters INT NOT NULL,
    active_from TIME,
    active_to TIME,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_id, label)
);

CREATE TABLE IF NOT EXISTS activity_observations (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    activity_label VARCHAR(40) NOT NULL,
    captured_at_utc TIMESTAMPTZ NOT NULL,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    notes VARCHAR(500),
    source VARCHAR(40) NOT NULL DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS ix_activity_observations_device_id_captured_at_utc
    ON activity_observations(device_id, captured_at_utc DESC);
