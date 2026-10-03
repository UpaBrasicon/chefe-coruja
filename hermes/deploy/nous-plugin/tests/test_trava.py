"""Trava de ferramentas das Corujas de saúde (RT, 03/10/2026): só as do agente e a leitura de skills."""

import os
import unittest
from unittest import mock

from test_consulta import plugin


class Ctx:
    def __init__(self):
        self.ferramentas, self.ganchos = [], {}

    def register_tool(self, name, **_):
        self.ferramentas.append(name)

    def register_hook(self, nome, fn):
        self.ganchos[nome] = fn


class TestTrava(unittest.TestCase):
    def gancho(self, agente):
        ctx = Ctx()
        with mock.patch.dict(os.environ, {"CORUJA_AGENTE": agente}):
            plugin.register(ctx)
        return ctx.ganchos["pre_tool_call"]

    def chamar(self, agente, ferramenta):
        g = self.gancho(agente)
        with mock.patch.dict(os.environ, {"CORUJA_AGENTE": agente}):
            return g(tool_name=ferramenta, args={})

    def test_libera_as_do_agente_e_a_leitura_de_skills(self):
        for f in ("coruja_consultar", "coruja_almanaque", "coruja_vincular", "skills_list", "skill_view", "tool_describe"):
            self.assertIsNone(self.chamar("corujinha", f), f)
        self.assertIsNone(self.chamar("clinica", "biblioteca_clinica_buscar"))

    def test_bloqueia_escrita_de_skill_terminal_e_arquivos(self):
        for f in ("skill_manage", "terminal", "read_file", "write_file", "browser_navigate", "memory"):
            r = self.chamar("gestora", f)
            self.assertEqual(r["action"], "block", f)

    def test_ferramenta_de_outro_agente_bloqueada(self):
        self.assertEqual(self.chamar("corujinha", "biblioteca_clinica_buscar")["action"], "block")

    def test_agente_desconhecido_nao_registra_nem_gancho(self):
        ctx = Ctx()
        with mock.patch.dict(os.environ, {"CORUJA_AGENTE": "qualquer"}):
            plugin.register(ctx)
        self.assertEqual((ctx.ferramentas, ctx.ganchos), ([], {}))

    def test_ctx_sem_ganchos_nao_quebra(self):
        class SemGancho:
            def register_tool(self, name, **_):
                pass
        with mock.patch.dict(os.environ, {"CORUJA_AGENTE": "corujinha"}):
            plugin.register(SemGancho())


if __name__ == "__main__":
    unittest.main()
