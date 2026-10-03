"""Porte de hermes/src/agent/sentinela.test.ts + o fluxo do job com banco falso."""

from __future__ import annotations

import math
import unittest

import apoio  # noqa: F401
from apoio import BancoFalso, contexto, erro
from vigias.sentinela import calcular_limite_outlier, calcular_metricas_unidade, detectar_outliers, rodar_sentinela


def m(id_, plantoes, repasses=0, tardio=0, conc=0.0):
    return {"medico_id": id_, "plantoes_atribuidos": plantoes, "repasses": repasses, "faltas": 0,
            "cancelamento_tardio": tardio, "trocas_iniciadas": 0, "concentracao_destino": conc}


class TestLogicaPura(unittest.TestCase):
    def test_limite_iqr(self):
        self.assertEqual(calcular_limite_outlier([1, 2, 3, 4, 5]), (3, 7))  # Q1=2, Q3=4, IQR=2
        self.assertFalse(math.isfinite(calcular_limite_outlier([3])[1]))

    def test_menos_de_8_plantoes_nao_gera(self):
        metricas = [m("a", 6, 10, 9, 1), m("b", 20, 1, 0, 0.2), m("c", 25, 2, 0, 0.3), m("d", 30, 0, 0, 0.1)]
        self.assertEqual([a for a in detectar_outliers(metricas, "30d") if a["medico_id"] == "a"], [])

    def test_outlier_com_8_ou_mais(self):
        metricas = [m("a", 20, 12, 10, 0.9), m("b", 20, 1, 0, 0.2), m("c", 25, 2, 0, 0.3), m("d", 30, 0, 0, 0.1),
                    m("e", 22, 1, 0, 0.25), m("f", 18, 2, 0, 0.15), m("g", 28, 1, 0, 0.2), m("h", 24, 0, 0, 0.1)]
        alertas = detectar_outliers(metricas, "30d")
        self.assertTrue(any(a["medico_id"] == "a" and a["metrica"] == "taxa_repasse" for a in alertas))
        self.assertTrue(any(a["medico_id"] == "a" and a["metrica"] == "cancelamento_tardio" for a in alertas))

    def test_sem_outlier(self):
        metricas = [m("a", 10, 1, 0, 0.3), m("b", 12, 2, 0, 0.4), m("c", 15, 1, 0, 0.2), m("d", 20, 2, 0, 0.3),
                    m("e", 18, 1, 0, 0.25), m("f", 22, 2, 0, 0.35), m("g", 14, 1, 0, 0.2), m("h", 16, 1, 0, 0.28)]
        self.assertEqual(detectar_outliers(metricas, "30d"), [])


UNIDADE = "u1"


def banco_escala(medicos=8, repasses_do_a=6, aberto=False):
    escala = [{"id": f"e{i}-{j}", "perfil_id": f"m{i}", "data": "2026-09-20", "turno": "D"}
              for i in range(medicos) for j in range(10)]
    sols = [{"perfil_id": "m0", "tipo": "passar_plantao", "status": "aprovado", "destino_perfil_id": "m1",
             "created_at": "2026-09-19T12:00:00.000001+00:00", "escala_plantao": {"data": "2026-09-20"}}  # < 48 h
            for _ in range(repasses_do_a)]
    sols.append({"perfil_id": "m2", "tipo": "falta", "status": "pendente", "destino_perfil_id": None,
                 "created_at": "2026-09-10T12:00:00+00:00", "escala_plantao": None})
    return BancoFalso({
        "unidades_ativas": [{"id": UNIDADE, "nome": "UPA Centro"}],
        "escala_da_unidade": escala,
        "solicitacoes_da_unidade": sols,
        "trocas_da_unidade": [{"perfil_a_id": "m3", "status": "erro", "created_at": "2026-09-10T00:00:00+00:00"}],
        "alerta_escala_aberto": [{"id": "x"}] if aberto else [],
        "gestores_da_unidade": [{"perfil_id": "g1"}],
        "nomes_de_perfis": [{"id": "m0", "nome_completo": "Dra. Ana"}],
    })


class TestJob(unittest.TestCase):
    def test_metricas_com_tardio_concentracao_e_troca_com_erro(self):
        ctx, _ = contexto(banco_escala())
        metricas = {x["medico_id"]: x for x in calcular_metricas_unidade(ctx, UNIDADE, "30d")}
        self.assertEqual(metricas["m0"]["repasses"], 6)
        self.assertEqual(metricas["m0"]["cancelamento_tardio"], 6)
        self.assertEqual(metricas["m0"]["concentracao_destino"], 1)
        self.assertEqual(metricas["m2"]["faltas"], 1)
        self.assertEqual(metricas["m3"]["trocas_iniciadas"], 0)  # status 'erro' não conta
        # janela: desde hoje-30 até hoje (datas de Brasília)
        chamada = next(c for c in ctx.banco.chamadas if c[1] == "escala_da_unidade")
        self.assertEqual(chamada[2], (UNIDADE, "2026-09-05", "2026-10-05"))

    def test_insere_alertas_e_notifica_gestor_com_texto_factual(self):
        banco = banco_escala()
        ctx, _ = contexto(banco)
        r = rodar_sentinela(ctx)
        alertas = banco.escritas_de("inserir_alerta_escala")
        self.assertEqual(r["alertas_novos"], len(alertas))
        self.assertGreater(len(alertas), 0)
        metricas = {(a[3], a[2]) for a in alertas}
        self.assertIn(("taxa_repasse", "30d"), metricas)
        self.assertIn(("concentracao_destino", "90d"), metricas)
        (_, perfil, unidade, tipo, mensagem, _data), = banco.escritas_de("inserir_notificacao")
        self.assertEqual((perfil, unidade, tipo), ("g1", UNIDADE, "sentinela_escala"))
        self.assertTrue(mensagem.startswith("📊 Sentinela de Escala — Unidade UPA Centro — semana 2026-10-05\n\n• Dra. Ana: 6 repasses em 30d (mediana da unidade: 0)"))
        self.assertIn("• Dra. Ana: 1 concentração de destino em 30d (mediana da unidade: 0) (100% para o mesmo destino)", mensagem)

    def test_alerta_ja_aberto_nao_duplica_nem_notifica(self):
        banco = banco_escala(aberto=True)
        ctx, _ = contexto(banco)
        self.assertEqual(rodar_sentinela(ctx)["alertas_novos"], 0)
        self.assertEqual(banco.escritas, [])

    def test_falha_ao_listar_unidades_derruba(self):
        ctx, _ = contexto(BancoFalso({"unidades_ativas": erro()}))
        with self.assertRaises(RuntimeError):
            rodar_sentinela(ctx)

    def test_sombra_anota_alertas_e_notificacao(self):
        ctx, reg = contexto(banco_escala(), modo="sombra")
        rodar_sentinela(ctx)
        tabelas = {l["tabela"] for l in reg.linhas}
        self.assertEqual(tabelas, {"chronos_alertas_escala", "notificacoes_plantonista"})
        self.assertEqual(ctx.banco.escritas, [])


if __name__ == "__main__":
    unittest.main()
