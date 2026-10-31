# Conferência da escala em produção — 31/10/2026

Pedido do RT ("Testar escala em produção", depois "Testes de banco"), depois de
aplicar as migrations `20270208000001` a `20270208000013` e mesclar os PRs das
correções do teste ponta a ponta de 29/10/2026.

Nada foi gravado na produção e nenhum dado de paciente foi lido.

## 1. Site publicado, sem login

- `www.chefecoruja.com.br` serve o bundle `index-BV91gNhc.js`, do master `69056bb`
  (deploy da Vercel com sucesso).
- O código publicado chama as RPCs novas: `pedidos_para_mim`, `aceitar_passagem`,
  `aceitar_troca` e `cancelar_pedido_escala` no bundle principal;
  `candidatar_faixa` e `resumo_carga_plantonistas` no `Escala-iiQAVEdw.js`.
- Console da tela de login: só um erro, a CSP barra o `beacon.min.js` do
  Cloudflare Web Analytics (`script-src 'self' https://challenges.cloudflare.com`).
  Não afeta o app. Fica como item à parte: desligar o Web Analytics no Cloudflare
  ou liberar `static.cloudflareinsights.com` na CSP.

## 2. RPCs novas chamadas como visitante

Chamada pela chave publicável, sem login, com id inexistente:

| RPC | Resposta |
|---|---|
| `pedidos_para_mim` | 401, `42501 permission denied` |
| `aceitar_passagem` | 401, `42501 permission denied` |
| `aceitar_troca` | 401, `42501 permission denied` |
| `cancelar_pedido_escala` | 401, `42501 permission denied` |
| `candidatar_faixa` | 401, `42501 permission denied` |
| `resumo_carga_plantonistas` | 401, `42501 permission denied` |

## 3. Testes de banco na produção, em transação desfeita

Os testes de `supabase/tests` das 13 correções rodaram no banco de produção pelo
CLI (`supabase db query --linked -f`). Cada arquivo foi montado assim:
`BEGIN`, `SET LOCAL lock_timeout = '3s'` e `statement_timeout = '60s'`, o teste,
e `RAISE EXCEPTION 'FIM ok'` no lugar do último `ROLLBACK`. O RAISE desfaz tudo e
mostra que o teste chegou ao fim sem falhar. Os testes usam dados próprios (ids
`00000000-0000-4000-8000-…`), sem o `seed.sql`.

| Teste | Correção | Resultado |
|---|---|---|
| `escala_troca_forcada` | C1 | FIM ok |
| `escala_passagem_aprovada` | C2 | FIM ok |
| `escala_vaga_por_categoria` | A1 | FIM ok |
| `escala_troca_gestor` | A2/A3 | FIM ok |
| `escala_aceite_colega` | A4 | FIM ok |
| `escala_atestado_falta` | A5 | FIM ok |
| `escala_vaga_sem_categoria` | M1 + B2 | FIM ok |
| `escala_passagem_conferencia` | M3 | FIM ok |
| `escala_avisos_decisoes` | M5 + M6 | FIM ok |
| `escala_candidatura_faixa` | M8 | FIM ok |
| `escala_carga_horaria` | M13 | FIM ok |
| `checkin_justificativa_curta` | B4 | FIM ok |
| `escala_troca_plantao_passado` | B10 | FIM ok |

Depois da rodada, conferido na produção: nenhuma unidade, perfil, plantão ou
usuário com id de teste (`00000000-0000-4000-8000-%`), e o gatilho
`trg_escala_sem_sobreposicao` (que os testes desligam dentro da transação) ativo.
A CLI voltou a apontar para a homologação.

## 4. Telas da escala com o RT logado, papel por papel

O RT entrou com a conta dele no Chrome (o navegador do app não passa no
Turnstile). A sessão trocou o papel ativo pelo menu do usuário e leu só as
telas da escala. Não clicou em Aprovar, Recusar, Escalar, Marcar vaga, Passar,
Trocar nem Candidatar, e não leu tela de paciente. No fim, o papel ativo voltou
para Plantonista.

| Papel ativo | Tela | Resultado |
|---|---|---|
| Gestor | `/escala`: Mensal, Pedidos, Carga horária | Carregam. Mensal: out/2026 "ainda não publicada", 0 plantões, 558 vagas previstas pela fixa, todas sem categoria. Pedidos: 2 candidaturas. Carga: "Nenhum plantão neste mês", texto novo do M13 (manhã e tarde 6 h, noite 12 h). |
| Plantonista | `/agenda`: Minha escala, Vagas | Carregam. 0 plantões; Vagas: 0 disponíveis (nenhuma vaga marcada). |
| Telemedicina | `/minha-escala` | Carrega, com "Seus plantões em todas as unidades" (M11). |
| Enfermeiro, Técnico de Enfermagem, Farmacêutico, Recepção | `/minha-escala` | Carregam. |
| Administrador | `/escala`: Pedidos, Carga horária | Carregam, iguais às do gestor. |

O console só mostrou o erro de uma extensão do Chrome ("Could not establish
connection. Receiving end does not exist."), que não é do app.

### Achados (registrados; nenhum foi corrigido)

1. **Médio — abas do gestor com o conteúdo do plantonista.** Para quem tem o
   papel de gestor na unidade mas está com o papel ativo de Plantonista, `/escala`
   abre as abas do gestor (Mensal, Pedidos, Carga horária, Fixa…), mas Pedidos e
   Carga horária mostram "Minha escala / Escala geral" do plantonista. Causa: a
   rota escolhe pela lista de papéis da unidade (`PorPapel`, `papeisDaUnidade`),
   e `Escala.tsx` escolhe pelo papel ativo (`ehPlantonista = papelAtivo ===
   'plantonista'`).
2. **Baixo — grade de montagem fora do papel.** Com o papel ativo de
   Telemedicina, `/agenda?aba=escala` (aberto pelo endereço; o menu da
   telemedicina leva a `/minha-escala`) mostra a grade semanal do gestor, com
   "+ adicionar". `Escala.tsx` trata como gestor todo papel que não é
   `plantonista`.
3. **Baixo — "sua categoria" com todos os papéis.** Em `/minha-escala`, o
   subtítulo e o dia dizem "Plantonista e Telemedicina e Enfermeiro e Técnico de
   Enfermagem e Farmacêutico e Recepção": a categoria é a lista de todos os
   papéis do usuário, não a do papel ativo.
4. **Dado — candidaturas vencidas de conta de teste.** A aba Pedidos da UPA
   Centro tem 2 candidaturas de "Plantonista Teste" para 16/08 (Observação manhã,
   Emergência tarde), pendentes há dois meses. Cabe ao RT recusar pela tela e
   decidir se a conta de teste fica na produção; candidatura de data passada não
   vence sozinha.
5. **Observação — escala da produção vazia.** A UPA Centro não tem escala
   publicada em out/2026: 0 plantões e 558 vagas previstas pela fixa, todas sem
   categoria. Por isso o plantonista vê 0 vagas e a carga horária está vazia, e o
   fluxo novo (aceite, aprovação, candidatura) ainda não foi exercido por
   usuários reais.
