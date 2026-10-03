"""Script do cron do Nous (--no-agent): Falcão/Argos, auditoria clínica (06h e 18h BR).
Porte de hermes/src/jobs/argos.ts. Saída vazia (nada vai ao Telegram); VIGIAS_MODO=sombra|valer."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vigias.comum import executar  # noqa: E402
from vigias.argos import rodar_auditoria_argos  # noqa: E402

if __name__ == "__main__":
    sys.exit(executar("argos", rodar_auditoria_argos))
