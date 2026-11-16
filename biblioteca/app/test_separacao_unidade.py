"""Trilha Hermes / Evidências, E1 (decisão do RT de 12/11/2026): o corpus fica no
Qdrant, e a separação por unidade é o filtro de `tenant_id` da busca. Este teste
prova, contra um Qdrant de verdade, que a unidade A não lê trecho da unidade B:
cria uma coleção temporária, grava um trecho global, um da unidade A e um da B,
chama a mesma `buscar` da API e apaga a coleção no fim. Não toca nas coleções
`biblioteca` e `biblioteca_homolog`.

Roda dentro do container da API (precisa do Qdrant e das variáveis da imagem):
    python -m unittest test_separacao_unidade
"""
import os
import unittest
import uuid
from unittest import mock

from qdrant_client import models

import main

DIM = 1024  # a mesma dimensão da coleção "ferramentas", consultada com o mesmo vetor
VETOR = [1.0] + [0.0] * (DIM - 1)
TEXTO = "hipotermia terapêutica protocolo de resfriamento após parada cardíaca " * 4
UNIDADE_A = "e1a00000-0000-4000-8000-00000000000a"
UNIDADE_B = "e1b00000-0000-4000-8000-00000000000b"
UNIDADE_C = "e1c00000-0000-4000-8000-00000000000c"


class TestSeparacaoPorUnidade(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.colecao = f"teste_separacao_{uuid.uuid4().hex[:8]}"
        main.qd.create_collection(cls.colecao, vectors_config=models.VectorParams(size=DIM, distance=models.Distance.COSINE))
        for campo in ("tenant_id", "fonte_id"):
            main.qd.create_payload_index(cls.colecao, campo, models.PayloadSchemaType.KEYWORD)
        main.qd.create_payload_index(cls.colecao, "texto", models.TextIndexParams(
            type="text", tokenizer=models.TokenizerType.WORD, lowercase=True, min_token_len=2, max_token_len=30))
        trechos = [(1, "global"), (2, UNIDADE_A), (3, UNIDADE_B)]
        main.qd.upsert(cls.colecao, wait=True, points=[models.PointStruct(
            id=pid, vector=VETOR,
            payload={"texto": TEXTO, "secao": "", "pagina": None, "titulo": f"Fonte de teste {tenant}",
                     "fonte_id": f"teste{pid}", "editor": "teste", "ano": 2026, "licenca": "institucional", "tenant_id": tenant},
        ) for pid, tenant in trechos])

    @classmethod
    def tearDownClass(cls):
        main.qd.delete_collection(cls.colecao)

    def ids_para(self, unidade: str) -> set:
        with mock.patch.object(main, "COLECAO", self.colecao), mock.patch.object(main, "embed", return_value=VETOR):
            _tools, trechos, _melhor, _lex = main.buscar("hipotermia terapêutica após parada cardíaca", unidade)
        return {p.id for p in trechos}

    def test_unidade_a_le_global_e_a_propria(self):
        self.assertEqual(self.ids_para(UNIDADE_A), {1, 2})

    def test_unidade_b_nao_le_trecho_da_a(self):
        self.assertEqual(self.ids_para(UNIDADE_B), {1, 3})

    def test_outra_unidade_so_le_global(self):
        self.assertEqual(self.ids_para(UNIDADE_C), {1})

    def test_tenant_vazio_ou_curinga_nao_abre_tudo(self):
        self.assertEqual(self.ids_para("global"), {1})
        self.assertEqual(self.ids_para("*"), {1})


if __name__ == "__main__":
    unittest.main()
