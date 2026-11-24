# Assinador ICP-Brasil (LG7)

Serviço do VPS que assina os documentos médicos com o certificado em nuvem do médico: PAdES AD-RB da ICP-Brasil, pelo padrão DOC-ICP-17. Código em `services/assinador`; desenho em `docs/regulatorio/LG7-DESENHO-TECNICO.md`.

## O que cobre

- A sessão de assinatura: o médico autoriza no celular uma vez por plantão, por no máximo 12 horas.
- O PDF da folha, gerado pelo Chromium a partir da Edge `folha`, com QR code e código de conferência.
- O CMS AD-RB, montado no assinador. O provedor só assina o hash.
- A gravação no banco pelo papel `assinador_app` (migrations 090 e 091).
- A conferência pública em `/v`, no formato do VALIDAR do ITI, e o PDF em `/pdf`.
- Prazo nas chamadas de fora (pedido 18): 15 s em cada chamada ao provedor, 10 s ao Supabase e 20 s à Edge `folha` (`services/assinador/src/prazo.ts`). Estourou, o assinador responde 504 com o motivo em português e registra no log. Só a consulta (lista de certificados e leituras GET do Supabase) tenta de novo, uma vez; a troca do código, a folha e a assinatura do hash nunca repetem. O navegador espera 20 s nas chamadas da sessão e 90 s na assinatura, que não trava a emissão.

## O que não cobre

- Notificação de Receita A e B no SNCR da ANVISA (A5: item separado).
- Evolução e prescrição do internado (A1: ficam com o login e o 2FA).
- Carimbo do tempo (AD-RT): fica para depois. A política usada é a AD-RB.

## Chaves e segredos

Ficam todos no `/home/assinador/deploy/.env.assinador` (600). O RT grava os segredos pelo terminal e nunca os cola no chat.

| Variável | O que é | Quem gera |
|---|---|---|
| `ASSINADOR_CHAVE` | 32 bytes em hexadecimal; cifra os tokens dos provedores | o VPS (`openssl rand -hex 32`), sem mostrar |
| `ASSINADOR_PG_URL` | conexão do papel `assinador_app`. A senha vai na produção como verificador SCRAM, como na troca de chaves | o VPS |
| `SUPABASE_URL`, `SUPABASE_CHAVE_PUBLICA` | Supabase e a chave publicável | já existem |
| `ASSINADOR_BASE`, `ASSINADOR_RETORNO`, `ASSINADOR_ORIGENS` | `https://assina.chefecoruja.com.br`, o mesmo endereço com `/retorno` no fim, e as origens do app | configuração |
| `VIDAAS_*`, `BIRDID_*` | `BASE`, `CLIENT_ID` e `CLIENT_SECRET` de cada provedor | o RT, quando as credenciais chegarem |
| `REDE_DO_CADDY` | a rede Docker do `hermes-caddy` | configuração |

## Instalação (quando houver o "ok produção" do RT)

1. Criar o usuário `assinador` e a pasta `/home/assinador/deploy`, do root, como no rnds-envio.
2. Copiar `services/assinador` para `app/`. Gerar a `ASSINADOR_CHAVE` e a senha do papel no VPS; a senha vai à produção só como verificador SCRAM.
3. Criar o DNS `assina` na Cloudflare e o bloco no Caddy (`assina.chefecoruja.com.br { reverse_proxy assinador:8090 }`).
4. `docker compose up -d --build` e conferir `/saude`.
5. Até chegarem as credenciais, nenhum provedor fica configurado: a sessão não abre e o app não mostra o botão.

## Como reverter

- `docker compose down` na pasta do deploy. O app volta a emitir sem assinatura ICP-Brasil, como hoje.
- Os documentos já assinados continuam no banco e são conferidos pelo `/v`, enquanto o serviço estiver de pé.
- As migrations 090 e 091 têm rollback em `docs/regulatorio/LG7-ROLLBACK-*.sql`. Ele apaga os registros; exporte antes.
