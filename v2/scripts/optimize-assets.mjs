import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const v2 = resolve(scriptDir, '..');
const repo = resolve(v2, '..');
const output = join(v2, 'assets', 'optimized');
const cli = join(repo, 'node_modules', '.bin', 'gltf-transform');

mkdirSync(join(output, 'studio'), { recursive: true });
mkdirSync(join(output, 'images'), { recursive: true });

function optimize(input, name, simplify = false) {
  const args = [
    'optimize', input, join(output, name),
    '--compress', 'meshopt',
    '--flatten', 'false',
    '--join', 'false',
    '--instance', 'false',
    '--palette', 'false',
    '--texture-compress', 'webp',
    '--texture-size', '2048'
  ];
  if (simplify) {
    args.push('--simplify', 'true', '--simplify-ratio', '0.5',
      '--simplify-error', '0.0001', '--simplify-lock-border', 'true');
  } else {
    args.push('--simplify', 'false');
  }
  execFileSync(cli, args, { cwd: repo, stdio: 'inherit' });
}

const sourceCar = join(v2, 'assets', 'models', 'ferrari-laferrari.glb');
optimize(sourceCar, 'ferrari-laferrari-full.v1.glb');
optimize(sourceCar, 'ferrari-laferrari-wide.v1.glb', true);

const studio = [
  ['camera/Camera_01_1k.gltf', 'camera.v1.glb'],
  ['sofa/sofa_02_1k.gltf', 'sofa.v1.glb'],
  ['laptop/classic_laptop_1k.gltf', 'laptop.v1.glb'],
  ['desk/metal_office_desk_1k.gltf', 'desk.v1.glb'],
  ['chair/modern_arm_chair_01_1k.gltf', 'chair.v1.glb']
];
for (const [input, name] of studio) {
  optimize(join(v2, 'assets', 'models', 'studio', input), join('studio', name));
}

const images = [
  ['references/laferrari-red-road.jpg', 'wall-art-road.v1.webp', 1600, 86],
  ['references/laferrari-red-monaco.jpg', 'wall-art-monaco.v1.webp', 1600, 86],
  ['references/laferrari-doors-open.jpg', 'gallery-laferrari.v1.webp', 1600, 88],
  ['references/laferrari-studio.png', 'laferrari-fallback.v1.webp', 1280, 86]
];
await Promise.all(images.map(async ([source, name, width, quality]) => {
  await sharp(join(v2, 'assets', source))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 6 })
    .toFile(join(output, 'images', name));
}));

copyFileSync(
  join(repo, 'node_modules', 'meshoptimizer', 'meshopt_decoder.js'),
  join(v2, 'lib', 'meshopt_decoder.v0.24.js')
);

console.log(`Optimized V2 assets written to ${output}`);
