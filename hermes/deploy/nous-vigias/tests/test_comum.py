"""Equivalências com o JS, modo sombra e o executor dos scripts.

Rodar: python -m unittest discover -s hermes/deploy/nous-vigias/tests -v
"""

from __future__ import annotations

import contextlib
import datetime as _dt
import io
import json
import os
import tempfile
import unittest

import apoio  # noqa: F401 — ajusta o sys.path
from apoio import AGORA, BancoFalso, contexto
from vigias.banco import Banco, ErroBanco, montar_chamada
from vigias.comum import (
    UTC, RegistroSombra, data_brasilia, executar, iso_js, js_num, js_round, js_slice, ms_epoch, sha256,
)


class TestEquivalenciaJS(unittest.TestCase):
    def test_js_num_igual_ao_String_do_js(self):
        casos = {3: "3", 3.0: "3", 0.75: "0.75", 1.5: "1.5", 0.1 + 0.2: "0.30000000000000004", 1e-7: "1e-7",
                 0.000001: "0.000001", 1e21: "1e+21", 123456789012.5: "123456789012.5", -2.5: "-2.5", 0: "0"}
        for valor, esperado in casos.items():
            self.assertEqual(js_num(valor), esperado, valor)
        self.assertEqual(js_num(float("inf")), "Infinity")

    def test_js_round_meio_para_cima(self):
        self.assertEqual(js_round(2.5), 3)  # round() do Python daria 2
        self.assertEqual(js_round(0.5), 1)
        self.assertEqual(js_round(-2.5), -2)
        self.assertEqual(js_round(66.66), 67)

    def test_js_slice_conta_utf16(self):
        self.assertEqual(js_slice("abc", 2), "ab")
        self.assertEqual(js_slice("📊x", 2), "📊")  # emoji = 2 unidades
        self.assertEqual(js_slice("a📊", 2), "a�")  # corte no meio do par
        self.assertEqual(js_slice("ção", 500), "ção")

    def test_iso_js_e_datas_de_brasilia(self):
        self.assertEqual(iso_js(AGORA), "2026-10-05T12:00:00.123Z")
        # 22h de Brasília = 01h UTC do dia seguinte: a data civil é a de Brasília
        noite = _dt.datetime(2026, 10, 6, 1, 0, tzinfo=UTC)
        self.assertEqual(data_brasilia(noite), "2026-10-05")
        self.assertEqual(data_brasilia(noite, -7), "2026-09-28")

    def test_ms_epoch_como_Date_do_js(self):
        self.assertEqual(ms_epoch("2026-09-01T23:59:59"), 1788307199000)  # sem fuso = UTC (contêiner)
        self.assertEqual(ms_epoch("2026-09-01T10:00:00.123456+00:00"), 1788256800123)
        self.assertEqual(ms_epoch("2026-09-01T10:00:00Z"), 1788256800000)
        self.assertIsNone(ms_epoch("lixo"))


class TestSombra(unittest.TestCase):
    def test_sombra_nao_grava_e_anota_sem_texto_livre(self):
        banco = BancoFalso()
        ctx, reg = contexto(banco, modo="sombra")
        ctx.grava.inserir_incidentes([{"patrulha": "hermes", "severidade": "atencao", "titulo": "T",
                                       "evidencia": {"trecho": "conteúdo da conversa"}, "chave_dedup": "hermes:T:s1:conteúdo"}])
        ctx.grava.inserir_notificacao({"perfil_id": "p1", "unidade_id": "u1", "tipo": "x", "mensagem": "Fulano 12", "data": "2026-10-05"})
        ctx.grava.inserir_alerta_escala({"unidade_id": "u1", "medico_id": "m1", "janela": "30d", "metrica": "faltas",
                                         "valor": 3, "mediana_unidade": 1.5, "limite_outlier": float("inf"), "detalhe": {}})
        ctx.grava.inserir_relatorio({"periodo_inicio": "a", "periodo_fim": "b", "resumo": {"total_incidentes": 1},
                                     "detalhes": {"incidentes": [{"titulo": "x"}], "alertas": []}})
        self.assertEqual(banco.escritas, [])
        texto = json.dumps(reg.linhas, ensure_ascii=False)
        self.assertNotIn("conteúdo", texto)
        self.assertNotIn("Fulano", texto)
        self.assertEqual(reg.linhas[0]["chave_sha256"], sha256("hermes:T:s1:conteúdo"))
        self.assertEqual(reg.linhas[1]["mensagem_chars"], 9)
        self.assertIsNone(reg.linhas[2]["limite_outlier"])  # infinito vira NULL, como no TS
        self.assertEqual(reg.linhas[3]["detalhes_itens"], 1)

    def test_valer_grava_com_id_do_cliente(self):
        banco = BancoFalso()
        ctx, reg = contexto(banco, modo="valer")
        id_ = ctx.grava.inserir_notificacao({"perfil_id": "p1", "unidade_id": "u1", "tipo": "x", "mensagem": "m", "data": "d"})
        self.assertEqual(banco.escritas_de("inserir_notificacao")[0][0], id_)
        self.assertEqual(reg.linhas, [])
        ctx.grava.anotar({"tabela": "x"})  # anotação extra é só da sombra
        self.assertEqual(reg.linhas, [])

    def test_registro_em_arquivo_jsonl_por_job_e_dia(self):
        with tempfile.TemporaryDirectory() as pasta:
            reg = RegistroSombra("vigia_porta", relogio=lambda: AGORA, pasta=pasta)
            reg.anotar({"tabela": "t", "acao": "inserir"})
            reg.anotar({"tabela": "t", "acao": "inserir"})
            caminho = os.path.join(pasta, "vigia_porta-2026-10-05.jsonl")
            with open(caminho, encoding="utf-8") as f:
                linhas = [json.loads(l) for l in f]
            self.assertEqual(len(linhas), 2)
            self.assertEqual(linhas[0]["job"], "vigia_porta")


class TestExecutor(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.amb = {"VIGIAS_LOG_BASE": self.tmp.name, "HERMES_PG_JOB_URL": "postgresql://x@127.0.0.1:1/x"}
        os.environ["VIGIAS_LOG_BASE"] = self.tmp.name

    def tearDown(self):
        os.environ.pop("VIGIAS_LOG_BASE", None)
        self.tmp.cleanup()

    def _rodar(self, funcao, **amb):
        saida, erro = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(saida), contextlib.redirect_stderr(erro):
            codigo = executar("teste", funcao, ambiente={**self.amb, **amb})
        return codigo, saida.getvalue(), erro.getvalue()

    def test_sucesso_stdout_vazio(self):
        vistos = []
        codigo, saida, erro = self._rodar(lambda ctx: vistos.append(ctx.grava.modo) or 0)
        self.assertEqual((codigo, saida, erro), (0, "", ""))
        self.assertEqual(vistos, ["sombra"])  # padrão é sombra

    def test_sombra_abre_banco_somente_leitura(self):
        vistos = []
        self._rodar(lambda ctx: vistos.append(ctx.banco.somente_leitura))
        self._rodar(lambda ctx: vistos.append(ctx.banco.somente_leitura), VIGIAS_MODO="valer")
        self.assertEqual(vistos, [True, False])

    def test_falha_uma_linha_no_stderr_e_codigo_1(self):
        def quebra(ctx):
            raise RuntimeError("[cerbero] crm: falha no banco (42501):\npermissão negada")
        codigo, saida, erro = self._rodar(quebra)
        self.assertEqual(codigo, 1)
        self.assertEqual(saida, "")
        self.assertEqual(erro.count("\n"), 1)
        self.assertIn("42501", erro)

    def test_sem_url_e_modo_invalido(self):
        self.assertEqual(self._rodar(lambda ctx: 0, HERMES_PG_JOB_URL="")[0], 1)
        self.assertEqual(self._rodar(lambda ctx: 0, VIGIAS_MODO="sim")[0], 2)


class TestBanco(unittest.TestCase):
    def test_rpc_fora_da_lista_e_gravacao_na_sombra_recusadas_sem_conectar(self):
        b = Banco("postgresql://x@127.0.0.1:1/x", somente_leitura=True)
        try:
            with self.assertRaises(ErroBanco):
                b.rpc("hermes_liberar_quarentena", {})  # é do caminho de request, não do job
            with self.assertRaises(ErroBanco):
                b.rpc("drop table x; --")
            with self.assertRaises(ErroBanco):
                b.escrever("inserir_notificacao", "1")
            with self.assertRaises(ErroBanco):
                b.ler("select * from perfis")
        finally:
            b.fechar()

    def test_montar_chamada_igual_ao_pg_ts(self):
        tabela = {"retset": True, "tipo_kind": "c", "tipo_nome": "record", "entradas": [{"nome": "p_horas", "tipo": "integer"}],
                  "obrigatorias": 0, "tem_saidas": True}
        sql = montar_chamada("hermes_plantoes_sobrepostos", tabela, ["p_horas"])
        self.assertIn('pg_catalog.jsonb_to_record($1::text::jsonb) as _a("p_horas" integer)', sql)
        self.assertIn('public."hermes_plantoes_sobrepostos"("p_horas" => _a."p_horas")', sql)
        self.assertTrue(sql.startswith("select coalesce(pg_catalog.json_agg(_r)"))
        escalar = {"retset": False, "tipo_kind": "b", "tipo_nome": "int8", "entradas": [], "obrigatorias": 0, "tem_saidas": False}
        self.assertEqual(montar_chamada("hermes_cadeia_auditoria", escalar, []),
                         'select pg_catalog.to_json(public."hermes_cadeia_auditoria"())::text as r')
        ruim = {**tabela, "entradas": [{"nome": "p_horas", "tipo": "integer); drop table x; --"}]}
        with self.assertRaises(ErroBanco):
            montar_chamada("hermes_plantoes_sobrepostos", ruim, ["p_horas"])


if __name__ == "__main__":
    unittest.main()
