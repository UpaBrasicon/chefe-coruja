"""Organizador de skills da Coruja Lab: carga, categorias, busca e registro só no Lab."""

import importlib.util
import json
import os
import unittest
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("lab_skills", AQUI / "plugins" / "lab-skills" / "__init__.py")
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
SKILLS = AQUI / "skills"


class Ctx:
    def __init__(self):
        self.ferramentas = []

    def register_tool(self, name, **_):
        self.ferramentas.append(name)


class TestLabSkills(unittest.TestCase):
    def test_carrega_todas(self):
        s = lab.carregar(SKILLS)
        self.assertEqual(len(s), len(list(SKILLS.glob("*/SKILL.md"))))
        self.assertGreaterEqual(len(s), 50)
        self.assertTrue(all(x["descricao"] for x in s), "toda skill tem descrição")

    def test_categorias(self):
        cats = {x["pasta"]: x["categoria"] for x in lab.carregar(SKILLS)}
        self.assertEqual(cats["planning-with-files"], "planejamento")
        self.assertEqual(cats["codex-delegate"], "delegacao")
        self.assertEqual(cats["rtk-tdd-rust"], "desenvolvimento-rtk")
        self.assertEqual(cats["caveman-compress"], "compressao-e-revisao")

    def test_busca_relevante(self):
        s = lab.carregar(SKILLS)
        self.assertEqual(lab.buscar("plan a multi-step task with persistent files", s, 3)[0]["pasta"], "planning-with-files")
        self.assertIn("codex-delegate", [x["pasta"] for x in lab.buscar("delegate this implementation to codex", s, 3)])
        self.assertTrue(lab.buscar("compress text caveman", s, 3)[0]["pasta"].startswith("cave"))
        self.assertEqual(lab.buscar("zzzz qqqq", s), [])

    def test_so_registra_no_lab(self):
        for agente, esperado in [("lab", ["skill_buscar", "skill_categorias"]), ("corujinha", []), ("", [])]:
            ctx = Ctx()
            with mock.patch.dict(os.environ, {"CORUJA_AGENTE": agente}):
                lab.register(ctx)
            self.assertEqual(ctx.ferramentas, esperado, agente)

    def test_pedido_curto(self):
        self.assertFalse(json.loads(lab._buscar({"pedido": "x"}))["ok"])


if __name__ == "__main__":
    unittest.main()
