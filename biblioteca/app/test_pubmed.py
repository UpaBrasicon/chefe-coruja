"""E5 da trilha Hermes / Evidências (12/11/2026): PubMed ao vivo, só a lista.

Roda com as dependências da imagem:
    python -m unittest test_pubmed
"""
import json
import unittest
from types import SimpleNamespace

import pubmed


class Resposta:
    def __init__(self, dados):
        self.dados = dados

    def raise_for_status(self):
        pass

    def json(self):
        return self.dados


class ClienteFalso:
    def __init__(self, ids, resumo):
        self.ids, self.resumo, self.chamadas = ids, resumo, []

    def get(self, url, params=None, timeout=None):
        self.chamadas.append((url, params))
        if url.endswith("esearch.fcgi"):
            return Resposta({"esearchresult": {"idlist": self.ids}})
        return Resposta({"result": self.resumo})


def llm_que_responde(texto):
    r = SimpleNamespace(model="deepseek-flash", usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5),
                        choices=[SimpleNamespace(message=SimpleNamespace(content=texto))])
    comp = SimpleNamespace(create=lambda **k: r)
    cliente = SimpleNamespace(chat=SimpleNamespace(completions=comp))
    return SimpleNamespace(with_options=lambda **k: cliente)


class TestPubmed(unittest.TestCase):
    def test_lista_com_tipo_ano_e_link(self):
        c = ClienteFalso(["111", "222"], {
            "111": {"title": "Hyperglycemic crises in adults with diabetes: a consensus report.", "fulljournalname": "Diabetes care",
                    "pubdate": "2024 Jul 1", "pubtype": ["Journal Article", "Practice Guideline"]},
            "222": {"title": "DKA management: a systematic review.", "source": "J Emerg", "pubdate": "2023", "pubtype": ["Systematic Review"]},
        })
        a = pubmed.buscar("diabetic ketoacidosis AND therapy", False, cliente=c)
        self.assertEqual([x["pmid"] for x in a], ["111", "222"])
        self.assertEqual(a[0]["tipo"], "diretriz")
        self.assertEqual(a[0]["ano"], 2024)
        self.assertEqual(a[0]["url"], "https://pubmed.ncbi.nlm.nih.gov/111/")
        self.assertEqual(a[1]["tipo"], "revisão sistemática")
        termo = c.chamadas[0][1]["term"]
        self.assertIn("guideline[pt]", termo)
        self.assertNotIn("child[mh]", termo)
        self.assertEqual(c.chamadas[0][1]["reldate"], 3650)

    def test_crianca_acrescenta_o_filtro_pediatrico(self):
        c = ClienteFalso([], {})
        self.assertEqual(pubmed.buscar("bronchiolitis", True, cliente=c), [])
        self.assertIn("child[mh]", c.chamadas[0][1]["term"])
        self.assertEqual(len(c.chamadas), 1)  # sem ids, não chama o resumo

    def test_ncbi_fora_devolve_lista_vazia(self):
        class Quebra:
            def get(self, *a, **k):
                raise RuntimeError("fora")
        self.assertEqual(pubmed.buscar("x", False, cliente=Quebra()), [])

    def test_traducao_e_fora_do_escopo(self):
        t, uso = pubmed.termos_pubmed("tratamento da cetoacidose no adulto", llm_que_responde("diabetic ketoacidosis AND therapy"), "m")
        self.assertEqual(t, "diabetic ketoacidosis AND therapy")
        self.assertEqual(uso[0], "deepseek-flash")
        t2, _ = pubmed.termos_pubmed("bom dia", llm_que_responde("FORA"), "m")
        self.assertIsNone(t2)

    def test_evento_diz_que_e_pubmed_ao_vivo(self):
        e = json.loads(pubmed.evento([{"pmid": "1"}], "x"))
        self.assertEqual(e["type"], "pubmed")
        self.assertEqual(e["origem"], "PubMed ao vivo")


if __name__ == "__main__":
    unittest.main()
