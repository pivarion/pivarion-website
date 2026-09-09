/**
 * Fold the LaFerrari's brake-disc and tail-light emission into the shot file.
 *
 *   node tools/add-vehicle-emission.mjs <shot.json>
 *
 * Both are pure functions of t on the page, driven through vehicle.js's
 * setHeat/setBrake, so they are recomputed here from the real cinematic track
 * rather than sampled — no browser needed. Material names come straight from
 * the model, matching the patterns vehicle.js classifies on.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const track = require('../v2/js/cinematic-track.js');

const file = process.argv[2];
const shot = JSON.parse(readFileSync(file, 'utf8'));

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a || 1e-6), 0, 1); return t * t * (3 - 2 * t); };
// experience.v1.js: peak on the brakes, then an ember alive through the macro
const heatAt = t => clamp(sstep(0.355, 0.470, t) * (1 - 0.66 * sstep(0.500, 0.665, t))
                                                 * (1 - sstep(0.720, 0.810, t)), 0, 1);

for (const fr of shot.frames) {
  const heat = heatAt(fr.t), brake = track.brakeAt(fr.t);
  fr.veh = { heat: +heat.toFixed(5), brake: +brake.toFixed(5),
             disc: +(heat * 0.08).toFixed(5),        // vehicle.js setHeat
             tail: +(0.65 + brake * 1.4).toFixed(5) }; // vehicle.js setBrake
}
// the patterns vehicle.js uses to classify them, for the Blender side
shot.rig.vehicleEmission = {
  disc: '^disc\\.', tail: '^(tail_lights|break_lights\\.001|red_light)$',
  discColour: 0xad2708
};
writeFileSync(file, JSON.stringify(shot));
const peak = shot.frames.reduce((a, f) => f.veh.disc > a.veh.disc ? f : a);
console.log(`disc emission peaks ${peak.veh.disc.toFixed(4)} at t=${peak.t.toFixed(3)}`);
const tb = shot.frames.reduce((a, f) => f.veh.tail > a.veh.tail ? f : a);
console.log(`tail emission peaks ${tb.veh.tail.toFixed(3)} at t=${tb.t.toFixed(3)}`);
