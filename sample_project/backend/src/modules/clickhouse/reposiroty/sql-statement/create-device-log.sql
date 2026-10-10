CREATE TABLE logging.bms_device_log
(
    id UUID DEFAULT generateUUIDv4(),
    deviceType LowCardinality(String),
    featureCode LowCardinality(Nullable(String)),

    deviceId String,
    buildingId LowCardinality(Nullable(String)),
    
    attribute String,

    xCoordinate Float32,
    yCoordinate Float32,
    zCoordinate Nullable(Float32),

    createdAt DateTime64(3) DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(createdAt)
ORDER BY (deviceType, deviceId, createdAt);