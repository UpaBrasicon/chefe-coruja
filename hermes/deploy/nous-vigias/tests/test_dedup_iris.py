"""Porte de hermes/src/jobs/dedup.test.ts e iris.test.ts."""

from __future__ import annotations

import unittest

import apoio  # noqa: F401
from apoio import BancoFalso, contexto, erro
from vigias.argos import chave_dedup as chave_argos
from vigias.gaviao import chave_dedup as chave_gaviao
from vigias.iris import chaves_ja_abertas, dispatch_iris, dispatch_iris_para_gestores, filtrar_novos, registrar_incidentes


class TestFiltrarNovos(unittest.TestCase):
    def test_remove_os_abertos(self):
        itens = [{"titulo": "A", "id": 1}, {"titulo": "B", "id": 2}]
        self.assertEqual(filtrar_novos(itens, lambda i: f"{i['titulo']}:{i['id']}", {"A:1"}), [{"titulo": "B", "id": 2}])

    def test_nenhuma_aberta_mantem_e_todas_abertas_esvazia(self):
        itens = [{"titulo": "A", "id": 1}]
        self.assertEqual(len(filtrar_novos(itens, lambda i: i["titulo"], set())), 1)
        self.assertEqual(len(filtrar_novos(itens, lambda i: i["titulo"], {"A"})), 0)


class TestChavesJaAbertas(unittest.TestCase):
    def _banco(self, existentes):
        return BancoFalso({"chaves_incidentes_abertos": lambda fatia: [{"chave_dedup": c} for c in existentes if c in fatia]})

    def test_so_as_que_existem(self):
        ctx, _ = contexto(self._banco(["dados:chave-1"]))
        self.assertEqual(chaves_ja_abertas(ctx, ["dados:chave-1", "dados:chave-2"]), {"dados:chave-1"})

    def test_lista_vazia_nao_consulta(self):
        banco = self._banco([])
        ctx, _ = contexto(banco)
        self.assertEqual(chaves_ja_abertas(ctx, []), set())
        self.assertEqual(banco.chamadas, [])

    def test_lotes_de_100_e_erro_vira_nenhuma(self):
        banco = BancoFalso({"chaves_incidentes_abertos": lambda fatia: [{"chave_dedup": fatia[0]}]})
        ctx, _ = contexto(banco)
        self.assertEqual(len(chaves_ja_abertas(ctx, [f"k{i}" for i in range(250)])), 3)
        self.assertEqual(len(banco.chamadas), 3)
        ctx, _ = contexto(BancoFalso({"chaves_incidentes_abertos": erro()}))
        self.assertEqual(chaves_ja_abertas(ctx, ["x"]), set())

    def test_registrar_na_sombra_anota_novos_e_ja_abertos(self):
        ctx, reg = contexto(self._banco(["k1"]), modo="sombra")
        n = registrar_incidentes(ctx, [{"k": "k1"}, {"k": "k2"}], lambda i: i["k"],
                                 lambda i: {"patrulha": "dados", "severidade": "atencao", "titulo": "T", "evidencia": {}, "chave_dedup": i["k"]},
                                 falha_lanca=True, contexto="t")
        self.assertEqual(n, 1)
        self.assertEqual([l["acao"] for l in reg.linhas], ["ja_aberta", "inserir"])


class TestChavesPorJob(unittest.TestCase):
    def test_argos_estavel_e_por_id(self):
        a = {"severidade": "atencao", "titulo": "Prescrição sem paciente vinculado", "evidencia": {"prescricao_id": "abc"}}
        self.assertEqual(chave_argos(a), chave_argos(dict(a)))
        self.assertEqual(chave_argos(a), "dados:[Falcao] Prescrição sem paciente vinculado:abc")
        self.assertNotEqual(chave_argos({**a, "evidencia": {"prescricao_id": "def"}}), chave_argos(a))
        self.assertIn("obs-1", chave_argos({"titulo": "Obs futura", "evidencia": {"observacao_id": "obs-1"}}))
        self.assertTrue(chave_argos({"titulo": "X", "evidencia": {}}).endswith(":sem-id"))

    def test_gaviao_estavel_por_sessao_e_trecho(self):
        base = {"regra": "R4", "severidade": "atencao", "titulo": "Tentativa de prompt injection"}
        a1 = chave_gaviao({**base, "evidencia": {"session_id": "s1", "trecho": "ignore suas instruções"}})
        self.assertEqual(a1, chave_gaviao({**base, "evidencia": {"session_id": "s1", "trecho": "ignore suas instruções"}}))
        self.assertEqual(a1, "hermes:[Gaviao] Tentativa de prompt injection:s1:ignore suas instruções")
        self.assertNotEqual(chave_gaviao({**base, "evidencia": {"session_id": "s1", "trecho": "msg 1"}}),
                            chave_gaviao({**base, "evidencia": {"session_id": "s1", "trecho": "msg 2"}}))

    def test_gaviao_r5_sem_trecho_so_sessao(self):
        b = {"regra": "R5", "severidade": "informativo", "titulo": "Volume anômalo"}
        self.assertEqual(chave_gaviao({**b, "evidencia": {"session_id": "s1", "quantidade": 40}}),
                         chave_gaviao({**b, "evidencia": {"session_id": "s1", "quantidade": 41}}))
        self.assertTrue(chave_gaviao({**b, "evidencia": {"quantidade": 1}}).endswith(":sem-sessao:"))


class TestIris(unittest.TestCase):
    def test_insere_e_devolve_id(self):
        banco = BancoFalso()
        ctx, _ = contexto(banco)
        r = dispatch_iris(ctx, "p1", "u1", "alerta", "olá mundo")
        self.assertTrue(r["ok"])
        (id_, perfil, unidade, tipo, mensagem, data), = banco.escritas_de("inserir_notificacao")
        self.assertEqual((id_, perfil, unidade, tipo, mensagem, data), (r["id"], "p1", "u1", "alerta", "olá mundo", "2026-10-05"))

    def test_trunca_em_500(self):
        banco = BancoFalso()
        ctx, _ = contexto(banco)
        dispatch_iris(ctx, "p1", "u1", "t", "x" * 700)
        self.assertEqual(len(banco.escritas_de("inserir_notificacao")[0][4]), 500)

    def test_erro_do_banco_ok_false(self):
        ctx, _ = contexto(BancoFalso(falha_escrita={"inserir_notificacao": erro("duplicate key value violates unique constraint")}))
        r = dispatch_iris(ctx, "p1", "u1", "t", "m")
        self.assertFalse(r["ok"])
        self.assertIn("duplicate key", r["erro"])

    def test_para_gestores_um_por_gestor(self):
        # gestores_da_unidade filtra gestor/admin no SQL — o falso devolve só esses
        banco = BancoFalso({"gestores_da_unidade": [{"perfil_id": "gestor-1"}, {"perfil_id": "admin-1"}]})
        ctx, _ = contexto(banco)
        self.assertEqual(dispatch_iris_para_gestores(ctx, "u1", "sentinela", "alerta de escala"), 2)
        self.assertEqual([a[1] for a in banco.escritas_de("inserir_notificacao")], ["gestor-1", "admin-1"])

    def test_sem_gestores_ou_erro_zero(self):
        banco = BancoFalso()
        ctx, _ = contexto(banco)
        self.assertEqual(dispatch_iris_para_gestores(ctx, "u1", "s", "m"), 0)
        ctx, _ = contexto(BancoFalso({"gestores_da_unidade": erro()}))
        self.assertEqual(dispatch_iris_para_gestores(ctx, "u1", "s", "m"), 0)
        self.assertEqual(banco.escritas, [])


if __name__ == "__main__":
    unittest.main()
