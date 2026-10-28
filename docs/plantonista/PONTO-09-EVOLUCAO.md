# Ponto 9 — "Evolução médica" não cria; Diagnóstico dentro de Evolução

Plano da tarefa, no formato do "Plano de Trabalho — comando por tarefa" do
`BACKLOG.md`. O RT pediu em 28/10/2026: "Comece pelo ponto 9".

**Decisões do RT (28/10/2026): "Aprovo B e sub-aba".**

- **Pergunta 2, quem evolui:** opção B.
- **Pergunta 5, tela:** opção A, o Diagnóstico como sub-aba.

**Situação: em produção desde 28/10/2026.**

- O PR #319 foi juntado ao master, e a tela está no ar.
- Com o "ok produção" do RT, a migration `20270203000003_evolucao_motivo` foi aplicada na produção.
- Na homologação, ela está desde o mesmo dia.

Antes:

**Situação: na homologação desde 28/10/2026** (branch `fix/evolucao-motivo`,
migration `20270203000003_evolucao_motivo`). Rollback testado na homologação
e desfeito; depois, migration aplicada e versão registrada.

**Ajuste ao implementar.**

- A regra B **não** mexe em `private.cuido_da_internacao`. Essa regra é
  usada em cerca de 13 lugares: alta, documentos, passagem, enfermagem e
  outros. Por isso, a nova `private.evoluo_internacao` vale só para a
  evolução médica (tipo `evolucao`), em `contexto_evolucao` e
  `registrar_evolucao`.
- A evolução de enfermagem e os outros registros seguem só o setor da
  internação. O teste de banco prova isso.
- **Motivos que chegam à tela.** Quem não lê a internação nem chega à aba
  Evolução: o servidor nega a leitura, e a tela de check-in bloqueia o app
  depois da tolerância. Na prática, a tela mostra:
  - `sem_plantao`: gestor ou admin sem plantão;
  - `papel`: recepção, enfermagem e telemedicina;
  - `encerrada`.

  `checkin_pendente` e `outro_setor` ficam na RPC para os casos de borda.

**Ainda sem resposta:**

- **Pergunta 1,** o e-mail do usuário de teste, para eu dar escala a ele.
- **Pergunta 3,** o gestor ver a Evolução em leitura. Fiz assim, porque
  senão o gestor perderia o Diagnóstico, que antes era aba própria. Ele vê
  as sub-abas Resumo, Diagnóstico e Histórico, sem a Evolução médica.
- **Pergunta 4,** tirar o campo de CID de dentro da evolução. **Não fiz:**
  espera a resposta.

```
Vamos trabalhar a tarefa: ponto 9, Evolução médica não cria e Diagnóstico dentro de Evolução.

Contexto:
Fase: Telas do plantonista (pedidos do RT em 27/10/2026)
Prioridade: P1 (sugerida no BACKLOG)
Objetivo comercial: o médico evolui o paciente sem ficar preso numa tela que não diz por quê
Objetivo técnico: a tela diz o motivo do bloqueio e o que fazer; as regras de quem evolui e de quem diagnostica ficam iguais; o diagnóstico passa a ter um lugar só, dentro da Evolução
Módulos afetados: caderno do leito (abas Evolução e Diagnóstico), contexto_evolucao, registrar_evolucao, registrar_diagnostico
Concorrentes que essa tarefa ajuda a enfrentar: PEPs em que a evolução abre direto, com o diagnóstico no mesmo lugar (MV, Tasy)
```

## 1. Diagnóstico do estado atual

### 1.1 Por que "Evolução médica" não cria

O formulário só aparece quando o banco devolve `pode_registrar`
verdadeiro (`src/components/evolucao/EvolucaoMedica.tsx:93`). Quando vem
falso, a tela mostra só a frase "A evolução médica é registrada pelo médico
de plantão no setor do paciente…" (`:156`). Não diz o motivo nem mostra
botão.

`pode_registrar` exige três coisas ao mesmo tempo
(`supabase/migrations/20261119000004_internacao_vinda_da_observacao.sql:528-529`):

1. A internação está ativa.
2. O médico está **de plantão agora no setor atual da internação**
   (`private.cuido_da_internacao`). "De plantão agora" vem de
   `private.plantoes_agora` (`20261022000018`) e vale em três casos:
   - dentro da tolerância de check-in;
   - com check-in feito;
   - até 20 min depois do fim do plantão, com check-in feito, ou enquanto
     houver liberação do gestor.
3. O papel permite evoluir: plantonista, gestor ou admin
   (`private.pode_registrar_evolucao`, `20261004000006`).

O servidor repete a regra 2 ao gravar (`registrar_evolucao`): "Acesso
negado: você não está de plantão no setor deste paciente."

**Na homologação, ninguém consegue evoluir ninguém desde 22/10.** Conferi
pelo banco de homologação em 28/10/2026:

- **Última escala: 21/10.** O último check-in foi em 21/10, às 19h.
- **Ninguém tem plantão agora.**
- **Há 86 internações ativas:** 57 em Internação, 22 em Observação Adulto e
  as outras em Observação, Isolamento, Clínica Médica e Observação
  Pediátrica.

O usuário de teste ganha escala por 8 dias com `npm run homolog:copiar`, e
só no Pronto Socorro (`infra/homologacao.md`, passo 8). Os internados estão
em outros setores. Mesmo com a escala em dia, esse usuário não evoluiria
nenhum deles.

Na produção, não li nada: essa leitura não estava autorizada.

### 1.2 Três regras diferentes para o mesmo médico

| O que | Regra | Onde |
|---|---|---|
| Ver o paciente na lista de internados | Inclui gestor, super admin e o setor do cadastro do paciente | `20260815000011:236-245` |
| Registrar diagnóstico | Plantão agora no **setor do cadastro do paciente ou no setor da internação**, e papel plantonista | `registrar_diagnostico` → `private.paciente_em_cuidado_no_plantao` (`20261119000001`) |
| Registrar evolução | Plantão agora **só no setor da internação**; papel plantonista, gestor ou admin | `contexto_evolucao` e `registrar_evolucao` → `private.cuido_da_internacao` |

**Efeito:** o mesmo médico consegue registrar o diagnóstico e não consegue
evoluir, quando o setor do cadastro do paciente é diferente do setor da
internação.

**O gestor.** Ele vê o leito em modo de leitura (`LeitoAberto.tsx:354`,
`escreve = ativa && !ehGestor`). As abas de leitura dele são Resumo,
Classificação, Diagnóstico e Alta, sem Evolução (`:81`).

### 1.3 O diagnóstico está em dois lugares

- **Aba Diagnóstico** (`caderno/Diagnostico.tsx`), com a tabela de
  diagnósticos:
  - um primário, com hipótese ou confirmado e o tempo da doença;
  - secundários;
  - histórico: cada troca encerra a linha anterior;
  - aviso de notificação compulsória.
- **Campo "Diagnóstico principal · CID-10" dentro da Evolução médica**
  (`EvolucaoMedica.tsx:296`). Ele fica gravado só na evolução do dia.

O cabeçalho do leito mistura os dois. Mostra o primário vigente da aba
Diagnóstico e, quando ele não existe, o CID da última evolução
(`LeitoAberto.tsx:359-375`). O médico pode escrever um diagnóstico num lugar
e outro no outro.

## 2. Subtarefas técnicas

| # | Subtarefa | Camada |
|---|---|---|
| 1 | Motivo do bloqueio: nova RPC que diz por que não dá para evoluir e o que fazer | RPC |
| 2 | Regra de quem evolui igual à de quem diagnostica, se o RT aprovar (pergunta 2) | banco |
| 3 | Aviso da Evolução médica com o motivo e a ação (check-in; setor certo) | tela |
| 4 | Diagnóstico como sub-aba de Evolução; sai a aba Diagnóstico do leito | tela |
| 5 | Um lugar só para o diagnóstico: a Evolução médica mostra o vigente e leva para a sub-aba (pergunta 4) | tela |
| 6 | Homologação: escala para o usuário de teste do RT em um setor com internados, para ele conferir | dados de teste |

## 3. Alterações de banco

Uma migration (`20270203000003_evolucao_motivo.sql`) que só acrescenta,
nesta ordem de reserva de números da sessão:

```sql
-- motivo de não poder evoluir, para a tela dizer o que fazer
CREATE OR REPLACE FUNCTION public.por_que_nao_evoluo(p_internacao uuid) RETURNS jsonb ...
```

**Se o RT aprovar a opção B da pergunta 2,** a mesma migration redefine
`private.cuido_da_internacao`, para valer também o setor do cadastro do
paciente: `i.setor_atual_id` ou `pacientes.setor_id` em
`setores_na_escala_agora()`. Isso amplia quem evolui.

- **Quem passa a evoluir a mais:** o médico de plantão no setor do cadastro
  do paciente, que hoje já registra o diagnóstico.
- **Quem nunca perde acesso:** ninguém que evolui hoje deixa de evoluir.
- **Rollback:**
  - voltar o corpo antigo de `cuido_da_internacao`, uma linha;
  - `DROP FUNCTION public.por_que_nao_evoluo(uuid)`.

## 4. Alterações de RPC

| RPC | Assinatura | Permissão | O que devolve | Auditoria | Chamada repetida |
|---|---|---|---|---|---|
| `por_que_nao_evoluo` | `(p_internacao uuid) RETURNS jsonb` | Quem lê a internação (`private.leio_internacao`) | `{pode, motivo, setor_paciente, meus_setores_agora[], checkin_pendente}`. `motivo` é um destes: `encerrada`, `papel`, `sem_plantao`, `checkin_pendente` ou `outro_setor` | Nenhuma (só leitura) | Mesmo resultado |

`registrar_evolucao` e `contexto_evolucao` não mudam de assinatura. Na opção
B, os dois seguem a nova `cuido_da_internacao` sozinhos.

## 5. Alterações de frontend

**Aviso com o motivo** (`EvolucaoMedica.tsx`), no lugar da frase genérica:

| Motivo | Texto | Ação |
|---|---|---|
| `checkin_pendente` | "Seu check-in deste plantão não foi feito." | Botão "Fazer check-in", que leva ao check-in que já existe |
| `outro_setor` | "Você está de plantão em Pronto Socorro; este paciente está em Internação." | Nenhuma. O texto diz quem evolui |
| `sem_plantao` | "Você não tem plantão agora nesta unidade." | Nenhuma |
| `papel` | "Seu papel nesta unidade não registra evolução médica." | Nenhuma |
| `encerrada` | O texto atual: "Internação encerrada…" | — |

**Diagnóstico como sub-aba de Evolução** (`AbaEvolucao.tsx`). A ordem fica
Resumo evoluções, Evolução médica, Diagnóstico, Histórico de evoluções.

- A aba "Diagnóstico" sai do leito (`LeitoAberto.tsx:62-81` e `:408`).
- Os pulos para a notificação compulsória continuam funcionando.
- O gestor passa a ver a Evolução em leitura, para não perder o diagnóstico
  que hoje ele vê (pergunta 3).

**Um lugar só para o diagnóstico** (opção recomendada na pergunta 4):

- A Evolução médica mostra o primário e os secundários vigentes, com
  hipótese ou confirmado, e o botão "Mudar diagnóstico", que abre a
  sub-aba.
- O campo de CID solto dentro da evolução sai.
- A evolução grava o retrato dos diagnósticos vigentes na hora do registro.
- O cabeçalho do leito passa a usar só a tabela de diagnósticos.

## 6. Permissões e auditoria

- `por_que_nao_evoluo` só lê e devolve o motivo de quem chama. Não expõe
  dado de outro médico, só o nome dos setores.
- A opção B muda quem escreve evolução. O teste de banco prova os três
  casos:
  - o médico do setor da internação evolui, como hoje;
  - o médico do setor do cadastro passa a evoluir;
  - o médico de outro setor continua barrado.
- A evolução e o diagnóstico já entram na auditoria (autor = login). Não
  muda.

## 7. Testes

| Teste | Onde |
|---|---|
| Banco: cada motivo de `por_que_nao_evoluo` (encerrada, papel, sem plantão, check-in pendente, outro setor) | `supabase/tests/evolucao_motivo.sql` |
| Banco (opção B): setor do cadastro evolui, outro setor é barrado, o de hoje continua; `registrar_evolucao` e `contexto_evolucao` concordam | o mesmo arquivo |
| Testes de evolução que já existem continuam passando | `supabase/tests/porte_evolucao.sql` |
| Tela: o RT evolui na homologação, depois de ganhar escala num setor com internados | registro neste documento |

## 8. Critérios de aceite

| Critério | Evidência |
|---|---|
| Quem não pode evoluir vê o motivo e, quando existe, a ação | Teste de banco dos motivos, e o RT conferindo na homologação |
| O médico de plantão no setor do paciente evolui | O RT evolui na homologação |
| O diagnóstico fica dentro de Evolução, e a aba solta some | O RT confere na homologação |
| O diagnóstico tem um lugar só | A evolução mostra o vigente; o cabeçalho do leito não lê mais o CID da evolução |

## 9. Riscos

| Risco | Cuidado |
|---|---|
| A opção B amplia quem evolui | Só para quem já pode registrar o diagnóstico daquele paciente. O teste de banco prova que outro setor continua barrado |
| Tirar o campo de CID da evolução muda o formulário que os médicos já usam | O diagnóstico vigente aparece no mesmo lugar, com o botão para mudar. As evoluções antigas continuam com o CID que tinham |
| O gestor deixa de ver o diagnóstico, se a Evolução não entrar na leitura dele | A Evolução entra na leitura do gestor, ou o diagnóstico continua visível ali (pergunta 3) |
| Na homologação, ninguém tem escala | Dar escala ao usuário do RT num setor com internados, para ele testar (pergunta 1) |

## 10. Ordem de implementação

1. Escala de teste na homologação, para o RT ver o formulário abrir com a
   regra de hoje.
2. Migration e teste de banco: o motivo, e a regra se for a opção B.
3. Tela: aviso com o motivo.
4. Tela: Diagnóstico como sub-aba, e o diagnóstico num lugar só.
5. Homologação, conferência do RT e produção com o "ok produção".

## 11. Como demonstrar comercialmente

"O médico abre o leito e evolui. Se não puder, o sistema diz por quê:
check-in, setor ou papel. O diagnóstico do paciente fica num lugar só, junto
da evolução, com o histórico de cada troca."

## 12. Opções de tela (referências reais do Refero)

**Aviso com o motivo e uma ação, dentro da própria aba (recomendado).**

- [X (Twitter), conta bloqueada](https://refero.design/pages/f1e64742-cd52-4d08-94ec-ed57c1501171):
  - bloco alinhado à esquerda, na própria página, e não numa janela;
  - título com o motivo;
  - uma linha de explicação;
  - um único botão para resolver.

**Diagnóstico dentro de Evolução.**

- **Opção A, recomendada: sub-aba.** Mesmas sub-abas que já existem
  (Resumo, Evolução médica, Histórico), com Diagnóstico entre Evolução
  médica e Histórico.
  - [Attio, ficha da empresa](https://refero.design/pages/cbbee303-d2de-4099-84f4-660c869ad2fa):
    abas no topo do painel central da ficha.
  - [Aboard, documentos](https://refero.design/pages/ed707e21-3e6f-4218-9c55-42e690d96676):
    abas de segundo nível dentro de uma seção.
- **Opção B: o diagnóstico como painel ao lado do formulário da evolução,**
  sempre visível e editável ali.
  - [Fibery, ficha de contato](https://refero.design/pages/c868628b-c4d1-4caf-8b57-8add54187bc4):
    campos da ficha num painel à direita do conteúdo principal.
  - Ocupa espaço do formulário. Por isso a recomendação é a A.

## 13. Perguntas ao RT

1. **Homologação.** Para você ver a evolução abrir, eu dou escala ao seu
   usuário de teste agora, num setor com internados (Internação), por 8
   dias. Qual é o e-mail do usuário?
2. **Quem evolui:**
   - (A) como hoje, só o médico de plantão no setor da internação;
   - (B) também o médico de plantão no setor do cadastro do paciente, igual
     à regra do diagnóstico — **recomendado**;
   - (C) qualquer médico de plantão na unidade.
3. **O gestor** passa a ver a Evolução, só leitura, já que o Diagnóstico vai
   para dentro dela?
4. **Diagnóstico num lugar só.** Tiro o campo de CID de dentro da Evolução
   médica e mostro ali o diagnóstico vigente, com o botão "Mudar
   diagnóstico"?
5. **Tela:** opção A (sub-aba) ou B (painel ao lado)?
