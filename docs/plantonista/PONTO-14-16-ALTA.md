# Pontos 14 e 16 — Atestado, receita para casa e orientações dentro de "Alta e documentos"

Plano da tarefa, no formato do "Plano de Trabalho — comando por tarefa" do
`BACKLOG.md`. O RT pediu em 28/10/2026: "Começar 14 e 16".

**Decisões do RT (28/10/2026): "Aprovo".** O RT aprovou o plano com as recomendações:

- **Pergunta 1:** o sumário de alta fica para uma tarefa própria.
- **Pergunta 2:** "Trazer da prescrição" traz só o medicamento; a dose fica em branco (opção a).
- **Pergunta 3:** a alta não exige receita nem atestado; só mostra o que foi feito.
- **Pergunta 4:** opção A, os passos numa página só.

**Situação: na homologação desde 29/10/2026** (branch `fix/alta-documentos`). Não há migration.

**Feito como planejado:**

- As peças de receita e de atestado da porta foram para `src/components/documentos` (`AtestadoReceita.tsx` e `emissaoAtestadoReceita.ts`). A porta usa as mesmas peças.
- Os tipos e os textos comuns foram para `src/lib/documentosAlta.ts`, porque um componente não importa uma tela (guia, 4.5).

```
Vamos trabalhar a tarefa: pontos 14 e 16, atestado, receita para casa e orientações dentro de Alta e documentos.

Contexto:
Fase: Telas do plantonista (pedidos do RT em 27/10/2026)
Prioridade: P1 (sugerida no BACKLOG)
Objetivo comercial: a alta sai inteira de um lugar só: receita para casa, atestado, orientações e a alta, sem sair do leito
Objetivo técnico: os formulários de receita e de atestado dentro do leito, com o paciente fixo; a aba Atestado sai; a ordem segue o fluxo da alta
Módulos afetados: aba "Alta e documentos" do leito (caderno/Alta.tsx), aba Atestado (caderno/Documentos.tsx), formulários da porta (AbaAtestadoReceita)
Concorrentes que essa tarefa ajuda a enfrentar: PEPs com "alta" como um passo único que reúne os documentos de saída (MV, Tasy)
```

## 1. Diagnóstico do estado atual

### 1.1 Atestado: sai do leito

A aba Atestado do leito (`src/components/internacao/caderno/Documentos.tsx:97-125`)
só lista os atestados.

- O botão "Emitir atestado" leva para a tela avulsa da porta
  (`/plantao/atendimento-porta/atestado-medico?paciente=`, `:107`).
- Ou seja, o médico sai do leito para emitir o atestado.

### 1.2 Receita para casa: não existe no leito

- **No leito:** não há receita para casa. A aba Prescrição é a prescrição da
  internação, outro documento.
- **Na porta:** a receita existe em dois lugares:
  - na aba "Atestado e receita" do atendimento
    (`src/pages/plantao/porta/AbaAtestadoReceita.tsx`), que já tem receita
    padrão do médico, favoritos e a trava de alergia;
  - na tela avulsa "Receituário médico"
    (`src/pages/plantao/atendimento/ReceituarioMedico.tsx`).
- **Regra que já vale nas duas:** receita padrão e favoritos têm dose de
  adulto. Por isso, criança e paciente sem data de nascimento não os recebem
  (decisão do RT de 02/10/2026).

### 1.3 Alta e documentos: os documentos "entram automaticamente", mas são feitos fora

A aba "Alta e documentos" (`caderno/Alta.tsx`) tem três partes:

- a alta (`dar_alta`), com o que impede a alta e o cancelamento em 24 h;
- o pacote de alta: as orientações que o médico marca (frases-modelo, nenhuma
  vem marcada), os sinais de retorno e o código de acesso do paciente;
- um texto dizendo que receita, atestado e outros documentos entram
  automaticamente. **Mas só entram os que foram feitos em outro lugar.**

### 1.4 Banco: a ligação com a internação já acontece

- **O documento já sai ligado à internação.** O caminho de emissão é
  `salvar_rascunho` e depois `emitir_rascunho`. Quando o paciente tem
  internação ativa, `salvar_rascunho` já grava a internação no documento.
  Isso vale para o atestado e para a receita feitos pela tela, com o paciente
  internado.
- **Logo, não é preciso mudar o banco para ligar.** O que falta é a tela no
  leito.
- **O que a homologação mostra:**
  - 3 atestados, nenhum ligado à internação, porque foram feitos fora dela;
  - 3 receitas, uma ligada.
- **Sumário de alta.** O banco aceita o tipo `sumario_alta` no rascunho, mas
  **nenhuma tela o escreve**. Ele só é lido, nos documentos da alta
  (`src/components/alta/DocumentosAlta.tsx`).

## 2. Subtarefas técnicas

| # | Subtarefa | Camada |
|---|---|---|
| 1 | Separar os formulários de receita e de atestado da aba da porta numa peça usada pela porta e pelo leito | tela |
| 2 | "Alta e documentos" em quatro passos, nesta ordem: 1 receita para casa, 2 atestado, 3 orientações (o pacote de hoje), 4 alta | tela |
| 3 | A aba Atestado sai do leito; a lista dos atestados emitidos vai para o passo 2 | tela |
| 4 | Receita para casa: opção de trazer os medicamentos da prescrição vigente (pergunta 2) | tela |
| 5 | Cada passo mostra se já foi feito (documento emitido, pacote gerado) | tela |
| 6 | Sumário de alta, se entrar (pergunta 1) | tela e banco |

## 3. Alterações de banco

**Nenhuma**, se o sumário de alta ficar para depois. A receita e o atestado
emitidos de dentro do leito já gravam a internação (`salvar_rascunho`).

Se o sumário de alta entrar (pergunta 1), o banco só precisa da
regra do que é obrigatório nele. O tipo `sumario_alta` já é aceito. Isso
fica para uma migration própria.

## 4. Alterações de RPC

Nenhuma, pelo mesmo motivo. As RPCs já existentes continuam sendo usadas:
`salvar_rascunho`, `emitir_rascunho`, `gerar_pacote_alta`, `dar_alta` e
`alergia_trava_medicamento`.

## 5. Alterações de frontend

**"Alta e documentos" em quatro passos, numa página só** (opção A da seção
12). Cada passo tem o seu botão e o seu estado:

1. **Receita para casa.**
   - O formulário da porta, com o paciente fixo: medicamento, dose e
     posologia escritas pelo médico, a trava de alergia, a receita padrão e
     os favoritos só para adulto.
   - O botão "Trazer da prescrição" lista os medicamentos da prescrição
     vigente para o médico escolher (pergunta 2).
   - Estado do passo: "emitida às 14h" ou "não emitida".
2. **Atestado.** O formulário da porta, com o paciente fixo: afastamento ou
   comparecimento, com CID só a pedido do paciente. Logo abaixo, os
   atestados já emitidos (o que hoje está na aba Atestado).
3. **Orientações.** O pacote de alta de hoje, sem mudança: orientações
   marcadas, sinais de retorno e código de acesso.
4. **Alta.** A alta de hoje, sem mudança. O botão mostra o que foi feito
   nos passos 1 a 3, só como informação: nenhum deles é obrigatório para a
   alta (pergunta 3).

**A aba "Atestado" sai do leito.** Quem tinha link para ela passa a cair em
Alta e documentos, no passo 2.

**A porta não muda para quem usa.** A aba "Atestado e receita" do
atendimento passa a usar a mesma peça.

## 6. Permissões e auditoria

- **Sem regra nova.** A emissão continua passando por `salvar_rascunho` e
  `emitir_rascunho`, com o mesmo controle de quem pode emitir para o paciente
  (`private.pode_atuar_no_paciente`).
- **Autor e número.** O documento continua levando o autor (login), o número
  da unidade e a versão.
- **Gestor.** Continua só lendo: a aba Alta e documentos já está na leitura
  dele.

## 7. Testes

| Teste | Onde |
|---|---|
| Emitir a receita e o atestado de dentro do leito grava `internacao_id` | Teste de banco: `salvar_rascunho` com paciente internado. Hoje é comportamento existente; o teste passa a protegê-lo |
| Receita padrão e favoritos não aparecem para criança nem para paciente sem nascimento, também no leito | Teste em node da regra (`ofereceConteudoAdulto`) |
| "Trazer da prescrição" não copia dose, se o RT escolher assim (pergunta 2) | Teste em node da montagem dos itens |
| O RT faz uma alta completa na homologação | Registro neste documento |

## 8. Critérios de aceite

| Critério | Evidência |
|---|---|
| Receita para casa e atestado emitidos sem sair do leito | O RT confere na homologação |
| Os documentos ficam ligados à internação | Teste de banco e consulta à homologação |
| A ordem é: receita, atestado, orientações, alta | O RT confere |
| A aba Atestado sumiu, e os atestados emitidos aparecem no passo 2 | O RT confere |
| A porta continua emitindo atestado e receita como antes | Teste de tela na homologação (porta) |

## 9. Riscos

| Risco | Cuidado |
|---|---|
| Dose na receita para casa (dado clínico) | A dose é sempre escrita pelo médico. "Trazer da prescrição" só traz a dose se o RT aprovar (pergunta 2). A recomendação é trazer só o medicamento, porque a dose da internação (EV, por exemplo) muitas vezes não é a de casa |
| Mexer na aba da porta (Atestado e receita), que está em produção | A peça é separada sem mudar o comportamento. A porta é conferida na homologação |
| Criança | Mantém a regra do RT de 02/10: nada de receita padrão nem de favoritos para criança ou para paciente sem nascimento |

## 10. Ordem de implementação

1. Separar a peça de receita e atestado da aba da porta, sem mudar a porta.
2. "Alta e documentos" em quatro passos, usando a peça.
3. Tirar a aba Atestado do leito.
4. "Trazer da prescrição" (conforme a pergunta 2).
5. Homologação, conferência do RT e produção. Não há migration: o merge já
   publica.

## 11. Como demonstrar comercialmente

"Na alta, o médico faz tudo num lugar só: a receita para casa, o atestado,
as orientações para o paciente e a alta. Cada documento sai com número,
autor e ligado à internação."

## 12. Opções de tela (referências reais do Refero)

**Opção A, recomendada: uma página com os quatro passos numerados, um abaixo
do outro, cada um abrindo e fechando, com o estado de cada um.**

- [time2book, guia de configuração](https://refero.design/pages/fa547511-4424-4a37-9081-bf3fadf31d20):
  passos numerados que abrem e fecham, cada um com a sua ação.
- [Lemon Squeezy, lista de primeiros passos](https://refero.design/pages/edc09563-82ab-4fd0-8b94-034755f5046d):
  lista numerada, com o que já foi feito marcado.

**Opção B: os passos numa coluna à esquerda e o formulário do passo
escolhido à direita.**

- [Stripe, ativação da conta](https://refero.design/pages/292eb25b-2a99-4d41-a9e5-c04c27b03561):
  passos numerados à esquerda e o formulário à direita.
- [Metaview, primeiros passos](https://refero.design/pages/97ccfcc6-d08c-4ab2-a889-7f5e85eba834):
  passos verticais, com o atual em destaque.

A opção A deixa ver a alta inteira sem trocar de tela. A B dá mais espaço ao
formulário da receita, mas esconde os outros passos.

## 13. Perguntas ao RT

1. **Sumário de alta.** Ele entra nesta tarefa, como um quinto passo? Hoje
   nenhuma tela o escreve. Recomendo que fique para uma tarefa própria,
   porque precisa definir o que é obrigatório.
2. **"Trazer da prescrição" na receita para casa:**
   - (a) traz só o medicamento e a apresentação, com a dose e a posologia em
     branco para o médico escrever — **recomendado**;
   - (b) traz também a dose e a posologia da internação, para o médico
     ajustar.
3. **A alta exige a receita ou o atestado?** Recomendo que não: só
   informar o que foi feito, porque nem toda alta tem receita ou atestado.
4. **Tela:** opção A (passos numa página) ou B (passos à esquerda e o
   formulário à direita)?
