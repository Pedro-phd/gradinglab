"""Gera LUTs criativas (.cube 33 pontos, entrada e saída Rec.709) a partir de receitas paramétricas."""
import os, sys
import numpy as np

N = 33
LUMA = np.array([0.2126, 0.7152, 0.0722])


def luma(x):
    return x @ LUMA


def to_hsv(x):
    mx, mn = x.max(-1), x.min(-1)
    d = mx - mn
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-9
    rc = m & (mx == r)
    gc = m & (mx == g) & ~rc
    bc = m & ~rc & ~gc
    h[rc] = ((g - b)[rc] / d[rc]) % 6
    h[gc] = (b - r)[gc] / d[gc] + 2
    h[bc] = (r - g)[bc] / d[bc] + 4
    s = np.where(mx > 1e-9, d / np.maximum(mx, 1e-9), 0)
    return h * 60, s, mx


def from_hsv(h, s, v):
    h = (h % 360) / 60
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros(h.shape + (3,))
    for k, (a, b, c) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k
        out[m] = np.stack([a[m], b[m], c[m]], -1)
    return out


def curve(v, c, pivot):
    v = np.clip(v, 0, 1)
    lo = pivot * (v / pivot) ** c
    hi = 1 - (1 - pivot) * ((1 - v) / (1 - pivot)) ** c
    return np.where(v < pivot, lo, hi)


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def tint(rgb):
    """Cor de tonalização com luma zero, para não mexer no brilho."""
    t = np.array(rgb, float)
    return t - t @ LUMA


def apply(x, p):
    x = x * np.array(p.get("wb", (1, 1, 1)))
    if p.get("ev"):
        x = (np.clip(x, 0, None) ** 2.2 * 2 ** p["ev"]) ** (1 / 2.2)
    x = np.clip(x, 0, 1) ** p.get("gam", 1)  # gam > 1 escurece meios-tons sem derrubar o branco

    if p.get("hues"):
        h, s, v = to_hsv(x)
        for center, width, dh, ds, dv in p["hues"]:
            d = np.abs((h - center + 180) % 360 - 180)
            w = np.where(d < width, 0.5 + 0.5 * np.cos(np.pi * d / width), 0) * smooth(0.04, 0.25, s)
            h = h + dh * w
            s = np.clip(s * (1 + (ds - 1) * w), 0, 1)
            v = np.clip(v * (1 + (dv - 1) * w), 0, 1)
        x = from_hsv(h, s, v)

    y = luma(x)[..., None]
    chroma = x - y
    cur_sat = np.abs(chroma).max(-1, keepdims=True)
    s = p.get("sat", 1) * (1 + p.get("vib", 0) * (1 - np.clip(cur_sat * 2.5, 0, 1)))
    s = s * (1 - p.get("hi_desat", 0) * smooth(0.6, 1, y)) * (1 - p.get("lo_desat", 0) * (1 - smooth(0, 0.35, y)))
    if "keep" in p:  # matiz que escapa da saturação global (ex.: só o vermelho do neon fica)
        center, width, keep_s = p["keep"]
        h0, s0, _ = to_hsv(x)
        d = np.abs((h0 - center + 180) % 360 - 180)
        w = (np.where(d < width, 0.5 + 0.5 * np.cos(np.pi * d / width), 0) * smooth(0.1, 0.35, s0))[..., None]
        s = s * (1 - w) + keep_s * w
    x = np.clip(y + chroma * s, 0, 1)

    c, pivot, mix = p.get("con", 1), p.get("pivot", 0.42), p.get("chan", 0.5)
    y = luma(x)[..., None]
    y2 = curve(y, c, pivot)
    by_luma = x * np.where(y > 1e-6, y2 / np.maximum(y, 1e-6), 1)
    x = np.clip(mix * curve(x, c, pivot) + (1 - mix) * by_luma, 0, 1)

    y = luma(x)[..., None]
    for key, mask in (("sh", (1 - y) ** 2.2), ("mid", 4 * y * (1 - y)), ("hi", y ** 1.8)):
        if key in p:
            col, amt = p[key]
            x = x + tint(col) * amt * mask
    lift, white = p.get("lift", 0), p.get("white", 1)
    x = np.array(lift) + (white - np.array(lift)) * np.clip(x, 0, 1)
    return np.clip(x, 0, 1)


TEAL, AMBER, ORANGE = (0.0, 0.55, 0.6), (1.0, 0.62, 0.2), (1.0, 0.45, 0.1)
# (centro do matiz, largura, giro de matiz, saturação x, brilho x)
LOOKS = {
    # --- Cinematic
    "cine-ambar": dict(nome="Cine Âmbar", grupo="Cinemático",
        nota="Escuro e contido, luzes âmbar e pretos levemente lavados. Na linha do Cinematic deles.",
        ev=-1.0, con=1.2, sat=0.88, white=0.84, lift=(0.04, 0.036, 0.032), hi=(AMBER, 0.13), mid=(AMBER, 0.04), sh=((0.3, 0.5, 0.45), 0.05),
        hues=[(35, 45, -4, 1.12, 1.0), (100, 60, -12, 0.7, 0.95)], hi_desat=0.25),
    "teal-laranja": dict(nome="Teal & Laranja", grupo="Cinemático",
        nota="O clássico de cinema: sombras e neutros puxados para o azul-esverdeado, doces e caramelo quentes.",
        ev=-0.7, con=1.3, sat=1.08, sh=(TEAL, 0.2), mid=(TEAL, 0.07), hi=(ORANGE, 0.08), white=0.93,
        hues=[(30, 45, -5, 1.25, 1.0), (120, 70, 35, 0.75, 0.95), (220, 60, -18, 0.9, 1.0)]),
    "print-2383": dict(nome="Print 2383", grupo="Cinemático",
        nota="Inspirado na cópia de cinema Kodak 2383: contraste forte, vermelhos densos, sombras frias, luzes quentes.",
        ev=-0.75, con=1.42, chan=0.8, sat=0.98, pivot=0.4, sh=((0.1, 0.45, 0.6), 0.13), hi=((1.0, 0.75, 0.4), 0.11),
        white=0.93, lift=(0.012, 0.014, 0.018), hi_desat=0.35,
        hues=[(5, 35, 4, 1.15, 0.9), (40, 35, -6, 1.1, 0.97), (120, 70, 18, 0.7, 0.9), (230, 60, -10, 0.8, 0.9)]),
    "bleach": dict(nome="Bleach Bypass", grupo="Cinemático",
        nota="Processo sem branqueamento: prateado, pouca cor e muito contraste. Deixa a mesa com cara de editorial.",
        ev=-0.6, con=1.6, chan=0.2, sat=0.42, sh=((0.4, 0.5, 0.6), 0.05), white=0.95,
        hues=[(30, 45, 0, 1.2, 1.0)]),
    "luz-de-vela": dict(nome="Luz de Vela", grupo="Cinemático",
        nota="Jantar à luz de vela: bem escuro, sombras profundas e tudo banhado em laranja.",
        ev=-1.45, wb=(1.1, 1.0, 0.74), con=1.3, sat=1.0, hi=(ORANGE, 0.16), mid=(ORANGE, 0.06), sh=((0.5, 0.25, 0.1), 0.05), white=0.88,
        hues=[(100, 70, -25, 0.6, 0.9), (220, 70, 0, 0.5, 0.85)]),
    "verde-cine": dict(nome="Verde Cine", grupo="Cinemático",
        nota="Sombras esverdeadas de filme de suspense, com as luzes mantendo o creme quente.",
        ev=-0.9, con=1.25, sat=0.8, sh=((0.1, 0.6, 0.35), 0.2), mid=((0.2, 0.6, 0.35), 0.09), hi=((1.0, 0.8, 0.5), 0.09),
        white=0.9, lift=(0.02, 0.03, 0.025), hues=[(30, 40, 4, 1.1, 1.0), (350, 40, 8, 0.9, 0.95)]),
    # --- Social
    "ouro": dict(nome="Ouro", grupo="Social",
        nota="Laranjas e caramelos explodindo, neutros frios. Na linha do PF GOLD deles.",
        ev=-0.5, con=1.3, sat=1.18, vib=0.3, sh=((0.1, 0.5, 0.65), 0.16), mid=((0.2, 0.5, 0.6), 0.08), hi=((0.5, 0.75, 0.8), 0.04),
        hues=[(32, 40, -12, 1.5, 1.0), (55, 30, -14, 1.3, 1.0), (5, 30, 6, 1.2, 0.95), (120, 70, 20, 0.8, 0.95)]),
    "prata": dict(nome="Prata", grupo="Social",
        nota="Versão fria: brancos azulados, laranja virando rosado. Na linha do PF SILVER deles.",
        ev=-0.5, wb=(0.93, 1.0, 1.12), con=1.25, sat=0.92, sh=((0.2, 0.4, 0.7), 0.14), mid=((0.3, 0.45, 0.7), 0.05), hi=((0.75, 0.85, 1.0), 0.05),
        hues=[(32, 45, -16, 0.95, 0.98), (55, 30, -10, 0.8, 1.0), (120, 70, 30, 0.7, 0.95)]),
    "pop-doce": dict(nome="Pop Doce", grupo="Social",
        nota="Vitrine de confeitaria: claro, saturado e limpo, para o doce saltar no feed.",
        ev=-0.1, con=1.22, sat=1.3, vib=0.45, pivot=0.45, hi=((1.0, 0.92, 0.8), 0.03),
        hues=[(5, 30, 0, 1.2, 1.0), (40, 40, -4, 1.15, 1.02), (100, 60, 0, 1.15, 1.0)]),
    # --- Clean
    "creme": dict(nome="Creme", grupo="Limpo",
        nota="Quente e macio, com cara de creme de confeiteiro. Na linha do Ayla deles.",
        ev=-0.6, wb=(1.05, 1.0, 0.88), con=1.1, sat=1.05, hi=((1.0, 0.8, 0.5), 0.08), sh=((0.5, 0.35, 0.25), 0.03),
        lift=(0.03, 0.027, 0.022), white=0.94, hues=[(35, 45, -5, 1.15, 1.0), (100, 60, -10, 0.85, 1.0)]),
    "claro": dict(nome="Claro e Arejado", grupo="Limpo",
        nota="Café da manhã: brancos limpos, sombras abertas, cor natural.",
        ev=0.0, wb=(0.99, 1.0, 1.02), con=0.96, sat=1.04, vib=0.2, pivot=0.5, lift=0.03, hi_desat=0.2),
    "mel": dict(nome="Mel", grupo="Limpo",
        nota="Natural com um banho dourado: amarelos virando mel, contraste médio.",
        ev=-0.45, wb=(1.07, 1.0, 0.82), con=1.2, sat=1.1, hi=((1.0, 0.78, 0.35), 0.1),
        hues=[(55, 35, -12, 1.2, 1.0), (30, 35, -3, 1.15, 1.0), (120, 60, -15, 0.8, 0.97)]),
    # --- Filme
    "portra": dict(nome="Negativo Portra", grupo="Filme",
        nota="Negativo colorido: pastel, sombras abertas, contraste baixo e verdes puxando para o ciano.",
        ev=-0.3, con=1.0, sat=0.9, vib=0.25, lift=(0.045, 0.045, 0.04), white=0.96, hi=((1.0, 0.85, 0.65), 0.04),
        sh=((0.3, 0.55, 0.5), 0.04), hi_desat=0.3, hues=[(120, 70, 28, 0.8, 1.0), (30, 40, 3, 1.05, 1.02), (5, 30, 8, 0.95, 1.0)]),
    "cromo": dict(nome="Cromo", grupo="Filme",
        nota="Slide dos anos 70: cor densa e profunda, vermelhos ricos, pretos fechados.",
        ev=-0.65, con=1.4, chan=0.9, sat=1.15, pivot=0.4, sh=((0.15, 0.3, 0.6), 0.1), hi=((1.0, 0.85, 0.6), 0.03),
        hues=[(5, 35, -2, 1.25, 0.88), (40, 35, -3, 1.15, 0.95), (120, 60, 8, 0.9, 0.85), (230, 60, 0, 1.1, 0.85)]),
    "fade-vintage": dict(nome="Fade Vintage", grupo="Filme",
        nota="Foto de álbum antigo: pretos lavados puxando para o magenta, luzes amareladas, cor apagada.",
        ev=-0.4, con=0.95, sat=0.72, lift=(0.11, 0.08, 0.1), white=0.9, hi=((1.0, 0.9, 0.45), 0.12), sh=((0.6, 0.3, 0.6), 0.09),
        hues=[(120, 70, -20, 0.75, 1.0)]),
    "mocha": dict(nome="Mocha", grupo="Filme",
        nota="Quase sépia: tudo em tons de café e chocolate, pouca cor e contraste suave.",
        ev=-0.8, con=1.2, sat=0.4, wb=(1.06, 1.0, 0.86), sh=((0.5, 0.3, 0.15), 0.1), mid=((0.6, 0.4, 0.2), 0.08),
        hi=((1.0, 0.82, 0.6), 0.06), white=0.92, lift=(0.03, 0.025, 0.02), hues=[(30, 45, 0, 1.3, 1.0)]),
}


def write_cube(path, title, table):
    with open(path, "w") as f:
        f.write(f'TITLE "{title}"\nLUT_3D_SIZE {N}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        f.write("\n".join("%.6f %.6f %.6f" % tuple(v) for v in table) + "\n")


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    g = np.linspace(0, 1, N)
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")  # vermelho varia mais rápido
    grid = np.stack([r, gg, b], -1).reshape(-1, 3)
    for key, p in LOOKS.items():
        write_cube(os.path.join(out, f"GradingLab {p['nome']}.cube"), f"GradingLab {p['nome']}", apply(grid, p))
    print(len(LOOKS), "LUTs")
