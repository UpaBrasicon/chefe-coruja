"""IA1 e IA2 da busca com IA (RT, 24/11/2026): partes sem dependência de fora.

    python -m unittest test_seguimento
"""
import json
import unittest

import seguimento as s

HIST = [{"pergunta": "dose de ataque de amiodarona na FA com instabilidade", "resposta": "Amiodarona 150 mg IV [1] em 10 min [2, 3]."}]


class TestConversa(unittest.TestCase):
    def test_busca_leva_a_pergunta_anterior(self):
        self.assertEqual(s.pergunta_de_busca("e na criança?", HIST), "dose de ataque de amiodarona na FA com instabilidade e na criança?")
        self.assertEqual(s.pergunta_de_busca("dor torácica", []), "dor torácica")

    def test_so_as_duas_ultimas(self):
        hist = [{"pergunta": f"p{i}", "resposta": ""} for i in range(4)]
        self.assertEqual([t["pergunta"] for t in s.ultimas(hist)], ["p2", "p3"])

    def test_bloco_sem_citacoes(self):
        bloco = s.bloco_da_conversa(HIST)
        self.assertIn("CONVERSA ANTERIOR", bloco)
        self.assertIn("Amiodarona 150 mg IV em 10 min.", bloco)
        self.assertNotIn("[1]", bloco)
        self.assertEqual(s.bloco_da_conversa([]), "")

    def test_reescrita_com_contexto(self):
        self.assertIn("amiodarona", s.para_reescrita("e na criança?", HIST))
        self.assertEqual(s.para_reescrita("dor torácica", []), "dor torácica")

    def test_pseudonimo_nao_e_citacao(self):
        self.assertEqual(s.sem_citacoes("[PACIENTE_1] com febre [1]"), "[PACIENTE_1] com febre")


class TestSugestoes(unittest.TestCase):
    def test_limpa_marcadores_e_aspas(self):
        texto = '1. "Carga da cardioversão sincronizada"\n- Dose na FA estável\n• interação com anticoagulante\n- Quarta pergunta'
        self.assertEqual(s.ler_sugestoes(texto),
                         ["Carga da cardioversão sincronizada", "Dose na FA estável", "Interação com anticoagulante"])

    def test_nenhuma(self):
        self.assertEqual(s.ler_sugestoes("NENHUMA"), [])
        self.assertEqual(s.ler_sugestoes(""), [])

    def test_dose_pseudonimo_e_repeticao_saem(self):
        texto = ("Amiodarona 300 mg na PCR\nConduta em [PACIENTE_1]\ncardioversão na FA instável\n"
                 "Escore CHA2DS2-VASc\n" + "x" * 90)
        self.assertEqual(s.ler_sugestoes(texto, "Cardioversão na FA instável?"), ["Escore CHA2DS2-VASc"])

    def test_evento(self):
        self.assertIsNone(s.evento([]))
        self.assertEqual(json.loads(s.evento(["Dose na FA estável"])), {"type": "sugestoes", "itens": ["Dose na FA estável"]})

    def test_pedido_leva_trechos_curtos(self):
        trechos = [{"titulo": "Manual", "secao": "FA", "texto": "a " * 400}]
        pedido = s.pedido_sugestoes("q", "Resposta [1].", trechos)
        self.assertIn("[1] Manual, FA:", pedido)
        self.assertIn("RESPOSTA:\nResposta.", pedido)
        self.assertLess(len(pedido), 600)


if __name__ == "__main__":
    unittest.main()
