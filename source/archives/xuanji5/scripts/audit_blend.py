"""Read-only audit of the supplied Blender project. Run with blender --background source.blend --python scripts/audit_blend.py."""
import bpy, json, os, math
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'data'
OUT.mkdir(parents=True, exist_ok=True)

def v3(v): return [round(float(x), 6) for x in v]
def bounds(obj):
    if not hasattr(obj, 'bound_box'): return None
    vs = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    mn = Vector([min(v[i] for v in vs) for i in range(3)])
    mx = Vector([max(v[i] for v in vs) for i in range(3)])
    return {'min': v3(mn), 'max': v3(mx), 'center': v3((mn+mx)/2), 'size': v3(mx-mn)}

objects=[]
for o in bpy.data.objects:
    d={'name':o.name, 'type':o.type, 'parent':o.parent.name if o.parent else None,
       'children':[c.name for c in o.children], 'visible':not o.hide_render,
       'collections':[c.name for c in o.users_collection], 'location':v3(o.location),
       'rotation':v3(o.rotation_euler), 'scale':v3(o.scale), 'bounds':bounds(o),
       'modifiers':[{'name':m.name,'type':m.type, 'render':m.show_render, 'viewport':m.show_viewport} for m in o.modifiers],
       'materials':[m.name if m else None for m in o.data.materials] if hasattr(o.data,'materials') else [],
       'particles':[{'name':p.name,'type':p.settings.type,'count':p.settings.count,'hairLength':p.settings.hair_length,'childPercent':p.settings.child_percent,'renderedChildCount':p.settings.rendered_child_count,'renderType':p.settings.render_type,'instanceObject':p.settings.instance_object.name if p.settings.instance_object else None} for p in getattr(o,'particle_systems',[])]}
    if o.type=='MESH':
        o.data.calc_loop_triangles()
        d.update(vertices=len(o.data.vertices), polygons=len(o.data.polygons), triangles=len(o.data.loop_triangles), mesh=o.data.name, uvLayers=[u.name for u in o.data.uv_layers])
    if o.type=='CURVE': d.update(splines=len(o.data.splines), bevelDepth=o.data.bevel_depth, bevelResolution=o.data.bevel_resolution)
    objects.append(d)
materials=[]
for m in bpy.data.materials:
    nodes=[]
    if m.use_nodes:
        for n in m.node_tree.nodes:
            row={'name':n.name,'type':n.type}
            if n.type=='TEX_IMAGE': row['image']=n.image.name if n.image else None
            if n.type=='BSDF_PRINCIPLED':
                for key in ['Base Color','Metallic','Roughness','Alpha','Transmission Weight','Sheen Weight']:
                    if key in n.inputs:
                        val=n.inputs[key].default_value
                        row[key]=list(val) if hasattr(val,'__iter__') else val
                        row[key+'Linked']=n.inputs[key].is_linked
            nodes.append(row)
    materials.append({'name':m.name,'diffuseColor':list(m.diffuse_color),'nodes':nodes,'surfaceRenderMethod':getattr(m,'surface_render_method',None),'useNodes':m.use_nodes})
images=[{'name':i.name,'filepath':i.filepath,'size':list(i.size),'packed':bool(i.packed_file),'source':i.source,'channels':i.channels,'colorspace':i.colorspace_settings.name} for i in bpy.data.images]
report={'source':str(bpy.data.filepath),'blender':bpy.app.version_string,'scene':bpy.context.scene.name,'unitSystem':bpy.context.scene.unit_settings.system,'unitScale':bpy.context.scene.unit_settings.scale_length,'objects':objects,'materials':materials,'images':images,'armatures':[a.name for a in bpy.data.armatures],'actions':[a.name for a in bpy.data.actions],'world':bpy.context.scene.world.name if bpy.context.scene.world else None}
(OUT/'model-audit.raw.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('AUDIT_SAVED',len(objects),'objects',len(materials),'materials',len(images),'images',flush=True)
print(json.dumps([{'name':o['name'],'type':o['type'],'vertices':o.get('vertices'),'triangles':o.get('triangles'),'bounds':o['bounds'],'materials':o['materials'],'particles':o['particles']} for o in objects],ensure_ascii=False),flush=True)
