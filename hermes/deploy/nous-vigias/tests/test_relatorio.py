"""Porte de hermes/src/jobs/relatorio.test.ts + gravação com id do cliente."""

from __future__ import annotations

import unittest

import apoio  # noqa: F401
from apoio import BancoFalso, contexto, erro
from vigias.relatorio import gerar_relatorio_semanal, montar_resumo

INICIO, FIM = "2026-08-16T00:00:00.000Z", "2026-08-23T00:00:00.000Z"


def inc(**over):
    return {"id": "i-1", "patrulha": "dados", "severidade": "atencao", "titulo": "X", "status": "aberto",
            "quando": "2026-08-20T10:00:00.000Z", **over}


def ale(**over):
    return {"id": "a-1", "unidade_id": "u1", "metrica": "repasses", "valor": 9, "status": "novo",
            "quando": "2026-08-20T10:00:00.000Z", **over}


class TestMontarResumo(unittest.TestCase):
    def test_vazio(self):
        r = montar_resumo([], [], INICIO, FIM)
        self.assertEqual((r["total_incidentes"], r["total_alertas"]), (0, 0))
        self.assertEqual(r["incidentes_por_severidade"], {"critico": 0, "atencao": 0, "informativo": 0})
        self.assertEqual(r["periodo"], {"inicio": "2026-08-16", "fim": "2026-08-23"})

    def test_por_severidade_e_patrulha(self):
        r = montar_resumo([inc(severidade="critico", patrulha="hermes"), inc(), inc(), inc(severidade="informativo", patrulha="conteudo")],
                          [], INICIO, FIM)
        self.assertEqual(r["total_incidentes"], 4)
        self.assertEqual(r["incidentes_por_severidade"], {"critico": 1, "atencao": 2, "informativo": 1})
        self.assertEqual(r["incidentes_por_patrulha"], {"dados": 2, "conteudo": 1, "hermes": 1})

    def test_alertas_por_status(self):
        r = montar_resumo([], [ale(), ale(), ale(status="justificado")], INICIO, FIM)
        self.assertEqual(r["alertas_por_status"], {"novo": 2, "visto": 0, "em_acompanhamento": 0, "justificado": 1})

    def test_desconhecidos_nao_quebram(self):
        r = montar_resumo([inc(patrulha="desconhecida")], [ale(status="x")], INICIO, FIM)
        self.assertEqual((r["total_incidentes"], r["total_alertas"]), (1, 1))
        self.assertEqual(r["incidentes_por_patrulha"], {"dados": 0, "conteudo": 0, "hermes": 0})


class TestJob(unittest.TestCase):
    def test_grava_com_id_gerado_e_periodo_de_7_dias(self):
        banco = BancoFalso({
            "incidentes_no_periodo": [{"id": "i1", "patrulha": "dados", "severidade": "critico", "titulo": "T", "status": "aberto",
                                       "detectado_em": "2026-10-01T10:00:00+00:00"}],
            "alertas_no_periodo": [{"id": "a1", "unidade_id": "u1", "metrica": "faltas", "valor": 3, "status": "novo",
                                    "criado_em": "2026-10-01T10:00:00+00:00"}],
        })
        ctx, _ = contexto(banco)
        r = gerar_relatorio_semanal(ctx)
        self.assertEqual(banco.chamadas[0][2], ("2026-09-28T12:00:00.123Z", "2026-10-05T12:00:00.123Z"))
        (id_, inicio, fim, resumo, detalhes), = banco.escritas_de("inserir_relatorio")
        self.assertEqual(id_, r["id"])
        self.assertEqual((inicio, fim), ("2026-09-28", "2026-10-05"))
        self.assertEqual(resumo["incidentes_por_severidade"]["critico"], 1)
        self.assertEqual(detalhes["incidentes"][0], {"id": "i1", "patrulha": "dados", "severidade": "critico", "titulo": "T",
                                                     "status": "aberto", "quando": "2026-10-01T10:00:00+00:00"})
        self.assertEqual(list(detalhes["alertas"][0]), ["id", "unidade_id", "metrica", "valor", "status", "quando"])

    def test_erros_derrubam(self):
        for falha in ({"incidentes_no_periodo": erro()}, {"alertas_no_periodo": erro()}):
            ctx, _ = contexto(BancoFalso(falha))
            with self.assertRaises(RuntimeError):
                gerar_relatorio_semanal(ctx)
        ctx, _ = contexto(BancoFalso(falha_escrita={"inserir_relatorio": erro()}))
        with self.assertRaises(RuntimeError):
            gerar_relatorio_semanal(ctx)


if __name__ == "__main__":
    unittest.main()
