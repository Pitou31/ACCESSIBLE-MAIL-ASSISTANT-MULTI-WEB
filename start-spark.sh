#!/bin/bash
set -euo pipefail

APP_DIR="/Users/jacquessoule/apps/ACCESSIBLE_MAIL_ASSISTANT_MULTI_SPARK"
SPARK_HOST="jacques@192.168.1.21"
SERVICE_NAME="accessible-mail-assistant-multi-spark.service"

cd "$APP_DIR"

echo "Redémarrage du service utilisateur Spark..."
ssh "$SPARK_HOST" "systemctl --user restart ${SERVICE_NAME}"

echo "Réouverture du tunnel SSH vers le Spark..."
"$APP_DIR/start-tunnel.sh"

echo "Spark prêt sur http://localhost:3002/"
