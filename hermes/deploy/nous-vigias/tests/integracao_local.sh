#!/usr/bin/env bash
# Integração dos vigias contra o Supabase LOCAL (nunca o de produção).
# Uso (Git Bash ou Linux, com `supabase start` no ar):
#   bash hermes/deploy/nous-vigias/tests/integracao_local.sh
# Põe uma senha TEMPORÁRIA e só local no hermes_app_job, roda os testes num
# python:3.13-slim com asyncpg 0.31.0 (o driver da imagem do Nous) e, no fim —
# sempre, mesmo em falha —, volta a senha para NULL (ninguém entra).
set -euo pipefail
export MSYS_NO_PATHCONV=1
DB=supabase_db_chefe-coruja
REDE=supabase_network_chefe-coruja
AQUI="$(cd "$(dirname "$0")/.." && pwd)"

resetar() {
  docker exec "$DB" psql -U postgres -qc "alter role hermes_app_job password null" >/dev/null \
    && echo "senha do hermes_app_job resetada para NULL"
}
trap resetar EXIT

SENHA="local_$(od -An -tx1 -N12 /dev/urandom | tr -d ' \n')"
docker exec "$DB" psql -U postgres -qc "alter role hermes_app_job password '$SENHA'" >/dev/null

# um vínculo ativo qualquer, para as gravações diretas (notificação/alerta)
read -r PERFIL UNIDADE < <(docker exec "$DB" psql -U postgres -tAF' ' -c \
  "select v.perfil_id, v.unidade_id from public.vinculos v where v.ativo limit 1" || true) || true

VOL="$AQUI"
command -v cygpath >/dev/null 2>&1 && VOL="$(cygpath -w "$AQUI")"

docker run --rm --network "$REDE" -v "$VOL:/vigias:ro" \
  -e HERMES_PG_JOB_URL="postgresql://hermes_app_job:$SENHA@$DB:5432/postgres" \
  -e TESTE_PERFIL="${PERFIL:-}" -e TESTE_UNIDADE="${UNIDADE:-}" -e PYTHONDONTWRITEBYTECODE=1 \
  python:3.13-slim sh -c '
    pip install -q --disable-pip-version-check --root-user-action=ignore asyncpg==0.31.0 tzdata >/dev/null &&
    cd /vigias &&
    python -m unittest discover -s tests -p "test_*.py" &&
    python tests/integracao.py'
