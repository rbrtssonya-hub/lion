import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url=process.env.ATLAS_PRODUCTION_URL || 'http://127.0.0.1:4173/';
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1536,height:960}});
const errors=[],failedResponses=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
page.on('response',response=>{if(response.status()>=400)failedResponses.push({url:response.url(),status:response.status()})});
try{
  await page.goto(url);
  await page.waitForFunction(()=>document.querySelector('.lion-experience')?.dataset.ready==='true',{timeout:180000});
  assert.equal(await page.evaluate(()=>typeof window.__LION_ATLAS__),'undefined');
  assert.equal(await page.locator('.cultural-panel').count(),0);
  assert.equal(await page.locator('.chapter-control').count(),6);
  const views=[];
  for(const id of ['brows','body']){
    await page.locator(`[data-part="${id}"]`).click();
    assert.equal(await page.locator('.model-layer').evaluate(el=>getComputedStyle(el).opacity),'1','first click cancels the initial reveal fade cleanly');
    await page.waitForFunction(id=>{const main=document.querySelector('.lion-experience');return main.dataset.phase==='study'&&main.dataset.selected===id},id,{timeout:30000});
    await page.waitForTimeout(2600);
    const state=await page.evaluate(()=>{
      const model=document.querySelector('.model-layer'),img=document.querySelector('.chapter-artwork'),text=document.querySelector('.cultural-panel');
      return{image:new URL(img.src).pathname,width:img.naturalWidth,height:img.naturalHeight,fit:getComputedStyle(img).objectFit,modelVisibility:getComputedStyle(model).visibility,textVisibility:getComputedStyle(text).visibility,textOpacity:getComputedStyle(text).opacity};
    });
    assert.equal(state.image,`/images/chapters/${id}.png`);
    assert.equal(state.width,1536);assert.equal(state.height,1024);
    assert.equal(state.fit,'contain');
    assert.equal(state.modelVisibility,'hidden');
    assert.equal(state.textVisibility,'visible');assert.equal(state.textOpacity,'1');
    await page.screenshot({path:`artifacts/handoff/screenshots/production-${id}.png`});
    views.push(state);
  }
  await page.getByRole('button',{name:'返回整体',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.lion-experience').dataset.phase==='overview');
  assert.equal(await page.locator('.cultural-panel').count(),0);
  assert.equal(await page.locator('.model-layer').evaluate(el=>getComputedStyle(el).visibility),'visible');
  const assets=await page.evaluate(async()=>Promise.all(['brows','crown','beard','body','trim','mouth'].map(async id=>{
    const response=await fetch(`/images/chapters/${id}.png`);
    const bitmap=await createImageBitmap(await response.blob());
    const result={id,status:response.status,width:bitmap.width,height:bitmap.height};
    bitmap.close();return result;
  })));
  assets.forEach(asset=>{assert.equal(asset.status,200);assert.equal(asset.width,1536);assert.equal(asset.height,1024)});
  assert.deepEqual(errors,[]);assert.deepEqual(failedResponses,[]);
  const result={url,production:true,views,assets,errors,failedResponses,checks:['static GLB and Draco load','GSAP production bundle executes','pure model homepage','dedicated full-frame artwork','all six production images decode','model actually hidden','cultural text actually visible','return to full model','no development global']};
  await writeFile('artifacts/handoff/production-results.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
