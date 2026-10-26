import http from 'node:http';
import worker from './dist/server/index.js';
import {database} from './tests/database.mjs';
const env={DB:database(),TEACHER_PASSWORD:process.env.TEACHER_PASSWORD};
let failNextAnswer=false;
http.createServer(async(req,res)=>{
 try{
  // Local-only fault injection exercises durable pending answers; this file is never deployed.
  if(req.method==='POST'&&req.url==='/__dev/fail-next-answer'){failNextAnswer=true;res.writeHead(204);res.end();return}
  if(req.method==='POST'&&req.url==='/api/student/answer'&&failNextAnswer){failNextAnswer=false;res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'接続を確認してください。回答はこの端末に保管しています。'}));return}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
  const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))
 }catch(error){console.error(error);res.writeHead(500);res.end('Error')}
}).listen(8767,'127.0.0.1',()=>console.log('Local classroom preview on http://127.0.0.1:8767'));
