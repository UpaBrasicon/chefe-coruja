# Trilha de segurança, S5: anexos — diagnóstico

**Pedido.** Em 15/11/2026, depois do S4, o RT escolheu o S5 ("S5 anexos").

**Origem.** Auditoria Cloudflare (`docs/seguranca/auditoria-cloudflare-2026-11-15/`), passada 1 (UPDATE do bucket `atendimento`) e passada 2 (SVG/HTML aberto como página).

**Escopo.** Só diagnóstico. Os buckets e as políticas foram lidos na homologação (só a estrutura), e os envios, no código.

## Como estão os buckets (homologação, 15/11/2026)

| Bucket | Público | Tipos aceitos | Limite | Quem envia (app) |
|---|---|---|---|---|
| `atendimento` | não | **qualquer** | **nenhum** | anexos do prontuário, justificativas da escala |
| `farmacia` | não | **qualquer** | 20 MB | farmacêutico (planilhas e documentos) |
| `banners` | **sim** | **qualquer** | **nenhum** | gestor e admin |
| `fotos` | não | **qualquer** | **nenhum** | foto do perfil (sem política: o envio já não funciona) |
| `receitas` | não | **qualquer** | **nenhum** | nenhum uso no app |
| `exames`, `regulacao` | não | PDF, JPEG, PNG | 10 MB | já limitados |
| `painel` | sim | PNG, JPEG, WebP | 5 MB | já limitado |

O tipo e o tamanho só são conferidos na tela (`src/lib/anexo.ts`). Quem chama a API direto envia qualquer coisa, com o tipo que declarar.

## As lacunas

1. **Arquivo ativo nos anexos.**
   - O `atendimento` aceita SVG e HTML. O registro do anexo (`registrar_anexo_prontuario`, `20261005000003_documentos_estados.sql:370`) aceita qualquer `image/%`, inclusive `image/svg+xml`.
   - Um SVG com script, aberto por outro profissional em "Abrir", vira página no endereço do storage.
   - O `opener` dessa janela já foi zerado no S4, então ela não alcança mais a aba do sistema. Mas o conteúdo ativo continua aberto no navegador da pessoa.
   - O `banners` é público: um SVG ou HTML enviado lá fica acessível a qualquer um, no domínio do storage.
2. **Sobrescrita de anexo registrado.**
   - A política `atendimento_update` deixa gestor e plantonista da unidade sobrescrever ou mover um objeto já registrado. A leitura ainda exige o prontuário aberto.
   - Isso fura a guarda de 20 anos, que limita a exclusão ao super admin.
   - Nenhuma tela usa sobrescrita nesse bucket: o envio é sempre `upsert: false`.
3. **Sem limite de tamanho** em `atendimento`, `banners`, `fotos` e `receitas`.

## Decisões para o RT

**A1. Tipos e tamanho por bucket.**
- **A (recomendada):**

| Bucket | Tipos | Limite |
|---|---|---|
| `atendimento` | PDF, JPEG, PNG, WebP, HEIC | 20 MB |
| `farmacia` | XLSX, XLS, CSV, DOC, DOCX, PDF (o que a tela já aceita) | 20 MB |
| `banners` | PNG, JPEG, WebP | 5 MB |
| `fotos` | PNG, JPEG, WebP | 5 MB |
| `receitas` | PDF, JPEG, PNG | 10 MB |

  O `registrar_anexo_prontuario` passa a aceitar só os tipos do `atendimento`, sem SVG. Os arquivos que já estão lá não mudam.
- **B:** só o `atendimento` e o `banners`.

**A2. Sobrescrita.**
- **A (recomendada):** a política `atendimento_update` passa a valer só para o super admin, igual à de exclusão. Nenhuma tela usa sobrescrita.
- **B:** retirar a política inteira.

**A3. Como o anexo abre.**
- **A (recomendada):** continua abrindo na tela (PDF e imagem). Com a A1, não entra mais arquivo ativo, e a janela já está isolada desde o S4.
- **B:** abrir sempre como download, o que obriga a salvar o arquivo para ver.

**A4. Arquivos que já estão lá.**
- **A (recomendada):** com a sua autorização, uma leitura só de estrutura na produção. Conta quantos objetos existem em cada bucket por tipo declarado e procura algum SVG ou HTML. Sem abrir arquivo nem ler dado de paciente. O resultado vem para você, e nada é apagado sozinho.
- **B:** não olhar o que já existe.

**A5. Hash do anexo.**
- **A (recomendada):** não fazer agora. Com a A2, ninguém além do super admin troca o arquivo, e o hash só faria sentido se calculado no servidor, o que o banco não consegue sem ler o arquivo.
- **B:** guardar o hash calculado no navegador, que serve só como conferência fraca.

## Riscos

- **Envio que hoje passa e vai parar de passar:** por exemplo, um GIF, um BMP ou um PDF acima de 20 MB nos anexos. A tela já limita os tipos; conferir o `accept` de cada campo na homologação.
- **Foto do perfil:** o bucket `fotos` não tem política, então o envio já falha hoje (achado separado: um defeito, não uma falha de segurança). Fica registrado e não entra aqui.
- **Rollback:** voltar `allowed_mime_types` e `file_size_limit` a nulo nos buckets e recriar a política antiga, tudo escrito na migration.

## Critérios de aceite

1. Envio de SVG e de HTML recusado em `atendimento`, `banners`, `fotos` e `receitas`. `registrar_anexo_prontuario` recusa `image/svg+xml`.
2. Gestor ou plantonista não sobrescreve nem move um objeto do `atendimento`.
3. Teste de banco no CI cobrindo 1 e 2.

## Depois

Com as decisões, abro a tarefa e começo pela migration na homologação.
