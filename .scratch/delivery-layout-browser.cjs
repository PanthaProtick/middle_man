const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
(async()=>{
 const { createServer } = await import('../frontend/node_modules/vite/dist/node/index.js');
 const server = await createServer({configFile:require('path').resolve('frontend/vite.config.ts'), root:require('path').resolve('frontend'), server:{port:5191,strictPort:true}, plugins:[{name:'preview',configureServer(s){s.middlewares.use('/__delivery-preview',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__delivery-preview','<html><div id="root"></div><script type="module" src="/@fs/E:/middle_man/.scratch/delivery-preview.tsx"></script></html>'));});}}]});
 server.middlewares.use('/__delivery-preview',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__delivery-preview','<html><div id="root"></div><script type="module" src="/@fs/E:/middle_man/.scratch/delivery-preview.tsx"></script></html>'));});
 await server.listen();
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});page.on('console',msg=>{if(msg.type()==='error')console.error(msg.text())});
 const draft={order_id:'preview',version:1,status:'local_proposal',recipient_name:'Synthetic Buyer',contact_number:'01711111111',address:'House 12, Road 3, Test Lane, Dhaka. Call before delivery.',remaining_cod_minor:75000,parcel_weight_grams:1000,parcel_quantity:1,missing_parcel_fields:[],blockers:[]};
 const review={token:'a'.repeat(64),reviewed:false,submission_enabled:false,blockers:[],draft,choices:{environment:'offline',store_id:7,delivery_type:48,location:{}},connection:{status:'connected',version:1,merchant_hint:'Test merchant',simulated:true},stores:[{id:7,name:'Test pickup store'}],location:{city_name:'Dhaka',zone_name:'Central',area_name:'Test area'}};
 let mode='ready';
 await page.route('**/api/**',async route=>{if(mode==='loading') await new Promise(r=>setTimeout(r,250)); await route.fulfill({status:mode==='error'?503:200,contentType:'application/json',body:JSON.stringify(mode==='error'?{error:{code:'UNAVAILABLE',message:'Unavailable'}}:route.request().url().includes('locations?')?{choices:[]}:route.request().url().endsWith('courier-draft')?draft:review)});});
 fs.mkdirSync('.cache/delivery-layout',{recursive:true});
 for(const width of [375,768,1280]){
 await page.setViewportSize({width,height:1000});await page.goto('http://localhost:5191/__delivery-preview');await page.locator('.delivery-summary-address dd').waitFor();
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow at '+width);
 await page.screenshot({path:`.cache/delivery-layout/ready-${width}.png`,fullPage:true});
 }
 mode='loading';await page.reload();await page.getByRole('status').first().waitFor();await page.locator('.delivery-summary-address dd').waitFor();
 mode='error';await page.reload();await page.getByRole('alert').first().waitFor();await page.screenshot({path:'.cache/delivery-layout/error.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS: 375/768/1280 layouts, loading and failure states; no overflow or browser errors. Synthetic fixtures only.');
 }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});


