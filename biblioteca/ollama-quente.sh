#!/bin/sh
# Mantém o modelo de busca (bge-m3) carregado no Ollama da biblioteca.
# O Ollama já está com keep_alive -1 (nunca descarrega), mas depois de um
# restart do contêiner ou do VPS o modelo começa fora da memória e a primeira
# pergunta esperaria 41–60+ s. Este aviso recarrega o modelo antes disso.
# Instalar no VPS como /root/ollama-quente.sh (chmod +x), cron do root:
#   */10 * * * * /root/ollama-quente.sh
# Só escreve no log quando falha ou demora mais de 5 s (= houve recarga).
# Ver infra/biblioteca-ollama-quente.md.
LOG=/home/hermes/backups/ollama-quente.log
saida=$(curl -sS -m 120 -o /dev/null -w '%{http_code} %{time_total}' \
  -H 'Content-Type: application/json' \
  -d '{"model":"bge-m3","input":["ping"],"keep_alive":"-1m"}' \
  http://127.0.0.1:11434/api/embed 2>&1)
codigo=${saida%% *}
tempo=${saida#* }
if [ "$codigo" != "200" ] || [ "${tempo%%.*}" -ge 5 ] 2>/dev/null; then
  echo "$(date -Is) $saida" >> "$LOG"
fi
