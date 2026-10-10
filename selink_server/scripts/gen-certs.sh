#!/bin/sh
# Generate a private CA and the EMQX server certificate (once). Run by the "certs"
# compose service, or manually: CERT_DIR=./emqx/certs MQTT_HOST=iot.example.vn sh scripts/gen-certs.sh
# Copy ca.pem to each gateway: /etc/edge-agent/ca.pem
set -e
DIR=${CERT_DIR:-/certs}
HOST=${MQTT_HOST:-localhost}
mkdir -p "$DIR"
if [ -f "$DIR/server.pem" ]; then
  echo "certificates already exist in $DIR"
  exit 0
fi
command -v openssl >/dev/null 2>&1 || apk add --no-cache openssl >/dev/null
cd "$DIR"
openssl req -x509 -newkey rsa:3072 -nodes -days 3650 -keyout ca.key -out ca.pem -subj "/CN=SmartMotor CA"
openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj "/CN=$HOST"
printf "subjectAltName=DNS:%s,DNS:localhost,DNS:emqx,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n" "$HOST" > ext.cnf
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out server.pem -days 1825 -extfile ext.cnf
rm -f server.csr ext.cnf
chmod 644 ca.pem server.pem server.key
echo "generated CA and server certificate for $HOST in $DIR"
