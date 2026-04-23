#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_EMAIL="testagentmail.js@gmail.com"
EMAIL="${1:-$DEFAULT_EMAIL}"
EXTRA_ARGS=()

if [[ $# -ge 2 ]]; then
  shift
  EXTRA_ARGS=("$@")
fi

printf "
Réinitialisation de la boîte de test...
"
printf "Projet : %s
" "$ROOT_DIR"
printf "Boîte ciblée : %s

" "$EMAIL"

cd "$ROOT_DIR"
if [[ ${#EXTRA_ARGS[@]} -gt 0 ]]; then
  npm run reset:test-gmail-mailbox -- --email "$EMAIL" "${EXTRA_ARGS[@]}"
else
  npm run reset:test-gmail-mailbox -- --email "$EMAIL"
fi

printf "
Réinitialisation terminée.
"
printf "Recharge ensuite l'Inbox dans l'application pour repartir d'un état propre.
"
