"""Script do cron do Nous (--no-agent): Guardião do prontuário (de hora em hora, minuto 20).
Porte de guardiaoProntuario, hermes/src/jobs/vigias.ts. Saída vazia (nada vai ao Telegram); VIGIAS_MODO=sombra|valer."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vigias.comum import executar  # noqa: E402
from vigias.rodada_d import guardiao_prontuario  # noqa: E402

if __name__ == "__main__":
    sys.exit(executar("guardiao_prontuario", guardiao_prontuario))
