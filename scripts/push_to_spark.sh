#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${HOME}/apps/ACCESSIBLE_MAIL_ASSISTANT_MULTI_SPARK"
SPARK_HOST="jacques@192.168.1.21"
SPARK_PROJECT_DIR="~/apps/ACCESSIBLE_MAIL_ASSISTANT_MULTI_SPARK"
SPARK_PORT=3002
SERVICE_NAME="accessible-mail-assistant-multi-spark.service"
SSH_SOCKET="${HOME}/.ssh/cm-accessible-mail-spark"

echo "==> Projet local : ${PROJECT_DIR}"
cd "${PROJECT_DIR}"

echo "==> Vérification Git locale"
git status --short

DIRTY_NON_ENV=$(git status --porcelain | grep -vE '^[ ?MADRCTU]{2} (\.env\.mac|\.env|\.env\.spark)$' || true)

if [ -n "${DIRTY_NON_ENV}" ]; then
  echo "Des modifications locales non committeées existent hors .env."
  echo "${DIRTY_NON_ENV}"
  echo "Fais d'abord : git add / git commit / git push, puis relance ce script."
  exit 1
fi

echo "==> Ouverture connexion SSH unique"
ssh -o ControlMaster=yes -o ControlPath="${SSH_SOCKET}" -o ControlPersist=10m -fnN "${SPARK_HOST}"

remote() {
  ssh -o ControlMaster=no -o ControlPath="${SSH_SOCKET}" "${SPARK_HOST}" "$@"
}

remote_nofail() {
  ssh -o ControlMaster=no -o ControlPath="${SSH_SOCKET}" "${SPARK_HOST}" "$@" || true
}

remote_tty() {
  ssh -tt -o ControlMaster=no -o ControlPath="${SSH_SOCKET}" "${SPARK_HOST}" "$@"
}

cleanup() {
  ssh -O exit -o ControlPath="${SSH_SOCKET}" "${SPARK_HOST}" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Push GitHub"
git push

echo "==> Pull sur Spark"
remote "cd ${SPARK_PROJECT_DIR} && git pull --ff-only"

echo "==> Installation des dépendances Node sur Spark"
remote "cd ${SPARK_PROJECT_DIR} && npm install"

echo "==> Préservation du .env Spark"
remote "cd ${SPARK_PROJECT_DIR} && if [ ! -f .env ]; then if [ -f .env.spark ]; then cp .env.spark .env; else echo '.env manquant sur le Spark'; exit 1; fi; fi"
remote "cd ${SPARK_PROJECT_DIR} && if grep -q '^APP_NODE_ROLE=' .env 2>/dev/null; then sed -i 's/^APP_NODE_ROLE=.*/APP_NODE_ROLE=spark/' .env; else echo 'APP_NODE_ROLE=spark' >> .env; fi"
remote "cd ${SPARK_PROJECT_DIR} && if grep -q '^PORT=' .env 2>/dev/null; then sed -i 's/^PORT=.*/PORT=${SPARK_PORT}/' .env; else echo 'PORT=${SPARK_PORT}' >> .env; fi"
remote "cd ${SPARK_PROJECT_DIR} && if grep -q '^APP_BASE_URL=' .env 2>/dev/null; then sed -i 's#^APP_BASE_URL=.*#APP_BASE_URL=http://localhost:${SPARK_PORT}#' .env; else echo 'APP_BASE_URL=http://localhost:${SPARK_PORT}' >> .env; fi"
remote "cd ${SPARK_PROJECT_DIR} && if grep -q '^GOOGLE_OAUTH_REDIRECT_URI=' .env 2>/dev/null; then sed -i 's#^GOOGLE_OAUTH_REDIRECT_URI=.*#GOOGLE_OAUTH_REDIRECT_URI=http://localhost:${SPARK_PORT}/api/mailbox/google/callback#' .env; fi"

echo "==> Redémarrage du service Spark"
remote_tty "sudo systemctl restart ${SERVICE_NAME}"

echo "==> Attente démarrage"
sleep 5

echo "==> Vérification service Spark"
remote "systemctl status ${SERVICE_NAME} --no-pager -n 20"

echo "==> Vérification API Spark"
remote "curl -i -s --max-time 10 http://localhost:${SPARK_PORT}/api/health"

echo
echo "==> Dernières lignes du journal Spark"
remote_nofail "journalctl -u ${SERVICE_NAME} -n 30 --no-pager"

echo
echo "Synchronisation terminée."
