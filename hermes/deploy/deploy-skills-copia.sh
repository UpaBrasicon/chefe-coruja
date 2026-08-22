#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy das skills — CÓPIA (arquivos já normalizados para LF) — 23/08
# Copia SKILL.md + scripts + _lib.sh para as skills do Nous.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SRC=/home/hermes/deploy/nous-skill
BASE=/home/hermes/.hermes/skills

copiar() {
  local skill_md="$1" pasta="$2" scripts="$3"
  install -m 0644 "$SRC/$skill_md" "$BASE/$pasta/SKILL.md"
  for s in $scripts; do
    install -m 0755 "$SRC/$s" "$BASE/$pasta/scripts/$s"
  done
  if [ -f "$SRC/_lib.sh" ]; then
    install -m 0644 "$SRC/_lib.sh" "$BASE/$pasta/scripts/_lib.sh"
  fi
  echo "[ok] $pasta ← $skill_md + ($scripts) + _lib.sh"
}

copiar "SKILL.md"         "chefe-coruja"           "operacional.sh escala.sh"
copiar "SKILL-AGUIA.md"   "chefe-coruja-athena"    "aguia.sh"
copiar "SKILL-GARCA.md"   "chefe-coruja-asclepio"  "garca.sh"
copiar "SKILL-PICAPAU.md" "chefe-coruja-hefesto"   "picapau.sh"
copiar "SKILL-SEGURANCA.md" "chefe-coruja-seguranca" "seguranca.sh"
copiar "SKILL-SENTINELA.md" "chefe-coruja-sentinela" "sentinela.sh"

echo "[...] verificando CRLF nos scripts copiados:"
CR=$(grep -rlP '\r$' "$BASE"/chefe-coruja*/scripts/ 2>/dev/null || true)
if [ -n "$CR" ]; then
  echo "[ERRO] ainda há CRLF em: $CR"
  exit 1
fi
echo "[ok] todos com LF"

chown -R hermes:hermes "$BASE"/chefe-coruja*/ 2>/dev/null || true
echo "[ok] permissões ajustadas"
