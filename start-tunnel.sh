#!/bin/bash
# Ouvre le tunnel SSH vers le Spark
# Mac:3002 -> Spark:3002
#
# L'application tourne sur le Spark (port 3002).
# Une fois le tunnel actif, accéder depuis le Mac via :
#   http://localhost:3002/
#   http://localhost:3002/frontend/mail.html

SPARK_HOST="jacques@192.168.1.21"
LOCAL_PORT=3002
REMOTE_PORT=3002

# Vérifie si le tunnel est déjà actif
if lsof -nP -iTCP:$LOCAL_PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Tunnel déjà actif sur le port $LOCAL_PORT."
  exit 0
fi

echo "Ouverture du tunnel SSH : Mac:$LOCAL_PORT → Spark:$REMOTE_PORT ..."
ssh -L ${LOCAL_PORT}:localhost:${REMOTE_PORT} ${SPARK_HOST} -N -f
echo "Tunnel actif. Ouvre : http://localhost:${LOCAL_PORT}/"
