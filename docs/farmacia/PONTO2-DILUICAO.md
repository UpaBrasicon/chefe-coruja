# Ponto 2 — Nova diluição visível e da unidade

Pedido do RT em 27/10/2026 ("Diluição não tem como adicionar novas medicações e diluições"),
aprovado no mesmo dia como o terceiro dos seis pontos (`docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md`).

Achado do diagnóstico: a "Nova diluição" criava a linha sem unidade, que é o **modelo da rede**.
Qualquer farmacêutico de qualquer unidade podia publicá-la, e ela chegava às prescrições de todas as
unidades.

**Decisão do RT em 27/10/2026:** o modelo da rede só é criado, mudado e publicado pelo **super
admin**, por carga revisada como a do HU-UFGD. O farmacêutico cria e publica só a diluição da unidade
dele, pela "Nova diluição" ou por "Ajustar esta linha".

## O que mudou

### Banco

Migration `supabase/migrations/20270109000001_diluicao_da_unidade.sql`.

- **`private.pode_editar_diluicao(NULL)`:** passa a aceitar só o super admin (antes, qualquer
  farmacêutico). A regra vale para salvar, criar versão e publicar a linha da rede.
- **`salvar_diluicao`:** a diluição nova recebe `unidade_id`.
  - Sem `unidade_id`, só o super admin cria, e a linha é modelo da rede.
  - Com `unidade_id`, só o farmacêutico daquela unidade cria.
  - O resto do corpo não muda.
- **`publicar_diluicao_versao`:** passa a aceitar o super admin, para publicar o modelo da rede.
- **Mensagens:** quem tenta mexer no modelo da rede recebe a explicação e a indicação de usar
  "Ajustar esta linha".
- As linhas que já existem não mudam. A homologação não tinha nenhuma diluição.

### Tela

Tela `src/pages/farmacia/Diluicoes.tsx`.

- **"Nova diluição":** virou botão no topo e aparece em todas as abas. A diluição nova vale só nesta
  unidade e aceita as vias EV, IM, SC, IN e VO.
- **Um passo só** (pergunta do RT no teste de 27/10/2026: "vai diluir em que? qual quantidade?"): a
  "Nova diluição" já mostra todos os campos, com "Diluir em", "Volume mínimo de diluente" e "Tempo de
  infusão" no topo, e tem "Salvar rascunho" e "Publicar aos prescritores". Antes, esses campos só
  apareciam depois de criar o rascunho. Se faltar campo para publicar, o rascunho fica salvo e a tela
  diz o que falta. O editor usa os mesmos campos, na mesma ordem.
- **"Rascunhos":** mostra só os desta unidade. "Substituídas" mostra a rede e esta unidade.
- **Modelo da rede:** abre só para leitura, com a indicação de usar "Ajustar esta linha".

## Ordem na produção

1. Publicar o frontend antes da migration. O frontend novo manda `unidade_id`, e o banco antigo
   ignora essa chave e cria a linha como hoje.
2. Só depois aplicar a migration.

A ordem inversa quebra: com o banco novo e o frontend antigo, a "Nova diluição" é recusada por falta
de unidade.

## O que não cobre

- **Rascunho da rede aberto por farmacêutico antes da mudança:** fica parado até o super admin
  publicá-lo ou até a farmácia refazê-lo como diluição da unidade. A homologação não tinha nenhum.
  Na produção, o número não foi conferido.
- **Tela do super admin para o modelo da rede:** não existe. O modelo continua entrando por carga.
- **Item da unidade (ponto 4):** passa a ganhar diluição pela "Nova diluição", porque ela agora tem
  unidade. O gatilho do ponto 4 aceita essa linha.

## Rollback

Reaplicar `private.pode_editar_diluicao`, `public.salvar_diluicao` e `public.publicar_diluicao_versao`
da migration `20261009000001`. As linhas criadas como da unidade continuam da unidade.

## Evidência

- **Teste do banco** `supabase/tests/diluicao_da_unidade.sql`. Cria o próprio cenário: rede, duas
  unidades, farmacêutico de cada uma, super admin e um medicamento. Confere que:
  - o farmacêutico não cria modelo da rede nem diluição de outra unidade;
  - o farmacêutico cria e publica a diluição da própria unidade;
  - essa diluição não chega à prescrição da outra unidade;
  - o farmacêutico não muda nem publica o modelo da rede, nem cria versão dele;
  - o super admin cria e publica o modelo da rede;
  - "Ajustar esta linha" continua criando o rascunho da unidade.
- **Teste da tela** `src/lib/diluicaoDaUnidade.test.ts`: a tela manda a unidade, oferece as cinco
  vias e deixa o modelo da rede só para leitura.
- **Local:** typecheck, lint, catraca, os 142 testes de `src/lib`, os 1089 testes clínicos e o build,
  todos verdes.
- **Homologação** (`kswurfyxxvfydpjfrivy`), 27/10/2026:
  - migration aplicada e registrada como `20270109000001 diluicao_da_unidade`;
  - o teste do banco rodou inteiro dentro de uma transação desfeita, e todos os passos passaram;
  - depois do ROLLBACK, nada sobrou (zero diluições, unidades e super admins de teste);
  - o rollback de `pode_editar_diluicao` foi testado em transação desfeita.

## Teste do RT na homologação

1. Como farmacêutico, abrir Central do Farmacêutico › Diluição. Em qualquer aba, "Nova diluição"
   aparece no topo.
2. Criar a diluição de um medicamento (vias EV, IM, SC, IN ou VO) e preencher fonte, CRF e, na via
   EV, volume mínimo e tempo de infusão. Publicar. A linha aparece em "Valendo na unidade" como "da
   unidade".
3. Com outro farmacêutico, de outra unidade, a linha não aparece.
4. Um item cadastrado pela farmácia (ponto 4) também aceita "Nova diluição".

**Teste do RT em 27/10/2026: ok na homologação**, com o formulário de um passo (diluente, volume e tempo de infusão no mesmo formulário).

**Formulário enxuto (pedido do RT no teste de 27/10/2026, PR #283):** saíram concentração máxima, velocidade máxima, concentração após reconstituir e as duas estabilidades; o acesso virou seleção (periférico ou central). Os valores que as linhas já têm continuam no banco e no texto da prescrição. **Teste do RT em 27/10/2026: ok na homologação.**
