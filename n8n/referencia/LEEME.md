# Workflows de referencia (NO se despliegan)

Estos dos JSON son del otro negocio del dueño, **321 Soluciones Inmobiliarias**.
Están aquí como **base a clonar y adaptar**, no para ejecutarse.

| Archivo | Qué es |
|---|---|
| `iAgente-321-INMO-V2.json` | El agente que ya funciona en producción. 80 nodos. Es la plantilla de la que sale el de Lavandería VIP |
| `Meta-Referral-Capture.json` | Captura el `referral` de los anuncios Click-to-WhatsApp y lo guarda en `meta_referrals`. Es el patrón para cuando haya número real |

**No modifiques estos archivos ni los workflows originales en n8n.** El triaje
acordado —qué se queda, qué se adapta y qué se borra— está en
[`../../docs/CONTINUIDAD.md`](../../docs/CONTINUIDAD.md), sección 3.

En su n8n los originales son `kdtUTHuszghCNPQ1` (agente) y `Mduk8hFNjpJXx5H1`
(referral). Se leen, nunca se escriben.
