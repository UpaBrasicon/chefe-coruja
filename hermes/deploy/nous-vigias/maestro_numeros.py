"""Script do cron do Nous (--no-agent): números agregados para o maestro do Coruja Lab (toda hora, minuto 50).
Grava /opt/data/maestro-saida/numeros.json (MAESTRO_SAIDA troca a pasta). Saída vazia; ignora VIGIAS_MODO
(não grava no banco: só lê, como hermes_app_job, e escreve o arquivo)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vigias.maestro import executar_maestro  # noqa: E402

if __name__ == "__main__":
    sys.exit(executar_maestro())
