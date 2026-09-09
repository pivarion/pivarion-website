#!/usr/bin/env bash
# Assemble the rendered frames into deliverable video.
#
#   tools/make-video.sh <framesdir> <outdir> [fps]
#
# Two files come out: an H.264 MP4 that plays anywhere, and a near-lossless
# CRF 12 master to cut from. The PNG sequence stays on disk either way — it
# is the real deliverable, and both of these are derived from it.
set -euo pipefail
FRAMES="${1:?frames dir}"
OUT="${2:?out dir}"
FPS="${3:-24}"
mkdir -p "$OUT"

n=$(ls "$FRAMES"/pv_*.png 2>/dev/null | wc -l)
[ "$n" -gt 0 ] || { echo "no frames in $FRAMES" >&2; exit 1; }
echo "$n frames at ${FPS}fps -> $(echo "scale=1; $n/$FPS" | bc)s"

common=(-y -framerate "$FPS" -pattern_type glob -i "$FRAMES/pv_*.png")

# delivery: yuv420p so it plays on phones and in browsers
ffmpeg "${common[@]}" -c:v libx264 -preset slow -crf 18 \
  -pix_fmt yuv420p -movflags +faststart -r "$FPS" \
  "$OUT/pivarion-shot.mp4" -loglevel error -stats

# master: keep the highs for grading or re-encoding
ffmpeg "${common[@]}" -c:v libx264 -preset slow -crf 12 \
  -pix_fmt yuv444p -r "$FPS" \
  "$OUT/pivarion-shot-master.mp4" -loglevel error -stats

ls -la "$OUT"/*.mp4
