#!/usr/bin/env bash
# Backs up the store database and wp-content to ./backups
set -e
mkdir -p backups
ROOT=$(kubectl get secret store-secrets -n store -o jsonpath='{.data.db-root-password}' | base64 -d)
kubectl exec -n store mariadb-0 -- mariadb-dump -uroot -p"$ROOT" --all-databases > backups/db.sql
kubectl exec -n store deploy/wordpress -- tar czf - -C /var/www/html wp-content > backups/wp-content.tgz
echo "Backed up to ./backups"
