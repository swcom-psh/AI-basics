// 학생 첫 말 몇 개를 넣어 후보 목록을 바로 본다. 사용: node csv_tools/topic_probe.mjs <모델> <강도> "첫 말 1" "첫 말 2" ...
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const [모델, 강도, ...말들] = process.argv.slice(2);
const gs = fs.readFileSync(path.join(ROOT, 'apps-script', '코드.gs'), 'utf8');
const 프롬프트 = vm.runInNewContext(gs.slice(gs.indexOf('const 시스템프롬프트 = `'), gs.indexOf('`.trim();') + 8) + ';시스템프롬프트');
const 스키마 = vm.runInNewContext(gs.slice(gs.indexOf('function 응답스키마_'), gs.indexOf('/* ════════ 확정')) + ';응답스키마_()');
for (const 말 of 말들) {
  const messages = [{ role: 'system', content: 프롬프트 }, { role: 'user', content: '안녕하세요. 수행평가 주제를 정하고 싶습니다. 무엇부터 하면 될까요?' },
    { role: 'assistant', content: '안녕하세요! 요즘 관심 있거나 궁금한 게 있나요? 가고 싶은 학과가 있으면 말해 줘도 되고, 없어도 괜찮아요.' }, { role: 'user', content: 말 }];
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_KEY },
    body: JSON.stringify({ model: 모델, reasoning_effort: 강도, max_completion_tokens: 8000, messages, response_format: { type: 'json_schema', json_schema: { name: 'topic_step', strict: true, schema: 스키마 } } }) });
  const j = await r.json(); if (!r.ok) { console.log(JSON.stringify(j.error)); continue; }
  const o = JSON.parse(j.choices[0].message.content);
  console.log('### ' + 말 + ' [' + o.단계 + ']\n' + o.답변 + '\n');
}
