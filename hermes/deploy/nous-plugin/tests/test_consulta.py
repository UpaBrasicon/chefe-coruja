"""Testes da consulta direta no plugin (etapa 1 da migração Hermes → Nous).

Espelham hermes/src/server/skill-api.test.ts (guarda de papel e unidade) e
cobrem o que a rota HTTP fazia: mapeamento escopo/comando → RPC e parâmetros,
pós-processamento, cross-tenant com auditoria, almanaque, vínculo com limite
de tentativas. O banco é um rpc() falso que grava as chamadas.

Rodar: python -m unittest discover -s hermes/deploy/nous-plugin/tests -v
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import types
import unittest
from unittest import mock
import logging

logging.disable(logging.CRITICAL)  # logs de erro esperados não poluem a saída

PASTA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chefe-coruja")

# O plugin importa gateway.session_context (do Nous). Aqui vai um falso, com
# a sessão controlada pelo teste.
SESSAO: dict[str, str] = {}
_gw = types.ModuleType("gateway")
_sc = types.ModuleType("gateway.session_context")
_sc.get_session_env = lambda nome, padrao="": SESSAO.get(nome, padrao)
_gw.session_context = _sc
sys.modules.setdefault("gateway", _gw)
sys.modules["gateway.session_context"] = _sc


def _carregar_pacote():
    spec = importlib.util.spec_from_file_location(
        "chefe_coruja_plugin", os.path.join(PASTA, "__init__.py"), submodule_search_locations=[PASTA]
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["chefe_coruja_plugin"] = mod
    spec.loader.exec_module(mod)
    return mod


plugin = _carregar_pacote()
consulta = plugin._modulo("consulta")

UNIDADE_A = "11111111-1111-4111-8111-111111111111"
UNIDADE_B = "22222222-2222-4222-8222-222222222222"


def identidade(**over):
    """Igual ao helper do teste TS."""
    papel = over.get("papel", "plantonista")
    base = {
        "perfilId": "perfil-1",
        "nome": "Fulano",
        "email": None,
        "papel": papel,
        "unidadeId": UNIDADE_A,
        "unidadeNome": "UPA Centro",
        "organizacaoId": "org-1",
        "vinculos": [{"papel": papel, "unidadeId": UNIDADE_A, "unidadeNome": "UPA Centro", "organizacaoId": "org-1"}] if papel else [],
        "superAdmin": False,
    }
    base.update(over)
    return base


def linha_identidade(vinculos=(("plantonista", UNIDADE_A),), super_admin=False, nome="Fulano"):
    return {
        "perfil_id": "perfil-1",
        "nome_completo": nome,
        "email": None,
        "is_super_admin": super_admin,
        "vinculos": [{"unidade_id": u, "papel": p, "unidade_nome": "U", "organizacao_id": "org-1"} for p, u in vinculos],
    }


class RpcFalso:
    """Grava (nome, params) e responde pela tabela ``respostas``."""

    def __init__(self, respostas=None, identidade_linha=None, falhar=()):
        self.chamadas: list[tuple[str, dict]] = []
        self.respostas = dict(respostas or {})
        if identidade_linha is not None:
            self.respostas.setdefault("hermes_identidade_por_canal", [identidade_linha])
        self.falhar = set(falhar)

    def __call__(self, nome, params):
        self.chamadas.append((nome, params))
        if nome in self.falhar:
            raise RuntimeError(f"erro em {nome}")
        r = self.respostas.get(nome)
        return r(params) if callable(r) else r

    def nomes(self):
        return [n for n, _ in self.chamadas]

    def params(self, nome):
        return next(p for n, p in self.chamadas if n == nome)


def consultar(rpc, escopo, comando, args=None, canal="telegram", ident="12345", **kw):
    return consulta.consultar(rpc, canal, ident, escopo, comando, args or {}, hoje=lambda: "2026-10-02", **kw)


# ── Guarda de papel (cópia dos casos de skill-api.test.ts) ───────────────────

class TestAutorizado(unittest.TestCase):
    def test_seguranca_infra_negados_sem_super(self):
        for papel in ("plantonista", "gestor", "admin"):
            self.assertFalse(consulta.autorizado("seguranca", identidade(papel=papel)), papel)
            self.assertFalse(consulta.autorizado("infra", identidade(papel=papel)), papel)

    def test_seguranca_infra_super_admin(self):
        su = identidade(papel="gestor", superAdmin=True)
        self.assertTrue(consulta.autorizado("seguranca", su))
        self.assertTrue(consulta.autorizado("infra", su))

    def test_super_admin_ausente_falha_fechado(self):
        sem = identidade(papel="admin")
        del sem["superAdmin"]
        self.assertFalse(consulta.autorizado("seguranca", sem))

    def test_super_admin_truthy_nao_conta(self):
        self.assertFalse(consulta.autorizado("infra", identidade(papel="admin", superAdmin="true")))

    def test_sentinela(self):
        self.assertFalse(consulta.autorizado("sentinela", identidade(papel="plantonista")))
        self.assertTrue(consulta.autorizado("sentinela", identidade(papel="gestor")))
        self.assertTrue(consulta.autorizado("sentinela", identidade(papel="admin")))

    def test_operacional_exige_vinculo(self):
        sem = identidade(papel=None, unidadeId=None, vinculos=[])
        for escopo in ("aguia", "garca", "operacional", "escala"):
            self.assertFalse(consulta.autorizado(escopo, sem), escopo)

    def test_operacional_plantonista_passa(self):
        self.assertTrue(consulta.autorizado("aguia", identidade(papel="plantonista")))
        self.assertTrue(consulta.autorizado("escala", identidade(papel="plantonista")))

    def test_escopo_desconhecido(self):
        self.assertFalse(consulta.autorizado("almanaque", identidade(superAdmin=True)))


class TestUnidade(unittest.TestCase):
    def test_sem_pedida_usa_principal(self):
        self.assertEqual(consulta.resolver_unidade(identidade(papel="gestor"), None), {"ok": True, "unidadeId": UNIDADE_A})

    def test_nao_vinculada_bloqueada(self):
        self.assertEqual(consulta.resolver_unidade(identidade(papel="gestor"), UNIDADE_B), {"ok": False})

    def test_multi_vinculo(self):
        multi = identidade(papel="gestor", vinculos=[
            {"papel": "gestor", "unidadeId": UNIDADE_A, "unidadeNome": "A", "organizacaoId": "org-1"},
            {"papel": "plantonista", "unidadeId": UNIDADE_B, "unidadeNome": "B", "organizacaoId": "org-1"},
        ])
        self.assertEqual(consulta.resolver_unidade(multi, UNIDADE_B), {"ok": True, "unidadeId": UNIDADE_B})
        self.assertEqual(consulta.papel_na_unidade(multi, UNIDADE_B), "plantonista")
        self.assertIsNone(consulta.papel_na_unidade(multi, "outra"))

    def test_super_admin_qualquer_unidade(self):
        su = identidade(papel="gestor", superAdmin=True)
        self.assertEqual(consulta.resolver_unidade(su, UNIDADE_B), {"ok": True, "unidadeId": UNIDADE_B})


class TestIdentidade(unittest.TestCase):
    def test_principal_por_precedencia_e_desempate(self):
        ident = consulta.montar_identidade(linha_identidade(vinculos=[
            ("enfermeiro", UNIDADE_A), ("gestor", UNIDADE_B), ("gestor", UNIDADE_A), ("desconhecido", "0000"),
        ]))
        self.assertEqual((ident["papel"], ident["unidadeId"]), ("gestor", UNIDADE_A))
        self.assertFalse(ident["superAdmin"])
        self.assertEqual(len(ident["vinculos"]), 4)

    def test_sem_vinculos(self):
        ident = consulta.montar_identidade({"perfil_id": "p", "nome_completo": "X", "email": None, "is_super_admin": True, "vinculos": None})
        self.assertIsNone(ident["papel"])
        self.assertIsNone(ident["unidadeId"])
        self.assertTrue(ident["superAdmin"])

    def test_identificador_invalido_nao_consulta(self):
        rpc = RpcFalso()
        self.assertIsNone(consulta.resolver_identidade_por_canal(rpc, "telegram", "a b"))
        self.assertIsNone(consulta.resolver_identidade_por_canal(rpc, "telegram", "x" * 65))
        self.assertIsNone(consulta.resolver_identidade_por_canal(rpc, "telegram", "123\n"))
        self.assertEqual(rpc.chamadas, [])

    def test_params_da_rpc(self):
        rpc = RpcFalso({"hermes_identidade_por_canal": []})
        self.assertIsNone(consulta.resolver_identidade_por_canal(rpc, "telegram", "987"))
        self.assertEqual(rpc.chamadas, [("hermes_identidade_por_canal", {"p_canal": "telegram", "p_identificador": "987"})])


# ── /skill/consulta ──────────────────────────────────────────────────────────

class TestValidacao(unittest.TestCase):
    def test_escopo_ou_comando_invalido(self):
        rpc = RpcFalso()
        esperado = {"ok": False, "erro": "escopo ou comando inválido"}
        self.assertEqual(consultar(rpc, "nada", "setores"), esperado)
        self.assertEqual(consultar(rpc, "aguia", "Setores"), esperado)
        self.assertEqual(consultar(rpc, "aguia", "x" * 33), esperado)
        self.assertEqual(consultar(rpc, "aguia", None), esperado)
        self.assertEqual(consultar(rpc, "aguia", "setores\n"), esperado)
        self.assertEqual(rpc.chamadas, [])

    def test_comando_desconhecido_valido_no_formato(self):
        rpc = RpcFalso(identidade_linha=linha_identidade())
        for escopo in ("aguia", "garca", "operacional", "escala", "sentinela"):
            self.assertEqual(consultar(rpc, escopo, "inexistente") if escopo != "sentinela"
                             else consultar(RpcFalso(identidade_linha=linha_identidade(vinculos=[("gestor", UNIDADE_A)])), escopo, "inexistente"),
                             {"ok": True, "dados": {"erro": "comando desconhecido"}}, escopo)
        su = RpcFalso(identidade_linha=linha_identidade(super_admin=True))
        self.assertEqual(consultar(su, "seguranca", "xyz"), {"ok": True, "dados": {"erro": "comando desconhecido"}})
        self.assertEqual(consultar(su, "infra", "xyz"), {"ok": True, "dados": {"erro": "comando desconhecido"}})

    def test_sujeito_obrigatorio(self):
        esperado = {"ok": False, "erro": "sujeito obrigatório (wa_id ou canal+identificador)"}
        self.assertEqual(consultar(RpcFalso(), "aguia", "setores", canal="sms"), esperado)
        self.assertEqual(consultar(RpcFalso(), "aguia", "setores", canal=None), esperado)
        self.assertEqual(consultar(RpcFalso(), "aguia", "setores", ident=""), esperado)

    def test_nao_vinculado_negado(self):
        rpc = RpcFalso({"hermes_identidade_por_canal": []})
        r = consultar(rpc, "escala", "meus_plantoes")
        self.assertEqual(r, {"ok": False, "erro": "nao_autorizado", "resposta": consulta.RESPOSTA_GENERICA})
        self.assertEqual(rpc.nomes(), ["hermes_identidade_por_canal"])

    def test_papel_insuficiente_mesma_resposta(self):
        rpc = RpcFalso(identidade_linha=linha_identidade())
        for escopo, comando in (("sentinela", "alertas"), ("seguranca", "incidentes"), ("infra", "integridade")):
            r = consultar(rpc, escopo, comando)
            self.assertEqual(r["erro"], "nao_autorizado")
            self.assertEqual(r["resposta"], consulta.RESPOSTA_GENERICA)

    def test_falha_na_identidade(self):
        rpc = RpcFalso(falhar={"hermes_identidade_por_canal"})
        self.assertEqual(consultar(rpc, "aguia", "setores"), {"ok": False, "erro": "falha interna"})

    def test_falha_na_consulta(self):
        rpc = RpcFalso(identidade_linha=linha_identidade(), falhar={"hermes_unidade_setores"})
        self.assertEqual(consultar(rpc, "aguia", "setores"), {"ok": False, "erro": "falha interna"})


class TestCrossTenant(unittest.TestCase):
    def test_bloqueia_e_audita(self):
        rpc = RpcFalso(identidade_linha=linha_identidade(vinculos=[("gestor", UNIDADE_A)]))
        r = consultar(rpc, "aguia", "setores", {"unidade_id": UNIDADE_B}, ident="555")
        self.assertEqual(r, {"ok": False, "erro": "nao_autorizado", "resposta": consulta.RESPOSTA_GENERICA})
        self.assertEqual(rpc.nomes(), ["hermes_identidade_por_canal", "hermes_audit_registrar"])
        self.assertEqual(rpc.params("hermes_audit_registrar"), {
            "p_perfil": "perfil-1",
            "p_phone": "555",
            "p_direction": "tool",
            "p_tool_name": "skill_cross_tenant_bloqueado",
            "p_tool_args": {"escopo": "aguia", "unidade_pedida": UNIDADE_B},
            "p_resumo": "[SkillAPI] Tentativa de acesso a unidade não vinculada",
        })

    def test_falha_da_auditoria_nao_muda_resposta(self):
        rpc = RpcFalso(identidade_linha=linha_identidade(vinculos=[("gestor", UNIDADE_A)]), falhar={"hermes_audit_registrar"})
        self.assertEqual(consultar(rpc, "aguia", "setores", {"unidade_id": UNIDADE_B})["erro"], "nao_autorizado")

    def test_papel_da_unidade_pedida_vale(self):
        # Gestor em A, plantonista em B: plantao_do_dia em B é negado.
        rpc = RpcFalso(identidade_linha=linha_identidade(vinculos=[("gestor", UNIDADE_A), ("plantonista", UNIDADE_B)]))
        r = consultar(rpc, "escala", "plantao_do_dia", {"unidade_id": UNIDADE_B})
        self.assertEqual(r, {"ok": True, "dados": {"mensagem": "Posso mostrar apenas os seus próprios plantões."}})
        rpc2 = RpcFalso(identidade_linha=linha_identidade(vinculos=[("gestor", UNIDADE_A), ("plantonista", UNIDADE_B)]),
                        respostas={"hermes_unidade_setores": [{"nome": "Sala"}]})
        self.assertEqual(consultar(rpc2, "aguia", "setores", {"unidade_id": UNIDADE_B})["dados"], [{"nome": "Sala"}])
        self.assertEqual(rpc2.params("hermes_unidade_setores"), {"p_perfil": "perfil-1", "p_unidade": UNIDADE_B})

    def test_unidade_id_nao_texto_ignorado(self):
        rpc = RpcFalso(identidade_linha=linha_identidade(), respostas={"hermes_unidade_setores": []})
        self.assertTrue(consultar(rpc, "aguia", "setores", {"unidade_id": 123})["ok"])
        self.assertEqual(rpc.params("hermes_unidade_setores")["p_unidade"], UNIDADE_A)


class TestEscopos(unittest.TestCase):
    def setUp(self):
        self.p = {"p_perfil": "perfil-1", "p_unidade": UNIDADE_A}

    def rpc(self, papel="plantonista", su=False, **respostas):
        return RpcFalso(respostas, identidade_linha=linha_identidade(vinculos=[(papel, UNIDADE_A)], super_admin=su))

    def test_aguia_simples(self):
        for comando, nome in (("setores", "hermes_unidade_setores"), ("censo", "hermes_unidade_censo"),
                              ("indicadores", "hermes_unidade_indicadores")):
            rpc = self.rpc(**{nome: [{"x": 1}]})
            self.assertEqual(consultar(rpc, "aguia", comando), {"ok": True, "dados": [{"x": 1}]})
            self.assertEqual(rpc.chamadas[-1], (nome, self.p))
            rpc_nulo = self.rpc(**{nome: None})
            self.assertEqual(consultar(rpc_nulo, "aguia", comando)["dados"], [])

    def test_aguia_profissionais(self):
        rpc = self.rpc(hermes_unidade_profissionais=[{"papel": "gestor", "total": 2}, {"papel": "plantonista", "total": "5"}])
        r = consultar(rpc, "aguia", "profissionais")
        self.assertEqual(r["dados"], {"profissionais_por_papel": {"gestor": 2, "plantonista": 5}})
        self.assertEqual(json.dumps(r["dados"]), '{"profissionais_por_papel": {"gestor": 2, "plantonista": 5}}')
        self.assertEqual(rpc.chamadas[-1], ("hermes_unidade_profissionais", self.p))

    def test_aguia_resumo(self):
        rpc = self.rpc(hermes_unidade_resumo={"pacientes": 3})
        self.assertEqual(consultar(rpc, "aguia", "resumo")["dados"], {"pacientes": 3})
        self.assertEqual(rpc.chamadas[-1], ("hermes_unidade_resumo", self.p))
        self.assertEqual(consultar(self.rpc(hermes_unidade_resumo=None), "aguia", "resumo")["dados"],
                         {"mensagem": "Resumo ainda não gerado para esta unidade."})
        self.assertEqual(consultar(self.rpc(hermes_unidade_resumo={}), "aguia", "resumo")["dados"], {})

    def test_sem_unidade(self):
        rpc = RpcFalso(identidade_linha=linha_identidade(vinculos=[], super_admin=True))
        for escopo, comando in (("aguia", "setores"), ("garca", "censo"), ("operacional", "notificacoes")):
            self.assertEqual(consultar(rpc, escopo, comando), {"ok": True, "dados": {"erro": "usuário sem unidade vinculada"}})
        self.assertEqual(consultar(rpc, "escala", "plantao_do_dia"), {"ok": True, "dados": {"erro": "usuário sem unidade vinculada"}})

    def test_garca(self):
        rpc = self.rpc(hermes_unidade_censo=[{"leitos": 4}])
        self.assertEqual(consultar(rpc, "garca", "censo")["dados"], [{"leitos": 4}])
        self.assertEqual(rpc.chamadas[-1], ("hermes_unidade_censo", self.p))
        rpc = self.rpc(hermes_unidade_internacoes_por_status=[{"status": "ativa", "total": 3}, {"status": "alta", "total": 2}])
        self.assertEqual(consultar(rpc, "garca", "internacoes")["dados"], {"por_status": {"ativa": 3, "alta": 2}, "total": 5})
        self.assertEqual(rpc.chamadas[-1], ("hermes_unidade_internacoes_por_status", self.p))
        self.assertEqual(consultar(self.rpc(), "garca", "setores")["dados"], {"erro": "comando desconhecido"})

    def test_operacional_repassa_aguia(self):
        rpc = self.rpc(hermes_unidade_setores=[{"nome": "A"}])
        self.assertEqual(consultar(rpc, "operacional", "setores")["dados"], [{"nome": "A"}])
        self.assertEqual(consultar(self.rpc(), "operacional", "resumo")["dados"], {"erro": "comando desconhecido"})

    def test_operacional_notificacoes(self):
        rpc = self.rpc(
            hermes_minhas_notificacoes=[
                {"tipo": "sentinela", "mensagem": "Ana Paula Souza e Ana sem check-in", "data": "2026-10-01"},
                {"tipo": "x", "mensagem": None, "data": "2026-10-01"},
            ],
            hermes_unidade_nomes=[{"nome_completo": "Ana"}, {"nome_completo": "Ana Paula Souza"}],
        )
        r = consultar(rpc, "operacional", "notificacoes", {"dias": 30})
        self.assertEqual(r["dados"], [
            {"tipo": "sentinela", "mensagem": "[PESSOA_1] e [PESSOA_2] sem check-in", "data": "2026-10-01"},
            {"tipo": "x", "mensagem": "", "data": "2026-10-01"},
        ])
        self.assertEqual(rpc.nomes(), ["hermes_identidade_por_canal", "hermes_minhas_notificacoes", "hermes_unidade_nomes"])
        self.assertEqual(rpc.params("hermes_minhas_notificacoes"), {"p_perfil": "perfil-1", "p_unidade": UNIDADE_A, "p_dias": 30})
        self.assertEqual(rpc.params("hermes_unidade_nomes"), self.p)

    def test_notificacoes_janela(self):
        for dias, esperado in ((None, 7), (0, 7), (91, 7), (90, 90), ("15", 15), ("abc", 7), (-3, 7), (2.5, 2.5), (True, 1)):
            rpc = self.rpc(hermes_minhas_notificacoes=[], hermes_unidade_nomes=[])
            consultar(rpc, "operacional", "notificacoes", {"dias": dias} if dias is not None else {})
            self.assertEqual(rpc.params("hermes_minhas_notificacoes")["p_dias"], esperado, dias)
            self.assertIs(type(rpc.params("hermes_minhas_notificacoes")["p_dias"]), type(esperado), dias)

    def test_escala_meus_plantoes(self):
        for periodo, dias in ((None, 7), ("hoje", 1), ("semana", 7), ("mes", 31), ("ano", 7)):
            rpc = self.rpc(hermes_plantoes_do_perfil=[{"inicio": "x"}])
            r = consultar(rpc, "escala", "meus_plantoes", {"periodo": periodo, "perfil_id": "outro"})
            self.assertEqual(r["dados"], [{"inicio": "x"}])
            self.assertEqual(rpc.chamadas[-1], ("hermes_plantoes_do_perfil", {"p_perfil": "perfil-1", "p_dias": dias}))

    def test_escala_plantao_do_dia(self):
        rpc = self.rpc(papel="gestor", hermes_plantao_do_dia=[{"setor": "A", "total": 2}])
        r = consultar(rpc, "escala", "plantao_do_dia", {"data": "2026-10-05"})
        self.assertEqual(r["dados"], {"dia": "2026-10-05", "plantoes": [{"setor": "A", "total": 2}]})
        self.assertEqual(rpc.chamadas[-1], ("hermes_plantao_do_dia", {"p_unidade": UNIDADE_A, "p_dia": "2026-10-05"}))
        for data in ("05/10/2026", "2026-10-05\n", None, 20261005):
            rpc = self.rpc(papel="admin", hermes_plantao_do_dia=None)
            self.assertEqual(consultar(rpc, "escala", "plantao_do_dia", {"data": data})["dados"], {"dia": "2026-10-02", "plantoes": []})
        self.assertEqual(consultar(self.rpc(), "escala", "plantao_do_dia")["dados"],
                         {"mensagem": "Posso mostrar apenas os seus próprios plantões."})

    def test_sentinela_alertas(self):
        for status, esperado in ((None, "novo"), ("visto", "visto"), ("apagado", "novo")):
            rpc = self.rpc(papel="gestor", hermes_alertas_escala=[{"id": 1}])
            self.assertEqual(consultar(rpc, "sentinela", "alertas", {"status": status})["dados"], [{"id": 1}])
            self.assertEqual(rpc.chamadas[-1], ("hermes_alertas_escala", {**self.p, "p_status": [esperado]}))

    def test_sentinela_super_sem_unidade_passa_null(self):
        rpc = RpcFalso({"hermes_alertas_escala": []}, identidade_linha=linha_identidade(vinculos=[], super_admin=True))
        consultar(rpc, "sentinela", "alertas")
        self.assertEqual(rpc.params("hermes_alertas_escala"), {"p_perfil": "perfil-1", "p_unidade": None, "p_status": ["novo"]})

    def test_sentinela_relatorio(self):
        rpc = self.rpc(papel="gestor")
        self.assertEqual(consultar(rpc, "sentinela", "relatorio")["dados"], {"mensagem": "O relatório semanal é consultado na plataforma."})
        self.assertNotIn("hermes_relatorio_semanal_ultimo", rpc.nomes())
        rpc = self.rpc(papel="gestor", su=True, hermes_relatorio_semanal_ultimo={"semana": 40})
        self.assertEqual(consultar(rpc, "sentinela", "relatorio")["dados"], [{"semana": 40}])
        self.assertEqual(rpc.chamadas[-1], ("hermes_relatorio_semanal_ultimo", {"p_perfil": "perfil-1"}))
        rpc = self.rpc(papel="gestor", su=True, hermes_relatorio_semanal_ultimo=None)
        self.assertEqual(consultar(rpc, "sentinela", "relatorio")["dados"], [])
        rpc = self.rpc(papel="gestor", su=True, hermes_relatorio_semanal_ultimo={})
        self.assertEqual(consultar(rpc, "sentinela", "relatorio")["dados"], [{}])

    def test_seguranca(self):
        rpc = self.rpc(su=True, hermes_incidentes_abertos=[{"id": 9}])
        self.assertEqual(consultar(rpc, "seguranca", "incidentes", {"patrulha": "dados", "severidade": "grave"})["dados"], [{"id": 9}])
        self.assertEqual(rpc.chamadas[-1], ("hermes_incidentes_abertos",
                                            {"p_perfil": "perfil-1", "p_patrulha": "dados", "p_severidade": None}))
        rpc = self.rpc(su=True, hermes_quarentena_pendente=None)
        self.assertEqual(consultar(rpc, "seguranca", "quarentena")["dados"], [])
        self.assertEqual(rpc.chamadas[-1], ("hermes_quarentena_pendente", {"p_perfil": "perfil-1"}))

    def test_infra(self):
        rpc = self.rpc(su=True, hermes_integridade_resumo={"incidentes_abertos": 2, "quarentena_pendente": 1})
        self.assertEqual(consultar(rpc, "infra", "integridade")["dados"], {"incidentes_abertos": 2, "quarentena_pendente": 1})
        self.assertEqual(rpc.chamadas[-1], ("hermes_integridade_resumo", {"p_perfil": "perfil-1"}))
        self.assertEqual(consultar(self.rpc(su=True), "infra", "integridade")["dados"], {"incidentes_abertos": 0, "quarentena_pendente": 0})

    def test_allowlist(self):
        self.assertEqual(len(consulta.RPC_USUARIO), 24)
        with self.assertRaises(consulta.RpcNaoPermitida):
            consulta._chamar(RpcFalso(), "hermes_buracos_escala", {})


class TestAlmanaque(unittest.TestCase):
    def test_validacao(self):
        rpc = RpcFalso()
        for texto in (None, "", "  a ", 123):
            self.assertEqual(consulta.almanaque(rpc, texto), {"ok": False, "erro": "informe a pergunta"})
        self.assertEqual(consultar(rpc, "almanaque", "listar", {"texto": "como faço check-in"}), {"ok": False, "erro": "informe a pergunta"})
        self.assertEqual(rpc.chamadas, [])

    def test_busca_sem_sujeito(self):
        rpc = RpcFalso({"hermes_almanaque_buscar": [{"pergunta": "p", "resposta": "r"}]})
        r = consultar(rpc, "almanaque", "buscar", {"texto": "x" * 400}, canal=None, ident=None)
        self.assertEqual(r, {"ok": True, "dados": [{"pergunta": "p", "resposta": "r"}]})
        self.assertEqual(rpc.chamadas, [("hermes_almanaque_buscar", {"p_texto": "x" * 300, "p_limite": 2})])

    def test_falha(self):
        self.assertEqual(consulta.almanaque(RpcFalso(falhar={"hermes_almanaque_buscar"}), "check-in"), {"ok": False, "erro": "falha interna"})
        self.assertEqual(consulta.almanaque(RpcFalso(), "check-in"), {"ok": True, "dados": []})


class TestVincular(unittest.TestCase):
    def setUp(self):
        consulta.TENTATIVAS_VINCULO.clear()
        self.t = [1_000_000.0]

    def agora(self):
        return self.t[0]

    def test_validacao(self):
        rpc = RpcFalso()
        esperado = {"ok": False, "erro": "código inválido"}
        for canal, ident, codigo in (("sms", "1", "123456"), ("telegram", "a b", "123456"), ("telegram", "1", "12345"),
                                     ("telegram", "1", "1234567"), ("telegram", "1", None), ("telegram", None, "123456")):
            self.assertEqual(consulta.vincular(rpc, canal, ident, codigo, agora=self.agora), esperado)
        self.assertEqual(rpc.chamadas, [])

    def test_sucesso(self):
        rpc = RpcFalso({"confirmar_vinculo_hermes": "perfil-1"}, identidade_linha=linha_identidade(vinculos=[("gestor", UNIDADE_A)]))
        r = consulta.vincular(rpc, "telegram", "777", "12-34 56", agora=self.agora)
        self.assertEqual(r, {"ok": True, "nome": "Fulano", "papel": "gestor"})
        self.assertEqual(rpc.chamadas[0], ("confirmar_vinculo_hermes", {"p_canal": "telegram", "p_identificador": "777", "p_codigo": "123456"}))
        self.assertEqual(rpc.nomes()[1], "hermes_identidade_por_canal")

    def test_sucesso_sem_identidade_ativa(self):
        rpc = RpcFalso({"confirmar_vinculo_hermes": "perfil-1", "hermes_identidade_por_canal": []})
        self.assertEqual(consulta.vincular(rpc, "telegram", "777", "123456", agora=self.agora), {"ok": True, "nome": None, "papel": None})

    def test_erro_de_banco(self):
        rpc = RpcFalso(falhar={"confirmar_vinculo_hermes"})
        self.assertEqual(consulta.vincular(rpc, "telegram", "777", "123456", agora=self.agora), {"ok": False, "erro": "falha interna"})
        self.assertEqual(consulta.TENTATIVAS_VINCULO, {})

    def test_limite_de_tentativas(self):
        errado = {"ok": False, "erro": "Código errado, vencido ou já usado. Gere um novo no seu Perfil."}
        muitas = {"ok": False, "erro": "Muitas tentativas. Gere um código novo e tente em 15 minutos."}
        rpc = RpcFalso({"confirmar_vinculo_hermes": None})
        for _ in range(5):
            self.assertEqual(consulta.vincular(rpc, "telegram", "777", "000000", agora=self.agora), errado)
            self.t[0] += 1000
        self.assertEqual(consulta.vincular(rpc, "telegram", "777", "000000", agora=self.agora), muitas)
        self.assertEqual(len(rpc.chamadas), 5, "a 6ª não chega ao banco")
        # Outro identificador não é afetado.
        self.assertEqual(consulta.vincular(rpc, "telegram", "888", "000000", agora=self.agora), errado)
        # Depois de 15 min a contar da 1ª tentativa, abre uma vaga.
        self.t[0] = 1_000_000.0 + 15 * 60_000
        self.assertEqual(consulta.vincular(rpc, "telegram", "777", "000000", agora=self.agora), errado)
        self.assertEqual(consulta.vincular(rpc, "telegram", "777", "000000", agora=self.agora), muitas)

    def test_acerto_zera_tentativas(self):
        respostas = iter([None, None, "perfil-1"])
        rpc = RpcFalso({"confirmar_vinculo_hermes": lambda p: next(respostas), "hermes_identidade_por_canal": []})
        for _ in range(3):
            consulta.vincular(rpc, "telegram", "777", "123456", agora=self.agora)
        self.assertNotIn("telegram:777", consulta.TENTATIVAS_VINCULO)


class TestDesidentificar(unittest.TestCase):
    """Casos de gateway/desidentificacao.test.ts usados pelas notificações."""

    def test_gatilho(self):
        r = consulta.desidentificar("Paciente João da Silva no leito 12A. Reavaliar o sr. João da Silva às 18h.", consulta.criar_cofre())
        self.assertEqual(r["texto"], "Paciente [PACIENTE_1] no leito 12A. Reavaliar o sr. [PACIENTE_1] às 18h.")
        self.assertEqual(r["contagem"]["PACIENTE"], 2)

    def test_conhecidos(self):
        r = consulta.desidentificar("Oi, aqui é Ana Paula Souza. Ana passou o plantão.", consulta.criar_cofre(),
                                    [{"valor": "Ana", "categoria": "PESSOA"}, {"valor": "Ana Paula Souza", "categoria": "PESSOA"}])
        self.assertEqual(r["texto"], "Oi, aqui é [PESSOA_1]. [PESSOA_2] passou o plantão.")

    def test_padroes(self):
        entrada = "Ligar (62) 99876-5432 ou ana@exemplo.com. CEP 74000-000, nasc. 12/03/1951, pront. 2026.000123. Dipirona 500 mg no 12A."
        t = consulta.desidentificar(entrada, consulta.criar_cofre())["texto"]
        for p in ("[TELEFONE_1]", "[EMAIL_1]", "[CEP_1]", "[DATA_1]", "[PRONTUARIO_1]"):
            self.assertIn(p, t)
        self.assertIn("Dipirona 500 mg no 12A", t)

    def test_cpf_cns(self):
        self.assertTrue(consulta.cpf_valido("529.982.247-25"))
        self.assertFalse(consulta.cpf_valido("111.111.111-11"))
        self.assertTrue(consulta.cns_valido("898 0012 3456 7018"))
        t = consulta.desidentificar("CPF 529.982.247-25 CNS 898 0012 3456 7018", consulta.criar_cofre())["texto"]
        self.assertEqual(t, "CPF [CPF_1] CNS [CNS_1]")


# ── Plugin (__init__.py): chave CORUJA_CONSULTA_DIRETA e dica ────────────────

class TestPlugin(unittest.TestCase):
    def setUp(self):
        SESSAO.clear()
        SESSAO.update({"HERMES_SESSION_PLATFORM": "telegram", "HERMES_SESSION_USER_ID": "4242"})
        consulta.TENTATIVAS_VINCULO.clear()
        plugin._rpc_cache = None

    def tearDown(self):
        plugin._rpc_cache = None

    def direto(self, rpc):
        plugin._rpc_cache = rpc
        return mock.patch.dict(os.environ, {"CORUJA_CONSULTA_DIRETA": "1"})

    def test_nao_vinculado_tem_dica(self):
        rpc = RpcFalso({"hermes_identidade_por_canal": []})
        with self.direto(rpc):
            r = json.loads(plugin._consultar({"escopo": "escala", "comando": "meus_plantoes", "unidade_id": UNIDADE_B}))
        self.assertEqual(r["erro"], "nao_autorizado")
        self.assertEqual(r["resposta"], consulta.RESPOSTA_GENERICA)
        self.assertIn("coruja_vincular", r["dica"])
        # Identidade da SESSÃO; unidade_id do modelo não passa pelo plugin.
        self.assertEqual(rpc.chamadas, [("hermes_identidade_por_canal", {"p_canal": "telegram", "p_identificador": "4242"})])

    def test_consulta_direta_repassa_extras(self):
        rpc = RpcFalso({"hermes_plantoes_do_perfil": []}, identidade_linha=linha_identidade())
        with self.direto(rpc):
            r = json.loads(plugin._consultar({"escopo": "escala", "comando": "meus_plantoes", "periodo": "hoje"}))
        self.assertEqual(r, {"ok": True, "dados": []})
        self.assertEqual(rpc.params("hermes_plantoes_do_perfil"), {"p_perfil": "perfil-1", "p_dias": 1})

    def test_comando_fora_da_lista_do_plugin(self):
        with self.direto(RpcFalso()), mock.patch.dict(os.environ, {"CORUJA_AGENTE": "gestora"}):
            r = json.loads(plugin._consultar({"escopo": "aguia", "comando": "internacoes"}))
        self.assertEqual(r, {"ok": False, "erro": "comando inválido para aguia"})

    def test_sem_sessao_telegram(self):
        SESSAO.clear()
        with self.direto(RpcFalso()):
            self.assertEqual(json.loads(plugin._consultar({"escopo": "escala", "comando": "meus_plantoes"}))["erro"],
                             "Consulta disponível só pelo Telegram.")
            self.assertEqual(json.loads(plugin._vincular({"codigo": "123456"}))["erro"], "Vínculo disponível só pelo Telegram.")

    def test_almanaque_direto_com_dica(self):
        rpc = RpcFalso({"hermes_almanaque_buscar": []})
        with self.direto(rpc):
            r = json.loads(plugin._almanaque({"pergunta": "  como conecto o Telegram?  "}))
        self.assertEqual(r["ok"], True)
        self.assertIn("coruja_consultar", r["dica"])
        self.assertEqual(rpc.params("hermes_almanaque_buscar"), {"p_texto": "como conecto o Telegram?", "p_limite": 2})

    def test_vincular_direto(self):
        rpc = RpcFalso({"confirmar_vinculo_hermes": "perfil-1"}, identidade_linha=linha_identidade())
        with self.direto(rpc):
            r = json.loads(plugin._vincular({"codigo": "123 456"}))
        self.assertEqual(r, {"ok": True, "nome": "Fulano", "papel": "plantonista"})
        self.assertEqual(rpc.params("confirmar_vinculo_hermes"), {"p_canal": "telegram", "p_identificador": "4242", "p_codigo": "123456"})

    def test_driver_ausente(self):
        with mock.patch.dict(os.environ, {"CORUJA_CONSULTA_DIRETA": "1"}):
            r = json.loads(plugin._consultar({"escopo": "escala", "comando": "meus_plantoes"}))
            self.assertEqual(r, {"ok": False, "erro": "backend indisponível (HERMES_PG_USER_URL não configurada no contêiner do Nous)"})
            self.assertTrue(plugin._disponivel())

    def test_sem_chave_segue_http(self):
        with mock.patch.dict(os.environ, {"CORUJA_CONSULTA_DIRETA": ""}), \
                mock.patch.object(plugin, "_post", return_value={"ok": True, "dados": []}) as post:
            json.loads(plugin._consultar({"escopo": "escala", "comando": "meus_plantoes", "periodo": "mes"}))
            json.loads(plugin._vincular({"codigo": "123456"}))
            json.loads(plugin._almanaque({"pergunta": "check-in"}))
        self.assertEqual(post.call_args_list[0].args, ("/skill/consulta", {
            "canal": "telegram", "identificador": "4242", "escopo": "escala", "comando": "meus_plantoes", "args": {"periodo": "mes"}}))
        self.assertEqual(post.call_args_list[1].args, ("/skill/vincular", {"canal": "telegram", "identificador": "4242", "codigo": "123456"}))
        self.assertEqual(post.call_args_list[2].args[1]["escopo"], "almanaque")


if __name__ == "__main__":
    unittest.main()
