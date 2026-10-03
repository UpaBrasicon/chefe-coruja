"""Padrões de texto do Gavião e do Cérbero, copiados LITERALMENTE do TS:
- PADROES_INJECTION ........ hermes/src/jobs/padroes-injection.ts
- PADROES_CLINICO/RECUSA ... hermes/src/jobs/gaviao.ts (e IDENTIFICADOR, VALOR_DE_EXAME)

O teste tests/test_padroes.py lê os arquivos TS e confere que as fontes são as
mesmas — quem mudar um lado sem o outro quebra o teste.
"""

from __future__ import annotations

from .jsre import js_regex

FONTES_INJECTION = [
    # EN
    (r"ignore\s+(your|as\s+an?|all)\s+(previous|prior|above|system)?\s*(instructions|prompts?|rules)", "i"),
    (r"reveal\s+(your|the)\s*(system|internal)?\s*(prompt|instructions)", "i"),
    (r"forget\s+(all\s+)?(rules|instructions)", "i"),
    (r"act\s+as\s+(admin|super.?admin|gestor)", "i"),
    (r"acesse\s+(dados|outro)\s+(tenant|cliente|paciente)", "i"),
    # PT-BR
    (r"ignore\s+(suas|todas|as|qualquer|instru[çc][õo]es\s+)?\s*(instru[çc][õo]es|regras|prompts?|ordens)", "i"),
    (r"revel[ae]\s+(seu|o)\s*(system\s*prompt|prompt\s*(de\s*)?sistema|instru[çc][õo]es\s*internas)", "i"),
    (r"esque[çc]a\s+(todas\s+)?(as\s+)?(regras|instru[çc][õo]es)", "i"),
    (r"aja\s+como\s+(admin|super.?admin|gestor|sistema)", "i"),
    (r"acesse\s+(dados|informa[çc][õo]es)\s+(de\s+)?(outr[oa]|qualquer)\s+(tenant|cliente|unidade|paciente)", "i"),
]

FONTES_CLINICO = [
    (r"\b(prontu[áa]rio|diagn[óo]stico|sintoma|exame de sangue|hemoglobina|glicemia|creatinina|press[aã]o arterial|frequ[êe]ncia card[ií]aca)\b", "i"),
    (r"\bpaciente [A-ZÀ-Ú][a-zà-ú]+ (est[áa]|apresenta|relata|tem|possui)\b", "i"),
]

FONTES_RECUSA = [
    (r"n[aã]o\s+(posso|forne[cç]o|respondo|dou)\b", "i"),
    (r"n[aã]o\s+forne[cç]o\s+(orienta[çc][ãa]o|detalhes|informa[çc][õo]es)\b", "i"),
    (r"n[aã]o\s+(tenho|consigo)\s+(acesso|responder|ajudar)\b", "i"),
    (r"n[aã]o\s+[ée]\s+poss[ií]vel\b", "i"),
    (r"regra\s+inviol[aá]vel", "i"),
    (r"(use|usar|consulte|acesse)\s+a\s+plataforma", "i"),
]

FONTE_IDENTIFICADOR = (r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{4}\.\d{6}\b|\bleito\s+\d{1,3}[A-Z]?\b|\bbox\s+\d{1,2}\b", "i")
FONTE_VALOR_DE_EXAME = (r"\b(hemoglobina|glicemia|creatinina|press[aã]o arterial|frequ[êe]ncia card[ií]aca|satura[çc][ãa]o)\s*(de|:|=)?\s*\d", "i")

# R4b do Gavião (revelação de instruções internas) — inline no TS
FONTE_REVELACAO_1 = (r"voc[êe] (são|é|será|deve)[^\n]{0,40}(assistente|agente|instru[çc][õo]es)", "i")
FONTE_REVELACAO_2 = (r"ignore|system prompt|regras internas", "i")

PADROES_INJECTION = [js_regex(f, fl) for f, fl in FONTES_INJECTION]
PADROES_CLINICO = [js_regex(f, fl) for f, fl in FONTES_CLINICO]
PADROES_RECUSA = [js_regex(f, fl) for f, fl in FONTES_RECUSA]
IDENTIFICADOR = js_regex(*FONTE_IDENTIFICADOR)
VALOR_DE_EXAME = js_regex(*FONTE_VALOR_DE_EXAME)
REVELACAO_1 = js_regex(*FONTE_REVELACAO_1)
REVELACAO_2 = js_regex(*FONTE_REVELACAO_2)


def testa(padrao, texto: str) -> bool:
    """``re.test(texto)`` do JS (sem flag g): procura em qualquer posição."""
    return padrao.search(texto) is not None


def algum(padroes, texto: str) -> bool:
    return any(testa(p, texto) for p in padroes)
