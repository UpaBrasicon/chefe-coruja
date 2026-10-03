"""Respostas recentes e medição do /v1/ask (03/10/2026).

Roda com as dependências da imagem (fastapi, httpx, openai, qdrant-client):
    BIBLIOTECA_API_KEY=t QDRANT_URL=http://x OLLAMA_URL=http://x EMBED_MODEL=x \
    DEEPSEEK_API_KEY=x python -m unittest test_velocidade
"""

import json
import os
import unittest
from types import SimpleNamespace
from unittest import mock

for k, v in {"BIBLIOTECA_API_KEY": "t", "QDRANT_URL": "http://qdrant.invalido", "OLLAMA_URL": "http://ollama.invalido",
             "EMBED_MODEL": "x", "DEEPSEEK_API_KEY": "x", "DEEPSEEK_BASE_URL": "http://llm.invalido"}.items():
    os.environ.setdefault(k, v)

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

TRECHO = SimpleNamespace(payload={"titulo": "Manual", "secao": "IC", "texto": "texto do trecho", "pagina": 10,
                                  "editor": "Ed", "ano": 2022, "ref": "r"}, score=0.9)


def stream_falso(*_a, **_kw):
    for pedaco in ["A IC é uma síndrome ", "clínica [1]."]:
        yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=pedaco))])


class TestVelocidade(unittest.TestCase):
    def setUp(self):
        main._cache.clear()
        self.cliente = TestClient(main.app)
        self.buscar = mock.patch.object(main, "buscar", return_value=([], [TRECHO], 0.9, True)).start()
        mock.patch.object(main, "passa_gate", return_value=True).start()
        mock.patch.object(main, "fmt_src", side_effect=lambda i, p: {"n": i + 1, "titulo": p.payload["titulo"]}).start()
        self.llm = mock.patch.object(main.llm.chat.completions, "create", side_effect=stream_falso).start()

    def tearDown(self):
        mock.patch.stopall()

    def perguntar(self, q, rid="r1"):
        r = self.cliente.post("/v1/ask", headers={"Authorization": "Bearer t"},
                              json={"q": q, "tenant_id": "global", "request_id": rid})
        return [json.loads(l) for l in r.text.splitlines() if l.strip()]

    def test_segunda_vez_vem_da_memoria_sem_buscar_nem_chamar_a_ia(self):
        a = self.perguntar("o que é icc", "r1")
        b = self.perguntar("O que é ICC?", "r2")
        self.assertEqual(self.buscar.call_count, 1)
        self.assertEqual(self.llm.call_count, 1)
        self.assertEqual([e["type"] for e in a], [e["type"] for e in b])
        self.assertTrue(b[0]["cache"])
        self.assertEqual(b[0]["request_id"], "r2")

    def test_pergunta_com_peso_nao_e_guardada(self):
        self.perguntar("dose de dipirona para 20 kg")
        self.perguntar("dose de dipirona para 20 kg")
        self.assertEqual(self.llm.call_count, 2)

    def test_validade_expira(self):
        self.perguntar("o que é icc")
        with mock.patch.object(main, "CACHE_TTL_S", -1):
            self.perguntar("o que é icc")
        self.assertEqual(self.llm.call_count, 2)

    def test_keep_alive_no_embed(self):
        with mock.patch.object(main.httpx, "post") as post:
            post.return_value.json.return_value = {"embeddings": [[0.1]]}
            main.embed("x")
        self.assertIn("keep_alive", post.call_args.kwargs["json"])


if __name__ == "__main__":
    unittest.main()
