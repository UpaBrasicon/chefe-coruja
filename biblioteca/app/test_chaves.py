"""LG6 (I5): o /v1/ask só com a chave da Edge. Roda sem dependências:
    python -m unittest test_chaves
"""
import unittest

from chaves import chave_ask, chave_geral, confere


class Chaves(unittest.TestCase):
    def test_com_chave_ask_a_chave_geral_nao_abre_o_ask(self):
        env = {"BIBLIOTECA_API_KEY": "geral", "BIBLIOTECA_ASK_KEY": "edge"}
        self.assertTrue(confere("Bearer edge", chave_ask(env)))
        self.assertFalse(confere("Bearer geral", chave_ask(env)))
        self.assertTrue(confere("Bearer geral", chave_geral(env)), "as outras rotas seguem com a chave geral")

    def test_sem_chave_ask_vale_a_geral(self):
        env = {"BIBLIOTECA_API_KEY": "geral"}
        self.assertTrue(confere("Bearer geral", chave_ask(env)))

    def test_sem_cabecalho_ou_sem_chave_recusa(self):
        self.assertFalse(confere(None, "x"))
        self.assertFalse(confere("Bearer ", ""))
        self.assertFalse(confere("Bearer x", None))
        self.assertFalse(confere("x", "x"))


if __name__ == "__main__":
    unittest.main()
