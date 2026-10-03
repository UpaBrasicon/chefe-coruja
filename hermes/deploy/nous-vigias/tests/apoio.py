"""Banco falso e contexto para os testes dos vigias (sem rede, sem asyncpg)."""

from __future__ import annotations

import datetime as _dt
import logging
import os
import sys

PASTA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PASTA not in sys.path:
    sys.path.insert(0, PASTA)

from vigias.banco import CONSULTAS, ESCRITAS, RPC_JOB, ErroBanco  # noqa: E402
from vigias.comum import Contexto, Gravacao, RegistroMemoria, UTC  # noqa: E402

# avisos esperados dos jobs não poluem a saída dos testes
_log = logging.getLogger("vigias")
_log.addHandler(logging.NullHandler())
_log.propagate = False

AGORA = _dt.datetime(2026, 10, 5, 12, 0, 0, 123000, tzinfo=UTC)  # segunda, 09h00 BR


class BancoFalso:
    """``ler``/``rpc`` respondem do dicionário (valor, função ou exceção);
    ``escrever`` grava a chamada. Nome fora das listas reais é erro, como no
    banco de verdade."""

    def __init__(self, leituras=None, rpcs=None, falha_escrita=None):
        self.leituras = leituras or {}
        self.rpcs = rpcs or {}
        self.falha_escrita = falha_escrita or {}
        self.chamadas: list[tuple] = []
        self.escritas: list[tuple] = []

    @staticmethod
    def _responder(resp, *args):
        if isinstance(resp, Exception):
            raise resp
        return resp(*args) if callable(resp) else resp

    def ler(self, nome, *args):
        assert nome in CONSULTAS, f"consulta fora da lista: {nome}"
        self.chamadas.append(("ler", nome, args))
        return self._responder(self.leituras.get(nome, []), *args)

    def rpc(self, nome, params=None):
        assert nome in RPC_JOB, f"rpc fora da lista: {nome}"
        self.chamadas.append(("rpc", nome, params or {}))
        return self._responder(self.rpcs.get(nome, []), params or {})

    def escrever(self, nome, *args):
        assert nome in ESCRITAS, f"gravação fora da lista: {nome}"
        if nome in self.falha_escrita:
            raise self.falha_escrita[nome]
        self.escritas.append((nome, args))

    def escritas_de(self, nome):
        return [a for n, a in self.escritas if n == nome]


def contexto(banco: BancoFalso, modo: str = "valer", agora=AGORA, ambiente=None):
    ids = iter(f"00000000-0000-4000-8000-{i:012d}" for i in range(1, 10_000))
    registro = RegistroMemoria("teste", relogio=lambda: agora)
    ctx = Contexto(banco, Gravacao(banco, modo, registro, gerar_id=lambda: next(ids)), relogio=lambda: agora,
                   ambiente=ambiente if ambiente is not None else {})
    return ctx, registro


def erro(msg="connection refused", codigo=""):
    return ErroBanco(msg, codigo)
