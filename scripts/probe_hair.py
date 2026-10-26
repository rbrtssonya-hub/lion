import bpy
for o in bpy.data.objects:
 if o.type=='CURVES':
  print('CURVES',o.name,'matrix',list(o.matrix_world),'attrs',[(a.name,a.domain,a.data_type,len(a.data)) for a in o.data.attributes],flush=True)
  c=o.data.curves[0];print('CURVE',[(p.identifier,p.type) for p in c.bl_rna.properties],flush=True)
  print('POINTS',[(p.position[:],getattr(p,'radius',None)) for p in c.points],flush=True)
for o in bpy.data.objects:
 if o.type=='MESH' and len(o.particle_systems):
  ps=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).particle_systems[0]
  p=ps.particles[0]
  print('PARTICLE',o.name,len(ps.particles),[(k.co[:],k.co_local[:]) for k in p.hair_keys], 'radius',ps.settings.root_radius,ps.settings.tip_radius,ps.settings.radius_scale,flush=True)
  break
