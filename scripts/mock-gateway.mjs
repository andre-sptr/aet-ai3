import http from 'node:http';
const port=Number(process.env.AET_MOCK_PORT||8799);
const server=http.createServer(async(req,res)=>{
 let raw='';for await(const c of req){raw+=c;if(raw.length>9_000_000){res.writeHead(413).end();return;}}
 let body;try{body=JSON.parse(raw);}catch{res.writeHead(400).end();return;}
 const content=body.messages?.at(-1)?.content||'';
 const text=Array.isArray(content)?content.filter(p=>p.type==='text').map(p=>p.text).join('\n'):content;
 if(typeof text!=='string'){res.writeHead(400).end();return;}
 if(text.includes('MOCK_ERROR_HTTP')){res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:'qa-private-upstream-detail'}));return;}
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 const delta=value=>res.write(`data: ${JSON.stringify({model:body.model,choices:[{delta:{content:value}}]})}\n\n`);
 const finish=()=>res.end(`data: ${JSON.stringify({model:body.model,choices:[{delta:{},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);
 if(Array.isArray(content)&&content.some(p=>p.type==='image_url')){delta('Image input received.');finish();return;}
 if(text.includes('MOCK_RENDERING')){
  delta(['Rumus $x^2 + y^2 = z^2$.', '', '```mermaid', 'flowchart TD', 'A[Masukan] --> B[Hasil]', '```', '', '```python', 'print(2 + 2)', '```'].join('\n'));
  finish();return;
 }
 if(text.includes('MOCK_SLOW')){let count=0;const timer=setInterval(()=>{delta('slow ');if(++count===20){clearInterval(timer);finish();}},300);res.on('close',()=>clearInterval(timer));return;}
 delta('AET test response. ');
 if(text.includes('MOCK_ERROR_FRAME')){res.end('data: {"error":{"message":"qa-private-upstream-detail"}}\n\n');return;}
 if(text.includes('MOCK_TRUNCATED')){res.end();return;}
 if(text.includes('fixture'))delta('The sensor reads temperature.');
 finish();
});
server.listen(port,'127.0.0.1',()=>console.log(`Local QA gateway listening on ${port}`));
