const { chromium }=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const {createServer}=await import('../frontend/node_modules/vite/dist/node/index.js');
 const server=await createServer({configFile:require('path').resolve('frontend/vite.config.ts'),root:require('path').resolve('frontend'),server:{port:5192,strictPort:true},plugins:[{name:'preview',configureServer(s){s.middlewares.use('/__spacing',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__spacing','<html><div id="root"></div><script type="module" src="/@fs/E:/middle_man/.scratch/spacing-preview.tsx"></script></html>'));});}}]});
 await server.listen();const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [375,768,1280]){await page.setViewportSize({width,height:1100});await page.goto('http://localhost:5192/__spacing');await page.locator('.tag').first().waitFor();
 const result=await page.evaluate(()=>{const gap=s=>getComputedStyle(document.querySelector(s)).gap;return {pills:['.status-badges','.workspace-section-tabs','.summary-pills','.metrics-ribbon','.tabs-nav','.tech-strip','.tag-list'].map(gap),cards:['.grid-2','.portal-main'].map(gap),section:getComputedStyle(document.querySelector('.isolated-section')).marginBottom,correction:getComputedStyle(document.querySelector('.buyer-correction')).marginTop,overflow:document.documentElement.scrollWidth>innerWidth,taps:[...document.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=44)}});
 if(result.pills.some(g=>g!=='4px')||result.cards.some(g=>g!=='12px')||result.section!=='12px'||result.correction!=='12px'||result.overflow||!result.taps)throw Error(JSON.stringify(result));
 await page.screenshot({path:`.cache/delivery-layout/spacing-${width}.png`,fullPage:true});console.log(`PASS ${width}px: pills 4px; cards 12px; 44px tap targets; no overflow`);
 }if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
