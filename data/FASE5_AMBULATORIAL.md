# FASE 5 — Camada ambulatorial / prescrição assinada (avaliação comercial)

> Status: **AVALIAÇÃO** — não é implementação. O projeto não constrói assinatura
> ICP-Brasil do zero; avalia integração com parceiros.
> Fontes consultadas em 2026-08-17 (sites públicos dos fornecedores).

## Contexto

A plataforma Chefe Coruja terá módulo de prescrição ambulatorial (pacientes não
internados) com receita digital. A emissão de receita eletrônica com validade
jurídica exige assinatura ICP-Brasil — infraestrutura cara e regulada que não
faz sentido construir internamente. As duas opções de parceria identificadas são
**Memed** e **Mevo (ex-Nexodata)**.

## Comparativo

| Critério | Memed | Mevo (ex-Nexodata) |
|---|---|---|
| **Modelo de contrato** | Parceria software (`memed.com.br/parceiro-software`) — contrato comercial com o sistema gestor; receita própria para médicos | Contrato de parceria para hospitais/operadoras + app gratuito para prescrever (`receita.mevosaude.com.br`) |
| **Dado retornado** | Base com **60.000+ itens** (medicamentos, exames, periféricos); alertas de interação medicamentosa + alergia com monografia em português; dados estruturados de prescrição; histórico para reenvio (SMS/e-mail/WhatsApp) | Receita digital, vinculação a farmácias parceiras, **dispensação** (conferência na farmácia), compra online/entrega do medicamento |
| **Dependência de internet** | Alta — serviço em nuvem (AWS); prescrição via API do parceiro | Alta — plataforma em nuvem |
| **Custo por prescrição** | Não público na página; modelo comercial via contrato (licença mensal/anual + volume; negociar com especialista) | Não público na página; modelo comercial via contrato |
| **Segurança/confiança** | ISO 27001; R$10 mi investidos em cybersecurity; AWS; **350+ parceiros** (TOTVS, Amil, Alice, Unimed, Hygia, etc.) | Plataforma consolidada (ex-Nexodata); foco em receita digital e farmácias |
| **Escala** | 4 mi prescrições/mês; +36 mil farmácias integradas; 210 mil médicos | Números não publicados na página inicial |
| **Público-alvo da integração** | Sistemas de gestão de clínicas/hospitais (150+ sistemas), operadoras, telemedicina | Hospitais, clínicas, operadoras, atendimento remoto, farmácias |

## Custo por prescrição — status da investigação

Nenhum dos dois publica preço por prescrição. Ambos exigem **contato comercial**
(Memed: formulário "Fale com especialista"; Mevo: formulário "Quero Mevo no meu
Hospital"). **Recomendação:** iniciar com a **Memed** pela base de dados mais
completa e histórico de alertas em português — mas solicitar cotação dos dois e
comparar. O modelo típico desse mercado é licença mensal + volume de prescrições
(com desconto por volume).

## Riscos e pontos de atenção

1. **Dependência de internet:** a plataforma roda em UPA com internet instável.
   A prescrição ambulatorial assinada depende de API em nuvem dos parceiros —
   **conflita** com o requisito offline. Mitigação: manter a prescrição
   hospitalar interna (local) como primária e usar o parceiro apenas para o
   fluxo ambulatorial/assinatura, com fila de sincronização offline-first.
2. **LGPD:** dados de paciente saem da plataforma para o parceiro. Exigir DPA
   (Data Processing Agreement) e minimização de dados.
3. **Custo:** sem cotação pública — orçar antes de assinar; negociar volume.
4. **Contrato:** revisar cláusulas de responsabilidade civil (erro assistencial)
   e propriedade dos dados estruturados gerados.

## Decisão da plataforma (nesta fase)

- **Não** construir assinatura ICP-Brasil do zero.
- **Não** integrar agora (sem contrato/cotação).
- Fluxo ambulatorial fica **fora do escopo desta iteração**; o módulo hospitalar
  (prescrição + diluição) já está estruturado localmente.

## Ação recomendada

1. Solicitar cotação comercial a **Memed** e **Mevo** (formulários oficiais).
2. Exigir DPA/LGPD de ambos.
3. Reavaliar quando a versão hospitalar estiver estável.
