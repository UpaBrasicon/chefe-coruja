"""Script do cron do Nous (--no-agent): relatório semanal do Gavião (segunda 08h15 BR).
Porte de hermes/src/jobs/relatorio.ts. Saída vazia (nada vai ao Telegram); VIGIAS_MODO=sombra|valer."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vigias.comum import executar  # noqa: E402
from vigias.relatorio import gerar_relatorio_semanal  # noqa: E402

if __name__ == "__main__":
    sys.exit(executar("relatorio", gerar_relatorio_semanal))
