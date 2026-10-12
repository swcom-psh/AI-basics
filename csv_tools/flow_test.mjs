// 새 흐름(맞힐 것 말하기 → 필요한 정보 말하기 → 화면 → 마무리) 시나리오 시험
// 사용: node csv_tools/flow_test.mjs <모델> <강도> [시나리오이름 ...]
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const [모델 = 'gpt-5.6-luna', 강도 = 'low', ...고름] = process.argv.slice(2);
const gs = fs.readFileSync(path.join(ROOT, 'apps-script', '코드.gs'), 'utf8');
const 프롬프트 = vm.runInNewContext(gs.slice(gs.indexOf('const 시스템프롬프트 = `'), gs.indexOf('`.trim();') + 8) + ';시스템프롬프트');
const 스키마 = vm.runInNewContext(gs.slice(gs.indexOf('function 응답스키마_'), gs.indexOf('/* ════════ 확정')) + ';응답스키마_()');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const 첫인사 = html.match(/const 첫인사 = '([^']*)'/)[1];

async function 호출(m) {
  for (let t = 0; t < 4; t++) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_KEY },
      body: JSON.stringify({ model: 모델, reasoning_effort: 강도, max_completion_tokens: 8000, messages: m, response_format: { type: 'json_schema', json_schema: { name: 'topic_step', strict: true, schema: 스키마 } } }) });
    const j = await r.json(); if (r.ok) return JSON.parse(j.choices[0].message.content);
    if (r.status === 429 || r.status >= 500) { await new Promise(ok => setTimeout(ok, 3000 * (t + 1))); continue; }
    throw new Error(JSON.stringify(j.error));
  }
}
const 관계 = ['늘어날 것 같다', '줄어들 것 같다', '관계없을 것 같다'];

// 각 말: 문자열이거나, 함수(마지막 정리) → 문자열
const 시나리오 = {
  구체y: ['편의점 알바를 하는데, 내일 삼각김밥이 몇 개 팔릴지 맞혀 보고 싶어요', '날씨랑 요일, 어제 판매량이요', '좋아요',
          (정) => 화면선택(정, '강남역 편의점', 5), '[마무리 서술]\n내 주제: 날씨와 요일, 어제 판매량으로 삼각김밥 판매량을 예측한다\n문제 해결 활용: 점장이 발주량을 미리 정해 남는 도시락 폐기를 줄일 수 있다'],
  막연: ['게임 좋아해요', '3번', '좋아요', '모르겠어요', (정) => 화면선택(정, '리그 오브 레전드 서버', 5)],
  범위밖: ['사진을 보고 강아지 품종을 맞히는 AI를 만들고 싶어요', '그대로 할래요'],
  의미없음: ['인천공항 하루 도착 항공편 수를 예측하고 싶어요', '그대로 할래요'],
  분류: ['체육학과 가고 싶고 축구 경기에서 우리 팀이 이길지 질지 맞히고 싶어요', '이기면 승, 지거나 비기면 패로 할래요', '최근 5경기 득점이랑 상대 팀 순위, 홈 경기인지요'],
  모름: ['잘 모르겠어요'],
  문제x: ['우리 학교 매점 하루 매출액을 맞히고 싶어요', '그날 방문한 학생 수랑 매점 사장님 기분이랑 날씨요', '그럼 방문객 수는 빼고 시험 기간인지, 행사 있는지로 할게요', '좋아요'],
  마무리약함: ['편의점 삼각김밥 판매량 예측하고 싶어요', '날씨 요일 전날 판매량', '좋아요', (정) => 화면선택(정, '강남역 편의점', 5),
            '[마무리 서술]\n내 주제: 삼각김밥 판매량 예측\n문제 해결 활용: 편의점에서 쓴다',
            '[마무리 서술]\n내 주제: 날씨와 요일로 삼각김밥 판매량을 예측한다\n문제 해결 활용: 점장이 발주를 미리 해서 버리는 게 줄어든다'],
  자료질문: ['내일 급식 잔반이 몇 kg 나올지 예측하고 싶어요', '근데 그 자료는 어디서 구해요?']
};
function 화면선택(정, 대상, n) {
  const 보기 = (정 && 정.x보기) || [];
  if (!보기.length) return '[정보 선택]\n대상: ' + 대상 + '\n(보기가 비어 있음)';
  return '[정보 선택]\n대상: ' + 대상 + '\n' + 보기.slice(0, n).map((x, i) => '정보: ' + x.이름 + ' | ' + 관계[i % 3] + ' | ').join('\n');
}

const 이름들 = 고름.length ? 고름 : Object.keys(시나리오);
for (const 이름 of 이름들) {
  console.log('\n██████ ' + 이름);
  let 대화 = [{ role: 'system', content: 프롬프트 }, { role: 'user', content: '안녕하세요. 수행평가 주제를 정하고 싶습니다. 무엇부터 하면 될까요?' }, { role: 'assistant', content: 첫인사 }];
  let 정 = null;
  for (const 말 of 시나리오[이름]) {
    const 글 = typeof 말 === 'function' ? 말(정) : 말;
    대화.push({ role: 'user', content: 글 });
    const o = await 호출(대화); 대화.push({ role: 'assistant', content: JSON.stringify(o) }); 정 = o.정리;
    console.log('\n[학생] ' + 글.replace(/\n/g, ' / ').slice(0, 160));
    console.log('[봇:' + o.단계 + '] ' + o.답변);
    const 요 = [정.트랙 && '트랙=' + 정.트랙, 정.주제 && '주제=' + 정.주제, 정.타깃?.이름 && 'y=' + 정.타깃.이름 + (정.타깃.단위 !== '해당 없음' ? '(' + 정.타깃.단위 + ')' : ''), 정.범주A && 정.범주A !== '해당 없음' && '범주=' + 정.범주A + '/' + 정.범주B,
              정.x보기.length && 'x보기 ' + 정.x보기.length + '개: ' + 정.x보기.map(x => x.이름 + (x.종류 === '학생이 말한 정보' ? '★' : '')).join(', '), 정.대상후보.length && '대상후보=' + 정.대상후보.join('/'), 정.특성.length && '특성 ' + 정.특성.length + '개',
              정.확인문장 && '확인문장=' + 정.확인문장.slice(0, 40), 정.활용방안 && '활용방안=' + 정.활용방안.slice(0, 40),
              o.확정가능 && '확정가능'].filter(Boolean);
    if (요.length) console.log('   · ' + 요.join(' | '));
  }
}
