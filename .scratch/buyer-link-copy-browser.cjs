const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'msedge'});
 try {
 const page = await browser.newPage();
 const now='2026-10-24T10:00:00Z';
 const account={id:'a1',shop_id:'s1',provider:'bkash',receiving_number:'01711111111',label:'Shop',is_active:true,version:1,created_at:now,updated_at:now};
 const order={id:'o1',shop_id:'s1',payment_account_id:'a1',product_name:'Test order',total_minor:185000,required_advance_minor:15000,expected_cod_minor:170000,actual_cod_minor:null,account_provider:'bkash',account_receiving_number:'01711111111',account_label:'Shop',lifecycle:'awaiting_buyer',version:1,review_reasons:[],buyer_revision:null,allocation_basis:null,portal_token:'synthetic',portal_url:'/orders/synthetic',created_at:now,updated_at:now,expires_at:'2026-10-26T10:00:00Z',completed_at:null};
 await page.route('**/api/**', async route => {
 const path=new URL(route.request().url()).pathname;
 const body=path.endsWith('/health')?{status:'healthy'}:path.endsWith('/shop')?{shop:{id:'s1',display_name:'Shop'},setup_needed:false}:path.includes('payment-accounts')?[account]:path.endsWith('/orders')?{items:[order],next_cursor:null}:{items:[],next_cursor:null};
 await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.addInitScript(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}}));
 await page.goto('http://127.0.0.1:5186');
 async function verify(label) {
 await page.getByRole('button',{name:label,exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Could not copy'}).waitFor();
 if(await page.getByRole('button',{name:label==='Copy Link'?'Copied!':'Copied Buyer Link',exact:true}).count()) throw Error('False copied state');
 const input=page.getByRole('textbox',{name:'Buyer link to copy manually'});
 if(await input.inputValue()!=='http://127.0.0.1:5186/orders/synthetic') throw Error('Wrong fallback URL');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedBuyerLink=text;}}}));
 await page.getByRole('button',{name:label,exact:true}).click();
 await page.getByRole('button',{name:label==='Copy Link'?'Copied!':'Copied Buyer Link',exact:true}).waitFor();
 if(await page.evaluate(()=>window.copiedBuyerLink)!=='http://127.0.0.1:5186/orders/synthetic') throw Error('Wrong copied URL');
 }
 await verify('Copy Link');
 await page.getByRole('button',{name:'Inspect',exact:true}).click();
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
 await verify('Copy Buyer Link');
 console.log('PASS Edge: list/detail failure, manual fallback, retry and exact URL (synthetic API/clipboard adapters).');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

