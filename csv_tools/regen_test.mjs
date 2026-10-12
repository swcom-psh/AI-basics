// [시점 변경] 시험: 하루 전 기준으로 받은 x 보기를 「일주일 전」「한 달 전」에 맞게 다시 만드는지 본다.
// 사용: node csv_tools/regen_test.mjs <모델> <강도> [기준폴더]
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const [모델 = 'gpt-5.6-luna', 강도 = 'low', 기준 = 'time1'] = process.argv.slice(2);
const gs = fs.readFileSync(path.join(ROOT, 'apps-script', '코드.gs'), 'utf8');
const 프롬프트 = vm.runInNewContext(gs.slice(gs.indexOf('const 시스템프롬프트 = `'), gs.indexOf('`.trim();') + 8) + ';시스템프롬프트');
const 스키마 = vm.runInNewContext(gs.slice(gs.indexOf('function 응답스키마_'), gs.indexOf('/* ════════ 확정')) + ';응답스키마_()');
async function 호출(m) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_KEY },
    body: JSON.stringify({ model: 모델, reasoning_effort: 강도, max_completion_tokens: 8000, messages: m, response_format: { type: 'json_schema', json_schema: { name: 'topic_step', strict: true, schema: 스키마 } } }) });
  const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j.error)); return JSON.parse(j.choices[0].message.content);
}
const 인사 = '안녕하세요. 수행평가 주제를 정하고 싶습니다. 무엇부터 하면 될까요?';
const 첫답 = '안녕하세요! 요즘 관심 있거나 궁금한 게 있나요?';
for (const 이름 of ['경영', '환경공학', '스포츠과학', '심리']) {
  const 기 = JSON.parse(fs.readFileSync(path.join(ROOT, 'csv_work', 'prompt_test', 기준, 이름 + '.json'), 'utf8'));
  let 대화 = [{ role: 'system', content: 프롬프트 }, { role: 'user', content: 인사 }, { role: 'assistant', content: 첫답 }, { role: 'user', content: 기.말 }, { role: 'assistant', content: JSON.stringify(기.응답) }, { role: 'user', content: '1번' }];
  const A = await 호출(대화); 대화.push({ role: 'assistant', content: JSON.stringify(A) });
  console.log('### ' + 이름 + ' — y: ' + (A.정리.타깃?.이름 || A.정리.주제) + '\n하루 전 보기: ' + A.정리.x보기.map(x => x.이름).join(', '));
  for (const 시점 of ['일주일 전', '한 달 전']) {
    const 질문 = '[시점 변경]\n예측 시점: ' + 시점 + '\n이 시점에 알 수 있는 값으로 보기를 10개 새로 만들어 주세요.';
    const B = await 호출(대화.concat([{ role: 'user', content: 질문 }]));
    const 이름들 = B.정리.x보기.map(x => x.이름);
    console.log('\n[' + 시점 + '] (' + 이름들.length + '개, 시점기록 "' + B.정리.예측시점 + '", 단계 ' + B.단계 + ')\n' + 이름들.join(', ') + '\n예보 포함: ' + 이름들.filter(n => /예보|내일|다음/.test(n)).join(', ') + '\n답변: ' + B.답변);
  }
}
