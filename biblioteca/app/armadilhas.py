"""Armadilhas com resposta fixa (Portão 2, tarefa 1b; decisão do RT em 14/10/2026).

Três pedidos que a IA não atende, com ou sem material na biblioteca: dose letal,
dado pessoal de paciente ou de familiar, e assinar ou autorizar no lugar do
médico. A resposta é fixa e explica a recusa; a pergunta nem vai para a busca.
Contraindicação e suspensão de remédio seguem pela busca, como qualquer pergunta.
"""
import re
import unicodedata

DOSE_LETAL = "dose_letal"
DADO_PESSOAL = "dado_pessoal"
ASSINATURA = "assinatura"

RESPOSTA = {
    DOSE_LETAL: ("Não informo dose letal ou fatal de medicamento. Se a pergunta é sobre uma intoxicação, "
                 "pergunte pela conduta (ex.: \"intoxicação por anlodipino em criança, o que fazer\"). "
                 "O Centro de Informação e Assistência Toxicológica (CIATox) da região orienta o caso."),
    DADO_PESSOAL: ("Não mostro dado pessoal de paciente ou de familiar. Consulte o cadastro e o prontuário no sistema: "
                   "a IA não recebe identificação."),
    ASSINATURA: ("Não assino, não autorizo e não emito documento. Assinatura e autorização são atos do médico, "
                 "feitos por ele no sistema."),
}


def _plano(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


# "dose letal", "dose fatal", "quantos comprimidos matam", "quanto mata"
_LETAL = re.compile(
    r"\bdoses?\s+(?:\w+\s+){0,2}(?:letal|letais|fatal|fatais|que\s+mata\w*|para\s+matar)\b"
    r"|\b(?:letal|letais|fatal|fatais)\b.{0,40}\bdoses?\b"
    r"|\bquant[oa]s?\s+(?:comprimidos?|capsulas?|ampolas?|frascos?|gotas|mg|gramas?|ml|doses?)\b.{0,40}\b(?:mata|matam|matar|morrer)\b"
    r"|\bdl\s?50\b")
# documento ou contato de uma pessoa: "CPF da mãe", "telefone desta paciente"
_DADO = re.compile(r"\b(?:cpf|rg|cns|cartao\s+(?:do\s+)?sus|telefones?|celular|endereco|e-?mail|whats\w*|"
                   r"nome\s+(?:de\s+registro|civil|completo)|registro\s+civil|data\s+de\s+nascimento)\b")
_PESSOA = re.compile(r"\b(?:d[oa]s?|dest[ea]s?|dess[ea]s?|del[ea]s?)\s+(?:paciente|mae|pai|responsave\w*|acompanhante\w*|"
                     r"familia\w*|filh[oa]s?|crianca|menor|esposa|marido|parente\w*)\b|\b(?:dele|dela)\b")
# assinar, autorizar ou emitir no lugar do médico
_ATO = re.compile(r"\b(?:assin\w*|carimb\w*|autoriz\w*|emit\w*|liber\w*|preench\w*|prescrev\w*)\b")
_NO_LUGAR = re.compile(r"\bpor\s+mim\b|\bno\s+meu\s+lugar\b|\bem\s+meu\s+nome\b|\bcom\s+(?:o\s+)?meu\s+(?:nome|crm|login|usuario)\b"
                       r"|\b(?:minha\s+senha|meu\s+crm)\b")
_PODE_ASSINAR = re.compile(r"\b(?:voce\s+)?(?:pode|poderia|consegue|da\s+para)\s+(?:me\s+)?(?:assinar|carimbar)\b")


def armadilha(q: str) -> str | None:
    """Tipo da armadilha (DOSE_LETAL, DADO_PESSOAL, ASSINATURA) ou None."""
    t = _plano(q)
    if _LETAL.search(t):
        return DOSE_LETAL
    m = _DADO.search(t)
    if m and _PESSOA.search(t[m.start():m.start() + 80]):
        return DADO_PESSOAL
    if (_ATO.search(t) and _NO_LUGAR.search(t)) or _PODE_ASSINAR.search(t):
        return ASSINATURA
    return None
