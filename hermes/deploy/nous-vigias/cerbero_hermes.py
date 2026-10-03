"""Script do cron do Nous (--no-agent): Cérbero, patrulha do Hermes (diária 05h BR).
Porte de rodarPatrulhaHermes, hermes/src/jobs/cerbero.ts. Saída vazia (nada vai ao Telegram); VIGIAS_MODO=sombra|valer."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vigias.comum import executar  # noqa: E402
from vigias.cerbero import rodar_patrulha_hermes  # noqa: E402

if __name__ == "__main__":
    sys.exit(executar("cerbero_hermes", rodar_patrulha_hermes))
