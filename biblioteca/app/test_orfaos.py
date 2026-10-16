"""orfaos.py só marca trecho de fonte registrada (16/10/2026: os artigos abertos
e as fichas de referência, ingeridos sem registro, apareceram como órfãos).

    BIBLIOTECA_DIR=.. python -m unittest test_orfaos
"""
import os
import unittest
from types import SimpleNamespace
from unittest import mock

os.environ.setdefault("BIBLIOTECA_DIR", "..")
os.environ.setdefault("QDRANT_URL", "http://qdrant.invalido")

import orfaos  # noqa: E402


def ponto(fid, titulo):
    return SimpleNamespace(payload={"fonte_id": fid, "titulo": titulo})


class TestOrfaos(unittest.TestCase):
    def test_pastas_registradas(self):
        p = orfaos.prefixos_registrados()
        for t in ("Central do Plantonista — ", "Artigos abertos CC BY 4.0 — ", "Fichas de referência (direitos reservados) — "):
            self.assertIn(t, p)

    def test_so_fonte_registrada_vira_orfa(self):
        pontos = [
            ponto("velho1", "Central do Plantonista — Ficha renomeada"),       # registrada, arquivo saiu: órfã
            ponto("solto", "Pasta que ninguém registrou — Algum artigo"),      # não registrada: fica
        ]
        with mock.patch.object(orfaos.qd, "scroll", return_value=(pontos, None)):
            contagem, _ = orfaos.orfaos()
        self.assertEqual(set(contagem), {"velho1"})


if __name__ == "__main__":
    unittest.main()
