#!/bin/sh
# Dispara os jobs do Hermes na hora, sem esperar o cron. Rodar NA VPS:
#   sh 2-disparar.sh                 → todos
#   sh 2-disparar.sh cerbero_dados   → só um
# Os jobs só gravam no banco (incidentes e avisos in-app): não mandam
# WhatsApp nem Telegram para ninguém.
JOBS="${1:-cerbero_dados cerbero_hermes argos_auditoria gaviao_patrulha sentinela_escala}"
for j in $JOBS; do
  docker exec -w /app hermes-app timeout 120 node --no-warnings -e \
    "import('/app/dist/queue/agendador.js').then(m=>m.executarJobCron('$j')).then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})" \
    >/dev/null 2>&1 && echo "ok     $j" || echo "FALHOU $j"
done
