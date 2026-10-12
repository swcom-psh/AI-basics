// 후보 바꾸기·"응" 시험: node csv_tools/swap_test.mjs <모델> <강도>
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const [모델 = 'gpt-5.6-luna', 강도 = 'low'] = process.argv.slice(2);
const gs = fs.readFileSync(path.join(ROOT, 'apps-script', '코드.gs'), 'utf8');
const 프롬프트 = vm.runInNewContext(gs.slice(gs.indexOf('const 시스템프롬프트 = `'), gs.indexOf('`.trim();') + 8) + ';시스템프롬프트');
const 스키마 = vm.runInNewContext(gs.slice(gs.indexOf('function 응답스키마_'), gs.indexOf('/* ════════ 확정')) + ';응답스키마_()');
async function 호출(m) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_KEY },
    body: JSON.stringify({ model: 모델, reasoning_effort: 강도, max_completion_tokens: 8000, messages: m, response_format: { type: 'json_schema', json_schema: { name: 'topic_step', strict: true, schema: 스키마 } } }) });
  const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j.error)); return JSON.parse(j.choices[0].message.content);
}
let 대화 = [{ role: 'system', content: 프롬프트 }, { role: 'user', content: '안녕하세요. 수행평가 주제를 정하고 싶습니다. 무엇부터 하면 될까요?' },
  { role: 'assistant', content: '안녕하세요! 요즘 관심 있거나 궁금한 게 있나요? 가고 싶은 학과가 있으면 말해 줘도 되고, 없어도 괜찮아요.' }];
for (const 말 of ['경제경영', '빵 말고 좀 실생활에 관련된 주제로', '다른거']) {
  대화.push({ role: 'user', content: 말 }); const o = await 호출(대화); 대화.push({ role: 'assistant', content: JSON.stringify(o) });
  console.log('### ' + 말 + ' [' + o.단계 + ']\n' + o.답변 + '\n');
}
