"""Compress only base-color embedded textures. Normal/data textures stay lossless.
Rewrites glTF binary buffer views, leaving geometry and data unchanged.
"""
import struct,json,io
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'public/models/lion.glb'
b=p.read_bytes();json_len=struct.unpack_from('<I',b,12)[0]
j=json.loads(b[20:20+json_len]);bin_start=20+json_len+8;binary=b[bin_start:]
color_images=set()
for m in j.get('materials',[]):
 info=m.get('pbrMetallicRoughness',{}).get('baseColorTexture')
 if info and m.get('alphaMode','OPAQUE')=='OPAQUE':color_images.add(j['textures'][info['index']]['source'])
 normal=m.get('normalTexture')
 if normal:
  normal_image=j['images'][j['textures'][normal['index']]['source']]
  if 'weave_appearance_mask' in normal_image.get('name','').lower():
   # Blender's procedural Wave→Bump graph is not a tangent-space normal map.
   # The exporter follows its scalar mask; suppress that incorrect interpretation.
   del m['normalTexture']
replacements={}
for i in color_images:
 image=j['images'][i];view=j['bufferViews'][image['bufferView']]
 raw=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
 im=Image.open(io.BytesIO(raw))
 out=io.BytesIO();im.convert('RGB').save(out,format='JPEG',quality=95,subsampling=0,optimize=True)
 encoded=out.getvalue()
 if image.get('mimeType')!='image/jpeg' and len(encoded)<len(raw):
  replacements[image['bufferView']]=encoded;image['mimeType']='image/jpeg'
  print(image.get('name'),len(raw),'→',len(encoded))
out_bin=bytearray()
for vi,view in enumerate(j['bufferViews']):
 old_offset=view.get('byteOffset',0);data=replacements.get(vi,binary[old_offset:old_offset+view['byteLength']])
 while len(out_bin)%4:out_bin.append(0)
 view['byteOffset']=len(out_bin);view['byteLength']=len(data);out_bin.extend(data)
j['buffers'][0]['byteLength']=len(out_bin)
while len(out_bin)%4:out_bin.append(0)
new_json=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode('utf8')
while len(new_json)%4:new_json+=b' '
length=12+8+len(new_json)+8+len(out_bin)
p.write_bytes(struct.pack('<III',0x46546C67,2,length)+struct.pack('<I4s',len(new_json),b'JSON')+new_json+struct.pack('<I4s',len(out_bin),b'BIN\x00')+out_bin)
print('Optimized GLB',len(b),'→',p.stat().st_size)
for name in ['brocade','head-atlas']:
 png=ROOT/f'public/models/{name}.png'
 if png.exists():Image.open(png).convert('RGB').save(png.with_suffix('.jpg'),quality=95,subsampling=0,optimize=True)
audit=ROOT/'public/data/model-audit.json'
if audit.exists():
 a=json.loads(audit.read_text(encoding='utf8'))
 a['webStats']={'fileBytes':p.stat().st_size,'nodes':len(j['nodes']),'meshes':len(j['meshes']),'drawPrimitives':sum(len(m['primitives']) for m in j['meshes']),'triangles':sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives']),'vertices':sum(j['accessors'][p['attributes']['POSITION']]['count'] for m in j['meshes'] for p in m['primitives']),'materials':len(j['materials']),'embeddedImages':len(j['images']),'baseColorEncoding':'JPEG quality 95, original pixel resolution','geometryCompression':'Draco level 6'}
 palettes={}
 for key in ['brocade','head-atlas']:
  im=Image.open(ROOT/f'public/models/{key}.jpg').convert('RGB').resize((160,160))
  q=im.quantize(colors=7,method=Image.Quantize.MEDIANCUT);pal=q.getpalette()
  palettes[key]=[{'hex':'#'+''.join(f'{v:02x}' for v in pal[i*3:i*3+3]),'share':round(count/25600,4)} for count,i in sorted(q.getcolors(),reverse=True)]
 a['texturePalettes']={'method':'160x160 image samples; median-cut quantization, 7 bins. Image-pixel shares, NOT whole-model visible surface shares.','data':palettes}
 audit.write_text(json.dumps(a,ensure_ascii=False,indent=2),encoding='utf8')
