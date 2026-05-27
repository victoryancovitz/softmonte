#!/bin/bash
# Backup diario do softmonte (banco + storage) para o OneDrive corporativo.
# Roda via launchd. O OneDrive sincroniza a pasta pra nuvem sozinho.
set -euo pipefail

REPO="$HOME/softmonte-git"
DEST="$HOME/OneDrive - Tecnomonte/Backups/softmonte"
PG_DUMP="/opt/homebrew/opt/libpq/bin/pg_dump"
NODE="/usr/local/bin/node"
LOG="$DEST/backup.log"

cd "$REPO"

# carrega DATABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env.local
set -a
# shellcheck disable=SC1091
source .env.local
set +a

ts() { date '+%Y-%m-%d %H:%M:%S'; }
mkdir -p "$DEST/db/daily" "$DEST/db/weekly" "$DEST/storage"
echo "[$(ts)] === inicio backup ===" >> "$LOG"

DATE="$(date +%F)"
DOW="$(date +%u)"  # 7 = domingo

# ---------- BANCO ----------
DUMP="$DEST/db/daily/softmonte_${DATE}.sql.gz"
if "$PG_DUMP" "$DATABASE_URL" | gzip > "$DUMP"; then
  echo "[$(ts)] db OK ($(du -h "$DUMP" | cut -f1)) -> $DUMP" >> "$LOG"
else
  echo "[$(ts)] db FALHOU" >> "$LOG"; rm -f "$DUMP"
fi

# rotacao diaria: mantem os 7 mais recentes
ls -1t "$DEST/db/daily/"*.sql.gz 2>/dev/null | tail -n +8 | while read -r f; do rm -f "$f"; done

# semanal: aos domingos guarda copia; mantem as 4 mais recentes
if [ "$DOW" = "7" ] && [ -f "$DUMP" ]; then
  cp "$DUMP" "$DEST/db/weekly/softmonte_${DATE}.sql.gz"
  ls -1t "$DEST/db/weekly/"*.sql.gz 2>/dev/null | tail -n +5 | while read -r f; do rm -f "$f"; done
fi

# ---------- STORAGE (incremental) ----------
export BACKUP_STORAGE_DIR="$DEST/storage"
if "$NODE" scripts/backup-storage.mjs >> "$LOG" 2>&1; then
  echo "[$(ts)] storage OK" >> "$LOG"
else
  echo "[$(ts)] storage com erros (ver acima)" >> "$LOG"
fi

echo "[$(ts)] === fim backup ===" >> "$LOG"
