"""Um contêiner do Nous por agente (RT, 02/10/2026): CORUJA_AGENTE escolhe
ferramentas e escopos; o que não é do agente não é registrado nem aceito."""

import json
import os
import unittest
from unittest import mock

from test_consulta import SESSAO, RpcFalso, linha_identidade, plugin


class CtxFalso:
    def __init__(self):
        self.ferramentas = {}

    def register_tool(self, name, **kw):
        self.ferramentas[name] = kw


def registrar(agente: str | None) -> dict:
    env = {} if agente is None else {"CORUJA_AGENTE": agente}
    with mock.patch.dict(os.environ, env):
        if agente is None:
            os.environ.pop("CORUJA_AGENTE", None)
        ctx = CtxFalso()
        plugin.register(ctx)
    return ctx.ferramentas


class TestAgentes(unittest.TestCase):
    def setUp(self):
        SESSAO.clear()
        SESSAO.update({"HERMES_SESSION_PLATFORM": "telegram", "HERMES_SESSION_USER_ID": "4242"})
        plugin._rpc_cache = None

    def tearDown(self):
        plugin._rpc_cache = None

    def test_corujinha_sem_biblioteca(self):
        f = registrar("corujinha")
        self.assertEqual(set(f), {"coruja_consultar", "coruja_almanaque", "coruja_vincular"})
        self.assertEqual(f["coruja_consultar"]["schema"]["parameters"]["properties"]["escopo"]["enum"], ["escala", "operacional"])

    def test_sem_variavel_e_corujinha(self):
        self.assertEqual(set(registrar(None)), set(registrar("corujinha")))

    def test_gestora(self):
        f = registrar("gestora")
        self.assertNotIn("biblioteca_clinica_buscar", f)
        self.assertEqual(f["coruja_consultar"]["schema"]["parameters"]["properties"]["escopo"]["enum"],
                         ["escala", "operacional", "aguia", "garca", "sentinela"])

    def test_clinica_so_referencia(self):
        self.assertEqual(set(registrar("clinica")), {"biblioteca_clinica_buscar", "coruja_almanaque", "coruja_vincular"})

    def test_suporte(self):
        f = registrar("suporte")
        self.assertEqual(f["coruja_consultar"]["schema"]["parameters"]["properties"]["escopo"]["enum"], ["seguranca", "infra"])
        self.assertNotIn("seguranca", registrar("gestora")["coruja_consultar"]["schema"]["parameters"]["properties"]["escopo"]["enum"])

    def test_agente_desconhecido_nao_registra_nada(self):
        self.assertEqual(registrar("qualquer"), {})

    def test_escopo_de_outro_agente_recusado_sem_ir_ao_banco(self):
        rpc = RpcFalso({}, identidade_linha=linha_identidade())
        plugin._rpc_cache = rpc
        with mock.patch.dict(os.environ, {"CORUJA_CONSULTA_DIRETA": "1", "CORUJA_AGENTE": "corujinha"}):
            r = json.loads(plugin._consultar({"escopo": "seguranca", "comando": "incidentes"}))
        self.assertEqual(r["ok"], False)
        self.assertIn("não é deste assistente", r["erro"])
        self.assertEqual(rpc.chamadas, [])


if __name__ == "__main__":
    unittest.main()
