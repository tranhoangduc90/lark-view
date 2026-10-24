import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.LARK_RECOVERY_EVIDENCE_DIR||resolve(root,'output/playwright/lark-recovery-copy');
await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const revision=process.env.LARK_RECOVERY_REVISION||null,publicBase=process.env.LARK_RECOVERY_PUBLIC_BASE||null;
assert.ok(!(revision&&publicBase));
const assets=['index.html','app.js','styles.css','master170.css','master170/theme.css'],overrides=new Map();
for(const path of assets){
 if(revision)overrides.set('/'+path,execFileSync('git',['-C',root,'show',revision+':'+path]));
 if(publicBase){const response=await fetch(publicBase.replace(/\/$/,'')+'/'+path,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200);overrides.set('/'+path,Buffer.from(await response.arrayBuffer()));}
}
const server=createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost'),relative=decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''),path=resolve(root,'.'+relative);
 if(!path.startsWith(root+sep))return res.writeHead(403).end();
 try{const body=await fs.readFile(path);res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'})[extname(path)]||'application/octet-stream'}).end(body);}
 catch{res.writeHead(404).end();}
});
await new Promise((ok,no)=>{server.once('error',no);server.listen(35685,'127.0.0.1',ok);});
const origin='http://127.0.0.1:35685',records=[],browser=await chromium.launch({channel:'chrome',headless:true});
const fields=[['Bài tập','Text'],['Số lần đề xuất','Number'],['Số lần luyện','Number'],['Chờ luyện','Checkbox'],['Timestamp','DateTime'],['Link BT','URL'],['Tài liệu','Attachment']].map(([name,uiType])=>({name,uiType}));
const payload={ok:true,fields,view:{name:'Luyện tập bổ trợ'},meta:{total:9,returned:9},records:Array.from({length:9},(_,i)=>({id:'fixture-'+i,fields:{'Bài tập':[{text:'Bài luyện '+i+' · Tên dài để kiểm đầy đủ nội dung trong bảng',link:'https://example.invalid/exercise/'+i}],'Số lần đề xuất':9-i,'Số lần luyện':i,'Chờ luyện':i<7,'Timestamp':1792717200000,'Link BT':{link:'https://example.invalid/exercise/'+i,text:'Mở bài luyện'},'Tài liệu':[{name:'Tài liệu thử '+i,url:'https://example.invalid/attachment/'+i}]}}))};
const query='?base_id=BASE_FIXTURE&table_id=TABLE_FIXTURE&view_id=VIEW_FIXTURE';
try{
 for(const [width,height]of[[1440,1000],[320,568]])for(const mode of['empty','network','json','403','500'])for(const priorData of(mode==='empty'?[false]:[false,true])){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(8000);const calls=[],errors=[],unexpected=[];let active=priorData?'data':mode;
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const q=route.request(),u=new URL(q.url());
   if(u.origin!==origin){unexpected.push({origin:u.origin,path:u.pathname});return route.abort();}
   if(u.pathname==='/api/view'){
    assert.equal(q.method(),'GET');calls.push({path:u.pathname,query:u.search,method:q.method()});
    if(active==='network')return route.abort('connectionfailed');
    if(active==='json')return route.fulfill({contentType:'application/json',body:'broken-json-fixture'});
    if(['403','500'].includes(active))return route.fulfill({status:Number(active),json:{ok:false,error:'Nguồn thử không đọc được.'}});
    return route.fulfill({json:active==='empty'?{...payload,records:[],meta:{total:0,returned:0}}:payload});
   }
   const key=u.pathname==='/'?'/index.html':u.pathname;
   if(overrides.has(key))return route.fulfill({body:overrides.get(key),contentType:key.endsWith('.css')?'text/css':key.endsWith('.html')?'text/html; charset=utf-8':'text/javascript'});
   return route.continue();
  });
  const snapshot=()=>page.evaluate(()=>({message:document.querySelector('#message').textContent,messageKind:document.querySelector('#message').dataset.state||null,empty:document.querySelector('.empty-state')?.textContent||null,pill:document.querySelector('#statusPill').textContent,count:document.querySelector('#pageCount').textContent,tableText:document.querySelector('#tableMount').innerText,links:[...document.querySelectorAll('#tableMount a')].map(a=>({text:a.textContent,href:a.getAttribute('href'),target:a.target,rel:a.rel})),rows:document.querySelectorAll('.record-row').length,inputs:[...document.querySelectorAll('.query-field input')].map(e=>e.value),loadDisabled:document.querySelector('#loadButton').disabled,font:getComputedStyle(document.body).fontFamily}));
  try{
   await page.goto(origin+'/'+query);let before=null;
   if(priorData){
    await page.locator('.record-row').first().waitFor();before=await snapshot();assert.equal(before.rows,9);
    await page.evaluate(()=>scrollTo(0,200));active=mode;await page.evaluate(()=>window.loadView());
   }
   if(mode==='empty')await page.locator('.empty-state').waitFor();
   else await page.waitForFunction(()=>document.querySelector('#statusPill').textContent==='Lỗi');
   await page.evaluate(()=>document.fonts.ready);const ui=await snapshot();
   const message=mode==='network'?'Chưa kết nối được để tải dữ liệu. Hãy kiểm tra mạng rồi tải lại trang.':mode==='json'?'Chưa đọc được phản hồi của hệ thống. Hãy tải lại trang để thử lại.':'Nguồn thử không đọc được.';
   const expected=mode==='empty'?'Bảng này chưa có bài tập hoặc tài khoản kết nối chưa có quyền đọc dữ liệu.':message+(priorData?' Dữ liệu đang hiển thị thuộc lần tải trước.':'');
   const checks={copy:(mode==='empty'?ui.empty:ui.message)===expected,font:ui.font.includes('Source Sans 3')};
   assert.equal(ui.loadDisabled,false);assert.deepEqual(ui.inputs,['BASE_FIXTURE','TABLE_FIXTURE','VIEW_FIXTURE']);
   assert.equal(calls.length,priorData?2:1);for(const call of calls)assert.deepEqual(call,{path:'/api/view',query,method:'GET'});
   if(priorData){assert.equal(ui.tableText,before.tableText);assert.deepEqual(ui.links,before.links);assert.equal(ui.count,before.count);assert.equal(ui.rows,9);assert.match(ui.message,/thuộc lần tải trước/);}
   else{assert.equal(ui.rows,0);assert.equal(ui.links.length,0);}
   if(mode==='empty'){assert.equal(ui.pill,'Đã tải');assert.equal(ui.count,'0/0 bài tập');}else assert.equal(ui.messageKind,'error');
   const target=page.locator(mode==='empty'?'.empty-state':'#message');
   const beforeHome=await target.boundingBox();await page.keyboard.press('Control+Home');await page.waitForFunction(()=>scrollY===0);
   const geometry=await target.evaluate(e=>{const b=e.getBoundingClientRect(),point=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return{top:b.top,bottom:b.bottom,viewportHeight:innerHeight,uncovered:e===point||e.contains(point)};});
   assert.ok(geometry.top>=0&&geometry.bottom<=height&&geometry.uncovered);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
   const key=mode+'-'+(priorData?'prior':'fresh')+'-'+width;
   await page.screenshot({path:out+'/'+key+'-viewport.png',fullPage:false});
   await target.screenshot({path:out+'/'+key+'-notice.png'});
   records.push({mode,priorData,width,height,outcome:Object.values(checks).every(Boolean)?'passed':'failed',checks,ui,calls,beforeHome,geometry});
  }catch(error){records.push({mode,priorData,width,height,outcome:'failed',error:error.stack,calls,errors,unexpected});}
  finally{await context.unrouteAll({behavior:'wait'});await context.close();}
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
const sources={};for(const path of assets)sources[path]=createHash('sha256').update(overrides.get('/'+path)||await fs.readFile(resolve(root,path))).digest('hex');
const result={outcome:records.every(x=>x.outcome==='passed')?'passed':'failed',records,sourceHashes:sources,revision,publicBase,testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),externalWrites:0,scope:'Actual Lark frontend,synthetic nine records,mocked GET only. Error/empty region verified after keyboard Control+Home,not automatic-scroll acceptance. Public mode substitutes five static assets;remaining assets local. No real Lark permissions,attachments,SQL or learner write.'};
await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(x=>x.outcome==='failed').length,errors:records.filter(x=>x.error).map(x=>({mode:x.mode,priorData:x.priorData,width:x.width,error:x.error}))}));if(result.outcome!=='passed')process.exitCode=1;
