"""Números do maestro (Coruja Lab): RPC agregada + estado dos vigias pelos logs,
gravados de forma atômica em numeros.json, legível por outro uid."""

from __future__ import annotations

import contextlib
import datetime as _dt
import importlib.util
import io
import json
import os
import stat
import sys
import tempfile
import unittest

import apoio  # noqa: F401 — ajusta o sys.path
from apoio import BancoFalso
import agenda
from vigias import maestro
from vigias.banco import RPC_JOB
from vigias.comum import UTC

AGORA = _dt.datetime(2026, 10, 6, 1, 30, tzinfo=UTC)  # 05/10 22h30 em Brasília
BRT = _dt.timezone(_dt.timedelta(hours=-3))

TOTAIS = {
    "janela_dias": 7, "desde": "2026-09-29", "ate": "2026-10-05",
    "gateway": [{"dia": "2026-10-05", "origem": "corujinha:telegram", "total": 40, "bloqueados": 3, "com_erro": 1,
                 "erros_desidentificacao": 1, "erros_modelo": 0, "residuos": 4,
                 "motivos_desidentificacao": {"timeout": 1}}],
    "incidentes": [{"patrulha": "hermes", "severidade": "atencao", "status": "aberto", "total": 2}],
    "alertas": [{"status": "novo", "total": 1, "criados_na_janela": 1}],
    "notificacoes": [{"dia": "2026-10-05", "tipo": "escala_buraco", "total": 2}],
}


def escrever_log(pasta, job, dia, linhas):
    os.makedirs(pasta, exist_ok=True)
    with open(os.path.join(pasta, f"{job}-{dia}.log"), "a", encoding="utf-8") as f:
        for l in linhas:
            f.write(l + "\n")


def carregar_plugin_maestro():
    caminho = os.path.join(apoio.PASTA, "..", "nous-lab", "plugins", "maestro", "__init__.py")
    if not os.path.isfile(caminho):
        return None
    spec = importlib.util.spec_from_file_location("plugin_maestro_teste", caminho)
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception:  # noqa: BLE001 — o plugin pode depender do Nous
        return None
    return mod


class TestEstadoVigias(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.pasta = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def test_ultima_execucao_ok_e_falhas_em_7_dias(self):
        escrever_log(self.pasta, "vigia_presenca", "2026-10-05", [
            "2026-10-05 10:00:01,123 INFO [vigia_presenca] concluído (modo sombra): {'enviados': 0}",
            "2026-10-05 10:15:01,123 ERROR [vigia_presenca] falhou: falha no banco (Fulano de Tal no texto)",
            "2026-10-05 10:15:01,124 WARNING [vigia_presenca] aviso qualquer",
            "lixo sem formato",
        ])
        escrever_log(self.pasta, "vigia_presenca", "2026-10-04", [
            "2026-10-04 09:00:00,000 INFO [vigia_presenca] concluído (modo sombra): x",
        ])
        escrever_log(self.pasta, "argos", "2026-10-05", [
            "2026-10-05 06:00:00,000 ERROR [argos] falhou: x",
            "2026-10-05 18:00:00,000 INFO [argos] concluído (modo valer): y",
        ])
        # fora da janela de 7 dias (29/09 é o primeiro dia)
        escrever_log(self.pasta, "cadeia_auditoria", "2026-09-28", [
            "2026-09-28 04:00:00,000 ERROR [cadeia_auditoria] falhou: x",
        ])
        with open(os.path.join(self.pasta, "nao-e-log.txt"), "w") as f:
            f.write("x")
        v = maestro.estado_vigias(self.pasta, AGORA, fuso=BRT)
        self.assertEqual(set(v), {"vigia_presenca", "argos"})
        self.assertEqual(v["vigia_presenca"], {"ultima_execucao": "2026-10-05T10:15:01-03:00", "ok": False,
                                               "execucoes": 3, "falhas": 1})
        self.assertEqual(v["argos"], {"ultima_execucao": "2026-10-05T18:00:00-03:00", "ok": True,
                                      "execucoes": 2, "falhas": 1})
        self.assertNotIn("Fulano", json.dumps(v))

    def test_pasta_ausente_vira_vazio(self):
        self.assertEqual(maestro.estado_vigias(os.path.join(self.pasta, "nao-existe"), AGORA), {})


class TestMontarEGravar(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.logs = os.path.join(self.tmp.name, "logs")
        self.saida = os.path.join(self.tmp.name, "maestro-saida")
        os.environ["VIGIAS_LOG_BASE"] = self.logs
        escrever_log(os.path.join(self.logs, "vigias"), "gaviao_patrulha", "2026-10-05", [
            "2026-10-05 20:00:00,000 INFO [gaviao_patrulha] concluído (modo sombra): 0",
        ])

    def tearDown(self):
        os.environ.pop("VIGIAS_LOG_BASE", None)
        self.tmp.cleanup()

    def test_rpc_na_allowlist_e_formato_do_arquivo(self):
        self.assertIn("hermes_maestro_totais", RPC_JOB)
        banco = BancoFalso(rpcs={"hermes_maestro_totais": TOTAIS})
        dados = maestro.montar(banco, AGORA, os.path.join(self.logs, "vigias"), fuso=BRT)
        self.assertEqual(banco.chamadas, [("rpc", "hermes_maestro_totais", {})])
        self.assertEqual(set(dados), {"gerado_em", "janela_dias", "desde", "ate", "gateway", "incidentes",
                                      "alertas", "notificacoes", "vigias"})
        self.assertEqual(dados["gerado_em"], "2026-10-05T22:30:00-03:00")  # dia civil de Brasília
        self.assertEqual(dados["janela_dias"], 7)
        self.assertEqual(dados["gateway"], TOTAIS["gateway"])
        self.assertTrue(dados["vigias"]["gaviao_patrulha"]["ok"])

    def test_chave_proibida_falha_fechado(self):
        ruim = {**TOTAIS, "gateway": [{**TOTAIS["gateway"][0], "perfil_id": "x"}]}
        with self.assertRaises(ValueError):
            maestro.montar(BancoFalso(rpcs={"hermes_maestro_totais": ruim}), AGORA, self.logs)
        with self.assertRaises(ValueError):
            maestro.montar(BancoFalso(rpcs={"hermes_maestro_totais": {"gateway": None}}), AGORA, self.logs)

    def test_tipos_bloqueio_lista_fixa(self):
        # chaves fixas (nome_ner/email casariam a regex de chave proibida) passam
        bom = {**TOTAIS, "gateway": [{**TOTAIS["gateway"][0],
                                      "tipos_bloqueio": {"nome_ner": 2, "email": 1, "digitos_11": 1, "outro": 1}}]}
        dados = maestro.montar(BancoFalso(rpcs={"hermes_maestro_totais": bom}), AGORA, self.logs)
        self.assertEqual(dados["gateway"][0]["tipos_bloqueio"]["nome_ner"], 2)
        # chave fora da lista (texto cru) ou valor que não é contagem: falha fechado
        for tipos in ({"Fulano de Tal": 1}, {"nome_ner": "Maria"}, {"email": True}):
            ruim = {**TOTAIS, "gateway": [{**TOTAIS["gateway"][0], "tipos_bloqueio": tipos}]}
            with self.assertRaises(ValueError):
                maestro.montar(BancoFalso(rpcs={"hermes_maestro_totais": ruim}), AGORA, self.logs)

    def test_executar_grava_atomico_stdout_vazio_e_ignora_modo(self):
        banco = BancoFalso(rpcs={"hermes_maestro_totais": TOTAIS})
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            codigo = maestro.executar_maestro({"MAESTRO_SAIDA": self.saida, "VIGIAS_MODO": "invalido"},
                                              relogio=lambda: AGORA, banco_fabrica=lambda: banco)
        self.assertEqual((codigo, out.getvalue(), err.getvalue()), (0, "", ""))
        arq = os.path.join(self.saida, "numeros.json")
        with open(arq, encoding="utf-8") as f:
            dados = json.load(f)
        self.assertEqual(dados["gateway"][0]["origem"], "corujinha:telegram")
        self.assertEqual(os.listdir(self.saida), ["numeros.json"])  # sem temporário sobrando
        if os.name == "posix":
            self.assertEqual(stat.S_IMODE(os.stat(self.saida).st_mode), 0o755)
            self.assertEqual(stat.S_IMODE(os.stat(arq).st_mode), 0o644)
        # o próprio maestro aparece nos logs dos vigias na rodada seguinte
        with contextlib.redirect_stdout(io.StringIO()):
            maestro.executar_maestro({"MAESTRO_SAIDA": self.saida}, relogio=lambda: AGORA, banco_fabrica=lambda: banco)
        with open(arq, encoding="utf-8") as f:
            self.assertIn("maestro_numeros", json.load(f)["vigias"])

    def test_falha_do_banco_mantem_arquivo_anterior(self):
        os.makedirs(self.saida)
        arq = os.path.join(self.saida, "numeros.json")
        with open(arq, "w", encoding="utf-8") as f:
            f.write('{"anterior": true}')
        banco = BancoFalso(rpcs={"hermes_maestro_totais": apoio.erro()})
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            codigo = maestro.executar_maestro({"MAESTRO_SAIDA": self.saida}, relogio=lambda: AGORA,
                                              banco_fabrica=lambda: banco)
        self.assertEqual(codigo, 1)
        self.assertEqual(out.getvalue(), "")
        self.assertIn("maestro_numeros falhou", err.getvalue())
        with open(arq, encoding="utf-8") as f:
            self.assertEqual(json.load(f), {"anterior": True})

    def test_sem_url_falha(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            self.assertEqual(maestro.executar_maestro({"MAESTRO_SAIDA": self.saida}), 1)
        self.assertIn("HERMES_PG_JOB_URL", err.getvalue())


class TestContratoComPluginMaestro(unittest.TestCase):
    """O arquivo tem de ser lido pelo plugin do Lab (sem mexer nele)."""

    def test_plugin_le_gateway_e_vigias(self):
        plugin = carregar_plugin_maestro()
        if plugin is None or not hasattr(plugin, "resumir"):
            self.skipTest("plugin maestro fora do repositório ou sem resumir()")
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        escrever_log(tmp.name, "argos", "2026-10-05", ["2026-10-05 06:00:00,000 ERROR [argos] falhou: x"])
        dados = maestro.montar(BancoFalso(rpcs={"hermes_maestro_totais": TOTAIS}), AGORA, tmp.name, fuso=BRT)
        dados = json.loads(json.dumps(dados))  # como o plugin lê do disco
        resumo, avisos = plugin.resumir(dados, agora=AGORA.astimezone(BRT))
        self.assertEqual(resumo["dia_referencia"], "2026-10-05")
        a = resumo["por_agente"]["corujinha"]
        self.assertEqual((a["total_1d"], a["bloqueados_1d"], a["total_7d"], a["bloqueados_7d"]), (40, 3, 40, 3))
        self.assertEqual(resumo["vigias_com_falha"], ["argos"])


class TestAgendaMaestro(unittest.TestCase):
    def test_minuto_50_de_toda_hora_e_script_existe(self):
        linhas = {n: (s, e) for n, s, e in agenda.linhas(-180)}
        self.assertEqual(linhas["coruja-maestro_numeros"], ("maestro_numeros.py", "50 * * * *"))
        self.assertTrue(os.path.isfile(os.path.join(apoio.PASTA, "maestro_numeros.py")))


if __name__ == "__main__":
    unittest.main()
