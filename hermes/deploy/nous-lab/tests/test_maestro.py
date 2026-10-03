"""Maestro da Coruja Lab: números agregados, propostas de skill, aprovação e reescrita do config."""

import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent.parent

# O plugin importa gateway.session_context (do Nous). Aqui vai um falso, com a
# sessão controlada pelo teste.
SESSAO: dict = {}
_gw = types.ModuleType("gateway")
_sc = types.ModuleType("gateway.session_context")
_sc.get_session_env = lambda nome, padrao="": SESSAO.get(nome, padrao)
_gw.session_context = _sc
sys.modules.setdefault("gateway", _gw)
sys.modules["gateway.session_context"] = _sc


def _carregar(nome, arquivo):
    spec = importlib.util.spec_from_file_location(nome, arquivo)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


maestro = _carregar("maestro_plugin", AQUI / "plugins" / "maestro" / "__init__.py")
reescrever = _carregar("reescrever_config", AQUI / "reescrever-config.py")

BRT = timezone(timedelta(hours=-3))
AGORA = datetime(2026, 10, 3, 9, 30, tzinfo=BRT)

SKILL_OK = (
    "# Resposta curta sobre escala\n\n"
    "Quando perguntarem do plantão, use coruja_consultar com escopo escala e responda em até 3 linhas.\n"
    "Se a conta não estiver vinculada, peça o código do Perfil.\n"
)


class Ctx:
    def __init__(self):
        self.ferramentas = []

    def register_tool(self, name, toolset, schema, handler, emoji):
        assert toolset == "maestro" and schema["name"] == name and callable(handler)
        self.ferramentas.append(name)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.env = mock.patch.dict(os.environ, {
            "MAESTRO_PROPOSTAS": str(self.tmp / "propostas"),
            "MAESTRO_NUMEROS": str(self.tmp / "numeros.json"),
            "MAESTRO_APROVADORES": "111, 222",
        })
        self.env.start()
        self.relogio = mock.patch.object(maestro, "_agora", lambda: AGORA)
        self.relogio.start()
        SESSAO.clear()

    def tearDown(self):
        self.relogio.stop()
        self.env.stop()
        SESSAO.clear()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def propor(self, **kw):
        args = {"agente": "corujinha", "nome": "escala-curta", "descricao": "Quando perguntarem do plantão do dia",
                "conteudo": SKILL_OK, "motivo": "bloqueio da corujinha subiu de 2% para 9% no dia"}
        args.update(kw)
        return json.loads(maestro._propor(args))

    def host(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            cod = maestro._host(list(argv))
        return cod, out.getvalue(), err.getvalue()

    def como(self, usuario, plataforma="telegram"):
        SESSAO.clear()
        if usuario:
            SESSAO.update(HERMES_SESSION_PLATFORM=plataforma, HERMES_SESSION_USER_ID=usuario)


class TestRegistro(unittest.TestCase):
    def test_so_registra_no_lab(self):
        todas = ["numeros_corujas", "propor_skill", "listar_propostas", "ver_proposta", "aprovar_proposta", "rejeitar_proposta"]
        for agente, esperado in [("lab", todas), ("corujinha", []), ("clinica", []), ("", [])]:
            ctx = Ctx()
            with mock.patch.dict(os.environ, {"CORUJA_AGENTE": agente}):
                maestro.register(ctx)
            self.assertEqual(ctx.ferramentas, esperado, agente)


class TestNumeros(Base):
    def gravar(self, dados):
        (self.tmp / "numeros.json").write_text(json.dumps(dados), encoding="utf-8")

    def test_sem_arquivo(self):
        r = json.loads(maestro._numeros({}))
        self.assertFalse(r["ok"])
        self.assertTrue(r["avisos"])

    def test_json_invalido(self):
        (self.tmp / "numeros.json").write_text("{nao é json", encoding="utf-8")
        self.assertFalse(json.loads(maestro._numeros({}))["ok"])

    def test_resumo_formato_dicionario(self):
        gw = {"corujinha:telegram": {}, "gestora:telegram": {}}
        for i in range(7):
            dia = (AGORA.date() - timedelta(days=i)).isoformat()
            gw["corujinha:telegram"][dia] = {"total": 100, "bloqueados": 2}
            gw["gestora:telegram"][dia] = {"total": 50, "bloqueados": 1}
        gw["corujinha:telegram"][AGORA.date().isoformat()] = {"total": 100, "bloqueados": 30}
        gw["corujinha:telegram"]["2026-09-01"] = {"total": 999, "bloqueados": 999}  # fora dos 7 dias
        self.gravar({
            "gerado_em": (AGORA - timedelta(minutes=20)).isoformat(),
            "janela_dias": 30,
            "gateway": gw,
            "vigias": {"coruja-cadeia_auditoria": {"ultima": "x", "ok": True, "falhas": 0},
                       "coruja-gaviao": {"ultima": "x", "ok": False, "falhas": 2}},
        })
        r = json.loads(maestro._numeros({}))
        self.assertTrue(r["ok"])
        res = r["resumo"]
        self.assertEqual(res["idade_horas"], 0.3)
        c = res["por_agente"]["corujinha"]
        self.assertEqual((c["total_1d"], c["bloqueados_1d"], c["total_7d"], c["bloqueados_7d"]), (100, 30, 700, 42))
        self.assertEqual(c["taxa_bloqueio_1d_pct"], 30.0)
        self.assertEqual(c["taxa_bloqueio_7d_pct"], 6.0)
        self.assertEqual(res["por_agente"]["gestora"]["taxa_bloqueio_7d_pct"], 2.0)
        self.assertEqual(res["vigias_com_falha"], ["coruja-gaviao"])
        self.assertTrue(any("bloqueio subiu" in a for a in r["avisos"]))
        self.assertTrue(any("coruja-gaviao" in a for a in r["avisos"]))
        self.assertFalse(any("velhos" in a for a in r["avisos"]))
        self.assertIsNotNone(r["dados"])

    def test_formato_lista_e_bloqueados_de_topo(self):
        hoje = AGORA.date().isoformat()
        self.gravar({
            "gerado_em": "2026-10-03T05:00:00-03:00",
            "gateway": [{"origem": "suporte:telegram", "dia": hoje, "total": 40}],
            "bloqueados": [{"origem": "suporte:telegram", "dia": hoje, "total": 4}],
            "vigias": [{"job": "v1", "ok": True}, {"job": "v2", "falhas": 1}],
        })
        r = json.loads(maestro._numeros({}))
        s = r["resumo"]["por_agente"]["suporte"]
        self.assertEqual((s["total_1d"], s["bloqueados_1d"], s["taxa_bloqueio_1d_pct"]), (40, 4, 10.0))
        self.assertEqual(r["resumo"]["vigias_com_falha"], ["v2"])
        self.assertTrue(any("velhos" in a for a in r["avisos"]), "4,5 h > 3 h")

    def test_tipos_bloqueio_por_agente(self):
        hoje = AGORA.date().isoformat()
        ontem = (AGORA.date() - timedelta(days=1)).isoformat()
        velho = (AGORA.date() - timedelta(days=10)).isoformat()
        self.gravar({
            "gerado_em": (AGORA - timedelta(minutes=10)).isoformat(),
            "gateway": [
                {"origem": "corujinha:telegram", "dia": hoje, "total": 50, "bloqueados": 5,
                 "tipos_bloqueio": {"nome_ner": 3, "digitos_11": 1, "email": 1}},
                {"origem": "corujinha:whatsapp", "dia": hoje, "total": 10, "bloqueados": 1,
                 "tipos_bloqueio": {"data_completa": 1}},
                {"origem": "corujinha:telegram", "dia": ontem, "total": 50, "bloqueados": 6,
                 "tipos_bloqueio": {"data_completa": 4, "digitos_15": 2, "Fulano de Tal": 9}},
                {"origem": "corujinha:telegram", "dia": velho, "total": 50, "bloqueados": 50,
                 "tipos_bloqueio": {"email": 50}},  # fora dos 7 dias
                {"origem": "gestora:telegram", "dia": hoje, "total": 20, "bloqueados": 0, "tipos_bloqueio": {}},
            ],
        })
        r = json.loads(maestro._numeros({}))
        c = r["resumo"]["por_agente"]["corujinha"]
        self.assertEqual(c["tipos_bloqueio_1d"], [{"tipo": "nome_ner", "total": 3}, {"tipo": "data_completa", "total": 1},
                                                  {"tipo": "digitos_11", "total": 1}])
        # 7d: chave inesperada vira "outro" (o texto cru nunca aparece no resumo)
        self.assertEqual(c["tipos_bloqueio_7d"], [{"tipo": "outro", "total": 9}, {"tipo": "data_completa", "total": 5},
                                                  {"tipo": "nome_ner", "total": 3}])
        self.assertNotIn("Fulano", json.dumps(r["resumo"], ensure_ascii=False))
        g = r["resumo"]["por_agente"]["gestora"]
        self.assertNotIn("tipos_bloqueio_1d", g, "sem bloqueio no período: sem a chave")

    def test_sem_tipos_bloqueio_continua_igual(self):
        hoje = AGORA.date().isoformat()
        self.gravar({"gerado_em": AGORA.isoformat(),
                     "gateway": [{"origem": "suporte:telegram", "dia": hoje, "total": 40, "bloqueados": 4}]})
        s = json.loads(maestro._numeros({}))["resumo"]["por_agente"]["suporte"]
        self.assertEqual(set(s), {"total_1d", "bloqueados_1d", "total_7d", "bloqueados_7d",
                                  "taxa_bloqueio_1d_pct", "taxa_bloqueio_7d_pct"})

    def test_tipos_bloqueio_formato_dicionario(self):
        hoje = AGORA.date().isoformat()
        self.gravar({"gerado_em": AGORA.isoformat(),
                     "gateway": {"clinica:telegram": {hoje: {"total": 10, "bloqueados": 2,
                                                             "tipos_bloqueio": {"email": 2}}}}})
        c = json.loads(maestro._numeros({}))["resumo"]["por_agente"]["clinica"]
        self.assertEqual(c["tipos_bloqueio_7d"], [{"tipo": "email", "total": 2}])

    def test_sem_gerado_em(self):
        self.gravar({"gateway": {}})
        r = json.loads(maestro._numeros({}))
        self.assertTrue(any("gerado_em" in a for a in r["avisos"]))


class TestValidacao(Base):
    def test_proposta_valida_grava(self):
        r = self.propor()
        self.assertTrue(r["ok"], r)
        self.assertEqual(r["id"], "20261003-0930-escala-curta")
        pasta = self.tmp / "propostas" / r["id"]
        meta = json.loads((pasta / "proposta.json").read_text(encoding="utf-8"))
        self.assertEqual(meta["status"], "pendente")
        self.assertEqual(meta["agente"], "corujinha")
        self.assertEqual(meta["criada_em"], "2026-10-03T09:30:00-03:00")
        skill = (pasta / "SKILL.md").read_text(encoding="utf-8")
        self.assertTrue(skill.startswith("---\nname: escala-curta\ndescription: \"Quando perguntarem"))
        self.assertIn("coruja_consultar", skill)
        self.assertEqual(sorted(x.name for x in pasta.iterdir()), ["SKILL.md", "proposta.json"])
        self.assertEqual(maestro.validar_skill_arquivo(pasta / "SKILL.md", "corujinha", "escala-curta"), [])

    def recusa(self, trecho_erro, **kw):
        r = self.propor(**kw)
        self.assertFalse(r["ok"], kw)
        self.assertTrue(any(trecho_erro in m for m in r["motivos"]), (trecho_erro, r))
        self.assertFalse((self.tmp / "propostas").exists() and any((self.tmp / "propostas").iterdir()))

    def test_agente_e_nome(self):
        self.recusa("agente", agente="lab")
        self.recusa("agente", agente="hermes")
        for nome in ["ab", "Escala", "escala_curta", "-escala", "escala-", "a--b", "x" * 49, "../etc"]:
            self.recusa("kebab", nome=nome)

    def test_campos(self):
        self.recusa("descricao", descricao="curta")
        self.recusa("descricao", descricao="duas linhas\nna descrição")
        self.recusa("conteudo vazio", conteudo="   ")
        self.recusa("12000", conteudo="a" * 12001)
        self.recusa("frontmatter", conteudo="---\nname: x\n---\ncorpo")
        self.recusa("motivo", motivo="")

    def test_dado_pessoal(self):
        for texto, rotulo in [
            ("paciente 123.456.789-09", "CPF"),
            ("ligar 12345678909", "CPF"),
            ("CNS 700 0000 0000 0000", "CNS"),
            ("ligar (62) 99999-1234", "telefone"),
            ("ligar 99999-1234", "telefone"),
            ("mandar para fulano@exemplo.com", "e-mail"),
            ("nascido em 03/10/2019", "data completa"),
            ("evento de 2026-09-27", "data completa"),
        ]:
            self.recusa(rotulo, conteudo=SKILL_OK + texto)
        self.recusa("CPF", motivo="caso do CPF 123.456.789-09 ontem")

    def test_ferramenta_proibida(self):
        for t in ["Use o terminal para conferir", "rode execute_code", "abra com read_file", "use bash", "toolset file"]:
            self.recusa("ferramenta", conteudo=SKILL_OK + t)

    def test_dose_recusada(self):
        for t in ["dipirona 15 mg/kg", "500mg", "0,1 mcg/kg/min", "noradrenalina 10 mL/h", "insulina 0.1 UI/kg",
                  "calcular em mg/kg", "2 g de ceftriaxona"]:
            self.recusa("dose", agente="clinica", conteudo=SKILL_OK + t)
        self.recusa("dose", agente="gestora", conteudo=SKILL_OK + "15 mg/kg")

    def test_clinica_sem_dose_passa(self):
        r = self.propor(agente="clinica", nome="citar-pagina",
                        conteudo="# Citar fonte\n\nSempre cite livro e página da biblioteca_clinica_buscar. "
                                 "Sem fonte pediátrica declarada, diga que não há referência. Nunca invente dose.\n")
        self.assertTrue(r["ok"], r)

    def test_texto_comum_nao_e_falso_positivo(self):
        r = self.propor(conteudo=SKILL_OK + "Responda em 3 linhas; veja os últimos 7 dias e 24h; ano 2026; 4G instável.\n")
        self.assertTrue(r["ok"], r)

    def test_controle(self):
        self.recusa("controle", conteudo=SKILL_OK + "\x1b[31mvermelho")

    def test_pendente_duplicada(self):
        self.assertTrue(self.propor()["ok"])
        with mock.patch.object(maestro, "_agora", lambda: AGORA + timedelta(minutes=5)):
            r = self.propor()
        self.assertFalse(r["ok"])
        self.assertIn("pendente", r["erro"])
        r2 = self.propor(agente="gestora")  # mesmo nome, outro agente, mesmo minuto → mesmo id
        self.assertFalse(r2["ok"])


class TestFluxo(Base):
    def test_listar_e_ver(self):
        pid = self.propor()["id"]
        with mock.patch.object(maestro, "_agora", lambda: AGORA + timedelta(minutes=1)):
            self.propor(agente="suporte", nome="incidente-curto")
        todas = json.loads(maestro._listar({}))
        self.assertEqual(todas["total"], 2)
        self.assertEqual(todas["propostas"][0]["nome"], "incidente-curto", "mais nova primeiro")
        self.assertEqual(set(todas["propostas"][0]), {"id", "agente", "nome", "status", "criada_em"})
        self.assertEqual(json.loads(maestro._listar({"status": "aprovada"}))["total"], 0)
        self.assertFalse(json.loads(maestro._listar({"status": "xyz"}))["ok"])
        v = json.loads(maestro._ver({"id": pid}))
        self.assertTrue(v["ok"])
        self.assertIn("escala-curta", v["skill_md"])
        for ruim in ["../../etc", "x", "", "20261003-0930-../x"]:
            self.assertFalse(json.loads(maestro._ver({"id": ruim}))["ok"], ruim)

    def test_aprovacao_exige_sessao_e_lista(self):
        pid = self.propor()["id"]
        self.como(None)
        self.assertFalse(json.loads(maestro._aprovar({"id": pid}))["ok"])
        self.como("111", plataforma="cli")
        self.assertFalse(json.loads(maestro._aprovar({"id": pid}))["ok"])
        self.como("999")
        r = json.loads(maestro._aprovar({"id": pid}))
        self.assertFalse(r["ok"])
        self.assertIn("aprovadores", r["erro"])
        with mock.patch.dict(os.environ, {"MAESTRO_APROVADORES": ""}):
            self.como("111")
            self.assertFalse(json.loads(maestro._aprovar({"id": pid}))["ok"])
        meta = json.loads(maestro._ver({"id": pid}))["proposta"]
        self.assertEqual(meta["status"], "pendente")

    def test_transicoes(self):
        pid = self.propor()["id"]
        self.como("222")
        r = json.loads(maestro._aprovar({"id": pid}))
        self.assertTrue(r["ok"], r)
        meta = json.loads(maestro._ver({"id": pid}))["proposta"]
        self.assertEqual((meta["status"], meta["aprovada_por"]), ("aprovada", "222"))
        self.assertEqual(len(meta["sha256"]), 64)
        self.assertFalse(json.loads(maestro._aprovar({"id": pid}))["ok"], "aprovar de novo")
        self.assertFalse(json.loads(maestro._rejeitar({"id": pid, "motivo": ""}))["ok"], "rejeitar sem motivo")
        r = json.loads(maestro._rejeitar({"id": pid, "motivo": "mudou o plano"}))
        self.assertTrue(r["ok"])
        meta = json.loads(maestro._ver({"id": pid}))["proposta"]
        self.assertEqual((meta["status"], meta["rejeitada_por"], meta["motivo_rejeicao"]), ("rejeitada", "222", "mudou o plano"))
        self.assertFalse(json.loads(maestro._aprovar({"id": pid}))["ok"], "rejeitada não volta")
        self.assertFalse(json.loads(maestro._rejeitar({"id": pid, "motivo": "de novo"}))["ok"])

    def test_aprovar_revalida_skill_mexida(self):
        pid = self.propor()["id"]
        skill = self.tmp / "propostas" / pid / "SKILL.md"
        skill.write_text(skill.read_text(encoding="utf-8") + "\nuse o terminal\n", encoding="utf-8")
        self.como("111")
        r = json.loads(maestro._aprovar({"id": pid}))
        self.assertFalse(r["ok"])
        self.assertEqual(json.loads(maestro._ver({"id": pid}))["proposta"]["status"], "pendente")

    def test_aplicada_nao_rejeita(self):
        pid = self.propor()["id"]
        self.como("111")
        maestro._aprovar({"id": pid})
        self.assertEqual(self.host("marcar", str(self.tmp / "propostas" / pid), "aplicada")[0], 0)
        self.assertFalse(json.loads(maestro._rejeitar({"id": pid, "motivo": "tarde"}))["ok"])


class TestHost(Base):
    """Modos usados pelo aplicar-propostas.sh."""

    def aprovada(self):
        pid = self.propor()["id"]
        self.como("111")
        self.assertTrue(json.loads(maestro._aprovar({"id": pid}))["ok"])
        return self.tmp / "propostas" / pid

    def test_validar_ok_e_marcar(self):
        p = self.aprovada()
        cod, out, err = self.host("validar", str(p), "111,333")
        self.assertEqual(cod, 0, err)
        self.assertEqual(out.strip(), "corujinha escala-curta")
        cod, out, _ = self.host("mostrar", str(p))
        self.assertEqual(cod, 0)
        self.assertIn("SKILL.md (20 primeiras linhas)", out)
        self.assertEqual(self.host("marcar", str(p), "aplicada")[0], 0)
        meta = json.loads((p / "proposta.json").read_text(encoding="utf-8"))
        self.assertEqual(meta["status"], "aplicada")
        self.assertIn("aplicada_em", meta)
        self.assertEqual(self.host("validar", str(p), "111")[0], 1, "aplicada não reaplica")
        self.assertEqual(self.host("marcar", str(p), "aprovada")[0], 1)

    def test_validar_recusa(self):
        p = self.aprovada()
        self.assertEqual(self.host("validar", str(p), "222")[0], 1, "aprovador fora da lista do host")
        self.assertEqual(self.host("validar", str(p), "")[0], 1, "lista vazia")
        (p / "extra.sh").write_text("echo oi", encoding="utf-8")
        cod, _, err = self.host("validar", str(p), "111")
        self.assertEqual(cod, 1)
        self.assertIn("além de SKILL.md", err)
        (p / "extra.sh").unlink()
        (p / "SKILL.md").write_text((p / "SKILL.md").read_text(encoding="utf-8") + "\nmais uma linha\n", encoding="utf-8")
        cod, _, err = self.host("validar", str(p), "111")
        self.assertEqual(cod, 1)
        self.assertIn("sha256", err)

    def test_validar_nome_trocado(self):
        p = self.aprovada()
        meta = json.loads((p / "proposta.json").read_text(encoding="utf-8"))
        meta["nome"] = "outro-nome"
        (p / "proposta.json").write_text(json.dumps(meta), encoding="utf-8")
        cod, _, err = self.host("validar", str(p), "111")
        self.assertEqual(cod, 1)
        self.assertIn("name do frontmatter", err)

    def test_status_forjado_sem_aprovador(self):
        pid = self.propor()["id"]
        p = self.tmp / "propostas" / pid
        meta = json.loads((p / "proposta.json").read_text(encoding="utf-8"))
        meta["status"] = "aprovada"  # a Lab escreveu direto no arquivo
        (p / "proposta.json").write_text(json.dumps(meta), encoding="utf-8")
        self.assertEqual(self.host("validar", str(p), "111")[0], 1)

    def test_removidas(self):
        p = self.aprovada()
        self.host("marcar", str(p), "aplicada")
        cod, out, _ = self.host("removidas", str(self.tmp / "propostas"), "corujinha", "escala-curta")
        self.assertEqual(cod, 0)
        self.assertIn("proposta.json", out)
        self.assertEqual(json.loads((p / "proposta.json").read_text(encoding="utf-8"))["status"], "removida")


CONFIG_EXEMPLO = """\
model:
  default: deepseek-chat
  provider: custom
  base_url: http://hermes-app:3000/ia/v1
  api_key: xxx
platform_toolsets:
  cli:
    - terminal
    - file
  telegram:
    - chefe-coruja
    - skills
toolsets:
  - hermes-telegram
plugins:
  enabled:
    - chefe-coruja
timezone: America/Sao_Paulo
"""


class TestConfig(unittest.TestCase):
    def test_reescreve_exemplo(self):
        s = reescrever.reescrever(CONFIG_EXEMPLO)
        self.assertIn("  telegram:\n    - skills\n    - terminal\n    - file\n    - todo\n    - lab-skills\n    - maestro\ntoolsets:", s)
        self.assertIn("plugins:\n  enabled:\n    - rtk-rewrite\n    - lab-skills\n    - maestro\ntimezone:", s)
        self.assertNotIn("chefe-coruja", s)
        self.assertIn("  cli:\n    - terminal\n    - file\n  telegram:", s, "cli intacto")
        self.assertEqual(reescrever.reescrever(s), s, "idempotente")

    def test_formato_inesperado_para(self):
        with self.assertRaises(ValueError):
            reescrever.reescrever("model:\n  default: x\n")

    def test_cli_arquivo(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "config.yaml"
            p.write_text(CONFIG_EXEMPLO, encoding="utf-8")
            r = subprocess.run([sys.executable, str(AQUI / "reescrever-config.py"), str(p)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("maestro", p.read_text(encoding="utf-8"))
            p.write_text("nada: 1\n", encoding="utf-8")
            r = subprocess.run([sys.executable, str(AQUI / "reescrever-config.py"), str(p)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 1)
            self.assertEqual(p.read_text(encoding="utf-8"), "nada: 1\n", "não grava pela metade")


@unittest.skipUnless(shutil.which("sh"), "sem sh")
class TestScripts(unittest.TestCase):
    def test_sintaxe(self):
        for nome in ("criar-lab.sh", "aplicar-propostas.sh"):
            r = subprocess.run(["sh", "-n", str(AQUI / nome)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, f"{nome}: {r.stderr}")

    def test_aplicar_sem_set_x_nem_env(self):
        s = (AQUI / "aplicar-propostas.sh").read_text(encoding="utf-8")
        self.assertIn("set -eu", s)
        self.assertNotIn("set -x", s)
        self.assertNotRegex(s, r"(?m)^\s*(env|printenv)\b")

    def test_criar_lab_maestro(self):
        s = (AQUI / "criar-lab.sh").read_text(encoding="utf-8")
        self.assertIn('"$AQUI/plugins/maestro"', s)
        self.assertIn("/opt/maestro/numeros:ro", s)
        self.assertIn("MAESTRO_APROVADORES=", s)
        self.assertIn("reescrever-config.py", s)


if __name__ == "__main__":
    unittest.main()
