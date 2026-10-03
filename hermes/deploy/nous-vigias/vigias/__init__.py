"""Vigias do Chefe Coruja como tarefas agendadas do Nous, sem IA (etapa 2 da
migração Hermes → Nous, RT 02/10/2026 — produto/docs/propostas/migracao-hermes-nous.md).

Porte em Python dos jobs de hermes/src/jobs/*.ts, com a MESMA lógica, os mesmos
limites, a mesma dedup e as mesmas gravações. Cada job roda como script
``--no-agent`` do cron do Nous (saída vazia = nada vai ao Telegram), com o
papel ``hermes_app_job`` (HERMES_PG_JOB_URL).

Modo (VIGIAS_MODO):
- ``sombra`` (padrão): calcula tudo, NÃO grava; anota cada gravação que faria
  em /opt/data/logs/vigias-sombra/<job>-AAAA-MM-DD.jsonl (só IDs, chaves em
  hash e contagens — nunca texto livre);
- ``valer``: grava de verdade, como o Hermes faz hoje.
"""
