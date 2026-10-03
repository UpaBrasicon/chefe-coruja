"""Agenda do cron (UTC do agendador.ts → fuso do Nous) e a comparação sombra × Hermes."""

from __future__ import annotations

import datetime as _dt
import json
import os
import re
import tempfile
import unittest

import apoio  # noqa: F401
import agenda
import compara
from vigias.comum import sha256

try:
    from zoneinfo import ZoneInfo

    ZoneInfo("America/Sao_Paulo")
    TEM_TZDATA = True
except Exception:  # noqa: BLE001 — Windows sem o pacote tzdata
    TEM_TZDATA = False

AGENDADOR_TS = os.path.join(apoio.PASTA, "..", "..", "src", "queue", "agendador.ts")


class TestAgenda(unittest.TestCase):
    def test_conversao_para_brasilia(self):
        esperado = {
            "coruja-sentinela_escala": "30 6 * * 1", "coruja-gaviao_relatorio_semanal": "15 8 * * 1",
            "coruja-cerbero_dados": "5 * * * *", "coruja-cerbero_hermes": "0 5 * * *",
            "coruja-gaviao_patrulha": "0 8,20 * * *", "coruja-argos_auditoria": "0 6,18 * * *",
            "coruja-vigia_porta": "5 7,19 * * *", "coruja-vigia_presenca": "*/15 * * * *",
            "coruja-vigia_escala": "0 8 * * *", "coruja-vigia_tardios": "2 8 * * *",
            "coruja-guardiao_prontuario": "20 * * * *", "coruja-cadeia_auditoria": "0 4 * * *",
        }
        self.assertEqual({n: e for n, _, e in agenda.linhas(-180)}, esperado)

    def test_em_utc_fica_igual(self):
        self.assertEqual([e for _, _, e in agenda.linhas(0)], [e for _, _, e in agenda.AGENDA_UTC])

    def test_virada_de_dia_com_dia_restrito_recusa(self):
        self.assertEqual(agenda.converter("0 1 * * *", -3), "0 22 * * *")
        with self.assertRaises(ValueError):
            agenda.converter("0 1 * * 1", -3)
        with self.assertRaises(ValueError):
            agenda.linhas(-150)

    @unittest.skipUnless(os.path.isfile(AGENDADOR_TS), "fora do repositório")
    def test_expressoes_utc_iguais_ao_agendador_ts(self):
        with open(AGENDADOR_TS, encoding="utf-8") as f:
            ts = f.read()
        padroes = set(re.findall(r"pattern: (?:cronBrasilia\()?'([^']+)'", ts))
        nossos = {e for n, _, e in agenda.AGENDA_UTC if n != "coruja-cerbero_dados"}  # esse é `every` no TS
        self.assertEqual(padroes, nossos)
        self.assertIn("every: 3_600_000", ts)
        nomes_ts = set(re.findall(r"upsertJobScheduler\(\s*'([a-z_]+)'", ts))
        self.assertEqual({n.removeprefix("coruja-") for n, _, _ in agenda.AGENDA_UTC}, nomes_ts)
        for _, script, _ in agenda.AGENDA_UTC:
            self.assertTrue(os.path.isfile(os.path.join(apoio.PASTA, script)), script)

    @unittest.skipUnless(TEM_TZDATA, "sem tzdata")
    def test_fuso_do_nous_na_ordem_do_hermes_time(self):
        agora = _dt.datetime(2026, 10, 5, 12, tzinfo=_dt.timezone.utc)
        with tempfile.TemporaryDirectory() as home:
            self.assertEqual(agenda.fuso_do_nous({"HERMES_TIMEZONE": "America/Sao_Paulo", "HERMES_HOME": home}, agora)[1], -180)
            with open(os.path.join(home, "config.yaml"), "w", encoding="utf-8") as f:
                f.write("model: x\ntimezone: 'UTC'  # comentário\n")
            self.assertEqual(agenda.fuso_do_nous({"HERMES_HOME": home}, agora), ("timezone UTC", 0))
            self.assertEqual(agenda.fuso_do_nous({"HERMES_HOME": home, "HERMES_TIMEZONE": "America/Sao_Paulo"}, agora)[1], -180)

    def test_ids_por_nome_no_jobs_json(self):
        with tempfile.TemporaryDirectory() as d:
            caminho = os.path.join(d, "jobs.json")
            with open(caminho, "w", encoding="utf-8") as f:
                json.dump({"jobs": [{"id": "ab12", "name": "coruja-vigia_porta"}, {"id": "cd34", "name": "wiki-backup"}]}, f)
            self.assertEqual(agenda.ids_por_nome("coruja-vigia_porta", caminho), ["ab12"])
            self.assertEqual(agenda.ids_por_nome("CORUJA-VIGIA_PORTA", caminho), ["ab12"])
            self.assertEqual(agenda.ids_por_nome("nao-existe", caminho), [])
            self.assertEqual(agenda.ids_por_nome("x", os.path.join(d, "falta.json")), [])


class TestCompara(unittest.TestCase):
    def test_limites_do_dia_de_brasilia(self):
        self.assertEqual(compara.limites_do_dia("2026-10-05"), ("2026-10-05T03:00:00.000Z", "2026-10-06T03:00:00.000Z"))

    def test_incidentes_bateram_com_ja_aberta(self):
        sombra = [{"tabela": "cerbero_incidentes", "acao": "inserir", "titulo": "A", "chave_sha256": sha256("dados:A:1")},
                  {"tabela": "cerbero_incidentes", "acao": "ja_aberta", "chave_sha256": sha256("dados:B:1")}]
        banco = [{"titulo": "A", "chave_dedup": "dados:A:1"}, {"titulo": "B", "chave_dedup": "dados:B:1"}]
        ok, linhas = compara.comparar_incidentes(sombra, banco)
        self.assertTrue(ok, linhas)

    def test_incidentes_divergem(self):
        sombra = [{"tabela": "cerbero_incidentes", "acao": "inserir", "titulo": "A", "chave_sha256": sha256("dados:A:1")}]
        banco = [{"titulo": "C", "chave_dedup": "dados:C:1"}]
        ok, linhas = compara.comparar_incidentes(sombra, banco)
        self.assertFalse(ok)
        self.assertIn("só no Hermes 1 · só no Nous 1", linhas[0])

    def test_alertas_e_notificacoes(self):
        a = {"tabela": "chronos_alertas_escala", "acao": "inserir", "unidade_id": "u", "medico_id": "m", "janela": "30d", "metrica": "faltas"}
        self.assertTrue(compara.comparar_alertas([a], [{k: a[k] for k in ("unidade_id", "medico_id", "janela", "metrica")}])[0])
        n = {"tabela": "notificacoes_plantonista", "perfil_id": "p", "unidade_id": "u", "data": "2026-10-05", "tipo": "checkin_pendente_0700"}
        ok, linhas = compara.comparar_notificacoes([n, n], None, "2026-10-05")  # repetida conta uma vez
        self.assertIsNone(ok)
        self.assertIn("previu 1", linhas[0])
        self.assertTrue(compara.comparar_notificacoes([n], [{k: n[k] for k in ("perfil_id", "unidade_id", "data", "tipo")}], "2026-10-05")[0])

    def test_relatorio_pareia_pelo_mais_proximo(self):
        p = {"tabela": "gaviao_relatorios_semanais", "ts": "2026-10-05T11:15:01.000Z", "periodo_fim": "2026-10-05",
             "resumo": {"total_incidentes": 4, "total_alertas": 1}}
        banco = [{"periodo_fim": "2026-10-05", "gerado_em": "2026-10-05T03:00:00+00:00", "resumo": {"total_incidentes": 0, "total_alertas": 0}},
                 {"periodo_fim": "2026-10-05", "gerado_em": "2026-10-05T11:15:03+00:00", "resumo": {"total_incidentes": 4, "total_alertas": 1}}]
        ok, linhas = compara.comparar_relatorios([p], banco[1:])
        self.assertTrue(ok, linhas)
        self.assertFalse(compara.comparar_relatorios([p], banco)[0])  # um a mais no Hermes

    def test_ler_sombra_junta_os_jobs_do_dia(self):
        with tempfile.TemporaryDirectory() as d:
            for job in ("vigia_porta", "argos"):
                with open(os.path.join(d, f"{job}-2026-10-05.jsonl"), "w", encoding="utf-8") as f:
                    f.write(json.dumps({"tabela": "t"}) + "\n\n")
            with open(os.path.join(d, "argos-2026-10-04.jsonl"), "w", encoding="utf-8") as f:
                f.write(json.dumps({"tabela": "t"}) + "\n")
            self.assertEqual(len(compara.ler_sombra("2026-10-05", d)), 2)


if __name__ == "__main__":
    unittest.main()
