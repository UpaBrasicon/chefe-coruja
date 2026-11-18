# LG7: desenho técnico da assinatura ICP-Brasil (18/11/2026)

Segue as decisões do RT de 18/11/2026 (A1–A7 = A, `LG7-ASSINATURA-ICP-DIAGNOSTICO.md`). São escolhas técnicas, que não pedem decisão nova do RT. Cada parte vai em PR próprio, com homologação, CI e "ok produção".

## Peças

| Peça | Onde roda | O que faz |
|---|---|---|
| **Assinador** | contêiner novo no VPS (`assinador`), atrás do Caddy, em `assina.chefecoruja.com.br` | guarda a sessão do médico com o provedor, gera o PDF, monta a assinatura PAdES e grava o resultado |
| **Banco** | Supabase | registra a sessão (sem token) e a assinatura de cada documento |
| **Tela** | app | "Iniciar sessão de assinatura", selo "Assinado (ICP-Brasil)", QR code e link de conferência |

**Por que no VPS e não numa Edge Function:**
- O PDF precisa sair igual à folha impressa de hoje. A folha é HTML montado pela Edge `folha`, e só um navegador sem tela (Chromium) transforma esse HTML em PDF fiel. Isso não roda numa Edge Function.
- O token do provedor dá poder de assinar pelo médico durante a sessão. Ele fica só no VPS, cifrado, e nunca vai ao navegador nem ao banco.
- O VPS já está no Brasil e já trata dado em trânsito (Apêndice A do LG1).

## Fluxo

**1. Iniciar a sessão (uma vez por plantão, A3)**
1. O médico toca em "Iniciar sessão de assinatura" e escolhe o provedor do seu certificado (VIDaaS, BirdID e outros).
2. O app chama o assinador com o JWT do médico. O assinador confere o login e se ele está na escala agora.
3. O assinador abre o OAuth do provedor (DOC-ICP-17):
   - PKCE S256;
   - escopo `signature_session`;
   - validade até o fim do plantão, no máximo 12 horas.
4. O médico autoriza no celular, no aplicativo do provedor. O app nunca vê senha nem código.
5. No retorno, o assinador troca o código pelo token e o guarda cifrado (AES-256-GCM, chave no `.env` do VPS).
   - Busca o certificado do médico e confere que o CPF dele bate com o CPF do perfil.
   - Registra a sessão no banco: quem, provedor, início, validade e serial do certificado, sem o token.

**2. Assinar cada documento**
1. Ao emitir (estado `ativo`), o app pede ao assinador a assinatura do documento.
2. O assinador busca a folha na Edge `folha` com o JWT do médico. Assim o acesso e o registro de impressão seguem as regras de hoje.
3. Gera o PDF com o Chromium, com o QR code e o código de conferência já impressos no rodapé, e acrescenta:
   - os metadados de saúde que o VALIDAR pede: CFM 2.16.76.1.4.2.2; tipo do documento 2.16.76.1.12.1.x, com prescrição .1, atestado .2, pedido de exame .3 e relatório .11;
   - o QR code do VALIDAR, que aponta para o nosso endereço de conferência com código secreto;
   - o espaço da assinatura (ByteRange).
4. Calcula o SHA-256 do PDF. Monta os atributos assinados do CMS:
   - `contentType`, `messageDigest` e `signingCertificateV2`;
   - a política **AD-RB** da ICP-Brasil (`signaturePolicyIdentifier`).
   - Calcula o SHA-256 desses atributos.
5. Manda **só esse hash** ao provedor, no formato `RAW`. Isso funciona igual em qualquer provedor do DOC-ICP-17.
6. Monta o CMS SignedData com o certificado e a cadeia, e o grava dentro do PDF.
7. Confere a assinatura antes de gravar: a assinatura bate com o hash e o certificado está dentro da validade.
8. Guarda o PDF no banco, numa chamada só com a assinatura (`private.registrar_assinatura_com_pdf`, migration 091). O banco calcula o hash do PDF. Atualização de 18/11/2026: o PDF fica no banco, e não no Storage, porque o assinador não tem chave de Storage e o banco já tem backup e cofre. Essa função só aceita o papel do assinador:
   - grava `assinaturas_documento`;
   - preenche `assinatura_id` e `assinado_em` no documento.
   - O estado continua `ativo`: 42 consultas do sistema procuram documento `ativo`, e trocar o estado quebraria listas, impressões e altas. O selo da tela vem de `assinado_em`.
9. Se algo falha, o documento continua `ativo`, impresso e numerado como hoje. A tela mostra "não assinado", e o médico pode tentar de novo.

**3. Conferência**
- O QR code e o link público abrem uma página de conferência. Ela mostra quem assinou, o registro no conselho, a data e o PDF.
- No formato do VALIDAR, o endereço devolve o JSON com o PDF quando recebe `_format=application/validador-iti+json` e o código secreto.
- Nada de dado do paciente na URL (só o código secreto, que é aleatório).

## Banco (migration expand, primeiro PR)

- `private.sessoes_assinatura`:
  - perfil, provedor, serial e CPF do certificado (só os 4 últimos dígitos visíveis na tela), início, validade, encerrada_em;
  - **sem token**;
  - só de inclusão, mais o encerramento.
- `public.assinaturas_documento`:
  - documento, médico, sessão, provedor, serial do certificado, emissor, política (AD-RB), hash do PDF assinado, caminho no Storage, código secreto da conferência (como hash) e data;
  - só de inclusão;
  - leitura pelas mesmas regras do documento.
- `private.registrar_assinatura_documento(...)`: confere que o documento está `ativo`, que o autor é o médico da sessão e que a sessão vale. Grava a assinatura e preenche `assinatura_id` e `assinado_em` no documento, sem mudar o estado.
  - Só o papel `assinador_app` executa. Ele é um papel de login próprio, como os do Hermes, sem outro acesso.
- `public.minha_sessao_assinatura()`: o app mostra se a sessão está ativa e até quando.
- `public.conferir_assinatura(codigo)`: anônima, para a página de conferência. Devolve só o necessário: tipo do documento, quem assinou, registro, data e hash. Nunca o nome do paciente.
- **Tabela antiga `public.assinaturas`** (vazia, presa à prescrição): hoje deixa o próprio usuário inserir, alterar e apagar. A migration tira essas permissões; a leitura continua. Ela sai numa contract, depois.
- `docs/regulatorio/inventario/operacoes.json`: as duas tabelas novas entram em "documentos" (LG4).
- `docs/regulatorio/modulo-clinico/mapa.json`: a assinatura não é função clínica, então fica fora do mapa.

## Segurança

- O token do provedor fica só no VPS, cifrado. A sessão vale até o fim do plantão e cai no checkout, no fim do plantão ou quando o médico encerra.
- O assinador só assina o documento do próprio médico, emitido e numerado, e só com sessão válida. Ele confere tudo de novo no banco.
- Cada assinatura e cada sessão vão para a auditoria.
- Limite de taxa por médico no assinador.
- Segredos dos provedores (`client_secret`) só no `.env` do VPS. O RT os grava pelo terminal, nunca pelo chat.

## Ordem dos PRs

1. Banco (este desenho, mais a migration expand), na homologação. Não muda nada que o usuário veja.
2. Assinador: geração do PDF com OIDs e QR code, e montagem do CMS AD-RB. Os testes usam um certificado ICP-Brasil **de teste** gerado localmente, que nunca é mostrado como válido.
3. Módulo DOC-ICP-17: PKCE, token e assinatura RAW, com testes contra um servidor que imita o padrão.
4. Telas, desligadas por configuração (`assinatura_icp_ligada`) até a primeira homologação real.
5. Homologação com o provedor real, quando as credenciais chegarem (`LG7-PEDIDO-CREDENCIAIS.md`). Só então liga, unidade por unidade.
