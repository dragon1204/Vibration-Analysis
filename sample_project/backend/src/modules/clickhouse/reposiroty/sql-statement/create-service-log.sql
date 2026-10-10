CREATE TABLE logging.service_log
(
    id UUID DEFAULT generateUUIDv4(),
    serviceName String,
    instance LowCardinality(String),
    env LowCardinality(String),
    source LowCardinality(String),
    meta String,
    recordedAt DateTime64(3),
    createdAt DateTime64(3) DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(createdAt)
ORDER BY (serviceName, createdAt);