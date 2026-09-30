"""Genera docs/Cuestionario_Conocimiento_del_Agente.pdf a partir de docs/cuestionario/*.md.

Formato de los .md (texto plano, una instrucción por línea):
  @titulo: / @subtitulo: / @pie:   portada y pie de página (solo en el primer archivo)
  # Título                         sección nueva (salto de página)
  ## Subtítulo                     subsección
  Q: pregunta                      pregunta numerada con 2 renglones para responder
  Q3: pregunta                     igual, con 6 renglones
  T: a | b | c                     encabezado de tabla
  R: a | b | c                     fila (las celdas vacías quedan para escribir)
  - viñeta                         viñeta
  (otra línea)                     párrafo

Uso:  python scripts/cuestionario_pdf.py
"""

import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "docs" / "cuestionario"
SALIDA = RAIZ / "docs" / "Cuestionario_Conocimiento_del_Agente.pdf"

AZUL = colors.HexColor("#1f4e79")
GRIS = colors.HexColor("#6b7280")
LINEA = colors.HexColor("#9ca3af")
FONDO = colors.HexColor("#eef4fb")

base = getSampleStyleSheet()
ESTILO = {
    "titulo": ParagraphStyle("titulo", parent=base["Title"], fontSize=26, leading=30, textColor=AZUL, alignment=0),
    "subtitulo": ParagraphStyle("subtitulo", parent=base["Normal"], fontSize=13, leading=17, textColor=GRIS),
    "h1": ParagraphStyle("h1", parent=base["Heading1"], fontSize=16, leading=20, textColor=AZUL, spaceBefore=4, spaceAfter=8),
    "h2": ParagraphStyle("h2", parent=base["Heading2"], fontSize=12, leading=15, textColor=AZUL, spaceBefore=10, spaceAfter=4),
    "p": ParagraphStyle("p", parent=base["Normal"], fontSize=10, leading=14.5, alignment=TA_JUSTIFY, spaceAfter=6),
    "q": ParagraphStyle("q", parent=base["Normal"], fontSize=10, leading=13.5, leftIndent=26, firstLineIndent=-26, spaceBefore=6),
    "li": ParagraphStyle("li", parent=base["Normal"], fontSize=10, leading=14, leftIndent=14, firstLineIndent=-10, spaceAfter=3),
    "celda": ParagraphStyle("celda", parent=base["Normal"], fontSize=8.6, leading=11),
    "celdah": ParagraphStyle("celdah", parent=base["Normal"], fontSize=8.6, leading=11, textColor=colors.white, fontName="Helvetica-Bold"),
}


class Renglones(Flowable):
    """Renglones en blanco para escribir la respuesta a mano."""

    def __init__(self, cuantos, ancho):
        super().__init__()
        self.cuantos, self.ancho = cuantos, ancho

    def wrap(self, *_):
        return self.ancho, self.cuantos * 0.75 * cm + 2

    def draw(self):
        self.canv.setStrokeColor(LINEA)
        self.canv.setLineWidth(0.4)
        for i in range(self.cuantos):
            y = (self.cuantos - i - 1) * 0.75 * cm + 2
            self.canv.line(26, y, self.ancho, y)


def esc(texto):
    return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def leer():
    meta, cuerpo = {}, []
    for archivo in sorted(FUENTE.glob("*.md")):
        for linea in archivo.read_text(encoding="utf-8").splitlines():
            m = re.match(r"@(\w+):\s*(.*)", linea)
            if m:
                meta[m.group(1)] = m.group(2)
            else:
                cuerpo.append(linea.rstrip())
    return meta, cuerpo


def tabla(filas, ancho):
    n = len(filas[0])
    pesos = {3: [0.34, 0.46, 0.20], 4: [0.17, 0.43, 0.20, 0.20]}.get(n, [1 / n] * n)
    datos = []
    for i, fila in enumerate(filas):
        est = ESTILO["celdah"] if i == 0 else ESTILO["celda"]
        datos.append([Paragraph(esc(c) if c else "&nbsp;", est) for c in fila])
    t = Table(datos, colWidths=[ancho * p for p in pesos], repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), AZUL),
                ("GRID", (0, 0), (-1, -1), 0.4, LINEA),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 1), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 13),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, FONDO]),
            ]
        )
    )
    return t


def construir(meta, lineas, ancho):
    historia = [
        Spacer(1, 5 * cm),
        Paragraph(esc(meta.get("titulo", "Cuestionario")), ESTILO["titulo"]),
        Spacer(1, 0.5 * cm),
        Paragraph(esc(meta.get("subtitulo", "")), ESTILO["subtitulo"]),
        Spacer(1, 1 * cm),
        Paragraph("Nombre de quien responde: ______________________________", ESTILO["p"]),
        Paragraph("Fecha: ____________________", ESTILO["p"]),
        PageBreak(),
    ]
    numero, filas, primera = 0, [], True

    def cerrar_tabla():
        nonlocal filas
        if filas:
            historia.extend([tabla(filas, ancho), Spacer(1, 6)])
            filas = []

    for linea in lineas:
        if not linea.strip():
            continue
        cerrar = not linea.startswith(("T:", "R:"))
        if cerrar:
            cerrar_tabla()
        if linea.startswith("# "):
            if not primera:
                historia.append(PageBreak())
            primera = False
            historia.append(Paragraph(esc(linea[2:]), ESTILO["h1"]))
        elif linea.startswith("## "):
            historia.append(Paragraph(esc(linea[3:]), ESTILO["h2"]))
        elif re.match(r"Q\d?:", linea):
            renglones = 6 if linea.startswith("Q3:") else 2
            numero += 1
            texto = linea.split(":", 1)[1].strip()
            historia.append(
                KeepTogether(
                    [Paragraph(f"<b>{numero}.</b>&nbsp;&nbsp;{esc(texto)}", ESTILO["q"]), Renglones(renglones, ancho)]
                )
            )
        elif linea.startswith("T:"):
            filas = [[c.strip() for c in linea[2:].split("|")]]
        elif linea.startswith("R:"):
            filas.append([c.strip() for c in linea[2:].split("|")] + [""] * 4)
            filas[-1] = filas[-1][: len(filas[0])]
        elif linea.startswith("- "):
            historia.append(Paragraph("•&nbsp;&nbsp;" + esc(linea[2:]), ESTILO["li"]))
        else:
            historia.append(Paragraph(esc(linea), ESTILO["p"]))
    cerrar_tabla()
    return historia, numero


def main():
    meta, lineas = leer()
    pie = meta.get("pie", "")

    def decorar(canv, doc):
        canv.saveState()
        canv.setFont("Helvetica", 8)
        canv.setFillColor(GRIS)
        canv.drawString(2 * cm, 1.2 * cm, pie)
        canv.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Página {doc.page}")
        canv.restoreState()

    doc = BaseDocTemplate(
        str(SALIDA),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=meta.get("titulo", ""),
        author="VIP Laundry",
    )
    ancho = A4[0] - 4 * cm
    doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(2 * cm, 2 * cm, ancho, A4[1] - 4 * cm)], onPage=decorar)])
    historia, n = construir(meta, lineas, ancho)
    doc.build(historia)
    print(f"{SALIDA} · {n} preguntas")


if __name__ == "__main__":
    sys.exit(main())
