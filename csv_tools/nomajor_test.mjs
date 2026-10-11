// 학과 없는 학생 시험: node csv_tools/nomajor_test.mjs <모델> <강도>
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const [모델 = 'gpt-5.6-luna', 강도 = 'low'] = process.argv.slice(2);
const gs = fs.readFileSync(path.join(ROOT, 'apps-script', '코드.gs'), 'utf8');
const 프롬프트 = vm.runInNewContext(gs.slice(gs.indexOf('const 시스템프롬프트 = `'), gs.indexOf('`.trim();') + 8) + ';시스템프롬프트');
const 스키마 = vm.runInNewContext(gs.slice(gs.indexOf('function 응답스키마_'), gs.indexOf('/* ════════ 확정')) + ';응답스키마_()');
const 인사 = '안녕하세요. 수행평가 주제를 정하고 싶습니다. 무엇부터 하면 될까요?';
const 첫답 = '안녕하세요! 요즘 관심 있거나 궁금한 게 있나요? 가고 싶은 학과가 있으면 말해 줘도 되고, 없어도 괜찮아요. 시간을 제일 많이 쓰는 것이나 해 본 일(알바·동아리 등)도 좋아요.';
const 말들 = ['학과는 아직 못 정했고 요즘 시험 기간에 잠을 너무 못 자서 힘들어요', '딱히 관심 없어요. 학과도 모르겠고 그냥 빨리 끝내고 싶어요', '축구 보는 거 좋아하고 학과는 없어요'];
for (const 말 of 말들) {
  const payload = { model: 모델, reasoning_effort: 강도, max_completion_tokens: 8000, messages: [{ role: 'system', content: 프롬프트 }, { role: 'user', content: 인사 }, { role: 'assistant', content: 첫답 }, { role: 'user', content: 말 }], response_format: { type: 'json_schema', json_schema: { name: 'topic_step', strict: true, schema: 스키마 } } };
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_KEY }, body: JSON.stringify(payload) });
  const j = await r.json(); if (!r.ok) { console.log(JSON.stringify(j.error)); continue; }
  const o = JSON.parse(j.choices[0].message.content);
  console.log('### ' + 말 + '\n[단계 ' + o.단계 + ' / 연계학과: "' + o.정리.연계학과 + '"]\n' + o.답변 + '\n');
}
