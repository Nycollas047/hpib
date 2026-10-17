#!/usr/bin/env python3
"""Desenha docs/mapa-analise.png a partir de docs/analise-mapa.json (rodar antes: npm run analise)."""
import json, pathlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

root = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((root / "docs/analise-mapa.json").read_text())
antes = json.loads((root / "docs/analise-antes.json").read_text())
m = d["_mapa"]

INK, MUTED, SURF, GRID = "#0b0b0b", "#52514e", "#fcfcfb", "#e3e2de"
ZONE = {  # zona -> (cor, marcador, rótulo); marcador diferente = não depende só de cor
    "road": ("#2a78d6", "o", "estrada"),
    "risk": ("#eb6834", "^", "perto do trilho"),
    "hill": ("#1baf7a", "s", "encosta"),
    "open": ("#6250d6", "D", "campo aberto"),
}

fig, (ax, bx) = plt.subplots(1, 2, figsize=(13.5, 6.4), gridspec_kw={"width_ratios": [1.15, 1]}, facecolor=SURF)
for a in (ax, bx):
    a.set_facecolor(SURF)
    for s in a.spines.values():
        s.set_color(GRID)
    a.tick_params(colors=MUTED, labelsize=9)

# ---- Mapa ----
half = d["config"]["world"] / 2
ax.set_xlim(-half, half); ax.set_ylim(-half, half); ax.set_aspect("equal")
ax.grid(color=GRID, lw=0.6)
ax.scatter([p[0] for p in m["props"] if p[2] in ("pine", "oak")], [p[1] for p in m["props"] if p[2] in ("pine", "oak")],
           s=3, color="#b9b8b0", lw=0, zorder=1)
ax.scatter([p[0] for p in m["props"] if p[2] == "house"], [p[1] for p in m["props"] if p[2] == "house"], s=26, marker="s", color="#9b9a92", zorder=1)
rl, tl = m["roadLine"], m["railLine"]
ax.plot([p[0] for p in tl], [p[1] for p in tl], color="#7a5a3a", lw=1.6, ls=(0, (4, 2)), zorder=2)
ax.plot([p[0] for p in rl], [p[1] for p in rl], color="#3a3d44", lw=3.2, zorder=2)
for c in m["crossings"]:
    ax.scatter(c["x"], c["z"], s=150, facecolor=SURF, edgecolor="#d63a2f", lw=2, zorder=4)
for pk in m["pickupsAI"]:
    ax.scatter(pk[0], pk[1], s=7, color=INK, alpha=0.35, lw=0, zorder=3)
for z, (col, mk, _) in ZONE.items():
    pts = [p for p in m["coinSpawns"] if p[3] == z]
    ax.scatter([p[0] for p in pts], [p[1] for p in pts], s=26, marker=mk, color=col, edgecolor=SURF, lw=0.6, zorder=5, alpha=0.95)
for p in m["stuck"]:
    ax.scatter(p[0], p[1], marker="x", s=60, color="#e34948", lw=2, zorder=6)
ax.set_title("Onde as moedas nascem agora (6 rodadas sobrepostas, mesmo mapa)", loc="left", fontsize=11, color=INK)
ax.set_xlabel("x (m)", color=MUTED); ax.set_ylabel("z (m)", color=MUTED)
leg = [Line2D([0], [0], marker=mk, color="none", markerfacecolor=col, markeredgecolor=SURF, markersize=8, label=lb) for col, mk, lb in ZONE.values()]
leg += [Line2D([0], [0], color="#3a3d44", lw=3, label="estrada"), Line2D([0], [0], color="#7a5a3a", lw=1.6, ls=(0, (4, 2)), label="trilho"),
        Line2D([0], [0], marker="o", color="none", markerfacecolor=SURF, markeredgecolor="#d63a2f", markeredgewidth=2, markersize=9, label="cruzamento (sinal)"),
        Line2D([0], [0], marker="o", color="none", markerfacecolor=INK, alpha=0.4, markersize=4, label="onde a IA pegou moeda"),
        Line2D([0], [0], marker="x", color="none", markeredgecolor="#e34948", markeredgewidth=2, markersize=7, label="IA ficou presa")]
ax.legend(handles=leg, loc="upper center", bbox_to_anchor=(0.5, -0.09), ncol=4, fontsize=8, frameon=False, labelcolor=MUTED)

# ---- Antes x depois: distância da estrada ----
bands = ["na estrada\n(até 3,8 m)", "3,8 a 10 m", "10 a 18 m", "mais de 18 m"]
before = [antes["moedas"]["faixaPct"]["estrada"], antes["moedas"]["faixaPct"]["perto_3_10"], antes["moedas"]["faixaPct"]["longe_10_18"], 0]
f = d["moedas"]["faixaPct"]
after = [f["estrada"], f["perto_3_10"], f["longe_10_18"], f["mais_de_18"]]
ys = range(len(bands))
h = 0.36
b1 = bx.barh([y + h / 2 for y in ys], before, height=h, color="#b9b8b0", label="antes")
b2 = bx.barh([y - h / 2 for y in ys], after, height=h, color="#2a78d6", label="depois")
for bars in (b1, b2):
    for r in bars:
        bx.text(r.get_width() + 1, r.get_y() + r.get_height() / 2, f"{r.get_width():.0f}%", va="center", fontsize=9, color=INK)
bx.set_yticks(list(ys)); bx.set_yticklabels(bands, fontsize=9, color=INK); bx.invert_yaxis()
bx.set_xlim(0, 62); bx.set_xlabel("% das moedas que nascem em cada faixa", color=MUTED)
bx.grid(axis="x", color=GRID, lw=0.6); bx.set_axisbelow(True)
bx.set_title("Distância da estrada: antes só 18 m de cada lado; agora o mapa todo", loc="left", fontsize=11, color=INK)
bx.legend(frameon=False, fontsize=9, labelcolor=MUTED, loc="lower right")
uso = d["geometria"]["usoDoMapaPct"]
bx.text(0, -0.2, f"Uso do mapa (medido): estrada {uso['estrada']}% · faixa de moedas antiga {uso['faixa_moedas']}% · "
        f"interior {uso['interior']}% · exterior {uso['exterior']}%", transform=bx.transAxes, fontsize=8.5, color=MUTED)
fig.tight_layout()
out = root / "docs/mapa-analise.png"
fig.savefig(out, dpi=140, facecolor=SURF)
print(out)
