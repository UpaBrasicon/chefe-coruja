"""Script do cron do Nous (--no-agent): Porta, virada de plantão (07h05 e 19h05 BR).
Porte de vigiaPorta, hermes/src/jobs/vigias.ts. Saída vazia (nada vai ao Telegram); VIGIAS_MODO=sombra|valer."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vigias.comum import executar  # noqa: E402
from vigias.rodada_d import vigia_porta  # noqa: E402

if __name__ == "__main__":
    sys.exit(executar("vigia_porta", vigia_porta))
