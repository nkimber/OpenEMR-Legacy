#!/usr/bin/env sh
set -eu

database_host="${MYSQL_HOST:-127.0.0.1}"
database_port="${MYSQL_PORT:-3306}"
database_user="${MYSQL_USER:-openemr}"
database_password="${MYSQL_PASS:-openemr}"
database_name="${MYSQL_DATABASE:-openemr}"
seed_path="/var/www/localhost/htdocs/openemr/public/demo-bootstrap.sql"

attempt=1
while [ "$attempt" -le 120 ]; do
  if mysql --skip-ssl \
      -h "$database_host" \
      -P "$database_port" \
      -u "$database_user" \
      "-p$database_password" \
      "$database_name" \
      -N -B \
      -e "SELECT COUNT(*) FROM globals" >/dev/null 2>&1; then
    break
  fi

  echo "Waiting for OpenEMR demo database schema before seeding portal account..."
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$attempt" -gt 120 ]; then
  echo "Timed out waiting for OpenEMR demo database schema; portal demo account was not seeded." >&2
  exit 1
fi

mysql --skip-ssl \
  -h "$database_host" \
  -P "$database_port" \
  -u "$database_user" \
  "-p$database_password" \
  "$database_name" < "$seed_path"

echo "OpenEMR legacy demo portal account seeded."
