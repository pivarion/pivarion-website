"""Trace the supplied Pivarion Auto raster mark into deterministic 3D shape data."""

from __future__ import annotations

import json
from pathlib import Path

import cv2


HERE = Path(__file__).resolve().parent
SOURCE = HERE / "demo-assets" / "logo-original.png"
OUTPUT = HERE / "demo-logo-data.js"


def normalized_points(contour, epsilon: float = 1.15) -> list[list[float]]:
    simplified = cv2.approxPolyDP(contour, epsilon, True)[:, 0, :]
    return [
        [round((int(x) - 240) / 120, 4), round((240 - int(y)) / 120, 4)]
        for x, y in simplified
    ]


image = cv2.imread(str(SOURCE), cv2.IMREAD_GRAYSCALE)
if image is None:
    raise SystemExit(f"Could not read {SOURCE}")

_, mask = cv2.threshold(image, 127, 255, cv2.THRESH_BINARY)
contours, hierarchy = cv2.findContours(
    mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
)
hierarchy = hierarchy[0]

components = []
for index, links in enumerate(hierarchy):
    if links[3] != -1:
        continue

    x, y, width, height = cv2.boundingRect(contours[index])
    child = links[2]
    holes = []
    while child != -1:
        holes.append(normalized_points(contours[child], 1.15))
        child = hierarchy[child][0]

    center_x = (x + width / 2 - 240) / 120
    center_y = (240 - (y + height / 2)) / 120
    components.append(
        {
            "kind": "core" if holes else "plate",
            "center": [round(center_x, 4), round(center_y, 4)],
            "outer": normalized_points(contours[index], 1.15),
            "holes": holes,
        }
    )

components.sort(
    key=lambda item: (
        0 if item["kind"] == "plate" else 1,
        -item["center"][1],
        item["center"][0],
    )
)

payload = json.dumps(components, separators=(",", ":"))
OUTPUT.write_text(
    "// Generated from demo-assets/logo-original.png; do not hand-edit.\n"
    f"window.PIVARION_LOGO_GEOMETRY={payload};\n",
    encoding="utf-8",
)
print(f"Wrote {OUTPUT.name} with {len(components)} components")
