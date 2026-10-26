import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '../..');
const manifestPath=path.join(root,'source/asset-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const types=new Set(['.png','.psd','.ora','.wav','.m4a','.mp3','.gif']);
const locations=['source/characters/xiaoxing','source/public/assets/xiaoxing','source/reviews/xiaoxing/2026-10-26'];
async function visit(folder){
 for(const item of await fs.readdir(path.join(root,folder),{withFileTypes:true})){const relative=`${folder}/${item.name}`;
  if(item.isDirectory()){await visit(relative);continue;}
  if(!types.has(path.extname(item.name).toLowerCase()))continue;
  const bytes=await fs.readFile(path.join(root,relative));
  const from=relative.includes('/reviews/')?'actual Chrome desktop Xiaoxing visual review 2026-10-26':relative.includes('/voice/')?'local Microsoft Yaoyao female Chinese narration; SSML role profile 2026-10-26':item.name==='approved-reference.png'||item.name==='reference.png'?'user-selected chibi lion costume mascot attachment 2026-10-26':item.name==='face-repair.png'?'imagegen facial underpainting from approved mascot 2026-10-26':'editable mascot layer export from approved art and repaired face, 2026-10-26';
  const entry={from,path:relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  const index=manifest.files.findIndex(file=>file.path===relative);
  if(index<0)manifest.files.push(entry);else manifest.files[index]={...manifest.files[index],...entry};
 }
}
for(const location of locations){try{await fs.access(path.join(root,location));await visit(location);}catch(error){if(error.code!=='ENOENT')throw error;}}
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('Asset manifest',manifest.files.length,'entries');
