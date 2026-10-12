// prompt_test 결과 폴더에 서버의 「후보걸러내기_」를 그대로 적용해 새 폴더로 저장한다.
// 사용: node csv_tools/review_apply.mjs <원본폴더> <새폴더> [모델] [강도]
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const [원본, 새, 모델 = 'gpt-5.6-luna', 강도 = 'low'] = process.argv.slice(2);
const gs = fs.readFileSync(path.join(ROOT, 'apps-script', '코드.gs'), 'utf8');
const 코드 = gs.slice(gs.indexOf('const 후보검토프롬프트'), gs.indexOf('// y 후보 목록(①②…)이 약속한 형식을 지켰는지'));
const 이름 = {}; // 비동기 호출을 동기처럼 쓰기 위해 결과를 미리 받아 두는 방식 대신, 함수를 async 로 바꿔 실행한다
const 변환 = 코드.replace('function 후보걸러내기_(', 'async function 후보걸러내기_(').replace('const r = 호출하기_(키, 검토);', 'const r = await 호출하기_(키, 검토);');
const ctx = { console, 호출하기_: async (키, payload) => {
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_KEY }, body: JSON.stringify(payload) });
  const j = await r.json(); if (!r.ok) return { 오류: JSON.stringify(j.error) };
  return { out: JSON.parse(j.choices[0].message.content) };
} };
vm.createContext(ctx); vm.runInContext(변환 + ';this.f=후보걸러내기_;', ctx);
const 입 = path.join(ROOT, 'csv_work', 'prompt_test', 원본), 출 = path.join(ROOT, 'csv_work', 'prompt_test', 새); fs.mkdirSync(출, { recursive: true });
let 바뀜 = 0;
for (const f of fs.readdirSync(입).filter(f => f.endsWith('.json') && f[0] !== '_')) {
  const j = JSON.parse(fs.readFileSync(path.join(입, f), 'utf8')); const 전 = j.응답.답변;
  await ctx.f('', { 모델, 추론: true, 강도 }, j.응답);
  if (j.응답.답변 !== 전) 바뀜++;
  fs.writeFileSync(path.join(출, f), JSON.stringify(j, null, 1), 'utf8');
}
console.log('목록이 바뀐 분야', 바뀜);
