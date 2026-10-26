"""Package already-authored transparent layers as editable PSD and OpenRaster.

This performs file-format export only; pixel repair is from imagegen and the
approved reference's mechanically clipped layers in export-rig.mjs.
"""
from pathlib import Path
import io, json, struct, zlib, zipfile
from xml.etree.ElementTree import Element, SubElement, tostring
from PIL import Image

root = Path(__file__).resolve().parents[2]
source = root / 'source/characters/xiaoxing'
runtime = root / 'source/public/assets/xiaoxing'
rig = json.loads((source / 'rig.json').read_text(encoding='utf8'))
w, h = rig['width'], rig['height']
hidden = {'mouth-smile', 'mouth-talk'}
layers = list(reversed(rig['layers']))
be = lambda fmt, *v: struct.pack('>' + fmt, *v)
records, channel_data = [], []
for layer in layers:
    image = Image.open(runtime / (layer['id'] + '.png')).convert('RGBA')
    channels = [be('H', 2) + zlib.compress(c.tobytes(), 9) for c in image.split()]
    name = layer['id'].encode('ascii')[:255]
    pascal = bytes([len(name)]) + name
    pascal += b'\0' * (-len(pascal) % 4)
    extra = be('II', 0, 0) + pascal
    record = be('iiiiH', 0, 0, h, w, 4)
    for channel, data in zip([0, 1, 2, -1], channels):
        record += be('hI', channel, len(data))
    record += b'8BIMnorm' + bytes([255, 0, 2 if layer['id'] in hidden else 0, 0]) + be('I', len(extra)) + extra
    records.append(record)
    channel_data.extend(channels)
info = be('h', -len(layers)) + b''.join(records + channel_data)
info += b'\0' * (len(info) % 2)
section = be('I', len(info)) + info + be('I', 0)
merged = Image.open(source / 'merged-preview.png').convert('RGBA')
composite = b''.join(c.tobytes() for c in merged.split())
header = b'8BPS' + be('H', 1) + b'\0' * 6 + be('HIIHH', 4, h, w, 8, 3)
(source / 'xiaoxing-layered.psd').write_bytes(header + be('II', 0, 0) + be('I', len(section)) + section + be('H', 2) + zlib.compress(composite, 9))
image_xml = Element('image', {'w': str(w), 'h': str(h), 'name': 'Xiaoxing editable animation layers', 'version': '0.0.3'})
stack = SubElement(image_xml, 'stack')
with zipfile.ZipFile(source / 'xiaoxing-layered.ora', 'w') as archive:
    archive.writestr('mimetype', 'image/openraster', compress_type=zipfile.ZIP_STORED)
    for i, layer in enumerate(layers):
        target = f'data/layer{i}.png'
        SubElement(stack, 'layer', {'name': layer['id'], 'src': target, 'x': '0', 'y': '0', 'opacity': '1.0', 'visibility': 'hidden' if layer['id'] in hidden else 'visible', 'composite-op': 'svg:src-over'})
        archive.write(runtime / (layer['id'] + '.png'), target, compress_type=zipfile.ZIP_DEFLATED)
    archive.writestr('stack.xml', tostring(image_xml, encoding='utf-8', xml_declaration=True))
    archive.write(source / 'merged-preview.png', 'mergedimage.png', compress_type=zipfile.ZIP_DEFLATED)
print('Packaged PSD and ORA:', len(layers), 'editable layers;', w, h)
