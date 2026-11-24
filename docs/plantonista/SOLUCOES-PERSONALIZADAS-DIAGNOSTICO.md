# Soluções personalizadas do médico: diagnóstico (SO1 a SO6)

Pedido 9 da lista "Pedidos do RT em 17/11/2026" do BACKLOG. Saiu do item 6 (tela do celular, CM4 = A): "Meu plantão: soluções personalizadas (diluições salvas pelo médico)". O RT pediu em 23/11/2026 para fazer este pedido junto com o 7 (anotações pessoais), cada um numa sessão. Diagnóstico lido na master (48145cb6). Nada foi programado.

## 1. O que já existe

- **Infusões contínuas do adulto** (`InfusoesAdulto.tsx`, dados em `src/clinico/adulto/infusoes.ts`). São 14 drogas, cada uma com o preparo padrão do Manual HCFMUSP (Anexo 1, p. 1482 a 1489) e a faixa de dose do livro. A tela tem duas opções de diluição:
  - "Padrão HC", com a concentração do livro;
  - "Diluição do serviço", em que o médico digita a massa da droga e o volume final, e a tela calcula a concentração ("Confira com o rótulo do preparo").

  A dose continua presa à faixa do livro, com o teto. Nada é guardado: ao fechar a droga, a diluição digitada some e precisa ser digitada de novo no próximo paciente.
- **Infusões contínuas da criança** (`InfusoesPediatricas.tsx`, dados em `src/clinico/pediatria/infusoes.ts`, PS Pediatria ICr-HCFMUSP, apêndice). O livro não traz preparo padrão, então o médico sempre digita a concentração final da solução. A tela mostra a apresentação da ampola citada no livro ("Não é o preparo") e avisa quando a concentração passa do máximo que o livro cita (ex.: dopamina até 3.200 µg/mL; amiodarona até 2 mg/mL em veia periférica). Também nada é guardado.
- **Diluições da farmácia** (`public.diluicao`, Fase 3 e Fase 4). O farmacêutico cadastra e publica, com fonte e CRF do revisor, em versões que não se apagam. É a diluição oficial da unidade, vista na "Referência de diluição" e na prescrição.
- **Ampolas da dose em mL** (`ampolas.ts`, `ampolasAdulto.ts`). É um cadastro fixo, com bula ou CMED em cada concentração. A ampola escolhida não é guardada e nenhuma vem marcada (ML2).
- **Favoritos e mais usados** (`ferramenta_uso`). Guardados no banco por pessoa, só o dono vê, sem segundo fator, porque são preferência de trabalho e não dado de paciente. Aparecem na aba "Meu plantão" do celular.
- **Não existe:** nenhuma solução, preparo ou concentração guardada pelo médico, nem no banco nem no aparelho.

## 2. O que o pedido quer dizer

No plantão, o médico prepara quase sempre as mesmas soluções do jeito do serviço dele, por exemplo "noradrenalina 2 ampolas em 100 mL de SG 5%" ou "midazolam 150 mg em 120 mL". Hoje ele digita a massa e o volume toda vez que abre a calculadora. O pedido é salvar essas soluções com um nome e abri-las com um toque.

O cuidado é a regra clínica: **dose só de fonte citada**. Uma solução salva não pode virar uma dose que não tem fonte. Por isso a pergunta central é **o que o médico pode salvar**.

## 3. Referências reais (Refero)

- **Salvar com um nome o que está na tela:** PayPal, "Save as a template" (refero.design/pages/97add398-501c-4456-9f69-1b8a6e8aacc8): um campo de nome e um botão Salvar, sem repetir o resto do formulário.
- **Calculadora com Salvar:** GrowPal, calculadora com os dados editáveis e o botão Salvar embaixo (refero.design/screens/c58a006e-f369-48dc-88df-4aaf41ca4eec).
- **Lista do que foi salvo, para escolher:** Uber, "Saved places" (refero.design/screens/b00d3e4d-fa9f-4af5-9a2a-9fc3b938dfd6) e "Choose a place" (refero.design/screens/aa971955-0ff4-41a2-9dcf-d259d8130e2e): uma linha por item, com nome e detalhe, e "Adicionar" no fim.
- **Salvar com aviso de que deu certo:** Uber, salvar lugar (refero.design/screens/bbd2aec2-9ae3-44a7-8694-9ae4252164ab): nome, endereço e aviso rápido de "salvo".

## 4. Decisões

### SO1. O que o médico pode salvar (ponto central)

**A (recomendo).** Só o **preparo**: a droga, escolhida da lista da calculadora de infusão, a massa da droga, o volume final e um nome curto (ex.: "Nora 2 amp em 100"). O diluente entra como texto opcional (SG 5%, SF 0,9%). A solução **não guarda dose, faixa, teto nem peso**. Quando o médico abre a solução, a calculadora vem com a concentração preenchida, e a dose continua saindo da faixa do livro, com a fonte e o teto de hoje. É o mesmo que a "Diluição do serviço" já faz, só que sem digitar de novo. Nada de paciente é guardado.

**B.** Texto livre: nome e receita escritos pelo médico, com a dose que ele usa. É mais flexível, mas vira uma dose sem fonte dentro da Central, fora do gate de aprovação (LG10). Não recomendo. Se o médico quiser escrever um lembrete, isso cabe nas anotações pessoais (pedido 7).

**C.** Atalho com tudo preenchido: preparo, peso e dose. É o mais rápido, mas o peso é dado do paciente e a dose deixaria de ser escolhida a cada uso. Não recomendo.

### SO2. Quem vê a solução

**A (recomendo).** Só quem criou, como os favoritos. Cada médico tem as suas. A diluição oficial da unidade continua sendo a da farmácia, com fonte e CRF do farmacêutico.

**B.** O médico pode compartilhar com a unidade. Uma solução compartilhada passa a ser a diluição do serviço de todos e, por isso, precisaria passar pelo farmacêutico, como as diluições da farmácia. É mais trabalho e repete um fluxo que já existe.

### SO3. Onde fica guardada

**A (recomendo).** No banco, ligada ao login, como os favoritos: segue o médico em qualquer celular ou computador. Tabela própria, que só o dono lê e muda, sem segundo fator (preferência de trabalho, sem dado de paciente). Limite de 30 soluções por médico. Apagar uma solução a esconde, sem perder o registro de quem criou e quando.

**B.** Só no aparelho. É mais simples, mas some ao trocar de celular ou limpar o navegador, e o computador da unidade não tem as do celular.

### SO4. Travas ao salvar e ao usar

**A (recomendo).**
- A solução é marcada como **adulto ou criança** e só aparece na calculadora da mesma faixa. Uma solução do adulto nunca é oferecida na criança (pediatria até 13 anos, 11 meses e 29 dias), e o contrário também.
- Massa e volume precisam ser maiores que zero. Na criança, se a concentração passar do máximo que o livro cita, a tela mostra o aviso do livro na hora de salvar e toda vez que a solução for usada.
- Drogas sem cálculo no livro (ex.: vasopressina no choque da criança) não aceitam solução.
- Se a droga sair da lista ou a ficha das infusões mudar de versão, a solução continua na lista com o aviso "Revise: a calculadora mudou". Ela só volta ao uso depois que o médico abre e salva de novo.
- Ao usar, a tela repete "Confira com o rótulo do preparo".

**B.** Só a trava de massa e volume maiores que zero.

### SO5. Onde a solução aparece

**A (recomendo).** Em dois lugares:
- **Na calculadora de infusão (adulto e criança):** ao lado de "Padrão HC" e "Diluição do serviço" entra a opção "Minhas soluções", com a lista das que são daquela droga. Depois de digitar uma diluição do serviço, aparece o botão "Salvar esta solução", que pede só o nome.
- **No "Meu plantão" do celular:** um bloco "Minhas soluções", abaixo dos favoritos. Cada linha mostra o nome, a droga e a concentração, e um toque abre a calculadora com a solução escolhida. O peso é pedido de novo a cada uso. Nada vai no endereço da página.

**B.** Só dentro da calculadora, sem o bloco no "Meu plantão".

### SO6. O texto copiado

**A (recomendo).** A linha do "Copiar" deixa claro que o preparo é do médico e que a faixa é do livro. Por exemplo, num adulto de 70 kg: "Noradrenalina: 0,1 µg/kg/min = 5,3 mL/h (minha solução "Nora 2 amp em 100", 80 µg/mL; faixa do Anexo 1, p. 1486–1487)".

**B.** A linha fica como hoje, com "diluição do serviço".

## 5. O que entra se for tudo A

- **Banco:** uma tabela nova, `solucoes_pessoais`, com dono, faixa (adulto ou criança), droga, massa, unidade, volume final, diluente, nome, versão da ficha usada, quem criou, quando e se foi apagada. Só o dono lê e muda, e só pelas RPCs (listar, salvar, apagar). Migration expand na faixa `20270419000050` a `20270419000099`, com teste em `supabase/tests`, volta em `supabase/snippets` testada na homologação e operação nova no inventário LG4 (preferência de trabalho, sem dado de paciente).
- **Telas:** opção "Minhas soluções" e botão "Salvar esta solução" nas duas calculadoras de infusão; bloco "Minhas soluções" no "Meu plantão" do celular.
- **Gate de aprovação (LG10):** as duas telas de infusão mudam, então as fichas `adulto-infusoes` e `ped-infusoes` sobem de versão e só vão à produção depois da aprovação do RT na Revisão Clínica. A faixa e as doses não mudam.
- **Fora:** dose em mL e ampolas (cadastro fixo com bula), doses por peso e RCP. A solução vale só para as infusões contínuas, onde hoje o médico já digita o preparo.
- **Ordem:** banco → calculadoras → "Meu plantão". Um PR, que passa pela homologação e só vai à produção com o ok do RT.

## 6. Decisões do RT

Aguardando.
