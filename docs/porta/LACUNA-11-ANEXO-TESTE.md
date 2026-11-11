# Lacuna 11: anexo de laudo, imagem ou ECG, teste na homologação (10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 11 (P2). Origem: relatório do
teste de ponta a ponta de 11/10/2026, passo `6.anexo_arquivo` (#7). Lá, o
envio falhou com o erro 42P10 do serviço de storage local, que tinha versão
diferente do esquema do banco local.

## Como funciona (master)

- **Onde fica o arquivo:** bucket privado `exames`, com até 10 MB.
  - Aceita PDF sempre e JPEG ou PNG só em exame de imagem
    (`20261206000001_resultado_exames.sql:99`;
    `20261208000001_imagem_no_sistema.sql:42`).
  - O caminho é `<id do exame>/<marca de tempo>-<nome>` (`src/lib/exames.ts:116`).
- **Envio:** `src/components/clinico/ResultadoExame.tsx:223`, com
  `upsert:false`, seguido da RPC `registrar_resultado_exame`.
- **Quem envia:** médico ou enfermagem com o paciente no plantão (policy
  `exames_laudo_upload`).
- **Quem lê:** só com uma liberação de 2 minutos dada por `exame_laudo_abrir`,
  que fica auditada. O link assinado dura 60 s.
- **Sem sobrescrever nem apagar:** não há policy de UPDATE nem de DELETE.

## O que foi testado na homologação

São 22 casos, numa transação desfeita (nada gravado), com contas e unidades
da Rede E2E e paciente fictício.

**Envio aceito:** PDF enviado pelo plantonista; PDF enviado pela enfermeira;
JPG do traçado de ECG.

**Envio recusado** (42501, regra de acesso):
- JPG em exame de laboratório;
- caminho sem id de exame;
- recepção;
- plantonista de outra unidade;
- gestor, que vê mas não registra;
- usuário anônimo.

**Leitura:**
- Sem liberação, ninguém vê o arquivo.
- Com `exame_laudo_abrir`, o plantonista e o gestor veem.
- A outra unidade e a recepção recebem "Acesso negado".
- Tentar alterar o arquivo não muda nenhuma linha.

**RPC:** recusa arquivo de outro exame e arquivo não enviado, e registra o
PDF e o JPG.

**Erro 42P10:** não ocorre na homologação. O serviço hospedado (v1.89.11) e o
esquema são atualizados juntos, e já há 4 PDFs enviados no bucket, em
19/10, pelo simulador de laboratório.

**Limite do teste:** a inserção foi feita direto em `storage.objects`. Isso
testa as regras de acesso, não o envio real pelo serviço de storage.

## Envio real com login (11/11/2026)

O RT fez o envio real com usuário logado, pelo roteiro abaixo, e todos os
passos passaram. A lacuna 11 está concluída.

1. Com médico ou enfermagem em plantão, de check-in feito, abra um atendimento
   de paciente fictício e peça um hemograma e um ECG.
2. No hemograma, em "Registrar resultado", anexe um PDF pequeno e registre.
   Deve aparecer o botão "Laudo em PDF".
3. No ECG, anexe uma foto JPG. Deve aparecer o botão "Traçado / imagem".
   Tente um JPG no hemograma: deve aparecer "O laudo precisa ser PDF.".
4. Clique no laudo. Ele abre numa aba nova com um link assinado. Recarregue
   depois de 60 s: o link deve estar expirado.
5. Com a recepção ou com um plantonista de outra unidade, o exame mostra
   "Acesso negado" e não oferece envio.

## Riscos achados (não testados com usuário real)

- **Laudo bloqueado no Safari e no celular:** o laudo abre com `window.open`
  depois de duas chamadas ao servidor (`ResultadoExame.tsx:164`). Por isso o
  bloqueador de pop-up pode impedir a abertura. A tela do prontuário abre a
  janela antes e não tem esse problema.
- **Tipo do arquivo:** PDF que o navegador manda com tipo vazio ou
  `application/x-pdf`, e foto HEIC do iPhone, são recusados na tela.
- **Arquivo órfão:** se o envio der certo e a RPC falhar, o arquivo fica no
  bucket, porque ninguém tem como apagar.
- **`upsert`:** se o envio passar a usar `upsert:true`, quebra, porque a
  leitura depende da liberação.
- **Segundo fator:** a homologação está com o 2FA desligado, e a produção
  exige o segundo fator.
