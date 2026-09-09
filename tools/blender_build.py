#!/usr/bin/env python3.11
"""
Rebuild the front page's shot inside Blender and render it.

    python3.11 tools/blender_build.py <exportdir> <outdir> [--frames A:B]
                                      [--res 1920x1080] [--samples 64]
                                      [--engine CYCLES] [--save-blend]

The GLB carries geometry, materials and the movement. Everything glTF cannot
express — focal length, visibility, emission levels, the light rig, the fog —
comes from pivarion-shot.json, which is why both files are needed.

Coordinates: glTF is Y-up, Blender is Z-up, so world transforms are rotated
+90 degrees about X on the way in. Applying that same rotation to the camera's
quaternion is all the correction a camera needs — glTF and Blender cameras
both look down their local -Z, so once the world agrees, the framing does.
"""
import bpy, json, math, os, sys, time
from mathutils import Quaternion, Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
EXPORT  = argv[0] if len(argv) > 0 else 'export'
OUTDIR  = argv[1] if len(argv) > 1 else 'render'


def opt(flag, default=None):
    return argv[argv.index(flag) + 1] if flag in argv else default

RES_W, RES_H = (int(v) for v in opt('--res', '1920x1080').split('x'))
SAMPLES  = int(opt('--samples', '64'))
ENGINE   = opt('--engine', 'CYCLES')
RANGE    = opt('--frames')
SAVEBLEND = '--save-blend' in argv

shot = json.load(open(os.path.join(EXPORT, 'pivarion-shot.json')))
meta, rig, frames = shot['meta'], shot['rig'], shot['frames']
FPS, NF = meta['fps'], meta['frames']
print(f"shot: {NF} frames @ {FPS}fps  ({meta['seconds']:.1f}s)")

# glTF (Y-up) -> Blender (Z-up)
YUP = Quaternion((1, 0, 0), math.radians(90))
YUPM = YUP.to_matrix().to_4x4()
def vec(p):  return YUPM @ Vector(p)
def quat(q): return YUP @ Quaternion((q[3], q[0], q[1], q[2]))   # xyzw -> wxyz


# ══ scene ═════════════════════════════════════════════════════════════
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, NF

bpy.ops.import_scene.gltf(filepath=os.path.join(EXPORT, 'pivarion-scene.glb'))
print(f"imported {len(bpy.data.objects)} objects, {len(bpy.data.materials)} materials")

# The importer brings the glTF camera in too; the shot file drives ours.
for o in [o for o in bpy.data.objects if o.type == 'CAMERA']:
    bpy.data.objects.remove(o, do_unlink=True)


# ══ materials ═════════════════════════════════════════════════════════
def principled(mat):
    if not mat or not mat.use_nodes:
        return None
    return next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)

def setv(node, name, value):
    if node and name in node.inputs:
        node.inputs[name].default_value = value

for mat in bpy.data.materials:
    b = principled(mat)
    if not b:
        continue
    base = b.inputs['Base Color'].default_value
    dark = (base[0] + base[1] + base[2]) / 3 < 0.02
    rough = b.inputs['Roughness'].default_value
    metal = b.inputs['Metallic'].default_value

    # glTF blend mode makes the glass a hole; it wants to be a dark mirror
    if mat.blend_method != 'OPAQUE' and dark:
        mat.blend_method = 'OPAQUE'
        setv(b, 'Alpha', 1.0)
        setv(b, 'Roughness', 0.04)
        setv(b, 'Coat Weight', 1.0)
        setv(b, 'Coat Roughness', 0.02)

    # the paint: a clearcoat over a near-black metallic base
    if dark and metal > 0.5 and rough < 0.25:
        setv(b, 'Coat Weight', 1.0)
        setv(b, 'Coat Roughness', 0.03)

    # everything the page lit with an IBL wants a little less bite in Cycles
    if metal > 0.9 and rough < 0.2:
        setv(b, 'Roughness', max(0.08, rough))

def by_role(role):
    """Materials exported as PV_<role>; Blender suffixes duplicates."""
    return [m for m in bpy.data.materials if m.name.split('.')[0] == 'PV_' + role]

def mat_of(obj_name):
    o = bpy.data.objects.get(obj_name)
    return [s.material for s in o.material_slots if s.material] if o else []

# Cycles puts real light on surfaces the page only ever showed in silhouette,
# so the darks are set here rather than inherited from the web material.
for m in by_role('rubber'):
    setv(principled(m), 'Base Color', (0.010, 0.010, 0.011, 1))
    setv(principled(m), 'Roughness', 0.92)
for m in by_role('plinth'):
    setv(principled(m), 'Base Color', (0.012, 0.014, 0.019, 1))
for m in mat_of('PV_Floor'):
    b = principled(m)
    setv(b, 'Base Color', (0.006, 0.008, 0.013, 1))
    setv(b, 'Metallic', 0.55)
for m in by_role('pad'):
    setv(principled(m), 'Base Color', (0.020, 0.017, 0.014, 1))

MAT = {m.name: m for m in bpy.data.materials}


def find(prefix):
    return [o for o in bpy.data.objects if o.name.startswith(prefix)]


# ══ camera ════════════════════════════════════════════════════════════
cam_data = bpy.data.cameras.new('PV_Camera')
cam_data.sensor_fit = 'VERTICAL'
cam_data.sensor_height = 24.0
cam_data.clip_start, cam_data.clip_end = 0.02, 500.0
cam = bpy.data.objects.new('PV_Camera', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.rotation_mode = 'QUATERNION'

def lens_for(fov_deg):
    """three.js fov is the vertical angle, so a vertical-fit sensor maps 1:1."""
    return (cam_data.sensor_height / 2) / math.tan(math.radians(fov_deg) / 2)

for fr in frames:
    f = fr['f'] + 1
    cam.location = vec(fr['cam']['p'])
    cam.rotation_quaternion = quat(fr['cam']['q'])
    cam.keyframe_insert('location', frame=f)
    cam.keyframe_insert('rotation_quaternion', frame=f)
    cam_data.lens = lens_for(fr['cam']['fov'])
    cam_data.keyframe_insert('lens', frame=f)

# the shot was authored as a camera move, not a stepped one
for act in (cam.animation_data.action, cam_data.animation_data.action):
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
print('camera: %d keys, lens %.1f-%.1fmm' % (
    NF, min(lens_for(f['cam']['fov']) for f in frames),
    max(lens_for(f['cam']['fov']) for f in frames)))


# ══ visibility ═══════════════════════════════════════════════════════
# glTF has no visibility channel, so the shot file carries a flag per tracked
# object per frame and it becomes a constant-interpolated hide key here.
def branch(name):
    o = bpy.data.objects.get(name)
    return [o] + list(o.children_recursive) if o else []

keyed = 0
for name, on0 in frames[0]['vis'].items():
    objs = branch(name)
    if not objs or all(fr['vis'][name] for fr in frames):
        continue                       # never hidden: leave it alone
    for o in objs:
        for fr in frames:
            o.hide_viewport = o.hide_render = not fr['vis'][name]
            o.keyframe_insert('hide_viewport', frame=fr['f'] + 1)
            o.keyframe_insert('hide_render', frame=fr['f'] + 1)
        if o.animation_data and o.animation_data.action:
            for fc in o.animation_data.action.fcurves:
                if 'hide' in fc.data_path:
                    for kp in fc.keyframe_points:
                        kp.interpolation = 'CONSTANT'
    keyed += len(objs)
print(f'visibility keyed on {keyed} objects')


# ══ emission that moves ══════════════════════════════════════════════
# The brake discs and tail lights are driven by emissiveIntensity on the page.
# Materials that carry an emissive texture keep it and only the strength moves.
EMIT_GAIN = float(opt('--emit', '1.4'))

def key_emission(mat, getter):
    b = principled(mat)
    if not b:
        return False
    moving = [getter(fr) for fr in frames]
    if max(moving) <= 0:
        return False
    for fr, v in zip(frames, moving):
        b.inputs['Emission Strength'].default_value = v * EMIT_GAIN
        b.inputs['Emission Strength'].keyframe_insert('default_value', frame=fr['f'] + 1)
    return True

lit = 0
for role in frames[0]['emit']:
    for m in [x for x in bpy.data.materials if x.name.split('.')[0] == role]:
        if key_emission(m, lambda fr, r=role: fr['emit'][r]):
            lit += 1
print(f'emission keyed on {lit} material(s)')


# ══ light ════════════════════════════════════════════════════════════
# The page lights the studio with four directionals, a hemisphere, a set of
# spots inside the set, and three point lights that come and go with the shot.
# Cycles gets all of them for real, at the world positions they actually had —
# the additive cards that stood in for glow are not exported at all.
GAIN = { 'DirectionalLight': float(opt('--sun',   '2.6')),
         'PointLight':       float(opt('--point', '55')),
         'SpotLight':        float(opt('--spot',  '140')) }

def aim(obj, direction):
    """Point a lamp's local -Z down `direction`."""
    obj.rotation_mode = 'QUATERNION'
    if direction.length < 1e-9:
        direction = Vector((0, 0, -1))
    obj.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(direction.normalized())

def rgb(hexv):
    return tuple(((hexv >> s) & 255) / 255 for s in (16, 8, 0))

made, hemi = {}, None
for L in rig['lights']:
    kind = L['type']
    if kind == 'HemisphereLight':
        hemi = L                      # becomes the world, not a lamp
        continue
    btype = {'DirectionalLight': 'SUN', 'PointLight': 'POINT', 'SpotLight': 'SPOT'}.get(kind)
    if not btype:
        print('  skipping unsupported light:', kind, L['name'])
        continue
    data = bpy.data.lights.new(L['name'], btype)
    data.color = rgb(L['colour'])
    data.energy = L['intensity'] * GAIN[kind]
    if btype == 'SUN':
        data.angle = math.radians(2.5)
    else:
        data.shadow_soft_size = 0.28
    if btype == 'SPOT':
        data.spot_size = min(math.pi, L.get('angle', 0.5) * 2)
        data.spot_blend = max(0.05, L.get('penumbra', 0.5))
    o = bpy.data.objects.new(L['name'], data)
    scene.collection.objects.link(o)

    world_p = vec(L.get('world', L['p']))
    if btype == 'SUN':
        # a three.js directional shines from its position toward its target
        d = vec(L['target']) - world_p if L.get('target') else -world_p
        aim(o, d)
        o.location = world_p.normalized() * 40 if world_p.length else Vector((0, 0, 40))
    else:
        o.location = world_p
        if L.get('target'):
            aim(o, vec(L['target']) - world_p)
        else:
            aim(o, Vector((0, 0, -1)))
    made[L['name']] = (o, data)

# whatever moved on the page moves here too
moved = 0
for name, (o, data) in made.items():
    track = [fr['lit'][name] for fr in frames if name in fr['lit']]
    if len(track) != len(frames):
        continue
    if (max(x['i'] for x in track) - min(x['i'] for x in track) < 1e-6
            and max(max(x['p']) - min(x['p']) for x in track) < 1e-6):
        continue                       # static: no keys needed
    gain = GAIN[next(L['type'] for L in rig['lights'] if L['name'] == name)]
    for fr, x in zip(frames, track):
        data.energy = x['i'] * gain
        data.keyframe_insert('energy', frame=fr['f'] + 1)
        if not made[name][0].parent:
            o.location = vec(x['p'])
            o.keyframe_insert('location', frame=fr['f'] + 1)
    moved += 1
print(f'lights: {len(made)} rebuilt ({moved} animated)' + (', hemisphere -> world' if hemi else ''))


# ══ world and fog ═════════════════════════════════════════════════════
fogc = rig['fog']['color']
FOG = tuple(((fogc >> s) & 255) / 255 for s in (16, 8, 0))

world = bpy.data.worlds.new('PV_World')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (*FOG, 1)
# the page's hemisphere light has no Cycles equivalent, so it becomes ambient
bg.inputs['Strength'].default_value = float(
    opt('--ambient', '%.3f' % ((hemi['intensity'] * 0.55) if hemi else 0.10)))

# FogExp2 fades the road into the void; Blender gets the same falloff from the
# mist pass, mixed to the fog colour in the compositor. Far cheaper than a
# volume, and the look is what matters here.
scene.view_layers[0].use_pass_mist = True
mist = world.mist_settings
mist.use_mist = True
# FogExp2 reaches 1-1/e at 1/density, so the mist depth tracks the page
mist.start, mist.depth, mist.falloff = 0.0, float(
    opt('--fog', '%.1f' % (1.9 / max(rig['fog']['density'], 1e-4)))), 'QUADRATIC'

scene.use_nodes = True
nt = scene.node_tree
nt.nodes.clear()
rl  = nt.nodes.new('CompositorNodeRLayers')
mix = nt.nodes.new('CompositorNodeMixRGB')
mix.blend_type = 'MIX'
mix.inputs[2].default_value = (*FOG, 1)
comp = nt.nodes.new('CompositorNodeComposite')
nt.links.new(rl.outputs['Image'], mix.inputs[1])
nt.links.new(rl.outputs['Mist'],  mix.inputs[0])
nt.links.new(mix.outputs['Image'], comp.inputs['Image'])
print(f'fog: mist to {mist.depth}m, colour #{fogc:06x}')


# ══ render ════════════════════════════════════════════════════════════
r = scene.render
r.engine = ENGINE
r.resolution_x, r.resolution_y, r.resolution_percentage = RES_W, RES_H, 100
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGB'
r.image_settings.compression = 15
r.filepath = os.path.join(OUTDIR, 'frames', 'pv_')

if ENGINE == 'CYCLES':
    c = scene.cycles
    c.device = 'CPU'
    c.samples = SAMPLES
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = True
    c.denoiser = 'OPENIMAGEDENOISE'
    c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    c.max_bounces, c.diffuse_bounces, c.glossy_bounces = 6, 2, 4
    c.transmission_bounces, c.transparent_max_bounces = 4, 4
    c.caustics_reflective = c.caustics_refractive = False
    c.use_fast_gi = True
    r.use_motion_blur = '--no-blur' not in argv
    r.motion_blur_shutter = float(opt('--shutter', '0.10'))
    c.motion_blur_position = 'CENTER'
    c.film_exposure = float(opt('--exposure', '1.0'))
    scene.render.use_persistent_data = True     # keeps the BVH between frames

scene.view_settings.view_transform = opt('--view', 'AgX')
scene.view_settings.look = opt('--look', 'AgX - Punchy')
scene.view_settings.exposure = float(opt('--ev', '0.25'))

if RANGE:
    a, b = RANGE.split(':')
    scene.frame_start, scene.frame_end = int(a), int(b)

STILLS = opt('--stills')          # spot-check a few marks without a full pass

os.makedirs(OUTDIR, exist_ok=True)
if SAVEBLEND:
    blend = os.path.join(OUTDIR, 'pivarion-shot.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    print('saved', blend)

print(f'render: {ENGINE} {RES_W}x{RES_H} {SAMPLES}spp '
      f'frames {scene.frame_start}-{scene.frame_end}')
if '--no-render' in argv:
    sys.exit(0)

t0 = time.time()
if STILLS:
    for f in (int(x) for x in STILLS.split(',')):
        scene.frame_set(f)
        r.filepath = os.path.join(OUTDIR, 'still_%04d' % f)
        s0 = time.time()
        bpy.ops.render.render(write_still=True)
        print('still %d in %.1fs' % (f, time.time() - s0), flush=True)
else:
    bpy.ops.render.render(animation=True)
n = len(STILLS.split(',')) if STILLS else scene.frame_end - scene.frame_start + 1
print(f'rendered {n} frames in {time.time()-t0:.0f}s ({(time.time()-t0)/n:.1f}s/frame)')
