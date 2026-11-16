"""E3b (13/11/2026): seção dos trechos do Manual HCFMUSP 2022.

Roda com as dependências da imagem:
    python -m unittest test_ingest_secoes
"""
import unittest
from types import SimpleNamespace
from unittest import mock

import ingest


def secoes_de(paginas, formato):
    with mock.patch.dict("sys.modules", {"pymupdf4llm": SimpleNamespace(to_markdown=lambda *a, **k: paginas)}):
        return [(c["pagina"], c["secao"]) for c in ingest.chunks_pdf("livro.pdf", formato)]


TEXTO = "texto clínico do capítulo " * 12


class TestCapituloNumero(unittest.TestCase):
    def test_capitulo_com_nome_na_linha_seguinte_e_subtitulo_em_maiusculas(self):
        paginas = [
            {"metadata": {"page": 199}, "text": f"# 13\n\n Infarto agudo do miocárdio sem supradesnivelamento do segmento ST\n##### A doença isquêmica {TEXTO}\n"},
            {"metadata": {"page": 202}, "text": f"##### COMO ESTRATIFICAR O RISCO DO PACIENTE DE SCA?\n Após descartar {TEXTO}\n"},
            {"metadata": {"page": 203}, "text": f"##### (AAS) para o paciente. {TEXTO}\n"},
            {"metadata": {"page": 212}, "text": f"# 14\n Infarto agudo do miocárdio com supradesnivelamento do segmento ST\n QUAIS COMPLICAÇÕES PODEM SE APRESENTAR NO IAM COM SUPRA?\n {TEXTO}\n"},
        ]
        s = dict(secoes_de(paginas, "capitulo-numero"))
        self.assertEqual(s[199], "13 Infarto agudo do miocárdio sem supradesnivelamento do segmento ST")
        self.assertEqual(s[202], "13 Infarto agudo do miocárdio sem supradesnivelamento do segmento ST — COMO ESTRATIFICAR O RISCO DO PACIENTE DE SCA?")
        # linha de texto marcada com ##### volta a ser texto, e a página herda o título
        self.assertEqual(s[203], s[202])
        self.assertEqual(s[212], "14 Infarto agudo do miocárdio com supradesnivelamento do segmento ST — QUAIS COMPLICAÇÕES PODEM SE APRESENTAR NO IAM COM SUPRA?")

    def test_texto_marcado_nao_vira_titulo(self):
        self.assertFalse(ingest.titulo_em_maiusculas("– A diferenciação é complexa. Na dúvida, conduzir o caso como IAM."))
        self.assertFalse(ingest.titulo_em_maiusculas("IAM"))
        self.assertTrue(ingest.titulo_em_maiusculas("LEITURA SUGERIDA"))

    def test_sem_formato_o_leitor_antigo_nao_muda(self):
        paginas = [{"metadata": {"page": 516}, "text": "## 52 Cetoacidose diabética\n" + "texto da cad " * 40}]
        self.assertEqual(secoes_de(paginas, None), [(516, "52 Cetoacidose diabética")])


if __name__ == "__main__":
    unittest.main()
