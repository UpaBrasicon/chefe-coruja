# Lacuna 3: medicação controlada, Portaria 344 (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 3 (P1), aprovada pelo RT em
10/11/2026. Origem: relatório do teste de ponta a ponta de 11/10/2026, seção 3,
passos `3.medicacao_controlada` (plantonista) e `10.controlados` (farmacêutico).

## 1. Fontes

- **Portaria SVS/MS nº 344/1998** (Regulamento Técnico das substâncias sujeitas a
  controle especial). Texto na BVS, que não substitui o DOU:
  https://bvsms.saude.gov.br/bvs/saudelegis/svs/1998/prt0344_12_05_1998_rep.html.
  Conferi no texto, em 10/11/2026, os artigos 35 §6º, 51, 56 e 94.
  - **Paciente internado, Art. 35 §6º:** a Notificação de Receita não é
    exigida. Basta a prescrição diária em papel privativo do estabelecimento.
  - **Arts. 51 e 56:**
    - listas A1, A2, A3, B1, B2, C2 e C3 (Art. 51) e C1 e C5 (Art. 56): ao
      internado ou semi-internado, pela receita privativa do estabelecimento,
      subscrita por profissional de lá;
    - ao paciente em tratamento ambulatorial: Notificação de Receita (A e B) ou
      Receita de Controle Especial em 2 vias (C1 e C5), pelos parágrafos únicos.
  - **Art. 94:** maleta de emergência com até 3 ampolas de entorpecente e 5 de
    psicotrópico. A reposição se faz pela Notificação de Receita.
  - **Escrituração e guarda:**
    - livro de registro (Arts. 62 a 65);
    - guarda sob chave, sob o farmacêutico (Art. 67);
    - balanço trimestral e anual (Art. 68).
- **Listas vigentes:** RDC ANVISA nº 1.036, de 09/07/2026 (DOU de 13/07/2026),
  "Atualização N. 101" do Anexo I. Página das listas:
  https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/controlados/lista-substancias.
  - Haloperidol: lista C1. Midazolam: lista B1.
  - A ANVISA atualiza as listas várias vezes por ano, sem arquivo em
    planilha, só HTML e PDF.
- **SNGPC:** a RDC 22/2014, Art. 3º, parágrafo único, isenta a unidade
  hospitalar até existir o módulo próprio. Fonte: perguntas frequentes da
  ANVISA (gov.br/anvisa, SNGPC).

## 2. Estado atual (master em 10/11/2026)

- **Catálogo (`public.medicamento`):** nenhuma marca de controlado nem de
  lista. A tabela antiga, que tinha `controlado`, foi apagada em agosto.
- **Midazolam EV:** já passa pela liberação da farmácia, mas por ser de alta
  vigilância (ISMP).
- **Haloperidol:** não passa por nenhuma regra.
- **Precedente aproveitável: a alta vigilância.**
  - Uma regra marca o catálogo pelo princípio ativo, com a fonte citada, e a
    unidade ajusta com motivo.
  - A farmácia libera antes de administrar. Sem liberação, a enfermagem
    administra com justificativa e o farmacêutico confere depois.
- **Prescrição e farmácia:**
  - `prescrever`, `validar_item` (confere ou devolve com motivo) e
    dispensação (`dispensar_item` e outras): nenhuma checagem de controlado.
  - Não há registro próprio de intervenção farmacêutica.
  - Lote e validade foram adiados pelo RT em 27/10/2026.
- **Receitas para casa:**
  - No receituário do atendimento, o médico marca à mão "Controle especial",
    e sai a Receita de Controle Especial em 2 vias.
  - A receita de alta e a da porta não têm controle especial.
  - Não há folha de Notificação de Receita: é talão numerado da vigilância
    sanitária.
  - Os rótulos "Verde (antibióticos — B1)" e "Azul (controle especial — B2)",
    em `src/lib/folhas.ts:46-51`, estão errados pela Portaria: B1 e B2 são
    psicotrópicos, em notificação azul.

## 3. Pontos para o RT decidir (recomendação em A)

### C1. Escopo desta lacuna
- **A:**
  - marca de controlado no catálogo, com a lista;
  - selo na prescrição, na farmácia e na checagem;
  - liberação pelo farmacêutico antes de administrar, como na alta vigilância;
  - receitas para casa seguindo a lista (C4).
  - Ficam para depois: o livro de registro eletrônico, o balanço, lote e
    validade (já adiados) e a intervenção farmacêutica com registro próprio.
- **B:** só a marca e o selo.
- **C:** tudo, inclusive o livro de registro e o balanço.

### C2. De onde vem a marca e como se atualiza
- **A:** uma tabela de substâncias controladas por princípio ativo, digitada
  da RDC vigente (1.036/2026), com a lista e o item de cada uma e o número
  da RDC.
  - O catálogo é marcado pela correspondência do princípio ativo, como na
    alta vigilância.
  - Entram só as substâncias que estão no catálogo da rede.
  - Quando sair uma nova RDC, o super admin atualiza a tabela, e a mudança
    fica registrada.
  - A unidade não desmarca, porque é obrigação legal.
- **B:** marcar item a item no catálogo, à mão.

### C3. Paciente na internação e no PS
- **A:** vale a prescrição do próprio sistema, sem Notificação de Receita
  (Arts. 35 §6º, 51 e 56). O app só marca e exige a liberação do C5.
- **B:** a unidade exige algo a mais.

### C4. Receita para casa (receituário, receita de alta e receita da porta)
- **A:**
  - **Lista C1 ou C5:** o item sai na Receita de Controle Especial em 2 vias,
    marcada pelo catálogo e não mais à mão. A receita de alta e a da porta
    ganham o mesmo controle.
  - **Lista A ou B:** o app avisa que o item exige Notificação de Receita (o
    talão da vigilância sanitária) e não o imprime na receita comum.
  - Os rótulos errados de `folhas.ts` são corrigidos.
- **B:** a receita para casa continua como está.

### C5. Liberação pelo farmacêutico
- **A:** obrigatória para controlado, no mesmo fluxo da alta vigilância.
  - Sem farmacêutico de plantão, a enfermagem administra com justificativa,
    e o farmacêutico confere depois.
  - Controlado de alta vigilância (midazolam EV) passa por uma liberação só.
- **B:** sem liberação; só o selo.

### C6. Saldo de controlado
- **A:** a regra de hoje fica: o saldo pode ficar negativo, para não travar
  a emergência. O painel da farmácia destaca o controlado com saldo negativo.
- **B:** controlado nunca fica negativo, e a dispensação para.

## 4. Fora do escopo
- Livro de registro eletrônico e balanço (Arts. 62 a 68).
- Guarda sob chave: é processo físico.
- SNGPC: a unidade hospitalar é isenta.
- Maleta de emergência (Art. 94).
- Lote e validade: adiados.

## 5. Achado à parte (fora da trilha)
Na leitura, `validar_item` chama o aviso de item devolvido duas vezes
(`supabase/migrations/20261119000007_avisos_farmacia_leito.sql:99` e `:101`),
e `concluir_higienizacao` chama o aviso de leito liberado duas vezes. Pode
gerar aviso duplicado. Não conferi, e o caso não está no BACKLOG.

## 6. Decisão do RT (10/11/2026)

"A em todos": A em C1 a C6.
