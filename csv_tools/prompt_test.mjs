// 챗봇 프롬프트 다분야 시험 — 코드.gs 의 시스템프롬프트와 응답스키마를 그대로 읽어 OpenAI 로 호출한다.
// 사용:  node csv_tools/prompt_test.mjs <결과폴더이름> [모델] [추론강도]   (키는 .env 의 OPENAI_KEY, 결과는 csv_work/prompt_test/<폴더>/)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const 폴더 = process.argv[2] || 'run';
const 모델 = process.argv[3] || env.OPENAI_MODEL || 'gpt-4.1';
const 강도 = process.argv[4] || env.OPENAI_EFFORT || 'low';

const gs = fs.readFileSync(path.join(ROOT, 'apps-script', '코드.gs'), 'utf8');
const 프롬프트 = vm.runInNewContext(gs.slice(gs.indexOf('const 시스템프롬프트 = `'), gs.indexOf('`.trim();') + 8) + ';시스템프롬프트');
const 스키마 = vm.runInNewContext(gs.slice(gs.indexOf('function 응답스키마_'), gs.indexOf('/* ════════ 확정')) + ';응답스키마_()');

const 입력 = [
  ['국어교육', '국어 선생님이 되고 싶어서 국어교육과 가고 싶어요'],
  ['스포츠과학', '축구를 좋아해요. 스포츠과학과에 관심 있어요'],
  ['기계공학', '기계공학과에 가고 싶어요'],
  ['생명과학', '생명과학과 가고 싶고 미생물에 관심 있어요'],
  ['간호', '간호학과에 가고 싶어요'],
  ['경영', '경영학과요. 편의점 알바 해 봤어요'],
  ['시각디자인', '시각디자인학과에 관심 있어요'],
  ['실용음악', '실용음악과 가고 싶어요. 작곡을 해요'],
  ['건축', '건축학과 가고 싶어요'],
  ['심리', '심리학과에 관심 있어요'],
  ['컴퓨터공학', '컴퓨터공학과요. 게임을 좋아해요'],
  ['식품영양', '식품영양학과 가고 싶고 급식에 관심 있어요'],
  ['초등교육', '초등교육과 가고 싶어요'],
  ['환경공학', '환경공학과에 가고 싶어요'],
];

const 추론 = /^(gpt-5|gpt-6|o\d)/i.test(모델);
const 출력폴더 = path.join(ROOT, 'csv_work', 'prompt_test', 폴더);
fs.mkdirSync(출력폴더, { recursive: true });

async function 호출(이름, 말) {
  const messages = [
    { role: 'system', content: 프롬프트 },
    { role: 'user', content: '안녕하세요. 수행평가 주제를 정하고 싶습니다. 무엇부터 하면 될까요?' },
    { role: 'assistant', content: '안녕하세요! 관심 있는 분야나 가고 싶은 학과가 있나요? 아직 잘 모르겠으면 요즘 시간을 제일 많이 쓰는 것이나 해 본 일(알바·동아리 등)을 말해 줘도 돼요.' },
    { role: 'user', content: 말 },
  ];
  const payload = { model: 모델, messages, response_format: { type: 'json_schema', json_schema: { name: 'topic_step', strict: true, schema: 스키마 } } };
  if (추론) { payload.reasoning_effort = 강도; payload.max_completion_tokens = 8000; } else { payload.temperature = 0.5; payload.max_completion_tokens = 3000; }
  for (let t = 0; t < 4; t++) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_KEY }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (r.ok) {
      const c = j.choices[0];
      const 결과 = { 이름, 말, 모델, 종료: c.finish_reason, 사용: j.usage, 응답: JSON.parse(c.message.content) };
      fs.writeFileSync(path.join(출력폴더, 이름 + '.json'), JSON.stringify(결과, null, 1), 'utf8');
      return 결과;
    }
    if (r.status === 429 || r.status >= 500) { await new Promise(ok => setTimeout(ok, 3000 * (t + 1))); continue; }
    return { 이름, 말, 오류: JSON.stringify(j.error || j).slice(0, 300) };
  }
  return { 이름, 말, 오류: '재시도 실패' };
}

const 결과들 = [];
const 동시 = 4;
for (let i = 0; i < 입력.length; i += 동시)
  결과들.push(...await Promise.all(입력.slice(i, i + 동시).map(([n, m]) => 호출(n, m))));

let 합 = { 입력: 0, 출력: 0, 캐시: 0, 추론: 0 };
const 요약 = [];
for (const r of 결과들) {
  if (r.오류) { 요약.push(`## ${r.이름}\n오류: ${r.오류}\n`); continue; }
  const u = r.사용 || {};
  합.입력 += u.prompt_tokens || 0; 합.출력 += u.completion_tokens || 0;
  합.캐시 += (u.prompt_tokens_details || {}).cached_tokens || 0; 합.추론 += (u.completion_tokens_details || {}).reasoning_tokens || 0;
  요약.push(`## ${r.이름}  — "${r.말}"\n단계: ${r.응답.단계} | 종료: ${r.종료} | 토큰 입력 ${u.prompt_tokens} 출력 ${u.completion_tokens}\n${r.응답.답변}\n`);
}
요약.push(`\n## 합계 (${결과들.length}회, 모델 ${모델}${추론 ? ' / 추론 ' + 강도 : ''})\n입력 ${합.입력} 토큰, 출력 ${합.출력} 토큰 (추론 ${합.추론}), 캐시 ${합.캐시}`);
fs.writeFileSync(path.join(출력폴더, '_요약.md'), 요약.join('\n'), 'utf8');
console.log('완료:', 출력폴더);
