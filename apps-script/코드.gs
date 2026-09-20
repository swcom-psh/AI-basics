/**
 * 인공지능 기초 수행평가 — 주제 정하기 챗봇 (챗봇1) · 백엔드
 *
 * 화면(index.html)은 GitHub Pages 에서 돌고, 이 스크립트는 API 역할만 한다.
 * 학생 인증은 구글 ID 토큰을 받아 이 서버에서 직접 검증한다.
 *
 * ── 설치 순서 ───────────────────────────────────────────
 *  1) 기록을 남길 스프레드시트에서 확장 프로그램 → Apps Script → 이 파일을 붙여넣기
 *     (따로 만든 프로젝트라면 아래 SHEET_ID 에 스프레드시트 ID를 넣는다)
 *  2) 그 스프레드시트에 KEY 라는 시트를 만들고 A2 칸에 OpenAI 키를 넣는다
 *     (스크립트 속성 OPENAI_KEY 에 넣어도 된다. 그쪽이 있으면 그것을 먼저 쓴다)
 *  3) 최초설정() 실행 → 시트1에 머리글이 만들어진다 (권한 승인 필요)
 *  4) 배포 → 새 배포 → 웹 앱
 *        실행 사용자 : 나
 *        액세스 권한 : 모든 사용자          ← 반드시 '모든 사용자'
 *     (정적 페이지에서 부르려면 이래야 한다. 로그인 검사는 이 코드가 직접 한다.)
 *  5) 나온 웹앱 URL 을 index.html 의 API_URL 에 넣는다
 *  6) 구글 클라우드 OAuth 클라이언트의 '승인된 JavaScript 원본'에
 *     GitHub Pages 주소(https://아이디.github.io)를 등록한다
 * ───────────────────────────────────────────────────────
 */

/* ════════ 설정 ════════ */
const CLIENT_ID = '508397953247-cec1cb0u7jmheuup6llmo05423lcibbu.apps.googleusercontent.com';
const DOMAIN    = 'sdhs.gwe.hs.kr';
const ADMINS    = ['pshyun1109@sdhs.gwe.hs.kr'];   // 항상 관리자로 들어오는 계정

const MODEL       = 'gpt-4o-mini';
const 시트이름     = '시트1';   // 주제 확정 내용과 대화 기록이 함께 쌓이는 시트
const 키시트이름   = 'KEY';      // 이 시트 A2 칸에서 OpenAI 키를 읽는다

// 이 스크립트를 스프레드시트에 붙여서(확장 프로그램 → Apps Script) 만들었다면 비워 둔다.
// 따로 만든 프로젝트라면 기록을 남길 스프레드시트 ID를 넣는다.
const SHEET_ID = '';

/* ════════════════════════════════════════════════════════
   교사가 심어 두는 조건 — 이 부분만 고치면 챗봇 행동이 바뀐다
   ════════════════════════════════════════════════════════ */
const 시스템프롬프트 = `
너는 고등학교 「인공지능 기초」 수행평가를 준비하는 학생과 1:1로 대화하는 도우미다.
학생이 하고 싶은 주제를, 선생님이 데이터로 만들어 줄 수 있는 형태까지 함께 다듬는 것이 네 일이다.

# 반드시 지킬 것

1. 최종 결과는 아래 둘 중 하나로 귀결되어야 한다.
   - 예측 : 맞히려는 답이 연속된 숫자 (몇 잔, 몇 원, 몇 분)
   - 분류 : 맞히려는 답이 정해진 두 가지 중 하나 (홍로/부사, 합격/불합격)
   세 가지 이상으로 나누는 분류는 받지 않는다. 두 개로 줄이도록 안내한다.

2. 맞히려는 값(타깃)은 하나만 정한다. 이름·단위·대략적인 값의 범위를 모두 확정해야 한다.

3. 맞히는 데 쓸 정보(특성)는 3개 또는 4개다. 각각 이름·단위·대략적인 값의 범위를 확정한다.
   특성은 반드시 숫자로 잴 수 있어야 한다. "분위기", "인기" 같은 것은 받지 않는다.
   다만 1~5점 척도처럼 숫자로 바꿀 수 있으면 괜찮다. 0/1로 표시하는 것(주말인가, 비가 왔나)도 좋다.

4. 값의 범위는 학생이 직접 찾아보게 한다. 네가 숫자를 먼저 알려주지 않는다.
   "하루 판매량이 보통 어느 정도인지 인터넷에서 찾아볼래? 찾으면 숫자와 어디서 봤는지 알려 줘." 처럼 묻는다.
   - 학생이 출처와 함께 가져오면 그 범위와 출처를 그대로 기록한다.
   - 한참 찾아도 없다고 하면 그때만 네가 상식적인 범위를 제안하고 학생 확인을 받는다.
     이 경우 근거는 "찾지 못함 — 상식으로 정함"으로 기록한다.
   - 출처는 기관명·사이트명·기사 제목 정도면 된다 (예: 농촌진흥청 자료, 기상청 날씨누리, ○○신문 기사).
   - 네가 출처를 지어내거나 대신 채우지 않는다. 학생이 말한 것만 적는다.
   맞히려는 값(타깃)과 쓸 정보(특성) 각각에 대해 이렇게 한다. '도움 안 될 것 같은 값'은 근거가 필요 없다.

5. 특성마다 타깃에 미치는 영향의 방향을 학생이 정하게 한다. 네가 정하지 않는다.
   예측이면 : "기온이 오르면 판매량은 늘까, 줄까? 영향은 큰 편일까 작은 편일까?"
     → 강한양 / 중간양 / 약한양 / 약한음 / 중간음 / 강한음 중 하나로 정리한다.
   분류면 : "무게가 큰 쪽은 홍로일까 부사일까?"
     → 두 범주 중 어느 쪽이 그 값이 큰지로 정리한다.

6. 예측 주제라면, 맞히는 데 별 도움이 안 될 것 같지만 같이 기록되는 값 하나를 더 물어본다.
   (예: 카페 판매량에 전날 남은 재고) 수업에서 쓸 것이니 꼭 받되, 마땅한 게 없으면 넘어간다.

7. 왜 이 주제를 골랐는지, 이 모델이 만들어지면 무엇이 달라지는지를 학생의 말로 받아 둔다.
   두세 문장이면 된다. 학생이 쓴 표현을 고치지 말고 그대로 담는다.

# 절대 하지 말 것

- 기계학습 방법, 알고리즘 선택, 파이썬 코드, 전처리 방법은 알려주지 않는다.
  그것은 학생이 수행평가에서 직접 판단할 내용이다. 물으면 "그건 수행평가 때 직접 정하는 부분"이라고만 답한다.
- 학생 대신 주제를 정해 버리지 않는다. 막연해하면 예시를 두세 개 들어 고르게 한다.
- 값의 범위나 영향 방향을 학생 확인 없이 확정하지 않는다.
- 출처를 지어내지 않는다. 학생이 찾아온 것이 아니면 근거 칸에 넣지 않는다.

# 대화 방식

- 한 번에 한 가지만 묻는다. 질문을 몰아서 던지지 않는다.
- 고등학생에게 말하듯 쉽게, 짧게 쓴다. 3~4문장을 넘기지 않는다.
- 학생이 "모르겠어요"라고 하면 구체적인 예를 들어 고르게 한다.
- 다 정해졌으면 전체를 짧게 요약해 보여주고, 학생이 확인하면 완료 상태로 넘긴다.

# 출력 형식

반드시 지정된 JSON 형식으로만 답한다.
- 답변 : 학생에게 보일 말
- 단계 : 지금 어디까지 왔는지
- 정리 : 지금까지 확정된 내용 (아직 안 정해진 항목은 빈 문자열이나 0)
- 확정가능 : 위 1~7이 모두 채워졌고(근거 칸 포함) 학생이 요약을 확인했으면 true
`.trim();

/* ════════ 라우팅 ════════ */
function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (_) {}
  try {
    switch (req.action) {
      case 'login':    return 응답_(로그인_(req));
      case 'chat':     return 응답_(대화_(req));
      case 'finalize': return 응답_(확정_(req));
      case 'admin':    return 응답_(관리_(req));
      default:         return 응답_({ 오류: '알 수 없는 요청입니다.' });
    }
  } catch (err) {
    console.error(err);
    return 응답_({ 오류: '서버에서 문제가 생겼습니다: ' + err.message });
  }
}

function doGet() {
  return ContentService.createTextOutput(
    '이 주소는 API 전용입니다. 학생용 화면은 따로 있습니다.'
  );
}

function 응답_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ════════ 인증 — 구글 ID 토큰을 이 서버에서 검증한다 ════════ */
function 인증_(token) {
  if (!token) return { ok: false, 오류: '로그인이 필요합니다.' };

  const 캐시키 = 'tk_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  const cache = CacheService.getScriptCache();
  const hit = cache.get(캐시키);
  if (hit) return JSON.parse(hit);

  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
    { muteHttpExceptions: true });

  if (res.getResponseCode() !== 200) {
    return { ok: false, 만료: true, 오류: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
  }
  const t = JSON.parse(res.getContentText());

  if (t.aud !== CLIENT_ID)
    return { ok: false, 오류: '허용되지 않은 경로로 들어왔습니다.' };
  if (String(t.email_verified) !== 'true')
    return { ok: false, 오류: '확인되지 않은 계정입니다.' };

  const 메일 = String(t.email || '').toLowerCase();
  if (메일.indexOf('@' + DOMAIN) !== 메일.length - DOMAIN.length - 1)
    return { ok: false, 오류: '학교 계정(@' + DOMAIN + ')으로 로그인해야 합니다. 지금 계정: ' + 메일 };

  const out = {
    ok: true,
    메일: 메일,
    이름: t.name || '',
    학번: 메일.split('@')[0],
    관리자: ADMINS.indexOf(메일) >= 0
  };
  cache.put(캐시키, JSON.stringify(out), 300);   // 5분간 재검증 생략
  return out;
}

function 로그인_(req) {
  const a = 인증_(req.token);
  if (!a.ok) return a;
  const 이전 = 내기록_(a.메일);
  return { ok: true, 이름: a.이름, 메일: a.메일, 학번: a.학번,
           관리자: a.관리자, 이전확정: 이전 };
}

/* ════════ OpenAI 키 ════════
   스크립트 속성 OPENAI_KEY 가 있으면 그것을, 없으면 KEY 시트 A2 칸을 쓴다. */
function API키_() {
  const p = PropertiesService.getScriptProperties();
  const 속성 = (p.getProperty('OPENAI_KEY') || '').trim();
  if (속성) return 속성;

  const cache = CacheService.getScriptCache();
  const hit = cache.get('openai_key');
  if (hit) return hit;

  try {
    const sh = 스프레드시트_().getSheetByName(키시트이름);
    if (!sh) return '';
    const v = String(sh.getRange('A2').getValue() || '').trim();
    if (v) cache.put('openai_key', v, 600);   // 10분 캐시
    return v;
  } catch (e) {
    return '';
  }
}

/* ════════ 대화 ════════ */
function 대화_(req) {
  const a = 인증_(req.token);
  if (!a.ok) return a;

  const 키 = API키_();
  if (!키) return { 오류: 'API 키가 설정되지 않았습니다. 선생님께 알려 주세요.' };

  const messages = [{ role: 'system', content: 시스템프롬프트 }].concat(
    (req.history || []).map(m => ({ role: m.role, content: m.content })));

  const payload = {
    model: MODEL, messages: messages, temperature: 0.6, max_tokens: 1200,
    response_format: { type: 'json_schema',
      json_schema: { name: 'topic_step', strict: true, schema: 응답스키마_() } }
  };

  let res;
  try {
    res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + 키 },
      payload: JSON.stringify(payload), muteHttpExceptions: true });
  } catch (err) {
    return { 오류: '서버에 연결하지 못했습니다. 잠시 뒤 다시 시도하세요.' };
  }

  const code = res.getResponseCode();
  if (code !== 200) {
    console.error('OpenAI ' + code + ' : ' + res.getContentText().slice(0, 400));
    if (code === 429) return { 오류: '지금 요청이 많습니다. 20초쯤 뒤에 다시 보내세요.' };
    return { 오류: '답을 받아오지 못했습니다 (' + code + '). 다시 시도해 보세요.' };
  }
  try {
    const j = JSON.parse(res.getContentText());
    const out = JSON.parse(j.choices[0].message.content);
    out.사용토큰 = (j.usage && j.usage.total_tokens) || 0;
    return out;
  } catch (err) {
    return { 오류: '답의 형식이 올바르지 않습니다. 다시 시도해 보세요.' };
  }
}

function 응답스키마_() {
  const 특성 = {
    type: 'object', additionalProperties: false,
    required: ['이름', '단위', '최소', '최대', '근거', '영향', '높은쪽'],
    properties: {
      이름: { type: 'string' }, 단위: { type: 'string' },
      최소: { type: 'number' }, 최대: { type: 'number' },
      근거: { type: 'string', description: '학생이 찾아온 출처. 못 찾았으면 "찾지 못함 — 상식으로 정함". 아직이면 빈 문자열' },
      영향:   { type: 'string', description: '예측일 때만. 강한양/중간양/약한양/약한음/중간음/강한음. 아니면 빈 문자열' },
      높은쪽: { type: 'string', description: '분류일 때만. 이 값이 큰 쪽 범주 이름. 아니면 빈 문자열' }
    }
  };
  return {
    type: 'object', additionalProperties: false,
    required: ['답변', '단계', '정리', '확정가능'],
    properties: {
      답변: { type: 'string' },
      단계: { type: 'string', enum: ['주제탐색','유형정하기','타깃확정','특성확정','방향확정','이유작성','요약확인','완료'] },
      확정가능: { type: 'boolean' },
      정리: {
        type: 'object', additionalProperties: false,
        required: ['트랙','주제','타깃','범주A','범주B','특성','무관변수','이유','기대효과'],
        properties: {
          트랙: { type: 'string', enum: ['', '예측', '분류'] },
          주제: { type: 'string' },
          타깃: { type: 'object', additionalProperties: false,
                  required: ['이름','단위','최소','최대','근거'],
                  properties: { 이름:{type:'string'}, 단위:{type:'string'},
                                최소:{type:'number'}, 최대:{type:'number'},
                                근거:{type:'string', description:'예측일 때 범위의 출처. 분류면 빈 문자열'} } },
          범주A: { type: 'string' }, 범주B: { type: 'string' },
          특성: { type: 'array', items: 특성 },
          무관변수: { type: 'object', additionalProperties: false,
                      required: ['이름','단위','최소','최대'],
                      properties: { 이름:{type:'string'}, 단위:{type:'string'},
                                    최소:{type:'number'}, 최대:{type:'number'} } },
          이유: { type: 'string' }, 기대효과: { type: 'string' }
        }
      }
    }
  };
}

/* ════════ 확정 ════════ */
function 검사_(s) {
  const 부족 = [];
  const 있 = v => v && String(v).trim().length > 0;

  if (['예측','분류'].indexOf(s.트랙) < 0) 부족.push('문제 유형(예측인지 분류인지)');
  if (!있(s.주제) || s.주제.length < 5) 부족.push('주제 한 줄');

  const t = s.타깃 || {};
  if (!있(t.이름)) 부족.push('맞히려는 값의 이름');
  if (s.트랙 === '예측') {
    if (!있(t.단위)) 부족.push('맞히려는 값의 단위');
    if (!(t.최대 > t.최소)) 부족.push('맞히려는 값의 범위');
    if (!있(t.근거)) 부족.push('맞히려는 값 범위의 근거 (못 찾았으면 못 찾았다고)');
  }
  if (s.트랙 === '분류') {
    if (!있(s.범주A) || !있(s.범주B)) 부족.push('맞히려는 두 가지');
    if (있(s.범주A) && s.범주A === s.범주B) 부족.push('두 가지가 서로 달라야 함');
  }

  const f = s.특성 || [];
  if (f.length < 3) 부족.push('쓸 정보 3개 이상 (지금 ' + f.length + '개)');
  if (f.length > 4) 부족.push('쓸 정보는 4개까지 (지금 ' + f.length + '개)');
  const 이름들 = {};
  f.forEach((x, i) => {
    const n = i + 1;
    if (!있(x.이름)) 부족.push(n + '번째 정보의 이름');
    else if (이름들[x.이름]) 부족.push('정보 이름이 겹침: ' + x.이름);
    else 이름들[x.이름] = 1;
    if (!있(x.단위)) 부족.push((x.이름 || n + '번째 정보') + '의 단위');
    if (!(x.최대 > x.최소)) 부족.push((x.이름 || n + '번째 정보') + '의 값 범위');
    if (!있(x.근거)) 부족.push((x.이름 || n + '번째 정보') + ' 범위의 근거 (못 찾았으면 못 찾았다고)');
    if (s.트랙 === '예측' &&
        ['강한양','중간양','약한양','약한음','중간음','강한음'].indexOf(x.영향) < 0)
      부족.push((x.이름 || n + '번째 정보') + '이(가) 결과에 주는 영향');
    if (s.트랙 === '분류' && !있(x.높은쪽))
      부족.push((x.이름 || n + '번째 정보') + '이(가) 큰 쪽이 어느 편인지');
  });
  if (s.트랙 === '분류') {
    f.forEach(x => {
      if (있(x.높은쪽) && x.높은쪽 !== s.범주A && x.높은쪽 !== s.범주B)
        부족.push(x.이름 + '의 「큰 쪽」이 두 범주 중 하나가 아님');
    });
  }
  if (!있(s.이유) || s.이유.replace(/\s/g, '').length < 15) 부족.push('주제를 고른 이유 (두세 문장)');
  if (!있(s.기대효과) || s.기대효과.replace(/\s/g, '').length < 15) 부족.push('무엇이 달라질지 (두세 문장)');
  return 부족;
}

function 확정_(req) {
  const a = 인증_(req.token);
  if (!a.ok) return a;

  const 정리 = req.정리 || {};
  const 부족 = 검사_(정리);
  if (부족.length) return { 통과: false, 부족: 부족 };

  const 반정보 = req.반정보 || {};
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (e) { return { 통과: false, 부족: ['지금 저장이 몰려 있습니다. 10초 뒤 다시 눌러 주세요.'] }; }

  try {
    const ss = 스프레드시트_();
    const sh = ss.getSheetByName(시트이름);
    const f = 정리.특성 || [];
    const 칸 = i => {
      const x = f[i] || {};
      return [x.이름 || '', x.단위 || '', x.최소 == null ? '' : x.최소,
              x.최대 == null ? '' : x.최대, x.근거 || '', x.영향 || '', x.높은쪽 || ''];
    };
    const m = 정리.무관변수 || {};
    const t = 정리.타깃 || {};

    지우기_(sh, a.메일);          // 다시 확정하면 이전 행을 지운다

    sh.appendRow([].concat(
      [new Date(), a.메일, a.학번, a.이름 || 반정보.이름 || '',
       반정보.학년 || '', 반정보.반 || '', 반정보.번호 || ''],
      [정리.트랙, 정리.주제],
      [t.이름 || '', t.단위 || '', t.최소 == null ? '' : t.최소, t.최대 == null ? '' : t.최대,
       t.근거 || ''],
      [정리.범주A || '', 정리.범주B || ''],
      칸(0), 칸(1), 칸(2), 칸(3),
      [m.이름 || '', m.단위 || '', m.최소 == null ? '' : m.최소, m.최대 == null ? '' : m.최대],
      [정리.이유 || '', 정리.기대효과 || ''],
      [(req.history || []).length, JSON.stringify(req.history || []).slice(0, 45000)]
    ));
    return { 통과: true };
  } finally {
    lock.releaseLock();
  }
}

function 지우기_(sh, 메일) {
  const v = sh.getDataRange().getValues();
  for (let r = v.length - 1; r >= 1; r--) {
    if (String(v[r][1]).toLowerCase() === String(메일).toLowerCase()) sh.deleteRow(r + 1);
  }
}

function 내기록_(메일) {
  try {
    const sh = 스프레드시트_().getSheetByName(시트이름);
    const v = sh.getDataRange().getValues();
    for (let r = v.length - 1; r >= 1; r--) {
      if (String(v[r][1]).toLowerCase() === String(메일).toLowerCase())
        return { 있음: true, 트랙: v[r][7], 주제: v[r][8], 시각: String(v[r][0]) };
    }
  } catch (e) {}
  return { 있음: false };
}

/* ════════ 관리자 ════════ */
function 관리_(req) {
  const a = 인증_(req.token);
  if (!a.ok) return a;
  if (!a.관리자) return { 오류: '관리자만 쓸 수 있습니다.' };

  const ss = 스프레드시트_();
  const sh = ss.getSheetByName(시트이름);

  if (req.일 === '목록') {
    const v = sh.getDataRange().getValues();
    const 행 = [];
    for (let r = 1; r < v.length; r++) {
      const f = [];
      for (let k = 0; k < 4; k++) {
        const b = 16 + k * 7;
        if (v[r][b]) f.push({ 이름: v[r][b], 단위: v[r][b+1], 최소: v[r][b+2], 최대: v[r][b+3],
                              근거: v[r][b+4], 영향: v[r][b+5], 높은쪽: v[r][b+6] });
      }
      행.push({
        시각: String(v[r][0]), 메일: v[r][1], 학번: v[r][2], 이름: v[r][3],
        학년: v[r][4], 반: v[r][5], 번호: v[r][6],
        트랙: v[r][7], 주제: v[r][8],
        타깃: { 이름: v[r][9], 단위: v[r][10], 최소: v[r][11], 최대: v[r][12], 근거: v[r][13] },
        범주A: v[r][14], 범주B: v[r][15],
        특성: f,
        무관: { 이름: v[r][44], 단위: v[r][45], 최소: v[r][46], 최대: v[r][47] },
        이유: v[r][48], 기대효과: v[r][49]
      });
    }
    return { ok: true, 시트주소: ss.getUrl(), 행: 행 };
  }

  if (req.일 === '삭제') {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { 지우기_(sh, req.메일); return { ok: true }; }
    finally { lock.releaseLock(); }
  }
  return { 오류: '알 수 없는 관리 요청' };
}

/* ════════ 스프레드시트 ════════ */
function 스프레드시트_() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const 붙은것 = SpreadsheetApp.getActiveSpreadsheet();
  if (붙은것) return 붙은것;                       // 스프레드시트에 붙여 만든 경우

  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('SHEET_ID_AUTO');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create('인공지능 기초 수행평가 — 주제 확정');
  p.setProperty('SHEET_ID_AUTO', ss.getId());
  머리글_(ss);
  return ss;
}

function 머리글_(ss) {
  const sh = ss.getSheetByName(시트이름) || ss.insertSheet(시트이름);
  if (sh.getLastRow() === 0) {
    const 특성머리 = n => ['정보'+n+'_이름','정보'+n+'_단위','정보'+n+'_최소',
                          '정보'+n+'_최대','정보'+n+'_근거','정보'+n+'_영향','정보'+n+'_큰쪽'];
    sh.appendRow([].concat(
      ['시각','메일','학번','이름','학년','반','번호','트랙','주제'],
      ['타깃_이름','타깃_단위','타깃_최소','타깃_최대','타깃_근거'],
      ['범주A','범주B'],
      특성머리(1), 특성머리(2), 특성머리(3), 특성머리(4),
      ['무관_이름','무관_단위','무관_최소','무관_최대'],
      ['고른이유','기대효과'],
      ['주고받은수','대화내용(JSON)']
    ));
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');
    sh.setColumnWidth(52, 120);          // 대화 열은 좁게 — 눈에 걸리지 않게
  }
}

function 최초설정() {
  const ss = 스프레드시트_();
  머리글_(ss);
  const 머리 = ss.getSheetByName(시트이름).getRange(1, 1, 1, 52).getValues()[0];
  if (머리[13] !== '타깃_근거') {
    Logger.log('⚠ 시트1 첫 줄이 예전 형식입니다. 시트1의 1행을 지우고 최초설정을 다시 실행하세요.');
    Logger.log('  (이미 쌓인 기록이 있다면 다른 시트로 옮겨 둔 뒤 지우세요.)');
  }
  Logger.log('기록 시트 : ' + ss.getUrl());
  const k = API키_();
  Logger.log(k ? 'OpenAI 키 확인됨 (' + k.slice(0, 7) + '…' + k.slice(-4) + ')'
               : '⚠ OpenAI 키를 찾지 못했습니다. KEY 시트 A2 칸을 확인하세요.');
  Logger.log('CLIENT_ID : ' + CLIENT_ID);
  Logger.log('이제 배포 → 새 배포 → 웹 앱 (실행: 나 / 액세스: 모든 사용자) 으로 배포하고,');
  Logger.log('나온 주소를 index.html 의 API_URL 에 넣으세요.');
}
