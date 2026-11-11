import test from 'node:test';
import assert from 'node:assert/strict';
import {lineDiff} from './line-diff.mjs';
import {buildMessages} from './executor.mjs';
test('diff records changed lines',()=>{const d=lineDiff('a\nb','a\nc');assert.deepEqual(d.lines.map(x=>x.kind),['same','add','remove']);});
test('diff detects identical text',()=>assert.ok(lineDiff('same','same').lines.every(x=>x.kind==='same')));
test('implementation receives real failing Docker report',()=>{const run={stage:'implementation',prompt:'build',artifacts:[],testResults:[{passed:false,tests:['a.test.js'],output:'expected 2 got 3'}]};assert.match(buildMessages(run)[1].content,/expected 2 got 3/);});
