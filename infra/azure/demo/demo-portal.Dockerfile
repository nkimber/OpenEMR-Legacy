FROM nginx:1.27-alpine

ARG DEMO_PORTAL_DATA_B64=""

COPY infra/azure/demo/demo-portal/ /usr/share/nginx/html/
COPY infra/azure/demo/demo-portal-nginx.conf /etc/nginx/conf.d/default.conf

RUN if [ -n "$DEMO_PORTAL_DATA_B64" ]; then \
      printf '%s' "$DEMO_PORTAL_DATA_B64" | base64 -d > /usr/share/nginx/html/demo-portal-data.json; \
    else \
      printf '%s\n' '{"title":"OpenEMR Demo Portal","applications":[]}' > /usr/share/nginx/html/demo-portal-data.json; \
    fi
