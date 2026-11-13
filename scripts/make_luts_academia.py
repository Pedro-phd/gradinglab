"""Looks de academia na linha do Dark Mode: escuros, secos, cor contida. Mesmo motor de looks/make_luts.py."""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from make_luts import apply, write_cube, N

CREME, PETRO, OLIVA, CIANO = (1.0, 0.9, 0.72), (0.0, 0.45, 0.5), (0.5, 0.6, 0.2), (0.1, 0.55, 0.8)
NEON = (358, 30, 0, 0.55, 0.85)   # doma o vermelho do neon
CAMISA = (140, 70, 28, 0.6, 0.9)  # verde da camisa vira petróleo apagado
PELE = (25, 35, 0, 1.25, 1.0)
G = "Na linha do Dark Mode"
LOOKS = {
    "dark-mode": dict(nome="Dark Mode", grupo=G,
        nota="O que você escolheu, aqui como referência para comparar com os outros.",
        ev=-0.1, gam=1.90, con=1.55, pivot=0.36, sat=0.72, sh=((0.3, 0.4, 0.55), 0.06), white=0.98, hi_desat=0.2),
    "breu": dict(nome="Breu", grupo=G,
        nota="Dark Mode mais fundo: o ambiente some no preto e só o que está na luz aparece.",
        ev=-0.1, gam=2.25, con=1.6, pivot=0.34, sat=0.6, sh=((0.3, 0.4, 0.5), 0.04), hi=(CREME, 0.05), white=0.97, hi_desat=0.25,
        hues=[NEON, PELE]),
    "petroleo": dict(nome="Petróleo", grupo=G,
        nota="Sombras azul-petróleo, pele quente e apagada, luzes creme. A camisa vira azul-esverdeado escuro.",
        ev=-0.1, gam=1.95, con=1.5, pivot=0.36, sat=0.6, sh=(PETRO, 0.14), mid=(PETRO, 0.04), hi=(CREME, 0.08), white=0.96, hi_desat=0.3,
        hues=[NEON, CAMISA, (25, 35, -3, 1.4, 1.0)]),
    "oliva-35": dict(nome="Oliva 35mm", grupo=G,
        nota="Tinta verde-oliva de filme vencido: pretos levemente lavados e luzes amareladas.",
        ev=-0.1, gam=1.85, wb=(1.02, 1.02, 0.9), con=1.35, pivot=0.38, sat=0.5, sh=(OLIVA, 0.12), mid=(OLIVA, 0.07), hi=((1.0, 0.95, 0.65), 0.09),
        lift=(0.028, 0.034, 0.026), white=0.9, hi_desat=0.2, hues=[NEON, (140, 70, -10, 0.7, 0.9)]),
    "giz": dict(nome="Giz", grupo=G,
        nota="Quase sem cor, só um resto de calor na pele. Preto fechado, como foto de magnésio na mão.",
        ev=-0.1, gam=2.05, con=1.6, pivot=0.36, sat=0.3, sh=((0.3, 0.45, 0.4), 0.05), hi=(CREME, 0.05), white=0.97,
        hues=[NEON, (25, 35, 0, 1.7, 1.0)]),
    "aco-noturno": dict(nome="Aço Noturno", grupo=G,
        nota="Frio e duro: sombras azul-ciano, contraste alto, pele quase cinza.",
        ev=-0.1, gam=2.0, wb=(0.93, 1.0, 1.1), con=1.75, chan=0.7, pivot=0.36, sat=0.5, sh=(CIANO, 0.16), mid=(CIANO, 0.06), hi=((0.8, 0.92, 1.0), 0.05),
        white=0.98, hues=[NEON, (140, 70, 40, 0.8, 0.9)]),
    "creme-sombrio": dict(nome="Creme Sombrio", grupo=G,
        nota="Escuro neutro com luzes creme e pretos foscos. O mais suave do grupo.",
        ev=-0.1, gam=1.8, con=1.35, pivot=0.38, sat=0.55, sh=((0.35, 0.4, 0.4), 0.04), hi=(CREME, 0.12), mid=(CREME, 0.03),
        lift=(0.03, 0.03, 0.03), white=0.9, hi_desat=0.15, hues=[NEON, CAMISA, PELE]),
    "couro": dict(nome="Couro", grupo=G,
        nota="Marrom escuro de academia antiga: pele bronze, madeira quente, o resto apagado.",
        ev=-0.1, gam=1.95, wb=(1.05, 1.0, 0.86), con=1.5, pivot=0.36, sat=0.6, sh=((0.45, 0.3, 0.2), 0.07), hi=((1.0, 0.8, 0.5), 0.08), white=0.96,
        hues=[NEON, (140, 70, 0, 0.35, 0.85), (25, 35, -4, 1.35, 1.0)]),
    "chumbo": dict(nome="Chumbo", grupo=G,
        nota="Cinza-chumbo neutro e denso, sem tinta nenhuma. Dark Mode com menos cor ainda.",
        ev=-0.1, gam=1.95, con=1.6, pivot=0.36, sat=0.45, white=0.98, hi_desat=0.3, hues=[NEON]),
    "meia-noite": dict(nome="Meia-Noite", grupo=G,
        nota="Azul profundo nas sombras, pele ainda natural. Mais frio que o Dark Mode, menos duro que o Aço Noturno.",
        ev=-0.1, gam=2.0, con=1.5, pivot=0.36, sat=0.65, sh=((0.1, 0.3, 0.75), 0.15), mid=((0.2, 0.4, 0.7), 0.04), white=0.98, hi_desat=0.25,
        hues=[NEON, (140, 70, 35, 0.8, 0.9), PELE]),
    "musgo": dict(nome="Musgo", grupo=G,
        nota="Verde-escuro nas sombras e luzes quentes: clima de galpão com lâmpada fluorescente.",
        ev=-0.1, gam=1.95, con=1.5, pivot=0.36, sat=0.55, sh=((0.1, 0.5, 0.3), 0.13), mid=((0.2, 0.5, 0.3), 0.04), hi=((1.0, 0.95, 0.7), 0.07),
        white=0.96, hues=[NEON, PELE]),
    "bronze": dict(nome="Bronze", grupo=G,
        nota="Tudo dessaturado menos a pele, que fica bronze e definida. Realça músculo.",
        ev=-0.1, gam=1.9, con=1.65, pivot=0.37, sat=0.3, keep=(25, 32, 1.05), sh=((0.3, 0.4, 0.5), 0.05), white=0.98,
        hues=[(25, 32, -3, 1.1, 1.03)]),
}

for _k, _p in LOOKS.items():  # tinta mais forte e luzes mais cremosas que o Dark Mode original
    if _k == "dark-mode": continue
    for _t in ("sh", "mid", "hi"):
        if _t in _p: _p[_t] = (_p[_t][0], _p[_t][1] * 1.6)
    _p["white"] = min(_p["white"], 0.94)

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    g = np.linspace(0, 1, N)
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")
    grid = np.stack([r, gg, b], -1).reshape(-1, 3)
    for key, p in LOOKS.items():
        write_cube(os.path.join(out, f"GradingLab {p['nome']}.cube"), f"GradingLab {p['nome']}", apply(grid, p))
    print(len(LOOKS), "LUTs")
