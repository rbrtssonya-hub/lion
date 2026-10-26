import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const root=path.resolve(import.meta.dirname,'../..');
const output=path.join(root,'source/reviews/xiaoxing/2026-10-26');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await page.addInitScript(()=>{ if(window===window.top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1','1'); });
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const records=[];
for(const chapter of ['entry','model','action','state']){
 await page.goto(`${process.env.XIAOXING_REVIEW_URL||'http://127.0.0.1:42826'}/#/${chapter}`);
 await page.getByRole('button',{name:'与小醒对话',exact:true}).waitFor();
 await page.locator('.xiaoxing-avatar[data-layered="true"]').waitFor();
 await page.waitForFunction(ch=>document.body.dataset.state===ch,chapter);
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(chapter==='model'||chapter==='action'?4000:900);
 if(chapter==='state'){
  await page.getByRole('button',{name:'与小醒对话',exact:true}).click();
  await page.getByRole('button',{name:'讲解本页',exact:true}).click();
 }
 await fs.writeFile(path.join(output,`${chapter}-1920-final.png`),await page.screenshot());
 records.push(await page.evaluate(ch=>({chapter:ch,file:`${ch}-1920-final.png`,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,pet:(()=>{const r=document.querySelector('.xiaoxing-pet').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})(),layerCount:document.querySelectorAll('.xiaoxing-layer').length,dialog:!!document.querySelector('#xiaoxingDialog')}),chapter));
}
await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(500);
await fs.writeFile(path.join(output,'state-1366-final.png'),await page.screenshot());
records.push(await page.evaluate(()=>({chapter:'state',width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,dialogInViewport:(()=>{const r=document.querySelector('#xiaoxingDialog').getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()})));
const report={date:'2026-10-26',browser:await browser.version(),baseURL:process.env.XIAOXING_REVIEW_URL||'http://127.0.0.1:42826',pageErrors:errors,records,scope:'actual production Chrome screenshots, desktop only; no live DeepSeek API or packaged EXE claim'};
await fs.writeFile(path.join(output,'capture.json'),JSON.stringify(report,null,2)+'\n');
await browser.close();
if(errors.length||records.some(r=>r.overflow)||records.at(-1).dialogInViewport!==true)throw Error(JSON.stringify(report));
console.log(JSON.stringify(report));
