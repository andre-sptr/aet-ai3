import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AI_MODELS } from '../lib/ai-models.ts';
await fs.mkdir('evaluation',{recursive:true});
const all=process.argv.includes('--all-models');
const budget={strategy:'provider-enforced-key-cap',operatorVerified:false,dedicatedKey:false,currency:'USD',hardLimitUsd:3,verifiedAt:new Date().toISOString(),evidence:'REPLACE: describe the cap actually configured and checked on your dedicated provider key.',keySha256:process.env.SUMOPOD_API_KEY?createHash('sha256').update(process.env.SUMOPOD_API_KEY).digest('hex'):'RUN AGAIN AFTER SETTING YOUR KEY',providerBaseUrl:'https://ai.sumopod.com/v1'};
const pricing={operatorVerified:false,verifiedAt:new Date().toISOString(),sourceUrl:'https://sumopod.com/ai',models:Object.fromEntries((all?AI_MODELS:[AI_MODELS[0]]).map(m=>[m.id,{inputUsdPerMillion:null,outputUsdPerMillion:null}]))};
for(const [name,value] of [['budget.json',budget],['pricing.json',pricing]]){try{await fs.writeFile('evaluation/'+name,JSON.stringify(value,null,2),{flag:'wx'});console.log('Created evaluation/'+name);}catch(e){if(e.code==='EEXIST')console.log('Preserved existing evaluation/'+name);else throw e;}}
console.log('Templates do not authorize spending. Check your provider key cap, fill the actual official rates, then update verifiedAt and the operator attestations. No secret is written to these files.');
