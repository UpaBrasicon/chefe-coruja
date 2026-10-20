"""Público da pergunta e das fontes (R2-13, 13/10/2026).

Roda com as dependências da imagem:
    BIBLIOTECA_API_KEY=t QDRANT_URL=http://x OLLAMA_URL=http://x EMBED_MODEL=x \
    DEEPSEEK_API_KEY=x python -m unittest test_publico
"""

import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

for k, v in {"BIBLIOTECA_API_KEY": "t", "QDRANT_URL": "http://qdrant.invalido", "OLLAMA_URL": "http://ollama.invalido",
             "EMBED_MODEL": "x", "DEEPSEEK_API_KEY": "x", "DEEPSEEK_BASE_URL": "http://llm.invalido",
             "REESCRITA": "0"}.items():
    os.environ.setdefault(k, v)

import main  # noqa: E402
import publico as pub  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


class TestPublicoDaPergunta(unittest.TestCase):
    """Perguntas da Rodada 2 (coorte 2) e casos de borda."""

    def test_criancas_da_coorte_2(self):
        for q in [
            "RN de 10 dias, 3,2 kg, icterícia zona III, bilirrubina total 19 mg/dL. Qual o próximo passo?",
            "Criança de 3 anos, 14 kg, ingeriu 2 comprimidos de anlodipino 10 mg da avó há 40 minutos.",
            "Criança de 9 anos, 30 kg, glicemia 480, pH 7,12, bicarbonato 9, cetonúria 3+. Como conduzo a cetoacidose?",
            "Paciente de 9 anos, 30 kg, glicemia 480, pH 7,12. Como conduzo?",
            "Lactente de 8 meses com febre há 3 dias",
            "bebê com 3 meses de idade e tosse",
            "Qual a dose de amoxicilina para uma criança de 12 kg?",
            "Adolescente com dor abdominal",
            "Paciente de 8 meses com febre",
            "10 dias de vida, icterícia",
            "RN com 5 dias e sucção fraca",
        ]:
            self.assertEqual(pub.publico_da_pergunta(q), pub.PED, q)

    def test_adultos_da_coorte_2(self):
        for q in [
            "Homem de 38 anos, 80 kg, picada de jararaca há 2 h. Quantas ampolas de soro antibotrópico?",
            "Gestante de 24 anos, 36 semanas, PA 170×110. Dose do sulfato de magnésio para 68 kg?",
            "Homem de 36 anos, tosse há 3 semanas, HIV positivo",
            "Idoso de 85 anos, 50 kg, dispneia, paliativo",
            "Adolescente de 15 anos, dor em fossa ilíaca, beta-HCG positivo",
            "Qual a dose de ataque da amiodarona?",
            "Febre há 10 dias e tosse",
            "Dose de 0,5 a 1 g/kg de carvão ativado",
            "Cirurgia de joelho há 10 anos, agora dispneia",
            # tempo de doença ou de gestação não é idade (regressão de 13/10/2026)
            "Gestante de 36 semanas, 68 kg, pré-eclâmpsia grave. Qual a dose do sulfato de magnésio?",
            "Tosse de 3 semanas e emagrecimento",
            "Febre de 5 dias com mialgia",
            "Dor lombar com 2 meses de evolução",
        ]:
            self.assertEqual(pub.publico_da_pergunta(q), pub.ADULTO, q)

    def test_modo_pediatrico_da_tela_vale_sempre(self):
        self.assertEqual(pub.publico_da_pergunta("Qual a dose de ataque da amiodarona?", "pediatrico"), pub.PED)

    def test_texto_de_crianca_vence_o_modo_adulto(self):
        self.assertEqual(pub.publico_da_pergunta("Criança de 4 anos com crise de asma", "adulto"), pub.PED)

    def test_idade_limite(self):
        self.assertEqual(pub.publico_da_pergunta("Paciente de 13 anos com cefaleia"), pub.PED)
        self.assertEqual(pub.publico_da_pergunta("Paciente de 14 anos com cefaleia"), pub.ADULTO)


class TestPublicoDasFontes(unittest.TestCase):
    def test_texto_do_cabecalho(self):
        self.assertEqual(pub.publico_do_texto("pediátrico (até antes dos 14 anos)"), pub.PED)
        self.assertEqual(pub.publico_do_texto("adulto (14 anos ou mais)"), pub.ADULTO)
        self.assertEqual(pub.publico_do_texto("adulto e pediátrico"), pub.AMBOS)
        self.assertEqual(pub.publico_do_texto("", pub.AMBOS), pub.AMBOS)
        self.assertEqual(pub.publico_do_texto(None), pub.ADULTO)

    def test_mapa_de_fontes(self):
        with tempfile.TemporaryDirectory() as d:
            base = Path(d)
            (base / "corpus").mkdir()
            (base / "corpus" / "ped-cad-ehh.md").write_text('---\ntitulo: "CAD — criança"\npublico: "pediátrico (até antes dos 14 anos)"\n---\n# x\n', encoding="utf-8")
            (base / "corpus" / "adulto-cad-ehh-tratamento.md").write_text('---\npublico: "adulto (14 anos ou mais)"\n---\n# x\n', encoding="utf-8")
            (base / "corpus" / "wells.md").write_text("# Wells\nsem cabeçalho\n", encoding="utf-8")
            (base / "fontes.yaml").write_text(
                "- arquivo: ps_pediatria_icr_4ed_2023.pdf\n  publico: pediatrico\n"
                "- arquivo: manual_hcfmusp_3ed_2022.pdf\n  publico: adulto\n"
                "- arquivo: ms_dengue_2024.pdf\n  publico: ambos\n"
                "- arquivo: sem_campo.pdf\n"
                "- pasta: corpus\n", encoding="utf-8")
            m = pub.mapa_de_fontes(base)
            fid = pub._fonte_id
            self.assertEqual(m[fid("ps_pediatria_icr_4ed_2023.pdf")], pub.PED)
            self.assertEqual(m[fid("manual_hcfmusp_3ed_2022.pdf")], pub.ADULTO)
            self.assertEqual(m[fid("ms_dengue_2024.pdf")], pub.AMBOS)
            self.assertEqual(m[fid("sem_campo.pdf")], pub.ADULTO)
            self.assertEqual(m[fid("corpus/ped-cad-ehh.md")], pub.PED)
            self.assertEqual(m[fid("corpus/adulto-cad-ehh-tratamento.md")], pub.ADULTO)
            self.assertEqual(m[fid("corpus/wells.md")], pub.ADULTO)

    def test_o_id_e_o_mesmo_da_ingestao(self):
        with mock.patch.dict("sys.modules", {"pymupdf4llm": mock.MagicMock()}):
            import ingest
        self.assertEqual(pub._fonte_id("corpus/ped-cad-ehh.md"), ingest.fonte_id_de("corpus/ped-cad-ehh.md"))

    def test_ferramentas(self):
        self.assertFalse(pub.ferramenta_serve({"nome": "Cetoacidose — adulto", "publico": "adulto"}, pub.PED))
        self.assertTrue(pub.ferramenta_serve({"nome": "CAD — criança", "publico": "pediatrico"}, pub.PED))
        self.assertFalse(pub.ferramenta_serve({"nome": "CAD — criança", "publico": "pediatrico"}, pub.ADULTO))
        self.assertTrue(pub.ferramenta_serve({"nome": "Hiperpotassemia", "publico": "ambos"}, pub.PED))
        # sem o campo (ferramentas.json antigo): rota e nome decidem
        self.assertTrue(pub.ferramenta_serve({"nome": "Anafilaxia — criança", "rota": "/plantonista/emergencias/x"}, pub.PED))
        self.assertFalse(pub.ferramenta_serve({"nome": "Fibrilação atrial — adulto", "rota": "/plantonista/emergencias/fa"}, pub.PED))


def ponto(fonte_id, texto="trecho", score=0.9):
    return SimpleNamespace(id=fonte_id, score=score,
                           payload={"fonte_id": fonte_id, "texto": texto, "titulo": "T", "editor": "E", "ano": 2023,
                                    "secao": "S", "pagina": 1, "tenant_id": "global"})


class TestFiltroNaBusca(unittest.TestCase):
    def setUp(self):
        mapa = {"ped1": pub.PED, "amb1": pub.AMBOS, "adu1": pub.ADULTO}
        mock.patch.object(main.FONTES, "mapa", return_value=mapa).start()
        mock.patch.object(main, "embed", return_value=[0.0] * 3).start()
        self.qp = mock.patch.object(main.qd, "query_points").start()
        self.sc = mock.patch.object(main.qd, "scroll", return_value=([], None)).start()

    def tearDown(self):
        mock.patch.stopall()

    def _filtro_denso(self):
        return [c.kwargs["query_filter"] for c in self.qp.call_args_list if c.args[0] == "biblioteca"][0]

    def test_crianca_so_fontes_pediatricas_ou_gerais(self):
        self.qp.return_value = SimpleNamespace(points=[])
        main.buscar("criança cetoacidose", "global", pub.PED)
        f = self._filtro_denso()
        cond = f.must[1]
        self.assertEqual(cond.key, "fonte_id")
        self.assertEqual(sorted(cond.match.any), ["amb1", "ped1"])
        self.assertFalse(f.must_not)

    def test_adulto_sem_as_fontes_so_pediatricas(self):
        self.qp.return_value = SimpleNamespace(points=[])
        main.buscar("cetoacidose", "global", pub.ADULTO)
        f = self._filtro_denso()
        self.assertEqual(f.must_not[0].match.any, ["ped1"])

    def test_sem_fonte_pediatrica_nao_busca(self):
        main.FONTES.mapa.return_value = {"adu1": pub.ADULTO}
        self.qp.return_value = SimpleNamespace(points=[])
        tools, trechos, melhor, _ = main.buscar("criança", "global", pub.PED)
        self.assertEqual((trechos, melhor), ([], 0.0))

    def test_ferramentas_de_adulto_fora_da_pergunta_de_crianca(self):
        t_adulto = SimpleNamespace(score=0.9, payload={"nome": "CAD — adulto", "publico": "adulto"})
        t_ped = SimpleNamespace(score=0.8, payload={"nome": "CAD — criança", "publico": "pediatrico"})
        self.qp.side_effect = lambda col, **kw: SimpleNamespace(points=[t_adulto, t_ped] if col == "ferramentas" else [])
        tools, *_ = main.buscar("criança cetoacidose", "global", pub.PED)
        self.assertEqual([t.payload["nome"] for t in tools], ["CAD — criança"])


class TestRespostaSemReferenciaPediatrica(unittest.TestCase):
    def setUp(self):
        main._cache.clear()
        self.cliente = TestClient(main.app)

    def tearDown(self):
        mock.patch.stopall()

    def perguntar(self, q, publico=None):
        corpo = {"q": q, "tenant_id": "global", "request_id": "r1"}
        if publico:
            corpo["publico"] = publico
        r = self.cliente.post("/v1/ask", headers={"Authorization": "Bearer t"}, json=corpo)
        return [json.loads(l) for l in r.text.splitlines() if l.strip()]

    def test_crianca_sem_trecho_pediatrico(self):
        b = mock.patch.object(main, "buscar", return_value=([SimpleNamespace(score=0.9, payload={"nome": "x"})], [], 0.0, False)).start()
        ev = self.perguntar("Criança de 9 anos, 30 kg, cetoacidose diabética")
        self.assertEqual(b.call_args.args[2], pub.PED)
        meta = ev[0]
        self.assertEqual((meta["publico"], meta["gate"], meta["fontes"], meta["ferramentas"]), ("pediatrico", False, [], []))
        self.assertEqual(ev[1]["text"], pub.MSG_SEM_PEDIATRIA)
        self.assertTrue(ev[-1]["nao_encontrou"])

    def test_adulto_sem_trecho(self):
        mock.patch.object(main, "buscar", return_value=([], [], 0.0, False)).start()
        ev = self.perguntar("Qual a dose de ataque da amiodarona?")
        self.assertEqual(ev[0]["publico"], "adulto")
        self.assertEqual(ev[1]["text"], main.NAO_ENCONTREI)

    def test_modo_da_tela_chega_na_busca(self):
        b = mock.patch.object(main, "buscar", return_value=([], [], 0.0, False)).start()
        self.perguntar("Qual a dose de ataque da amiodarona?", "pediatrico")
        self.assertEqual(b.call_args.args[2], pub.PED)

    def test_trecho_marcado_com_o_publico_e_lembrete_de_crianca(self):
        trecho = ponto("ped1", "Insulina 0,05 a 0,1 U/kg/h.")
        mock.patch.object(main, "buscar", return_value=([], [trecho], 0.9, True)).start()
        mock.patch.object(main, "passa_gate", return_value=True).start()
        mock.patch.object(main.FONTES, "mapa", return_value={"ped1": pub.PED}).start()
        enviado = {}

        def falso(**kw):
            enviado.update(kw)
            yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="Insulina 0,05 a 0,1 U/kg/h [1]."))])
        mock.patch.object(main.llm.chat.completions, "create", side_effect=falso).start()
        ev = self.perguntar("Criança de 9 anos com cetoacidose: insulina?")
        user = enviado["messages"][1]["content"]
        self.assertIn("fonte pediátrica", user)
        self.assertIn("CRIANÇA", user)
        self.assertFalse(ev[-1]["nao_encontrou"])


if __name__ == "__main__":
    unittest.main()
