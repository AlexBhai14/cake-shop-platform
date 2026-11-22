#!/bin/bash
# Runs ONCE, only when the MySQL data volume is empty.
# Creates one database + one least-privilege user per microservice.
# Each user can access only its own database (and its own shadow database,
# which Prisma Migrate needs during development).
set -euo pipefail

for svc in auth user product cart inventory order payment notification; do
  upper=$(echo "$svc" | tr '[:lower:]' '[:upper:]')
  pw_var="${upper}_DB_PASSWORD"
  pw="${!pw_var:?Missing environment variable $pw_var}"

  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<EOSQL
CREATE DATABASE IF NOT EXISTS cake_${svc}_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cake_${svc}_db_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${svc}_user'@'%' IDENTIFIED BY '${pw}';
GRANT ALL PRIVILEGES ON cake_${svc}_db.* TO '${svc}_user'@'%';
GRANT ALL PRIVILEGES ON cake_${svc}_db_shadow.* TO '${svc}_user'@'%';
FLUSH PRIVILEGES;
EOSQL
  echo "Created database and user for service: ${svc}"
done
