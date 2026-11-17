"""LG6 (I5): o /v1/ask só com a chave da Edge. Roda sem dependências:
    python -m unittest test_chaves
"""
import unittest

from chaves import confere, rota_ask, rota_geral

ENV = {"BIBLIOTECA_API_KEY": "edge", "BIBLIOTECA_INTERNA_KEY": "interna"}


class Chaves(unittest.TestCase):
    def test_chave_interna_abre_busca_mas_nao_o_ask(self):
        self.assertTrue(rota_geral("Bearer interna", ENV))
        self.assertFalse(rota_ask("Bearer interna", ENV))

    def test_chave_da_edge_abre_tudo(self):
        self.assertTrue(rota_geral("Bearer edge", ENV))
        self.assertTrue(rota_ask("Bearer edge", ENV))

    def test_sem_chave_interna_configurada_so_a_da_edge(self):
        env = {"BIBLIOTECA_API_KEY": "edge"}
        self.assertTrue(rota_geral("Bearer edge", env))
        self.assertFalse(rota_geral("Bearer ", env))
        self.assertFalse(rota_geral("Bearer interna", env))

    def test_recusas(self):
        self.assertFalse(confere(None, "x"))
        self.assertFalse(confere("Bearer ", ""))
        self.assertFalse(confere("Bearer x", None))
        self.assertFalse(confere("x", "x"))
        self.assertFalse(rota_ask("Bearer outra", ENV))


if __name__ == "__main__":
    unittest.main()
