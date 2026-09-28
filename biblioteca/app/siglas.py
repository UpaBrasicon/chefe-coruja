"""Siglas comuns do plantão → expansão. Cópia de src/lib/siglas.ts (manter
iguais). A busca embute a pergunta expandida: "o que é icc" vira
"o que é icc (insuficiência cardíaca congestiva)"."""
import re

SIGLAS = {
    "icc": "insuficiência cardíaca congestiva",
    "ic": "insuficiência cardíaca",
    "icfer": "insuficiência cardíaca com fração de ejeção reduzida",
    "iam": "infarto agudo do miocárdio",
    "sca": "síndrome coronariana aguda",
    "avc": "acidente vascular cerebral",
    "ave": "acidente vascular encefálico",
    "ait": "ataque isquêmico transitório",
    "tep": "tromboembolismo pulmonar",
    "tvp": "trombose venosa profunda",
    "tev": "tromboembolismo venoso",
    "dpoc": "doença pulmonar obstrutiva crônica",
    "cad": "cetoacidose diabética",
    "ehh": "estado hiperglicêmico hiperosmolar",
    "pcr": "parada cardiorrespiratória (ou proteína C reativa)",
    "rcp": "reanimação cardiopulmonar",
    "ira": "insuficiência renal aguda",
    "lra": "lesão renal aguda",
    "irc": "insuficiência renal crônica",
    "drc": "doença renal crônica",
    "itu": "infecção do trato urinário",
    "pac": "pneumonia adquirida na comunidade",
    "hda": "hemorragia digestiva alta",
    "hdb": "hemorragia digestiva baixa",
    "has": "hipertensão arterial sistêmica",
    "dm": "diabetes mellitus",
    "fa": "fibrilação atrial",
    "tce": "traumatismo cranioencefálico",
    "sdra": "síndrome do desconforto respiratório agudo",
    "vm": "ventilação mecânica",
    "vni": "ventilação não invasiva",
    "iot": "intubação orotraqueal",
    "isr": "intubação em sequência rápida",
    "eap": "edema agudo de pulmão",
    "hsa": "hemorragia subaracnóidea",
    "eme": "estado de mal epiléptico",
    "pam": "pressão arterial média",
    "bav": "bloqueio atrioventricular",
    "tsv": "taquicardia supraventricular",
    "tv": "taquicardia ventricular",
    "fv": "fibrilação ventricular",
    "aesp": "atividade elétrica sem pulso",
    "dva": "droga vasoativa",
    "atb": "antibiótico",
    "ivas": "infecção de vias aéreas superiores",
    "geca": "gastroenterite aguda",
    "tro": "terapia de reidratação oral",
    "sro": "sais de reidratação oral",
    "sf": "soro fisiológico",
    "sg": "soro glicosado",
    "kcl": "cloreto de potássio",
    "rn": "recém-nascido",
    "pic": "pressão intracraniana",
    "hic": "hipertensão intracraniana",
    "hnf": "heparina não fracionada",
    "hbpm": "heparina de baixo peso molecular",
    "aas": "ácido acetilsalicílico",
    "pep": "profilaxia pós-exposição",
    "tb": "tuberculose",
    "sbv": "suporte básico de vida",
    "sav": "suporte avançado de vida",
    "ecg": "eletrocardiograma",
    "tc": "tomografia computadorizada",
    "usg": "ultrassonografia",
    "gsa": "gasometria arterial",
    "civd": "coagulação intravascular disseminada",
    "shu": "síndrome hemolítico-urêmica",
    "irpa": "insuficiência respiratória aguda",
    "sirs": "síndrome da resposta inflamatória sistêmica",
    "qsofa": "quick SOFA sepse",
    "dhe": "distúrbio hidroeletrolítico",
    "ptt": "púrpura trombocitopênica trombótica",
    "pti": "púrpura trombocitopênica imune",
    "lmc": "leucemia mieloide crônica",
    "sta": "síndrome torácica aguda",
    "af": "anemia falciforme",
    "ttpa": "tempo de tromboplastina parcial ativada",
    "inr": "razão normalizada internacional",
    "rni": "razão normalizada internacional",
}

_RE = re.compile(r"[a-z0-9]+")


def expandir_siglas(q: str) -> str:
    """Acrescenta a expansão entre parênteses após cada sigla conhecida (uma vez)."""
    vistas: set[str] = set()

    def troca(m: re.Match) -> str:
        t = m.group(0)
        exp = SIGLAS.get(t.lower())
        if not exp or exp in vistas:
            return t
        vistas.add(exp)
        return f"{t} ({exp})"

    return _RE.sub(troca, q) if any(tok in SIGLAS for tok in _RE.findall(q.lower())) else q
