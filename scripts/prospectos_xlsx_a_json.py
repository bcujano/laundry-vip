"""Convierte la hoja de ProspectorVIP a JSON para `pnpm db:prospectos`.

    python scripts/prospectos_xlsx_a_json.py "C:/ruta/ProspectorVIP LAUNDRY.xlsx" prospectos.json

Es un convertidor tonto a propósito: NO filtra segmentos ni normaliza teléfonos (eso lo hace
scripts/prospectos-datos.ts, que tiene pruebas). Solo deja fuera las columnas que el dueño declaró
inconsistentes o que traen datos de otra empresa:

  - «WhatsApp»: 14 filas no coinciden con el teléfono y varias son de una página de Linktree.
  - «Facebook», «LinkedIn», «TikTok»: en las filas con sitio de Linktree el scraper devolvió las
    redes de Linktree, no las del negocio.
  - «Horarios», «Canales verificados», «Procedencia de los datos»: no se usan.

Necesita openpyxl (pip install openpyxl). La primera columna de la hoja no tiene encabezado ni
significado: se ignora.
"""
import json
import sys

import openpyxl

ENCABEZADOS = {
    "#": "numero",
    "Nombre": "nombre",
    "Dirección": "direccion",
    "Teléfono": "telefono",
    "Emails": "emails",
    "Website": "website",
    "Instagram": "instagram",
    "Rating": "rating",
    "Reviews": "reviews",
    "Segmentos": "segmentos",
    "Google Maps": "google_maps",
}


def main(origen: str, destino: str) -> None:
    hoja = openpyxl.load_workbook(origen, data_only=True).active
    filas = list(hoja.iter_rows(values_only=True))
    encabezados = list(filas[0])

    salida = []
    for fila in filas[1:]:
        if not any(valor not in (None, "") for valor in fila):
            continue
        registro = dict(zip(encabezados, fila))
        salida.append({clave: registro.get(titulo) for titulo, clave in ENCABEZADOS.items()})

    with open(destino, "w", encoding="utf-8") as archivo:
        json.dump(salida, archivo, ensure_ascii=False, indent=1)
    print(f"{len(salida)} filas escritas en {destino}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
