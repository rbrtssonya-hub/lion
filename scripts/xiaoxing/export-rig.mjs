// Mechanical extraction/export of approved art and the imagegen-repaired face.
// Creative inpainting is authored with imagegen; this script preserves its pixels.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const root = path.resolve(import.meta.dirname, '../..');
const source = path.join(root, 'source/characters/xiaoxing');
const output = path.join(root, 'source/public/assets/xiaoxing');
await fs.mkdir(source, { recursive: true }); await fs.mkdir(output, { recursive: true });
const W=1349,H=1166;
const original=await fs.readFile(path.join(source,'approved-reference.png'));
const repair=await fs.readFile(path.join(source,'face-repair.png'));
const data=b=>`data:image/png;base64,${b.toString('base64')}`;
const image=(b,extra='')=>`<use href="#${b===original?'original-art':'repair-art'}" ${extra}/>`;
const head='M0 0H1349V630H1016L1002 661L970 655L928 685L905 718L842 741L798 736L747 741L689 747L629 749L577 732L540 718L520 751L502 782L452 815L403 819L348 799H0Z';
const features={
 'left-eye':'M591 606Q606 573 647 575Q691 579 703 620L696 661Q687 687 651 690Q610 688 601 661Z',
 'right-eye':'M794 577Q804 546 843 539Q882 539 901 569L894 619Q879 656 842 657Q809 650 804 623Z',
 'left-brow':'M610 574Q636 557 668 564L692 582Q653 571 619 590Z',
 'right-brow':'M805 540Q832 519 862 523L885 540Q847 530 815 550Z',
 'mouth-talk':'M740 669Q764 657 791 653Q807 655 809 673Q804 705 780 716Q757 711 746 693Z',
};
const defs=`<defs><image id="original-art" width="${W}" height="${H}" href="${data(original)}"/><image id="repair-art" width="${W}" height="${H}" href="${data(repair)}"/><clipPath id="head-cut"><path d="${head}"/></clipPath><mask id="body-cut"><rect width="${W}" height="${H}" fill="white"/><path d="${head}" fill="black"/></mask><filter id="feather" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter><mask id="face-fill"><rect width="${W}" height="${H}" fill="black"/><g fill="white" filter="url(#feather)"><ellipse cx="651" cy="627" rx="76" ry="76"/><ellipse cx="848" cy="592" rx="72" ry="82"/><ellipse cx="776" cy="686" rx="65" ry="55"/></g></mask>${Object.entries(features).map(([id,d])=>`<clipPath id="${id}-cut"><path d="${d}"/></clipPath>`).join('')}</defs>`;
const body=`<path d="M585 726Q696 690 835 714L866 770L622 811Z" fill="#b53e34"/><path d="M617 749Q710 712 821 737" fill="none" stroke="#fff0d9" stroke-width="24"/><g mask="url(#body-cut)">${image(original)}</g>`;
const headLayer=`<g clip-path="url(#head-cut)">${image(original)}${image(repair,'mask="url(#face-fill)"')}</g>`;
const layers=[{id:'body',label:'身体与补全领口',content:body},{id:'head',label:'狮头头饰与修复脸底',content:headLayer},
 ...['left-eye','right-eye','left-brow','right-brow'].map(id=>({id,label:id,content:image(original,`clip-path="url(#${id}-cut)"`)})),
 {id:'mouth-closed',label:'闭合嘴型',content:'<path d="M751 683Q775 694 797 675" fill="none" stroke="#9a4c47" stroke-width="4" stroke-linecap="round"/>'},
 {id:'mouth-smile',label:'微笑嘴型',content:'<path d="M751 680Q779 699 801 670Q790 704 776 703Q763 702 751 680Z" fill="#b54e4f" stroke="#713b37" stroke-width="2"/><path d="M762 693Q777 689 791 691Q778 709 762 693Z" fill="#ee9b8f"/>'},
 {id:'mouth-talk',label:'说话嘴型',content:image(original,'clip-path="url(#mouth-talk-cut)"')},
];
const svg=(content)=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${content}</svg>`;
const editable=svg(layers.map(l=>`<g id="${l.id}" inkscape:groupmode="layer" inkscape:label="${l.label}"${l.id==='mouth-smile'||l.id==='mouth-talk'?' style="display:none"':''}>${l.content}</g>`).join(''));
await fs.writeFile(path.join(source,'xiaoxing-layered.svg'),editable);
await fs.writeFile(path.join(source,'rig.json'),JSON.stringify({width:W,height:H,layers:layers.map(({content,...l})=>l),pivots:{head:[752,741],leftEye:[651,632],rightEye:[848,596],leftBrow:[650,576],rightBrow:[846,540],mouth:[776,686]},inpainting:'imagegen face-repair.png; original outer pixels preserved',exporter:'scripts/xiaoxing/export-rig.mjs'},null,2));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
for(const l of layers){
 const url='data:image/svg+xml;base64,'+Buffer.from(svg(l.content)).toString('base64');
 const png=await page.evaluate(async({url,W,H})=>{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.getContext('2d').drawImage(img,0,0);return canvas.toDataURL('image/png').split(',')[1];},{url,W,H});
 await fs.writeFile(path.join(output,`${l.id}.png`),Buffer.from(png,'base64'));
}
await fs.copyFile(path.join(source,'approved-reference.png'),path.join(output,'reference.png'));
const preview=svg(layers.filter(l=>l.id!=='mouth-smile'&&l.id!=='mouth-talk').map(l=>l.content).join(''));
await fs.writeFile(path.join(source,'assembly-preview.svg'),preview);
const merged=await page.evaluate(async({url,W,H})=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/png').split(',')[1];},{url:'data:image/svg+xml;base64,'+Buffer.from(preview).toString('base64'),W,H});
await fs.writeFile(path.join(source,'merged-preview.png'),Buffer.from(merged,'base64'));
await page.setContent(`<body style="margin:0;background:#f6f0e6"><img width="${W}" height="${H}" src="data:image/svg+xml;base64,${Buffer.from(preview).toString('base64')}"></body>`);
await page.locator('img').evaluate(img=>img.decode());
await fs.mkdir(path.join(root,'tmp/xiaoxing'),{recursive:true});
await page.screenshot({path:path.join(root,'tmp/xiaoxing/face-assembly.png'),clip:{x:550,y:510,width:420,height:250}});
await browser.close();
console.log('Exported',layers.length,'aligned layers',W,H);
