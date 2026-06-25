#!/bin/sh
set -eu

: "${FRONTEND_DOMAIN:?FRONTEND_DOMAIN is required}"
: "${BACKEND_DOMAIN:?BACKEND_DOMAIN is required}"

CERT_DIR="/etc/letsencrypt/live/${FRONTEND_DOMAIN}"
if [ ! -f "${CERT_DIR}/fullchain.pem" ]; then
  echo "No TLS certificate found; creating temporary self-signed certificate."
  mkdir -p "${CERT_DIR}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${CERT_DIR}/privkey.pem" \
    -out "${CERT_DIR}/fullchain.pem" \
    -subj "/CN=${FRONTEND_DOMAIN}"
fi

envsubst '${FRONTEND_DOMAIN} ${BACKEND_DOMAIN}' \
  < /etc/nginx/templates/app.conf.template \
  > /etc/nginx/conf.d/app.conf

exec nginx -g 'daemon off;'
