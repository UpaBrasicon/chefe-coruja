"""Filtro de nomes com vocabulário clínico (decisão do RT em 15/10/2026).

Roda com as dependências da imagem e o corpus do repositório:
    BIBLIOTECA_DIR=.. python -m unittest test_pii
"""
import os
import unittest
from types import SimpleNamespace
from unittest import mock

os.environ.setdefault("BIBLIOTECA_DIR", "..")

import pii  # noqa: E402


def nlp_falso(*nomes):
    """NER de mentira: marca como pessoa cada texto passado."""
    def nlp(t):
        return SimpleNamespace(ents=[SimpleNamespace(text=n, label_="PER") for n in nomes if n in t])
    return nlp


class TestVocabularioClinico(unittest.TestCase):
    def test_palavras_medicas_e_erro_de_digitacao(self):
        for w in ["hantavirose", "anafilaxia", "anafilaxa", "news", "wells", "glasgow", "kawasaki", "adrenalina"]:
            self.assertTrue(pii.palavra_clinica(w), w)

    def test_nomes_de_gente_nunca(self):
        for w in ["maria", "joao", "ricardo", "santos", "silva", "carson", "schvartsman", "brandao", "paulo"]:
            self.assertFalse(pii.palavra_clinica(w), w)

    def test_entidade_so_e_clinica_se_todas_as_palavras_forem(self):
        self.assertTrue(pii.entidade_clinica("Hantavirose"))
        self.assertFalse(pii.entidade_clinica("Maria Wells"))
        self.assertFalse(pii.entidade_clinica(""))


class TestPseudonimizar(unittest.TestCase):
    def tearDown(self):
        mock.patch.stopall()

    def test_palavra_medica_nao_vira_pessoa(self):
        mock.patch.object(pii, "_nlp", return_value=nlp_falso("hantavirose", "anafilaxa")).start()
        self.assertEqual(pii.pseudonimizar("hantavirose síndrome cardiopulmonar conduta"), "hantavirose síndrome cardiopulmonar conduta")
        self.assertEqual(pii.pseudonimizar("anafilaxa adrenalina"), "anafilaxa adrenalina")

    def test_nome_de_pessoa_continua_mascarado(self):
        mock.patch.object(pii, "_nlp", return_value=nlp_falso("Maria da Silva", "Maria Wells")).start()
        self.assertEqual(pii.pseudonimizar("a Maria da Silva do leito com dengue"), "a [PESSOA] do leito com dengue")
        self.assertEqual(pii.pseudonimizar("paciente Maria Wells com TEP"), "paciente [PESSOA] com TEP")


class TestNerEstrito(unittest.TestCase):
    """E2 da trilha Hermes / Evidências (12/11/2026): no caminho do modelo, NER fora = não sai."""

    def tearDown(self):
        mock.patch.stopall()

    def test_sem_modelo_estrito_lanca_e_simples_segue(self):
        mock.patch.object(pii, "_nlp", return_value=None).start()
        with self.assertRaises(pii.NerIndisponivel):
            pii.pseudonimizar("a Maria do leito com dengue", estrito=True)
        self.assertEqual(pii.pseudonimizar("CPF 123.456.789-09 com dengue"), "CPF [CPF] com dengue")

    def test_ner_que_falha_estrito_lanca(self):
        def quebra(_t):
            raise RuntimeError("falhou")
        mock.patch.object(pii, "_nlp", return_value=quebra).start()
        with self.assertRaises(pii.NerIndisponivel):
            pii.nomes_proprios_estrito("a Maria do leito")
        self.assertEqual(pii.nomes_proprios("a Maria do leito"), [])

    def test_estrito_com_modelo_mascara(self):
        mock.patch.object(pii, "_nlp", return_value=nlp_falso("Maria da Silva")).start()
        self.assertEqual(pii.pseudonimizar("a Maria da Silva com dengue", estrito=True), "a [PESSOA] com dengue")


if __name__ == "__main__":
    unittest.main()
