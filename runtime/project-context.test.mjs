import test from 'node:test';import assert from 'node:assert/strict';
import {stageContext} from './project-context.mjs';
test('role context removes duplication while retaining complete independent review inputs',()=>{
 const before='unchanged\n'.repeat(500)+'const score=1;\n',proposed=before.replace('score=1','score=3');
 const stages=['orchestrator','architect','developer','reviewer','qa'].map(id=>({id,status:'COMPLETED',text:id+' private artifact'}));
 const options={original:[{path:'game.js',sha256:'abc',content:before}],draft:{changes:[{path:'game.js',before,content:proposed}]},stages,goal:'bonus',history:[]};
 const plan=stageContext('orchestrator',options);assert.equal(plan.contextKind,'FILE_OVERVIEWS');assert.equal(plan.files[0].overviewPartial,true);
 const review=stageContext('reviewer',options);assert.equal(review.files[0].before,before);assert.equal(review.files[0].proposed,proposed);
 const qa=stageContext('qa',options);assert.equal(qa.files[0].proposed,proposed);assert.equal(qa.files[0].before,undefined);assert.ok(!qa.artifacts.some(a=>a.role==='reviewer'));
 const docs=stageContext('documentation',options);assert.ok(JSON.stringify(docs).includes('score=3'));assert.ok(JSON.stringify(docs).length<JSON.stringify(review).length/4);assert.ok(docs.artifacts.some(a=>a.role==='qa'));
});
