// 후보 억지 여부 판정: prompt_test 결과 폴더의 후보를 다른(강한) 모델이 읽고 "억지/자연" 을 매긴다.
// 사용: node csv_tools/judge_test.mjs <결과폴더> [판정모델] [강도]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const [폴더, 모델 = 'gpt-5.6-terra', 강도 = 'low'] = process.argv.slice(2);
const dir = path.join(ROOT, 'csv_work', 'prompt_test', 폴더);
let 억지 = 0, 전체 = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && f[0] !== '_')) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const 줄 = (j.응답?.답변 || '').split('\n').filter(l => /^\s*[①②③④⑤⑥]/.test(l));
  if (!줄.length) continue;
  const 말 = `고2 인문계 학생이 "${j.말}"라고 말했다. 챗봇이 수행평가용 기계학습 주제(y) 후보를 이렇게 제시했다:\n${줄.join('\n')}\n\n후보마다 판정하라: 학생 말과 이어지는가, 문제가 현실에 있고 그 값을 알아 바꿀 행동이 자연스러운가, 기록되는 값인가. "억지"(끼워 맞춘 느낌)인지 "자연"인지 JSON 배열로만 답하라: [{"번호":"①","판정":"자연|억지","이유":"한 줄"}]`;
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_KEY },
    body: JSON.stringify({ model: 모델, reasoning_effort: 강도, max_completion_tokens: 4000, messages: [{ role: 'user', content: 말 }] }) });
  const d = await r.json(); if (!r.ok) { console.log(f, JSON.stringify(d.error)); continue; }
  let 판 = []; try { 판 = JSON.parse(d.choices[0].message.content.replace(/```json|```/g, '')); } catch { console.log(f, '판정 해석 실패'); continue; }
  console.log('## ' + (j.이름 || f));
  for (const x of 판) { 전체++; if (x.판정 === '억지') { 억지++; console.log('  억지 ' + x.번호 + ' : ' + x.이유 + '\n     ' + (줄.find(l => l.trim().startsWith(x.번호)) || '').slice(0, 110)); } }
}
console.log('\n억지 ' + 억지 + ' / 전체 ' + 전체);
