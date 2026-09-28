#!/bin/sh
# Backup diário da biblioteca clínica (guia §12): índice do Qdrant, fontes.yaml,
# ferramentas.json e corpus. Guarda os 7 mais recentes em /srv/biblioteca/backup.
# Instalar no VPS como /etc/cron.daily/biblioteca-backup (chmod +x).
# É cópia local, no mesmo disco: de tempos em tempos copie um .tgz para fora
# do VPS (scp para o seu computador).
set -e
cd /srv/biblioteca
mkdir -p backup
tar czf "backup/biblioteca-$(date +%F).tgz" qdrant_data fontes.yaml ferramentas.json corpus 2>/dev/null
ls -1t backup/biblioteca-*.tgz | tail -n +8 | xargs -r rm -f
