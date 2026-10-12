// 챗봇 3단계 이어서 시험: ① y 고르기(→ 대상후보·x보기 10개) ② [정보 선택] 옮겨 적기 ③ [마무리 서술] 옮겨 적기
// 사용: node csv_tools/prompt_chain_test.mjs <결과폴더> <모델> <추론강도> [기준폴더]
//   기준폴더: 첫 후보 목록을 이미 받아 둔 폴더(prompt_test.mjs 결과). 같은 후보 목록을 모든 모델에 줘서 공정하게 비교한다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const [폴더, 모델, 강도, 기준 = 'terra_none_v2'] = process.argv.slice(2);
const gs = fs.readFileSync(path.join(ROOT, 'apps-script', '코드.gs'), 'utf8');
const 프롬프트 = vm.runInNewContext(gs.slice(gs.indexOf('const 시스템프롬프트 = `'), gs.indexOf('`.trim();') + 8) + ';시스템프롬프트');
const 스키마 = vm.runInNewContext(gs.slice(gs.indexOf('function 응답스키마_'), gs.indexOf('/* ════════ 확정')) + ';응답스키마_()');
const 추론 = /^(gpt-5|gpt-6|o\d)/i.test(모델);
const 출력 = path.join(ROOT, 'csv_work', 'prompt_test', 폴더); fs.mkdirSync(출력, { recursive: true });
const 기준폴더 = path.join(ROOT, 'csv_work', 'prompt_test', 기준);

async function 호출(messages) {
  const payload = { model: 모델, messages, response_format: { type: 'json_schema', json_schema: { name: 'topic_step', strict: true, schema: 스키마 } } };
  if (추론) { payload.reasoning_effort = 강도; payload.max_completion_tokens = 8000; } else { payload.temperature = 0.5; payload.max_completion_tokens = 3000; }
  for (let t = 0; t < 4; t++) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_KEY }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (r.ok) return { 응답: JSON.parse(j.choices[0].message.content), 사용: j.usage, 종료: j.choices[0].finish_reason };
    if (r.status === 429 || r.status >= 500) { await new Promise(ok => setTimeout(ok, 3000 * (t + 1))); continue; }
    throw new Error(JSON.stringify(j.error || j).slice(0, 200));
  }
  throw new Error('재시도 실패');
}
const 관계목록 = ['늘어날 것 같다', '줄어들 것 같다', '관계없을 것 같다'];
const 인사 = '안녕하세요. 수행평가 주제를 정하고 싶습니다. 무엇부터 하면 될까요?';
const 첫답 = '안녕하세요! 관심 있는 분야나 가고 싶은 학과가 있나요? 아직 잘 모르겠으면 요즘 시간을 제일 많이 쓰는 것이나 해 본 일(알바·동아리 등)을 말해 줘도 돼요.';

async function 한분야(파일) {
  const 기준결과 = JSON.parse(fs.readFileSync(path.join(기준폴더, 파일), 'utf8'));
  const 사용 = [];
  let 대화 = [{ role: 'system', content: 프롬프트 }, { role: 'user', content: 인사 }, { role: 'assistant', content: 첫답 },
              { role: 'user', content: 기준결과.말 }, { role: 'assistant', content: 기준결과.응답.답변 }];
  // ① 첫 후보 번호 고르기
  const 번호 = (기준결과.응답.답변.match(/^\s*①.*$/m) ? '1번' : '1번');
  대화.push({ role: 'user', content: 번호 });
  const A = await 호출(대화); 사용.push(A.사용);
  const 정리A = A.응답.정리;
  const 결과 = { 이름: 기준결과.이름, A: { 단계: A.응답.단계, 대상후보: 정리A.대상후보, x보기: 정리A.x보기, 트랙: 정리A.트랙, 주제: 정리A.주제, 타깃: 정리A.타깃, 답변: A.응답.답변 } };
  if (!정리A.x보기 || 정리A.x보기.length < 4) { 결과.중단 = 'x보기 없음'; return 결과; }
  // ② [정보 선택]
  const 대상 = (정리A.대상후보 && 정리A.대상후보[0]) || '우리 학교';
  const 고름 = 정리A.x보기.slice(0, 5);
  const 줄 = 고름.map((x, i) => ({ 이름: x.이름, 관계: 관계목록[i % 3], 한줄: i === 0 ? '어제 많았으면 오늘도 많을 것 같아서' : '' }));
  const 메시지B = '[정보 선택]\n대상: ' + 대상 + '\n' + 줄.map(r => '정보: ' + r.이름 + ' | ' + r.관계 + ' | ' + r.한줄).join('\n');
  대화.push({ role: 'assistant', content: JSON.stringify(A.응답) }, { role: 'user', content: 메시지B });
  const B = await 호출(대화); 사용.push(B.사용);
  const 정리B = B.응답.정리;
  const 기대 = 줄.map(r => r.관계 + (r.한줄 ? ' (' + r.한줄 + ')' : ''));
  결과.B = { 단계: B.응답.단계, 대상: 정리B.대상, 대상확인: 정리B.대상확인, 기대대상: 대상, 특성: 정리B.특성.map(x => ({ 이름: x.이름, 떠올린사람: x.떠올린사람, 가설: x.가설 })), 기대특성: 줄.map((r, i) => ({ 이름: r.이름, 가설: 기대[i] })), 보기유지: (정리B.x보기 || []).length, 답변: B.응답.답변 };
  // ③ [마무리 서술]
  // 현실적인 학생 서술: 맞힐 것(y)과 정보 이름 둘 이상이 들어 있고, 활용에는 누가·어떤 문제·어떻게가 들어 있다
  const y이름 = (정리A.타깃 && 정리A.타깃.이름) || 정리A.주제 || '맞힐 값';
  const 주제 = y이름 + '을(를) ' + 고름[0].이름 + '과(와) ' + 고름[1].이름 + ' 같은 정보로 예측해 보려고 한다';
  const 활용 = '운영 담당자가 이 값을 미리 알면 인력과 물품을 미리 준비해서 혼잡과 낭비라는 문제를 줄일 수 있다';
  대화.push({ role: 'assistant', content: JSON.stringify(B.응답) }, { role: 'user', content: '[마무리 서술]\n내 주제: ' + 주제 + '\n문제 해결 활용: ' + 활용 });
  const C = await 호출(대화); 사용.push(C.사용);
  결과.C = { 단계: C.응답.단계, 확정가능: C.응답.확정가능, 확인문장: C.응답.정리.확인문장, 활용방안: C.응답.정리.활용방안, 기대주제: 주제, 기대활용: 활용, 답변: C.응답.답변, 특성수: C.응답.정리.특성.length };
  결과.사용 = 사용.map(u => ({ 입력: u.prompt_tokens, 출력: u.completion_tokens, 캐시: (u.prompt_tokens_details || {}).cached_tokens || 0 }));
  fs.writeFileSync(path.join(출력, 기준결과.이름 + '.json'), JSON.stringify(결과, null, 1), 'utf8');
  return 결과;
}

const 파일들 = fs.readdirSync(기준폴더).filter(f => f.endsWith('.json'));
const 결과들 = [];
for (let i = 0; i < 파일들.length; i += 4)
  결과들.push(...await Promise.all(파일들.slice(i, i + 4).map(f => 한분야(f).catch(e => ({ 이름: f, 오류: String(e.message || e) })))));
fs.writeFileSync(path.join(출력, '_전체.json'), JSON.stringify(결과들, null, 1), 'utf8');
console.log('완료', 폴더, 결과들.length);
