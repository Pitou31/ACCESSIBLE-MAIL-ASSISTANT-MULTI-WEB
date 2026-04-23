#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$SCRIPT_DIR"
BACKUP_SOURCE="${1:-}"

REQUIRED_ITEMS=(
  "backend"
  "frontend"
  "package.json"
  ".env"
)

if [ -z "$BACKUP_SOURCE" ]; then
  echo "Usage : ./restore-backup.sh \"/chemin/vers/la/sauvegarde\"" >&2
  exit 1
fi

if [ ! -d "$BACKUP_SOURCE" ]; then
  echo "Sauvegarde introuvable : $BACKUP_SOURCE" >&2
  exit 1
fi

missing=()
for item in "${REQUIRED_ITEMS[@]}"; do
  if [ ! -e "$BACKUP_SOURCE/$item" ]; then
    missing+=("$item")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Restauration refusée : sauvegarde invalide." >&2
  echo "Éléments manquants à la racine : ${missing[*]}" >&2
  exit 1
fi

echo "Restauration sécurisée depuis : $BACKUP_SOURCE"

rsync -a --delete \
  --exclude "sauvegarde" \
  --exclude ".DS_Store" \
  "$BACKUP_SOURCE/" "$PROJECT/"

echo "Restauration terminée."
