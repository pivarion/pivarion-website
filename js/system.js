/* ═══════════════════════════════════════════════════════════════════════
   PIVARION · CONTENT
   This is the file to edit when the business changes. Everything visual is
   derived from it — bodies, orbits, labels, navigation, camera framing.

   Add a moon:      drop an object into any `children` array
   Add a sub-system: give that object its own non-empty `children`
   Add a mark:      put <name>.png in /marks and set `mark: '<name>'`

   Position is optional. Omit `at` and the body is placed automatically.
   ═══════════════════════════════════════════════════════════════════════ */

const SYSTEM = {
  id: 'root',
  name: 'PIVARION',
  subtitle: 'MAIN PLANET',
  radius: 5.0,
  surface: 'main',
  tint: 0x7f8797,
  mark: 'square',
  lights: true,
  children: [
    { id:'automation', name:'AUTOMATION', radius:2.30, surface:'cratered',  tint:0x6d7789, mark:'globe',    at:{x:-9.6, y: 4.9, z:3.2}, children:[] },
    { id:'media',      name:'MEDIA',      radius:2.20, surface:'weathered', tint:0x847b6e, mark:'aperture', at:{x: 9.8, y: 5.1, z:2.8},
      children:[
        { id:'auto',     name:'PIVARION AUTO',     radius:2.30, surface:'pale',      tint:0x79838f, mark:'auto',     children:[] },
        { id:'property',     name:'PIVARION PROPERTY',     radius:2.25, surface:'weathered', tint:0x7d8494, mark:'property',     children:[] },
        { id:'construction', name:'PIVARION CONSTRUCTION', radius:2.32, surface:'cratered',  tint:0x6f7887, mark:'construction', children:[] }
      ] },
    { id:'studio',     name:'STUDIO',     radius:2.35, surface:'basalt',    tint:0x565e6c, mark:'lens',     at:{x:-9.9, y:-4.6, z:3.4}, children:[] },
    { id:'edition',    name:'EDITION',    radius:2.28, surface:'pale',      tint:0x808a99, mark:'prism',    at:{x: 9.7, y:-4.8, z:3.0}, children:[] }
  ]
};

/* Surface archetypes. Bodies share these — a dozen moons cost the same
   memory as four, because only the small mark decal is unique. */
const ARCHETYPES = {
  main:      { seed:   7, density:0.85, maria:0.34, base: 96, bigness:1.15 },
  cratered:  { seed: 113, density:1.55, maria:0.16, base: 88, bigness:0.55 },
  weathered: { seed: 271, density:0.70, maria:0.40, base: 94, bigness:1.45 },
  basalt:    { seed: 439, density:0.45, maria:0.52, base: 82, bigness:1.80 },
  pale:      { seed: 617, density:1.15, maria:0.12, base:100, bigness:0.85 }
};

export { SYSTEM, ARCHETYPES };
