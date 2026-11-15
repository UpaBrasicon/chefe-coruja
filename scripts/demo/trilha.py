"""Vídeo de venda (backlog comercial, item 8): trilha instrumental gerada por código.

Sem amostra de terceiros e sem direito autoral: tudo é sintetizado aqui
(pad de acordes, baixo, arpejo, bumbo e chimbal), em Lá menor, progressão
vi–IV–I–V (Am–F–C–G), 104 batidas por minuto. Quatro compassos de introdução
sem bateria, o miolo com bateria e um final que some.

Uso: python scripts/demo/trilha.py <segundos> <saida.wav>
Só a biblioteca padrão do Python.
"""
import math
import random
import struct
import sys
import wave

TAXA = 22050
BPM = 104
BATIDA = 60 / BPM
COMPASSO = 4 * BATIDA
ACORDES = [  # notas MIDI do pad (Am, F, C, G) e a fundamental do baixo
    ([57, 60, 64, 69], 45),
    ([53, 57, 60, 65], 41),
    ([48, 55, 60, 64], 36),
    ([55, 59, 62, 67], 43),
]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def bloco(com_bateria):
    """Quatro compassos (um por acorde), como lista de amostras."""
    n = int(4 * COMPASSO * TAXA)
    s = [0.0] * n
    rnd = random.Random(7)
    for k, (notas, baixo) in enumerate(ACORDES):
        ini = int(k * COMPASSO * TAXA)
        dur = int(COMPASSO * TAXA)
        # pad: três harmônicos por nota, ataque e soltura suaves
        for m in notas:
            f = hz(m)
            for i in range(dur):
                t = i / TAXA
                env = min(1.0, t / 0.6) * min(1.0, (COMPASSO - t) / 0.5)
                v = math.sin(2 * math.pi * f * t) + 0.35 * math.sin(4 * math.pi * f * t) + 0.12 * math.sin(6 * math.pi * f * t)
                s[ini + i] += 0.035 * env * v
        # baixo: colcheias pulsadas
        fb = hz(baixo)
        for b in range(8):
            o = ini + int(b * BATIDA / 2 * TAXA)
            for i in range(int(BATIDA / 2 * TAXA)):
                t = i / TAXA
                env = math.exp(-t * 6)
                s[o + i] += 0.16 * env * (math.sin(2 * math.pi * fb * t) + 0.3 * math.sin(4 * math.pi * fb * t))
        # arpejo: semicolcheias nas notas do acorde, uma oitava acima
        arp = [notas[0] + 12, notas[1] + 12, notas[2] + 12, notas[3] + 12, notas[2] + 12, notas[1] + 12]
        for b in range(16):
            o = ini + int(b * BATIDA / 4 * TAXA)
            f = hz(arp[b % len(arp)])
            for i in range(int(BATIDA / 4 * TAXA)):
                t = i / TAXA
                s[o + i] += 0.05 * math.exp(-t * 14) * math.sin(2 * math.pi * f * t)
        if com_bateria:
            for b in range(4):
                o = ini + int(b * BATIDA * TAXA)
                # bumbo: senoide que desce de 110 para 45 Hz
                fase = 0.0
                for i in range(int(0.22 * TAXA)):
                    t = i / TAXA
                    f = 45 + 65 * math.exp(-t * 30)
                    fase += 2 * math.pi * f / TAXA
                    s[o + i] += 0.45 * math.exp(-t * 14) * math.sin(fase)
                # chimbal no contratempo
                o2 = o + int(BATIDA / 2 * TAXA)
                for i in range(int(0.05 * TAXA)):
                    t = i / TAXA
                    s[o2 + i] += 0.05 * math.exp(-t * 90) * (rnd.random() * 2 - 1)
    return s


def main():
    segundos = float(sys.argv[1])
    saida = sys.argv[2]
    intro, miolo = bloco(False), bloco(True)
    total = int(segundos * TAXA)
    s = list(intro)
    while len(s) < total:
        s.extend(miolo)
    s = s[:total]
    fim = int(3.0 * TAXA)  # some nos últimos 3 s
    for i in range(fim):
        s[total - fim + i] *= 1 - i / fim
    pico = max(abs(x) for x in s) or 1.0
    with wave.open(saida, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(b''.join(struct.pack('<h', int(32767 * 0.89 * x / pico)) for x in s))
    print(f'Trilha: {saida} ({segundos:.1f} s)')


if __name__ == '__main__':
    main()
