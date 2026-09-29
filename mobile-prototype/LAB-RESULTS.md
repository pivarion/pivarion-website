# Prototype lab results — September 29, 2026

Functional checks in Codex's Chromium browser on this Mac. These are **not physical-phone measurements**. Samples served locally, without network throttling. The close-up was checked at a 390×844 viewport; early opening measurements also used the desktop viewport. Do not compare these as a device benchmark.

| Sample / encoding | Sample bytes | Presented updates | p95 target-to-frame | Stalls |
| --- | ---: | ---: | ---: | ---: |
| Opening / independent frames, initial run | 3,352,458 | 180 | 26.5 ms | 0 |
| Opening / six-frame groups, corrected scheduler | 1,679,141 | 180 | 18.3 ms | 0 |
| Wheel / six-frame groups | 2,601,354 | 180 | 20.1 ms | 0 |
| Wheel / independent frames | 5,121,526 | 180 | 17.9 ms | 0 |

The initial six-frame test stalled at a target of 0.041666667 seconds: the browser rounded to 0.041666 and retained frame zero, so no new-frame callback fired. The scheduler now seeks to the middle of the requested frame interval. Rerun completed with no stalls.

Wheel six-frame compression versus the lossless source PNG sequence: mean FFmpeg SSIM 0.992856, after converting the reference to YUV420P. This supports encoding fidelity only; it is not human approval of the entire site, a colour calibration, or a phone-performance guarantee.

Verified all MP4s have their metadata before media data; media sizes match the manifest; local entry references exist; the prototype page includes no Three.js, GLTF loader, Meshopt decoder, or model requests. Browser resource entries during the successful close-up test showed only fonts, HTML support files, stills and the chosen MP4s. No long tasks were reported during that particular synthetic close-up run.

## Gate status

**Pending:** physical iPhone Safari, Android, Low Power Mode, cold network at 10 Mbps / 100 ms, visual approval, landscape, full sequence and chapter transitions. No production replacement or complete-mobile acceptance is claimed.

The isolated preview branch changes `vercel.json` to serve only this test directory. **Do not merge that preview configuration into production.** Continue production integration only after the physical-device gate passes.
