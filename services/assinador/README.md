# Assinador ICP-Brasil (LG7)

Serviço que assina os documentos médicos com certificado em nuvem: PAdES AD-RB da ICP-Brasil, pelo padrão DOC-ICP-17 do ITI.

- Desenho: `docs/regulatorio/LG7-DESENHO-TECNICO.md`
- Decisões do RT: `docs/regulatorio/LG7-ASSINATURA-ICP-DIAGNOSTICO.md`

## O que já está aqui

| Arquivo | O que faz |
|---|---|
| `src/politica.ts` | política PAdES AD-RB v1.1, lida dos arquivos oficiais do ITI em 18/11/2026, e os OIDs de documento de saúde |
| `src/cms.ts` | atributos assinados exigidos pela política, o hash que vai ao provedor, a montagem do CMS e a conferência |
| `src/pades.ts` | espaço da assinatura no PDF, DocMDP P=2, metadados de saúde, `/ByteRange` e gravação do CMS |
| `src/certificado.ts` | serial, emissor, validade e CPF (otherName 2.16.76.1.3.1) do certificado |
| `src/docicp17.ts` | OAuth com PKCE e `signature_session`, troca do código, certificados e assinatura RAW do hash |
| `src/sessoes.ts` | token do provedor cifrado (AES-256-GCM) e pedidos de autorização de uso único |
| `src/fluxo.ts` | iniciar sessão (só no plantão, até 12 h), retorno do provedor (confere o CPF), assinar e encerrar |

**Testes:** `npm test`, 15 testes.
- Usam uma CA e um certificado **de teste** gerados na hora pelo openssl.
- Usam um provedor de teste que segue o DOC-ICP-17.
- O openssl confere o CMS de forma independente.
- Nenhuma assinatura de teste é válida na ICP-Brasil.

## Peças reais e servidor (#2 do LG7)

| Arquivo | O que faz |
|---|---|
| `src/real.ts` | Supabase com o JWT do médico (perfil, plantão, documento, folha), banco pelo papel `assinador_app` e o Chromium que faz o PDF |
| `src/rodape.ts` | QR code e código de conferência impressos na folha antes de assinar, e a resposta no formato do VALIDAR |
| `src/servidor.ts` | rotas do médico (JWT) e da conferência pública (`/v`, `/pdf`), CORS só para o app e limite de pedidos |
| `src/main.ts` | liga tudo pelo ambiente (variáveis em `infra/assinador.md`) |
| `Dockerfile`, `deploy/docker-compose.yml` | contêiner só de leitura, sem porta no host, atrás do Caddy |

Testes: 21 no total.

## O que falta

- **Telas do app:** "Iniciar sessão de assinatura", selo "Assinado (ICP-Brasil)" e link da conferência. Ficam desligadas até a homologação com um provedor real.
- **Instalação no VPS:** pede o "ok produção" do RT. Passo a passo em `infra/assinador.md`.

## A conferir na homologação com um provedor real

- Onde o VALIDAR espera os OIDs de saúde no PDF (hoje vão no dicionário de informações; o guia remete ao ADE-ICP-04.01).
- Caminhos e formato do hash de cada provedor (`hashEm`: base64 ou hex).
- O hash da política no atributo `sigPolicyId` (hoje é o `signPolicyHash` de dentro da política).
