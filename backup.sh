#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATE="$(date +"%Y-%m-%d_%H-%M")"
TITLE="${1:-Sauvegarde}"

PROJECT="$SCRIPT_DIR"
INTERNAL_BACKUP="$PROJECT/sauvegarde"
EXTERNAL_BACKUP="$HOME/Documents/sauvegarde-assistant-mail"
NAME="${DATE}_${TITLE}"
KEEP_BACKUPS=10
TMP_SUFFIX=".tmp.$$"

REQUIRED_ITEMS=(
  "backend"
  "frontend"
  "package.json"
  ".env"
)

validate_backup() {
  local backup_dir="$1"
  local missing=()

  for item in "${REQUIRED_ITEMS[@]}"; do
    if [ ! -e "$backup_dir/$item" ]; then
      missing+=("$item")
    fi
  done

  if [ "${#missing[@]}" -gt 0 ]; then
    echo "Sauvegarde invalide : éléments manquants dans $backup_dir -> ${missing[*]}" >&2
    return 1
  fi
}

write_manifest() {
  local backup_dir="$1"
  cat > "$backup_dir/backup-manifest.txt" <<EOF
backup_name=$NAME
created_at=$DATE
source_project=$PROJECT
internal_backup_dir=$INTERNAL_BACKUP
external_backup_dir=$EXTERNAL_BACKUP
excluded_paths=sauvegarde,.DS_Store
EOF
}

cleanup_old_backups() {
  local root_dir="$1"
  local keep_count="${2:-$KEEP_BACKUPS}"
  local entries=()
  local dir=""
  local line=""
  local target=""
  local index=0
  local name=""

  while IFS= read -r -d '' dir; do
    name="$(basename "$dir")"
    entries+=("${name}|${dir}")
  done < <(find "$root_dir" -mindepth 1 -maxdepth 1 -type d -print0)

  if [ "${#entries[@]}" -le "$keep_count" ]; then
    return 0
  fi

  while IFS= read -r line; do
    index=$((index + 1))
    if [ "$index" -le "$keep_count" ]; then
      continue
    fi

    target="${line#*|}"
    rm -rf "$target"
  done < <(printf '%s\n' "${entries[@]}" | sort -t '|' -k1,1r)
}

mkdir -p "$INTERNAL_BACKUP"
mkdir -p "$EXTERNAL_BACKUP"

INTERNAL_TARGET="$INTERNAL_BACKUP/$NAME"
EXTERNAL_TARGET="$EXTERNAL_BACKUP/$NAME"
INTERNAL_TMP_TARGET="${INTERNAL_TARGET}${TMP_SUFFIX}"
EXTERNAL_TMP_TARGET="${EXTERNAL_TARGET}${TMP_SUFFIX}"

cleanup_tmp_targets() {
  rm -rf "$INTERNAL_TMP_TARGET" "$EXTERNAL_TMP_TARGET"
}

trap cleanup_tmp_targets EXIT

echo "Création des sauvegardes sécurisées..."

rm -rf "$INTERNAL_TMP_TARGET" "$EXTERNAL_TMP_TARGET"
mkdir -p "$INTERNAL_TMP_TARGET"
mkdir -p "$EXTERNAL_TMP_TARGET"

rsync -a --delete \
  --exclude "sauvegarde" \
  --exclude ".DS_Store" \
  "$PROJECT/" "$INTERNAL_TMP_TARGET/"

rsync -a --delete \
  --exclude "sauvegarde" \
  --exclude ".DS_Store" \
  "$PROJECT/" "$EXTERNAL_TMP_TARGET/"

write_manifest "$INTERNAL_TMP_TARGET"
write_manifest "$EXTERNAL_TMP_TARGET"

validate_backup "$INTERNAL_TMP_TARGET"
validate_backup "$EXTERNAL_TMP_TARGET"

rm -rf "$INTERNAL_TARGET" "$EXTERNAL_TARGET"
mv "$INTERNAL_TMP_TARGET" "$INTERNAL_TARGET"
mv "$EXTERNAL_TMP_TARGET" "$EXTERNAL_TARGET"

echo "Sauvegarde interne : $INTERNAL_TARGET"
echo "Sauvegarde externe : $EXTERNAL_TARGET"

echo "Nettoyage des anciennes sauvegardes..."
cleanup_old_backups "$INTERNAL_BACKUP" "$KEEP_BACKUPS"
cleanup_old_backups "$EXTERNAL_BACKUP" "$KEEP_BACKUPS"

echo "Nettoyage terminé"
echo "Sauvegarde complète et validée."
trap - EXIT
