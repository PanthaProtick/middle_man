const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
(async () => {
 const browser = await chromium.launch({headless:true,channel:"msedge"});
 const page = await browser.newPage();
 const errors=[];page.on('pageerror', e=>errors.push(e.message));
 const now='2026-10-24T10:00:00Z';
 const account={id:'a1',shop_id:'s1',provider:'bkash',receiving_number:'01711111111',label:'Shop bKash',is_active:true,version:1,created_at:now,updated_at:now};
 const order={id:'o1',shop_id:'s1',payment_account_id:'a1',product_name:'Cotton everyday kurti',total_minor:185000,required_advance_minor:15000,expected_cod_minor:170000,actual_cod_minor:null,account_provider:'bkash',account_receiving_number:'01711111111',account_label:'Shop bKash',lifecycle:'awaiting_buyer',version:1,review_reasons:[],buyer_revision:null,allocation_basis:null,portal_token:'synthetic',portal_url:'/orders/synthetic',created_at:now,updated_at:now,expires_at:'2026-10-26T10:00:00Z',completed_at:null,shop_display_name:'Bunon Studio',status_message:'Waiting for buyer details',submission_acknowledgement:null};
 let mode='ready';
 await page.route('**/api/**', async route=>{
  const url=new URL(route.request().url());let body={};let status=200;
  if(url.pathname.includes('/health')) body={status:'healthy'};
  else if(url.pathname==='/api/seller/shop') {if(mode==='error'){status=503;body={message:'Please try again shortly.'};}else body={shop:mode==='setup'?null:{id:'s1',display_name:'Bunon Studio'},setup_needed:mode==='setup'};}
  else if(url.pathname.includes('payment-accounts')) body=[account];
  else if(url.pathname==='/api/seller/orders') body={items:[order],next_cursor:null};
  else if(url.pathname.includes('/api/public/orders/')) {if(mode==='buyer-error'){status=404;body={message:'Order not available'};}else body=order;}
  else body={items:[],next_cursor:null};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 fs.mkdirSync('.cache/ui-revamp',{recursive:true});const checks=[];
 async function capture(name,width){await page.setViewportSize({width,height:1000});await page.screenshot({path:`.cache/ui-revamp/${name}-${width}.png`,fullPage:true});const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));if(dimensions.scroll>width) throw Error(`${name} overflow ${JSON.stringify(dimensions)}`);checks.push(`${name} ${width}: no horizontal overflow`);}
 await page.goto('http://localhost:5175');await page.getByText('Bunon Studio',{exact:true}).waitFor();
 for(const width of [375,768,1024,1440]) await capture('seller',width);
 await page.getByRole('button',{name:'Create Order Link',exact:true}).click();await page.getByRole('dialog').waitFor();await capture('create-order',375);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/Payments & SMS/}).click();await capture('payments',375);
 await page.getByRole('button',{name:/Receiving Accounts/}).click();await capture('accounts',375);
 await page.goto('http://localhost:5175/orders/synthetic');await page.getByText('Cotton everyday kurti',{exact:true}).first().waitFor();
 for(const width of [375,768,1024,1440]) await capture('buyer',width);
 for(const lifecycle of ['pending','confirmed','expired']) {
  order.lifecycle=lifecycle;
  await page.reload();await page.getByText('Cotton everyday kurti',{exact:true}).first().waitFor();
  await capture(`buyer-${lifecycle}`,375);
 }
 mode='buyer-error';await page.reload();await page.getByRole('alert').waitFor();await capture('buyer-error',375);
 mode='ready';await page.goto('http://localhost:5175');await page.getByText('Bunon Studio',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Demo & tools',exact:true}).click();
 await page.getByText('Demo Sandbox & Technical Tools',{exact:true}).waitFor();await capture('demo',375);
 await page.getByRole('button',{name:'Back to shop',exact:true}).click();await page.getByText('Bunon Studio',{exact:true}).waitFor();
 mode='setup';await page.goto('http://localhost:5175');await page.getByLabel('Shop Display Name').waitFor();await capture('setup',375);
 mode='error';await page.reload();await page.getByRole('button',{name:'Retry',exact:true}).waitFor();await capture('error',375);
 if(errors.length) throw Error(errors.join('\n'));
 fs.writeFileSync('.cache/ui-revamp/browser-results.json',JSON.stringify({checks,errors,scope:'Synthetic network fixtures; no live providers'},null,2));
 console.log(checks.join('\n'));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});


