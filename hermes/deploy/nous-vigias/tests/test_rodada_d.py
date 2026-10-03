"""Vigias da rodada D (porte de hermes/src/jobs/vigias.ts e vigias.test.ts)."""

from __future__ import annotations

import datetime as _dt
import unittest

import apoio  # noqa: F401
from apoio import BancoFalso, contexto, erro
from vigias.comum import UTC
from vigias.rodada_d import (
    cadeia_auditoria, guardiao_prontuario, texto_escala, texto_porta, vigia_escala, vigia_porta, vigia_presenca, vigia_tardios,
)

PORTA = {"janela_horas": 12, "fichas": 14, "atendidos": 12, "evasoes": 1, "aguardando_agora": 3,
         "por_cor": {"laranja": {"atendidos": 3, "dentro_do_alvo": 2, "espera_media_min": 12},
                     "verde": {"atendidos": 9, "dentro_do_alvo": 9, "espera_media_min": 40}}}
UNIDADES = [{"id": "u1", "nome": "UPA Centro"}]
GESTORES = [{"perfil_id": "g1"}, {"perfil_id": "g2"}]


class TestPorta(unittest.TestCase):
    def test_texto_so_numeros_cor_a_cor(self):
        t = texto_porta("UPA Centro", PORTA)
        self.assertIn("14 fichas · 12 atendidos · 1 evasões · 3 aguardando agora", t)
        self.assertIn("Laranja: 2/3 no tempo-alvo (espera média 12 min)", t)
        self.assertLess(t.index("Laranja"), t.index("Verde"))  # mais grave primeiro
        self.assertTrue(t.startswith("🦉 Porta — últimas 12 h · UPA Centro\n"))

    def test_tipo_leva_a_hora_de_brasilia_e_pula_unidade_parada(self):
        banco = BancoFalso({"unidades_ativas": UNIDADES + [{"id": "u2", "nome": "Parada"}], "gestores_da_unidade": GESTORES},
                           {"hermes_porta_resumo": lambda p: PORTA if p["p_unidade"] == "u1" else {**PORTA, "fichas": 0, "aguardando_agora": 0}})
        ctx, _ = contexto(banco, agora=_dt.datetime(2026, 10, 5, 22, 5, tzinfo=UTC))  # 19h05 BR
        self.assertEqual(vigia_porta(ctx), 2)
        self.assertEqual({a[3] for a in banco.escritas_de("inserir_notificacao")}, {"porta_resumo_19h"})
        self.assertIn(("rpc", "hermes_porta_resumo", {"p_unidade": "u1", "p_horas": 12}), banco.chamadas)

    def test_hora_com_dois_digitos(self):
        banco = BancoFalso({"unidades_ativas": UNIDADES, "gestores_da_unidade": GESTORES[:1]}, {"hermes_porta_resumo": PORTA})
        ctx, _ = contexto(banco, agora=_dt.datetime(2026, 10, 5, 10, 5, tzinfo=UTC))  # 07h05 BR
        vigia_porta(ctx)
        self.assertEqual(banco.escritas_de("inserir_notificacao")[0][3], "porta_resumo_07h")


class TestPresencaEscalaTardios(unittest.TestCase):
    def test_presenca_um_aviso_por_inicio(self):
        banco = BancoFalso(rpcs={"hermes_checkin_pendente": [
            {"perfil_id": "p1", "unidade_id": "u1", "setor": "Sala Vermelha", "inicio_brasilia": "07:00", "escala_id": "e1"}]})
        ctx, _ = contexto(banco)
        self.assertEqual(vigia_presenca(ctx), 1)
        (_, perfil, unidade, tipo, mensagem, data), = banco.escritas_de("inserir_notificacao")
        self.assertEqual((perfil, unidade, tipo, data), ("p1", "u1", "checkin_pendente_0700", "2026-10-05"))
        self.assertEqual(mensagem, "Seu plantão em Sala Vermelha começou às 07:00 e o check-in ainda não foi feito. Faça em Meu Plantão.")

    def test_presenca_duplicada_no_dia_nao_conta(self):
        banco = BancoFalso(rpcs={"hermes_checkin_pendente": [
            {"perfil_id": "p1", "unidade_id": "u1", "setor": "S", "inicio_brasilia": "07:00", "escala_id": "e1"}]},
            falha_escrita={"inserir_notificacao": erro("duplicate key", "23505")})
        ctx, _ = contexto(banco)
        self.assertEqual(vigia_presenca(ctx), 0)

    def test_escala_agrupa_por_unidade_e_corta_em_6(self):
        buracos = [{"unidade_id": "u1", "setor": f"S{i}", "horas_sem_ninguem": 12, "primeira_hora_brasilia": "05/10 19:00"} for i in range(8)]
        texto = texto_escala(buracos)
        self.assertEqual(texto.count("\n• S"), 6)
        self.assertTrue(texto.endswith("• … e mais 2 setores"))
        self.assertTrue(texto.startswith("Escala das próximas 24 h com setor descoberto:\n• S0: 12 h sem ninguém, a partir de 05/10 19:00"))
        banco = BancoFalso({"gestores_da_unidade": GESTORES}, {"hermes_buracos_escala": buracos + [{**buracos[0], "unidade_id": "u2"}]})
        ctx, _ = contexto(banco)
        self.assertEqual(vigia_escala(ctx), 4)
        self.assertIn(("rpc", "hermes_buracos_escala", {"p_horas": 24}), banco.chamadas)
        self.assertEqual({a[3] for a in banco.escritas_de("inserir_notificacao")}, {"escala_buraco"})

    def test_tardios(self):
        banco = BancoFalso({"gestores_da_unidade": GESTORES[:1]},
                           {"hermes_revisoes_paradas": [{"unidade_id": "u1", "pendentes": 3, "mais_antiga_brasilia": "03/10 10:00"}]})
        ctx, _ = contexto(banco)
        self.assertEqual(vigia_tardios(ctx), 1)
        self.assertEqual(banco.escritas_de("inserir_notificacao")[0][4],
                         "3 registro(s) feitos sem conexão aguardam revisão há mais de 24 h (o mais antigo chegou 03/10 10:00). Abra Unidade → Registros tardios.")

    def test_erro_de_rpc_derruba(self):
        ctx, _ = contexto(BancoFalso(rpcs={"hermes_checkin_pendente": erro()}))
        with self.assertRaises(RuntimeError):
            vigia_presenca(ctx)


class TestGuardiaoCadeia(unittest.TestCase):
    def test_guardiao_chave_por_pessoa_unidade_e_dia(self):
        anomalo = {"perfil_id": "p1", "unidade_id": "u1", "aberturas": 120, "impressoes": 3, "pacientes_distintos": 90}
        banco = BancoFalso(rpcs={"hermes_acessos_anomalos": [anomalo]})
        ctx, _ = contexto(banco)
        self.assertEqual(guardiao_prontuario(ctx), 1)
        self.assertIn(("rpc", "hermes_acessos_anomalos", {"p_horas": 24, "p_aberturas": 80, "p_impressoes": 40}), banco.chamadas)
        (linhas,), = banco.escritas_de("inserir_incidentes")
        self.assertEqual(linhas[0], {"patrulha": "dados", "severidade": "atencao", "titulo": "Acesso ao prontuário fora do padrão (24 h)",
                                     "evidencia": anomalo, "chave_dedup": "dados:guardiao:p1:u1:2026-10-05"})

    def test_cadeia_integra_null_nao_registra(self):
        banco = BancoFalso(rpcs={"hermes_cadeia_auditoria": None})
        ctx, _ = contexto(banco)
        self.assertTrue(cadeia_auditoria(ctx))
        self.assertEqual(banco.escritas, [])

    def test_cadeia_quebrada_registra_critico(self):
        banco = BancoFalso(rpcs={"hermes_cadeia_auditoria": 4211})
        ctx, _ = contexto(banco)
        self.assertFalse(cadeia_auditoria(ctx))
        (linhas,), = banco.escritas_de("inserir_incidentes")
        self.assertEqual((linhas[0]["severidade"], linhas[0]["chave_dedup"], linhas[0]["evidencia"]),
                         ("critico", "dados:cadeia:4211", {"primeira_linha_invalida": 4211}))

    def test_cadeia_erro_derruba(self):
        ctx, _ = contexto(BancoFalso(rpcs={"hermes_cadeia_auditoria": erro()}))
        with self.assertRaises(RuntimeError):
            cadeia_auditoria(ctx)


if __name__ == "__main__":
    unittest.main()
