FROM openemr/openemr:8.1.0-2026-06-18

USER root
WORKDIR /var/www/localhost/htdocs/openemr

COPY infra/azure/demo/legacy-demo-login-preset.js /var/www/localhost/htdocs/openemr/public/demo-login-preset.js
COPY infra/azure/demo/legacy-demo-bootstrap.sql /var/www/localhost/htdocs/openemr/public/demo-bootstrap.sql
COPY infra/azure/demo/legacy-demo-bootstrap.sh /usr/local/bin/openemr-demo-bootstrap.sh

RUN chmod u+w templates/login/base.html.twig portal/index.php \
    && sed -i 's#</head>#    <script src="/public/demo-login-preset.js?v=20260627"></script>\n</head>#' templates/login/base.html.twig \
    && sed -i 's#</body>#    <script src="/public/demo-login-preset.js?v=20260627"></script>\n</body>#' portal/index.php \
    && chmod 755 /usr/local/bin/openemr-demo-bootstrap.sh
