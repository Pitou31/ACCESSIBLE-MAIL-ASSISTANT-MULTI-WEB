#!/bin/bash
set -euo pipefail

APP_DIR="/Users/jacquessoule/apps/ACCESSIBLE_MAIL_ASSISTANT_MULTI_SPARK"
PORT=3001

cd "$APP_DIR"

echo "Démarrage de l'application Mac sur http://localhost:${PORT}/"
npm start
