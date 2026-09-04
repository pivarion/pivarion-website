"""Derive 3D outline data from the supplied raster. Never modify the source image.

Requires OpenCV and NumPy. This is a raster-derived mesh, not a vector master.
"""
from pathlib import Path
import hashlib
import json

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'assets/pivarion-logo-original.jpg'
gray = cv2.imread(str(source), cv2.IMREAD_GRAYSCALE)
_, mask = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY)
contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
hierarchy = hierarchy[0]
outlines = []
reconstructed = np.zeros_like(mask)
for index, contour in enumerate(contours):
    if hierarchy[index][3] != -1 or cv2.contourArea(contour) < 100:
        continue
    outer = cv2.approxPolyDP(contour, 0.65, True)
    holes = []
    child = hierarchy[index][2]
    while child != -1:
        holes.append(cv2.approxPolyDP(contours[child], 0.65, True))
        child = hierarchy[child][0]
    # Fill all paths together using even-odd fill, including the central void.
    cv2.drawContours(reconstructed, [outer, *holes], -1, 255, cv2.FILLED)
    outlines.append({'outer': outer[:, 0].tolist(), 'holes': [h[:, 0].tolist() for h in holes]})

intersection = np.count_nonzero((mask > 0) & (reconstructed > 0))
union = np.count_nonzero((mask > 0) | (reconstructed > 0))
iou = intersection / union
assert len(outlines) == 5, 'Expected four separate outer pieces and the central frame'
assert sum(len(o['holes']) for o in outlines) == 1, 'Expected one central opening'
assert iou > 0.995, f'Raster silhouette mismatch: {iou}'
x, y, width, height = cv2.boundingRect(cv2.findNonZero(mask))
data = {'bounds': [x, y, width, height], 'components': outlines}
output = '// Generated from PIVARION.JPG; do not hand-edit these source-derived contours.\n'
output += 'window.PIVARION_MARK_SOURCE = ' + json.dumps(data, separators=(',', ':')) + ';\n'
(ROOT / 'js/mark-outlines.js').write_text(output)
provenance = {
    'source': source.name,
    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'method': 'Threshold 128; OpenCV CCOMP contours; approximation tolerance 0.65 source pixels',
    'bounds': data['bounds'],
    'components': len(outlines),
    'holes': sum(len(o['holes']) for o in outlines),
    'threshold_silhouette_iou': round(iou, 8),
    'limitation': 'Raster-derived mesh; preserves source irregularities, not an original vector master.',
}
(ROOT / 'assets/logo-mesh-provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
print(json.dumps(provenance, indent=2))
