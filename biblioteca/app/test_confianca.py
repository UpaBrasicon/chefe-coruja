"""E4 da trilha Hermes / Evidências (12/11/2026): confiança em três níveis e
identificador do trecho na resposta.

Roda com as dependências da imagem:
    python -m unittest test_confianca
"""
import unittest
from types import SimpleNamespace

import main


def ponto(pid, fonte, score):
    return SimpleNamespace(id=pid, score=score, payload={"fonte_id": fonte, "titulo": "t", "editor": "e", "ano": 2026})


class TestConfianca(unittest.TestCase):
    def test_duas_fontes_acima_do_corte_e_alta(self):
        self.assertEqual(main.confianca([ponto(1, "a", 0.7), ponto(2, "b", 0.6)], True, True), "alta")

    def test_uma_fonte_so_e_moderada(self):
        self.assertEqual(main.confianca([ponto(1, "a", 0.7), ponto(2, "a", 0.65)], True, True), "moderada")

    def test_segunda_fonte_abaixo_do_corte_nao_conta(self):
        abaixo = main.GATE_MIN - 0.05
        self.assertEqual(main.confianca([ponto(1, "a", 0.7), ponto(2, "b", abaixo)], True, True), "moderada")

    def test_sem_palavra_em_comum_usa_o_corte_mais_alto(self):
        meio = (main.GATE_MIN + main.GATE_SEM_LEXICO) / 2
        self.assertEqual(main.confianca([ponto(1, "a", 0.7), ponto(2, "b", meio)], False, True), "moderada")
        self.assertEqual(main.confianca([ponto(1, "a", 0.7), ponto(2, "b", meio)], True, True), "alta")

    def test_sem_gate_e_baixa(self):
        self.assertEqual(main.confianca([ponto(1, "a", 0.7), ponto(2, "b", 0.7)], True, False), "baixa")

    def test_trecho_lexical_sem_score_nao_conta(self):
        self.assertEqual(main.confianca([ponto(1, "a", 0.7), ponto(2, "b", None)], True, True), "moderada")

    def test_fonte_leva_o_id_do_trecho(self):
        p = SimpleNamespace(id=123456789, score=0.7, payload={"titulo": "t", "editor": "e", "ano": 2026, "secao": "s", "pagina": 4})
        f = main.fmt_src(0, p)
        self.assertEqual(f["trecho_id"], "123456789")
        self.assertEqual(f["n"], 1)


if __name__ == "__main__":
    unittest.main()
