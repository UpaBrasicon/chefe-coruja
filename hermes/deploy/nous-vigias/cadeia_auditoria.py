"""Script do cron do Nous (--no-agent): Cadeia do log de auditoria (04h BR).
Porte de cadeiaAuditoria, hermes/src/jobs/vigias.ts. Saída vazia (nada vai ao Telegram); VIGIAS_MODO=sombra|valer."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vigias.comum import executar  # noqa: E402
from vigias.rodada_d import cadeia_auditoria  # noqa: E402

if __name__ == "__main__":
    sys.exit(executar("cadeia_auditoria", cadeia_auditoria))
