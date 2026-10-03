"""Script do cron do Nous (--no-agent): Presença, check-in pendente (a cada 15 min).
Porte de vigiaPresenca, hermes/src/jobs/vigias.ts. Saída vazia (nada vai ao Telegram); VIGIAS_MODO=sombra|valer."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vigias.comum import executar  # noqa: E402
from vigias.rodada_d import vigia_presenca  # noqa: E402

if __name__ == "__main__":
    sys.exit(executar("vigia_presenca", vigia_presenca))
