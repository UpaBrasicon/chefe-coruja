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

## O que não foi coberto

- As telas com usuário logado (Escala, Pedidos para você, Pedidos do gestor,
  Carga horária): na produção não se entra com senha nem se cria pedido de
  verdade. Se o RT quiser, entra com a conta dele no navegador do app e a sessão
  só lê as telas.
