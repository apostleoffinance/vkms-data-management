FROM nginx:1.27-alpine

RUN apk add --no-cache gettext wget openssl

COPY nginx.conf /etc/nginx/nginx.conf
COPY templates/app.conf.template /etc/nginx/templates/app.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh \
    && mkdir -p /etc/nginx/conf.d

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
