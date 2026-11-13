"""E6 da trilha Hermes / Evidências (12/11/2026): uso de tokens da pergunta ao modelo.

Roda com as dependências da imagem:
    python -m unittest test_uso
"""
import unittest
from types import SimpleNamespace

import main


def uso(prompt, hit, saida):
    return SimpleNamespace(prompt_tokens=prompt, prompt_cache_hit_tokens=hit, completion_tokens=saida)


class TestSomarUso(unittest.TestCase):
    def test_soma_reescrita_e_resposta(self):
        u = main.somar_uso(("deepseek-flash", uso(100, 40, 20)), ("deepseek-flash", uso(1000, 0, 300)))
        self.assertEqual(u, {"type": "uso", "modelo": "deepseek-flash", "entrada_cache": 40, "entrada": 1060, "saida": 320})

    def test_sem_uso_nao_manda_linha(self):
        self.assertIsNone(main.somar_uso(None, None))
        self.assertIsNone(main.somar_uso(("m", None)))

    def test_campo_ausente_conta_zero(self):
        u = main.somar_uso(("m", SimpleNamespace(prompt_tokens=50, completion_tokens=5)))
        self.assertEqual((u["entrada_cache"], u["entrada"], u["saida"]), (0, 50, 5))

    def test_uso_da_reescrita_e_lido_uma_vez(self):
        main._uso_reescrita.valor = ("m", uso(1, 0, 1))
        self.assertIsNotNone(main.uso_da_reescrita())
        self.assertIsNone(main.uso_da_reescrita())


if __name__ == "__main__":
    unittest.main()
