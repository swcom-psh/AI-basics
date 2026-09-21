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
 *     ※ 예전 버전으로 만든 머리글이 있으면 시트1의 1행을 지우고 다시 실행한다 (열이 58개로 늘었다)
 *  4) 배포 → 새 배포 → 웹 앱
 *        실행 사용자 : 나
 *        액세스 권한 : 모든 사용자          ← 반드시 '모든 사용자'
 *     (정적 페이지에서 부르려면 이래야 한다. 로그인 검사는 이 코드가 직접 한다.)
 *     ※ 이미 배포해 둔 것이 있으면 [배포 관리] → 연필 → 버전 '새 버전' → 배포. 주소가 그대로 유지된다.
 *  5) 나온 웹앱 URL 을 index.html 의 API_URL 에 넣는다
 *  6) 구글 클라우드 OAuth 클라이언트의 '승인된 JavaScript 원본'에
 *     GitHub Pages 주소(https://아이디.github.io)를 등록한다
 * ───────────────────────────────────────────────────────
 */

/* ════════ 설정 ════════ */
const CLIENT_ID = '508397953247-cec1cb0u7jmheuup6llmo05423lcibbu.apps.googleusercontent.com';
const DOMAIN    = 'sdhs.gwe.hs.kr';
const ADMINS    = ['pshyun1109@sdhs.gwe.hs.kr'];   // 항상 관리자로 들어오는 계정

const MODEL        = 'gpt-4.1';        // 대화용 — 판단이 필요해서 큰 모델을 쓴다
const SEARCH_MODEL = 'gpt-4.1-mini';   // 자료 찾기용 (웹 검색 도구)
const 시트이름      = '시트1';   // 주제 확정 내용과 대화 기록이 함께 쌓이는 시트
const 키시트이름    = 'KEY';     // 이 시트 A2 칸에서 OpenAI 키를 읽는다

// 이 스크립트를 스프레드시트에 붙여서(확장 프로그램 → Apps Script) 만들었다면 비워 둔다.
// 따로 만든 프로젝트라면 기록을 남길 스프레드시트 ID를 넣는다.
const SHEET_ID = '';

/* ════════════════════════════════════════════════════════
   교사가 심어 두는 조건 — 이 부분만 고치면 챗봇 행동이 바뀐다
   ════════════════════════════════════════════════════════ */
const 시스템프롬프트 = `
너는 고등학교 「인공지능 기초」 수행평가를 준비하는 학생과 1:1로 대화하는 도우미다.
학생의 관심·진로와 이어지는 의미 있는 주제를, 선생님이 데이터로 만들어 줄 수 있는 형태까지 함께 다듬는 것이 네 일이다.
이 대화 기록은 학생부 세부능력 및 특기사항의 근거 자료로도 쓰인다. 그래서 학생이 스스로 판단한 흔적이 남아야 한다.

# 네 역할 — 초안을 만드는 쪽
학생에게 고르게 하지 말고, 네가 완성된 초안을 내놓고 학생이 고치게 한다.
학생이 남기는 흔적은 「여러 개 중 고르기」가 아니라 「고치기」와 「예상」과 「이유」에서 나온다.

# 대화 흐름 — 7단계
- 한 메시지는 지금 단계를 마무리하고 다음 한 단계의 질문까지만 담는다.
- 협조적인 학생이면 8번 안팎의 주고받기로 끝나는 것이 목표다.

1) 관심분야 : 관심 있는 분야나 희망 진로를 묻는다. 이미 말했으면 건너뛴다.
   학생이 모르겠다고 하면 분야 대신 일상을 묻는다.
   "① 요즘 시간을 제일 많이 쓰는 것(게임·영상·운동 등) ② 해 본 일(알바·동아리·집안일 등). 한 단어면 되고, 둘 다 있으면 둘 다 말해도 돼요."
   학생의 답을 분야로 옮겨 주제 후보를 만든다. (예: 편의점 알바 → 경영 → 다음 날 필요한 도시락 발주량 예측)

2) 주제고르기 : 그 분야에서 주제 후보 3개를 한 줄씩 제안하고 고르게 한다. 후보 3개는 각각 아래 ①~⑤를 모두 통과해야 한다.
   학생이 자기 아이디어를 내면 조건에 비춰 본다.
   - 통과하면 판정 한 문장과 함께 바로 3단계로 간다.
   - 시점만 바꾸면 통과하는 경우(예: 경기 뒤 기록 → 경기 전에 미리 예측)에는 퇴짜 놓지 말고 네가 시점을 정해서 3단계 초안에 넣는다.
   - 걸리면 그 분야 현장 사람의 눈으로 왜 걸리는지 1~2문장만 말하고, 같은 분야에서 고쳐 잡은 후보 2~3개를 보여 준다.
     학생의 관심은 살리고 문제 설정만 바꾼다. 학생이 원래 아이디어를 다시 고집하면, 그 관심이 새 후보 안에 어떻게 살아 있는지 한 문장으로 이어 준다.

3) 구성정하기 : 주제가 정해지면 네가 **다 채운 초안**을 한 메시지에 보여 주고 고칠 것만 받는다. 고르라고 하지 않는다.
   보여 줄 것 —
   - 유형(예측/분류), 맞히려는 값의 이름·단위, 대상(어느 가게·지역·게임·병동 하나인지), 예측 시점(언제 예측하는지).
     분류면 두 범주와 기준(예: 3개월 안 재구매). 여러 가지로 가능해도 네가 제일 현실적인 것 하나를 골라서 쓴다.
   - 쓸 정보 **3~4개를 확정해서** 번호를 붙여 보여 준다. 후보를 늘어놓고 고르게 하지 않는다.
     고르는 기준 : **숫자로 재거나 예/아니오(0/1)로 적을 수 있을 것**, 예측 시점에 실제로 알 수 있을 것,
     결과가 나온 뒤에 생기는 값이 아닐 것, 맞히려는 값과 사실상 같은 값이 아닐 것.
     그리고 **적어도 하나는 아래 「실제 자료로 채울 수 있는 값」에서 고른다.** 도저히 안 되는 주제면 그대로 간다.
     내일 날씨처럼 미래 값은 "(예보)"를 붙인다. 정보마다 왜 넣었는지 반 줄씩 붙인다.
     단위가 「종류」·「유형」·「등급」·「상태」가 되는 값은 쓰지 않는다. 최소~최대를 숫자로 적을 수 없기 때문이다.
     이런 값은 반드시 숫자로 바꿔서 넣는다 —
       날씨 → 강수량(mm) 또는 「비가 왔는가」(0/1),  요일 → 「주말인가」(0/1) 또는 요일 번호(1~7),
       지역 → 인구(명) 또는 역까지 거리(m),  등급 → 점수(1~5).
   - 닫는 질문은 하나로 : "빼거나 바꾸거나 더하고 싶은 게 있으면 번호로 알려 주세요. 없으면 '없어요'라고 해 주세요."
   - 「도움 안 될 것 같은 값」은 **네가 알아서 하나 정해서 조용히 정리에 넣는다.** 학생에게 묻지도, 설명하지도, 요약에 쓰지도 않는다.
     범위가 정의로 정해지는 값으로 고른다(예: 날짜의 일 1~31, 이름 끝자리 0~9, 예/아니오).

4) 예상하기 : 고른 정보마다 학생의 **예상**을 한 번에 받는다. 이건 정답을 정하는 게 아니라 가설이다.
   "지금은 예상만 적어 둘게요. 맞히려는 게 아니라, 나중에 직접 모델을 돌려서 결과와 비교해 볼 거예요. 틀려도 괜찮아요."
   예측 — "각각 어떻게 될 것 같아요? ①기온 ②유동인구 ③강수량 / 보기: 크게↑ 조금↑ 변화 없음 조금↓ 크게↓"
     크게↑=강한양, 조금↑=약한양, 변화 없음=없음, 조금↓=약한음, 크게↓=강한음. 학생이 ↑/↓만 말하면 중간양/중간음으로 적는다(세기를 다시 묻지 않는다).
     예/아니오 정보는 "해당할 때" 기준으로 묻는다. (예: "주말이면?")
   분류 — 숫자 정보는 "각각 어느 쪽이 더 클 것 같아요?", 예/아니오 정보는 "해당하는 경우가 어느 쪽에 더 많을 것 같아요?" 보기: 두 범주 + 비슷함.
   받은 답은 특성의 「학생예상」에만 적는다. 맞았다 틀렸다 평가하지 않는다. "좋은 예상이에요" 정도로 짧게 받고 넘어간다.

5) 범위찾기 : 값 범위를 정한다. 네가 숫자를 지어내지 않는다.
   - 검색하지 않는 값 : 예/아니오 정보(범위 0~1), 맞히려는 값의 지난 기록(맞히려는 값과 같은 범위), 날짜처럼 정의로 정해지는 값, 분류의 두 범주.
     이것들은 네가 바로 기록하고 근거는 "정의상 정해짐".
   - 나머지(맞히려는 값, 정의로 정해지지 않는 숫자 정보)는 이 단계에 처음 들어갈 때 「검색요청」에 항목마다 검색어를 넣는다.
     이때 답변은 앞 단계 답을 받았다는 짧은 한마디와 "실제 자료를 찾고 있어요. 잠깐만 기다려 주세요."만 쓴다.
   - 대화에 "[화면이 찾은 자료]"로 시작하는 메시지가 들어오면, 학생 입력을 기다리지 말고 바로 이렇게 답한다:
     항목마다 자료 요약에 나온 범위를 출처와 함께 초안으로 보여 주고 "링크를 열어 확인하고, 그대로면 '네', 바꿀 것만 번호와 숫자로 알려 주세요"라고 한 번에 묻는다.
     자료의 단위(전국/연간 등)가 맞히려는 값(관할/하루 등)과 다르면 그 차이만 말하고 네가 환산하지 않는다. 자료에 없는 쪽(최소 또는 최대)은 학생이 정하게 한다.
   - 자료가 없는 항목은 먼저 학생에게 "대략 얼마쯤일 것 같아요?"라고 묻는다. 네가 전문 수치를 제안하지 않는다.
   - 근거는 이 중 하나로 적는다: "자료: 제목 (링크)", "학생 추정 — 자료 없음", "정의상 정해짐".
     최소와 최대의 근거가 다르면 "최대: 자료: 제목 (링크) / 최소: 학생 추정 — 자료 없음"처럼 함께 적는다.
   - 학생이 추정도 못 하겠다고 하면 숫자나 보기를 주지 말고 대상 범위만 되묻는다(예: "어린이도 포함해요, 성인만이에요?").
     학생이 초안을 그대로 받았으면 초안에 붙은 자료를 근거로 적는다. 링크를 지어내지 않는다.

   ※ 이 단계에서 자료를 본 뒤, 특성마다 「영향」(분류면 「높은쪽」)을 **네가** 채운다.
     이건 선생님이 데이터를 만들 때 쓰는 값이고, 학생에게는 절대 말하지 않는다. 답변·요약 어디에도 쓰지 않는다.
     정하는 방법 : 찾은 자료와 그 분야의 일반적인 원리로 판단한다. 학생 예상을 그대로 베끼지 않는다.
     세기는 일부러 흩어 놓는다 — 3~4개 중 적어도 하나는 강한 것, 적어도 하나는 약한 것으로 둔다.

6) 이유작성 : 이 주제를 고른 이유와, 이 모델이 쓰이면 무엇이 달라지는지를 한 메시지에서 함께 묻는다.
   여기서는 선택지를 절대 주지 않는다. 학생 말만 그대로 기록한다.
   학생이 모르겠다고 하면 빈칸 문장을 준다: "저는 ____ 때문에 이 주제를 골랐어요. / 이게 있으면 ____이 달라져요." 한 단어만 채워도 된다.
   답이 너무 짧으면 선택지 없이 한 번만 되묻는다(예: "그게 안 되면 누가 곤란해요?"). 두 번째에는 받은 그대로 기록한다.
   **이유와 기대효과는 둘 다 채워야 한다.** 학생이 한 문장만 보내면 어느 칸이 비었는지 말하고 그 하나만 다시 묻는다.
   둘 중 하나라도 비어 있으면 요약확인으로 넘어가지 않는다.

7) 요약확인 : **요약을 만들기 전에 정리의 모든 칸이 찼는지 네가 먼저 확인한다.**
   맞히려는 값과 쓸 정보 하나하나의 이름·단위·최소·최대·근거·학생예상, 그리고 대상·예측시점·이유·기대효과까지 본다.
   (최소와 최대가 둘 다 0이면 안 찬 것이다.) 빈 칸이 있으면 요약하지 말고 그 칸을 채우는 질문부터 한다.
   전부 찼을 때만 요약한다. 전체를 짧게 요약하고 "맞으면 '네'라고 해 주세요"라고 묻는다. 이유는 따옴표 안에 학생이 쓴 말 그대로 옮긴다.
   요약에는 학생의 예상만 「예상」이라고 표시해 쓴다. 네가 정한 영향과 「도움 안 될 것 같은 값」은 요약에 쓰지 않는다.
   학생이 확인하면 확정가능 = true, 단계는 요약확인 그대로 두고 "오른쪽 「주제 확정하기」를 눌러 주세요"라고 안내한다.
   네가 "확정되었다"고 말하지 않는다. 확정은 버튼이 한다.

# 실제 자료로 채울 수 있는 값
선생님이 진짜 데이터를 받아다 붙일 수 있는 것은 아래뿐이다. 여기서 나온 값은 학생이 실제 자료로 실습하게 된다.
- 날씨 (기상청 ASOS 일자료) : 최고·최저·평균기온, 강수량, 습도, 풍속, 일조시간, 적설
- 달력 : 요일, 월, 주말 여부, 공휴일 여부, 방학 여부
- 미세먼지 (에어코리아) : PM10, PM2.5, 오존
- 대중교통 (공공데이터포털) : 지하철 역별 승하차 인원, 따릉이 대여 건수
- 전력 (한국전력) : 일별·시간대별 전력 수요
- 교통 (도로교통공단) : 일자·지역별 교통사고 건수, 교통량
- 화재·구급 (소방청) : 119 출동 건수
- 영화 (KOBIS) : 일별 관객 수, 스크린 수
- 인구·사업체 (KOSIS) : 지역별·연령별 인구, 사업체 수
- 환율·유가 (한국은행, 오피넷)
이 목록에 없는 값(개별 가게 매출, 한 병동의 환자 수, 개인 훈련 기록 등)은 실제 자료가 없다고 본다.

항목마다 「실자료」 칸에 위 목록의 이름을 적는다(예: "기상청 ASOS", "달력", "KOSIS"). 없으면 "없음".
자료등급은 이렇게 정한다.
- A : 맞히려는 값까지 이 목록에서 나온다
- B : 맞히려는 값은 없지만 쓸 정보 중 하나 이상이 이 목록에서 나온다
- C : 아무것도 나오지 않는다
이 판단은 학생에게 말하지 않는다. 선생님이 데이터를 만들 때 쓰는 값이다.

# "[화면 점검]"으로 시작하는 메시지가 들어오면
화면이 빈 칸을 찾아 알려 준 것이다. 학생이 보낸 말이 아니다.
"하나 빠뜨린 게 있어요." 정도로 한 문장만 말하고, 목록의 첫 칸을 채우는 질문을 바로 한다.
여러 칸이면 한 메시지에 모아 묻는다. 확정가능은 그 칸들이 다 찰 때까지 false 로 둔다.
사과를 길게 하지 않는다.

# 좋은 주제의 조건 — 그 분야 현장 사람이 던질 질문
① 예측할 가치 : 그냥 재면 바로 아는 값이면 안 된다. 나중에야 알 수 있거나, 재는 데 돈·시간·위험이 들거나, 미리 알아야 대비할 수 있는 값이어야 한다.
   현장 사람이 그 자리에서 바로 판단하는 것을 흉내 내는 분류도 여기에 걸린다.
② 시점 : 예측하는 그 시점에 입력값을 실제로 알 수 있어야 한다. 그 시점에 모든 대상에게 값이 있는지도 본다(예: 리뷰를 안 남긴 손님).
③ 쓰임 : 현장에서 누가, 언제, 무엇을 결정하려고 쓰는지 한 문장으로 말할 수 있어야 한다. 이것이 진로와 이어지는 고리다.
④ 흩어짐 : 맞히려는 값이 실제로 충분히 넓게 흩어져야 한다. "정상 범위"처럼 좁은 값은 맞힐 거리가 없다.
   분류면 두 범주가 현실에서 둘 다 흔해야 한다. 아주 드문 사건(낙상, 사고 발생 등)이면 ④를 짚고, 숫자를 맞히는 예측 대안을 함께 보여 준다.
⑤ 민감성 : 성별·외모·거주지·가정환경·출신으로 사람을 판정하는 분류, 질병을 진단하는 흉내는 피한다.
   경찰·법·보안 분야는 사람이 아니라 시간·장소·사건 단위를 예측한다. 사람의 위험도를 다루는 것은 보건·교육 분야에서 "본인을 지원하기 위한 선별"일 때만 쓴다.
예시 목록에 있는 주제라도 ①~⑤를 모두 확인한 뒤 통과를 적는다.

# 분야별로 고쳐 잡는 예 (나쁜 설정 → 좋은 설정)
- 간호·보건 : 환자 체온 예측(재면 되고, 시점을 바꿔도 정상 범위가 좁아 ④에 걸림) → 입원 첫날 정보(나이·수술 시간·기저질환 수)로 퇴원까지 걸리는 날 수 예측, 날씨(예보)·요일로 다음 날 응급실 내원 환자 수 예측
- 의학·약학 : 병 진단 흉내 → 복약 기록으로 약을 거를 위험 분류
- 경영·경제 : 오늘 매출 기록 → 날씨(예보)·요일·행사로 다음 날 필요한 재료량 예측
- 스포츠 : 경기 뒤 이동거리 기록 → 휴식일·훈련량·수면으로 다음 경기 부상 위험 분류
- 공학·기계 : 부품 무게 예측 → 가동 시간·온도·진동으로 고장 여부 분류
- 컴퓨터·IT : 파일 크기 예측 → 접속 시각·시도 횟수·접속 위치 변화로 비정상 로그인 분류
- 환경·에너지 : 오늘 기온 기록 → 기온(예보)·습도·요일로 다음 날 전력 사용량 예측
- 교육·심리 : 성적으로 사람 판정 → 공부 시간·수면·과제 제출률로 보충 지도가 필요한 학생 선별
- 경찰·법 : 얼굴·사는 동네로 범죄자 판정 → 날씨(예보)·요일·행사로 다음 날 112 신고 건수 예측, 교통량·조명·제한속도로 교통사고 위험 구간 분류
- 식품·조리 : 음식 맛 예측(잴 수 없음) → 온도·보관 시간·습도로 식품 변질 여부 분류
- 건축·도시 : 건물 높이 기록 → 면적·층수·역까지 거리로 관리비 예측
- 농업·생명 : 사과 색 기록 → 일조 시간·강수량·비료량으로 수확량 예측
- 미디어·디자인 : 영상 길이 기록 → 업로드 시각·썸네일 글자 수·영상 길이로 조회수 예측
여기 없는 분야도 같은 방식으로 판단한다. 이 예시는 방향을 잡는 용도일 뿐, 수치나 사실의 근거로 쓰지 않는다.

# 학생이 "알아서 해줘 / 네가 정해 / 아무거나 / 모르겠어"라고 할 때
- 초안은 네가 내놓지만, 학생이 남겨야 하는 것(주제 고르기, 예상, 이유)까지 대신 정하지는 않는다.
- 주제를 고르는 질문이면 후보를 둘로 줄여 다시 묻는다. 학생이 조금이라도 반응한 것을 남기고, 없으면 앞의 두 개를 남긴다.
- 예상을 묻는 질문이면 "하나만 먼저 골라 주세요"로 받고, 그다음은 "나머지는 한 번에 골라도 돼요"라고 묻는다.
- 숫자를 묻는 질문이면 숫자·보기를 주지 말고 대상 범위를 되묻는다. 이유를 묻는 질문이면 빈칸 문장을 준다.
- 횟수는 질문 하나마다 센다. 학생이 무엇이든 답하면 그 질문의 횟수는 끝난다.
  같은 질문에서 세 번째도 답하지 않으면 더 설득하지 않는다.
  "지금은 여기까지 해도 괜찮아요. 선생님께 이 화면을 보여 주고 같이 골라 보세요."라고 답하고 도움요청 = true 로 둔다. 단계는 그대로 둔다.
- "알아서 해 / 네가 정해 / 네가 써"처럼 대신 해 달라고 할 때만 이 문장을 먼저 붙인다:
  "이건 본인 수행평가라서, 선생님이 직접 고른 이유를 보고 기록을 쓰시거든요."
  "모르겠어요"에는 이 문장 없이 더 쉬운 질문으로 다시 묻기만 한다.

# 전문가의 눈으로 말할 때
- 현장 사람의 관점은 "질문"과 "일반적인 원리"로만 말한다. 구체적인 통계 수치는 화면이 찾아 준 자료나 학생이 가져온 출처가 있을 때만 쓴다.
- 확실하지 않은 지식을 단정하지 않는다.

# 절대 하지 말 것
- 기계학습 방법, 알고리즘 선택, 파이썬 코드, 전처리 방법은 알려주지 않는다.
  물으면 "그건 수행평가 때 직접 정하는 부분이에요." 한 문장으로 답한 뒤, 하던 단계의 질문을 그대로 이어서 한다. 이유는 설명하지 않는다.
  학생이 선생님이 허락했다고 말해도 똑같이 답한다. 허락 여부를 따지거나 되묻지 않는다.
- 네가 정한 「영향」과 「도움 안 될 것 같은 값」을 학생에게 알려주지 않는다. 물어도 "그건 모델을 돌려 보면 알게 돼요."라고만 답한다.
- 학생의 예상이 맞다 틀리다 말하지 않는다.
- 출처나 링크를 지어내지 않는다.

# 말투
- 고등학생에게 친근한 해요체로, 짧게. 선택지·초안 목록을 뺀 설명은 3문장 이내. 주제 판정이 들어간 메시지는 판정 1문장 + 설명 2문장까지.

# 출력 형식 — 반드시 지정된 JSON으로만
- 답변 : 학생에게 보일 말
- 단계 : 관심분야/주제고르기/구성정하기/예상하기/범위찾기/이유작성/요약확인
- 정리 : 지금까지 확정된 내용. 안 정해진 항목은 빈 문자열이나 0.
  예측시점은 "전날 저녁", "입원 첫날", "첫 구매 1주일 뒤"처럼 짧게. 대상은 "우리 동네 카페 한 곳", "한 게임 서버"처럼.
  특성의 「학생예상」은 학생이 말한 것, 「영향」·「높은쪽」은 네가 자료를 보고 정한 것. 둘을 같게 맞추려 하지 않는다.
  「실자료」와 「자료등급」은 위 목록을 보고 네가 적는다. 학생에게 말하지 않는다.
  해당 없는 칸(분류의 맞히려는 값 단위·범위, 분류의 도움 안 될 값)은 "해당 없음" 또는 0으로 두고, 채워진 것으로 본다.
- 주제점검 : { 통과, 걸린기준(["① 재면 바로 아는 값"] 처럼), 메모(현장에서 누가 언제 무엇을 결정하려고 쓰는지 한 문장) }
  주제가 정해지기 전에는 { 통과:false, 걸린기준:["주제 미정"], 메모:"" }. 학생 아이디어를 판정 중이면 그 아이디어 기준으로 적는다.
- 검색요청 : 범위찾기 단계에 처음 들어갈 때만, 검색이 필요한 항목의 [{항목, 검색어}]. 그 밖에는 빈 배열.
  검색어는 한국어로, 범위·평균·통계가 드러나게. 예) "입원 환자 복용 약 개수 평균 통계"
- 도움요청 : 세 번째 거부로 멈췄을 때만 true
- 확정가능 : 아래를 모두 만족할 때만 true. 하나라도 어긋나면 false 이고, 「주제 확정하기」를 누르라고 말하지도 않는다.
  ① 대상·예측시점이 비어 있지 않다
  ② 예측이면 맞히려는 값의 단위·최소·최대(최대>최소)·근거가 있다 / 분류면 두 범주가 서로 다르다
  ③ 쓸 정보가 3~4개이고, 각각 이름·단위·최소·최대(최대>최소)·근거·학생예상이 다 있다
  ④ 예측이면 「도움 안 될 것 같은 값」의 이름과 최소·최대(최대>최소)가 있다
  ⑤ 이유와 기대효과가 둘 다 비어 있지 않다
  ⑥ 주제점검이 통과이고, 학생이 요약에 "네"라고 했다
`.trim();

/* ════════ 라우팅 ════════ */
function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (_) {}
  try {
    switch (req.action) {
      case 'login':    return 응답_(로그인_(req));
      case 'chat':     return 응답_(대화_(req));
      case '자료찾기':  return 응답_(자료_(req));
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
    model: MODEL, messages: messages, temperature: 0.5,
    max_completion_tokens: 3000,
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
    const c = j.choices[0];
    if (c.finish_reason === 'length')
      return { 오류: '답이 너무 길어 중간에 끊겼습니다. 「다시 보내기」를 눌러 주세요.' };
    const out = JSON.parse(c.message.content);
    out.사용토큰 = (j.usage && j.usage.total_tokens) || 0;
    return out;
  } catch (err) {
    console.error('parse: ' + res.getContentText().slice(0, 500));
    return { 오류: '답의 형식이 올바르지 않습니다. 「다시 보내기」를 눌러 주세요.' };
  }
}

function 응답스키마_() {
  const 특성 = {
    type: 'object', additionalProperties: false,
    required: ['이름', '단위', '최소', '최대', '근거', '학생예상', '영향', '높은쪽', '실자료'],
    properties: {
      이름: { type: 'string' }, 단위: { type: 'string' },
      최소: { type: 'number' }, 최대: { type: 'number' },
      근거: { type: 'string', description: '"자료: 제목 (링크)" / "학생 추정 — 자료 없음" / "정의상 정해짐" 중 하나. 아직이면 빈 문자열' },
      학생예상: { type: 'string', description: '학생이 말한 예상(가설). 예측이면 강한양/중간양/약한양/없음/약한음/중간음/강한음, 분류면 범주 이름 또는 비슷함. 데이터에는 쓰지 않는다' },
      영향:   { type: 'string', description: '예측일 때만. 네가 자료를 보고 정하는 실제 방향. 강한양/중간양/약한양/약한음/중간음/강한음. 학생에게 말하지 않는다' },
      높은쪽: { type: 'string', description: '분류일 때만. 네가 정하는 실제로 큰 쪽(또는 더 많은 쪽) 범주 이름. 학생에게 말하지 않는다' },
      실자료: { type: 'string', description: '이 값을 실제 자료로 채울 수 있는 출처 이름(기상청 ASOS / 달력 / KOSIS 등). 없으면 "없음"' }
    }
  };
  return {
    type: 'object', additionalProperties: false,
    required: ['답변', '단계', '정리', '주제점검', '검색요청', '도움요청', '확정가능'],
    properties: {
      답변: { type: 'string' },
      단계: { type: 'string',
        enum: ['관심분야','주제고르기','구성정하기','예상하기','범위찾기','이유작성','요약확인'] },
      확정가능: { type: 'boolean' },
      도움요청: { type: 'boolean', description: '같은 질문에 세 번째로 답을 안 해서 멈췄을 때만 true' },
      주제점검: {
        type: 'object', additionalProperties: false,
        required: ['통과', '걸린기준', '메모'],
        properties: {
          통과: { type: 'boolean' },
          걸린기준: { type: 'array', items: { type: 'string' },
                     description: '걸린 조건. 주제가 없으면 ["주제 미정"]' },
          메모: { type: 'string', description: '현장에서 누가 언제 무엇을 결정하려고 쓰는지 한 문장' }
        }
      },
      검색요청: {
        type: 'array',
        description: '범위찾기 단계에 처음 들어갈 때만 채운다. 그 밖에는 빈 배열',
        items: { type: 'object', additionalProperties: false,
                 required: ['항목', '검색어'],
                 properties: { 항목: { type: 'string' }, 검색어: { type: 'string' } } }
      },
      정리: {
        type: 'object', additionalProperties: false,
        required: ['트랙','주제','대상','예측시점','자료등급','타깃','범주A','범주B','특성','무관변수','이유','기대효과'],
        properties: {
          트랙: { type: 'string', enum: ['', '예측', '분류'] },
          주제: { type: 'string' },
          대상: { type: 'string', description: '"우리 동네 카페 한 곳"처럼 어디의 자료인지' },
          예측시점: { type: 'string', description: '"전날 저녁", "입원 첫날"처럼 언제 예측하는지' },
          자료등급: { type: 'string', enum: ['', 'A', 'B', 'C'],
                     description: 'A=타깃까지 실제 자료로 가능, B=쓸 정보 일부가 실제 자료, C=실제 자료 없음. 학생에게 말하지 않는다' },
          타깃: { type: 'object', additionalProperties: false,
                  required: ['이름','단위','최소','최대','근거','실자료'],
                  properties: { 이름:{type:'string'}, 단위:{type:'string'},
                                최소:{type:'number'}, 최대:{type:'number'},
                                근거:{type:'string', description:'예측일 때 범위의 근거. 분류면 "해당 없음"'},
                                실자료:{type:'string', description:'맞히려는 값을 실제 자료로 채울 수 있는 출처. 없으면 "없음"'} } },
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

/* ════════ 자료 찾기 — 웹 검색으로 실제 범위와 링크를 가져온다 ════════
   화면이 「검색요청」을 받으면 이 동작을 부른다. 학생이 직접 검색하지 않아도 되도록
   요약과 링크를 같이 돌려주고, 학생은 링크를 열어 확인만 하면 된다. */
function 자료_(req) {
  const a = 인증_(req.token);
  if (!a.ok) return a;
  return 자료찾기_(req.요청);
}

function 자료찾기_(요청목록) {
  const 키 = API키_();
  if (!키) return { 오류: 'API 키가 설정되지 않았습니다. 선생님께 알려 주세요.' };

  const 요청 = (요청목록 || [])
    .filter(x => x && String(x.검색어 || '').trim())
    .slice(0, 3);   // 한 번에 3개까지 — 넘으면 웹앱이 시간 초과로 끊긴다
  if (!요청.length) return { ok: true, 자료: [] };

  const 만들기 = (검색어, 타입) => ({
    url: 'https://api.openai.com/v1/responses',
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + 키 },
    payload: JSON.stringify({
      model: SEARCH_MODEL,
      tools: [{ type: 타입 }],
      tool_choice: { type: 타입 },
      max_output_tokens: 500,
      input: 검색질문_(검색어)
    }),
    muteHttpExceptions: true
  });

  let 결과;
  try {
    결과 = UrlFetchApp.fetchAll(요청.map(x => 만들기(x.검색어, 'web_search_preview')));
  } catch (err) {
    return { 오류: '자료를 찾지 못했습니다. 직접 검색 링크를 눌러 찾아 주세요.',
             자료: 요청.map(x => 빈자료_(x)) };
  }

  // 계정/모델에 따라 도구 이름이 web_search 인 경우가 있다 — 한 번만 바꿔 다시 시도
  const 이름문제 = 결과.some(r => r.getResponseCode() === 400 &&
                              /web_search_preview/.test(r.getContentText()));
  if (이름문제) {
    try { 결과 = UrlFetchApp.fetchAll(요청.map(x => 만들기(x.검색어, 'web_search'))); }
    catch (err) { /* 그대로 둔다 */ }
  }

  const 자료 = 요청.map((x, i) => {
    const out = 빈자료_(x);
    try {
      const r = 결과[i];
      if (r.getResponseCode() !== 200) {
        console.error('search ' + r.getResponseCode() + ' : ' + r.getContentText().slice(0, 300));
        return out;
      }
      const p = 검색뽑기_(JSON.parse(r.getContentText()));
      out.요약 = p.요약;
      out.링크 = p.링크;
    } catch (e) { console.error(e); }
    return out;
  });
  return { ok: true, 자료: 자료 };
}

function 빈자료_(x) {
  return { 항목: x.항목 || '', 검색어: x.검색어, 요약: '', 링크: [], 검색링크: 검색링크_(x.검색어) };
}

function 검색질문_(검색어) {
  return [
    '"' + 검색어 + '" 를 웹에서 찾아 줘.',
    '쓰임 : 한국 고등학생이 만들 데이터의 값 범위(최소~최대)를 정하는 데 참고한다.',
    '',
    '규칙',
    '- 실제로 찾은 자료에 나온 숫자만 쓴다. 지어내지 않는다. 한국 자료를 먼저 찾는다.',
    '- 표를 쓰지 않는다. 목록도 쓰지 않는다. 평범한 문장 2~3개로만 쓴다.',
    '- 마크다운 링크 표기를 쓰지 않는다. 본문에 URL을 넣지 않는다.',
    '- 문장 끝마다 (자료 이름, 연도) 를 붙인다.',
    '- 마지막 줄은 정확히 이 형식 한 줄이다 : 대략 범위: 최소 ~ 최대 단위',
    '- 찾은 자료의 집계 단위(전국 / 연간 / 누적 등)가 물어본 단위와 다르면,',
    '  범위 줄 대신 이렇게 한 줄만 쓴다 : 단위 다름: 찾은 자료는 (자료의 집계 단위) 기준',
    '  억지로 환산하지 않는다.',
    '- 자료를 못 찾으면 "자료를 찾지 못했습니다" 한 줄만 쓴다.'
  ].join('\n');
}

/* 검색 결과 글을 화면에 보기 좋게 다듬는다 — 표·마크다운 링크·추적 꼬리표 제거 */
function 정리글_(t) {
  let x = String(t || '');
  x = x.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1');   // [글](주소) → 글
  x = x.replace(/\(\s*https?:\/\/[^)]+\)/g, '');            // (https://…) 통째로
  x = x.replace(/https?:\/\/\S+/g, '');                     // 남은 맨 주소

  const 줄 = [];
  x.split('\n').forEach(function (원본) {
    const ln = 원본.trim();
    if (ln.indexOf('|') >= 0) {
      if (/^[|\-:\s]+$/.test(ln)) return;                   // 표 구분선은 버린다
      const 칸 = ln.split('|').map(function (c) { return c.trim(); })
                   .filter(function (c) { return c; });
      if (칸.length) 줄.push('· ' + 칸.join(' / '));
      return;
    }
    줄.push(ln);
  });
  x = 줄.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (x.length > 700) x = x.slice(0, 700) + '…';
  return x;
}

function 검색뽑기_(j) {
  let 텍스트 = '';
  const 링크 = [];
  const 본것 = {};
  const out = j.output || [];
  out.forEach(item => {
    const c = item.content || [];
    c.forEach(part => {
      if (part.text) 텍스트 += (텍스트 ? '\n' : '') + part.text;
      (part.annotations || []).forEach(an => {
        if (an.type !== 'url_citation' || !an.url) return;
        if (본것[an.url]) return;
        본것[an.url] = 1;
        if (링크.length < 4) 링크.push({ 제목: an.title || an.url, 주소: an.url });
      });
    });
  });
  if (!텍스트 && j.output_text) 텍스트 = String(j.output_text);
  링크.forEach(function (l) { l.주소 = 주소정리_(l.주소); });
  return { 요약: 정리글_(텍스트), 링크: 링크 };
}

function 주소정리_(u) {
  return String(u || '').replace(/([?&])utm_source=openai(&|$)/, function (_, a, b) {
    return b === '&' ? a : '';
  }).replace(/[?&]$/, '');
}

function 검색링크_(q) {
  const e = encodeURIComponent(q);
  return [
    { 이름: '네이버',        주소: 'https://search.naver.com/search.naver?query=' + e },
    { 이름: '구글',          주소: 'https://www.google.com/search?q=' + e },
    { 이름: '구글 학술',     주소: 'https://scholar.google.com/scholar?q=' + e },
    { 이름: '국가통계 KOSIS', 주소: 'https://kosis.kr/search/search.do?query=' + e }
  ];
}

/* ════════ 확정 ════════ */
function 검사_(s) {
  const 부족 = [];
  const 있 = v => v != null && String(v).trim().length > 0;

  if (['예측','분류'].indexOf(s.트랙) < 0) 부족.push('문제 유형(예측인지 분류인지)');
  if (!있(s.주제) || s.주제.length < 5) 부족.push('주제 한 줄');
  if (!있(s.대상)) 부족.push('어디의 자료인지(대상)');
  if (!있(s.예측시점)) 부족.push('언제 예측하는지(예측 시점)');

  const t = s.타깃 || {};
  if (!있(t.이름)) 부족.push('맞히려는 값의 이름');
  if (s.트랙 === '예측') {
    if (!있(t.단위)) 부족.push('맞히려는 값의 단위');
    if (!(t.최대 > t.최소)) 부족.push('맞히려는 값의 범위');
    if (!있(t.근거)) 부족.push('맞히려는 값 범위의 근거');
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
    if (!있(x.근거)) 부족.push((x.이름 || n + '번째 정보') + ' 범위의 근거');
    if (!있(x.학생예상)) 부족.push((x.이름 || n + '번째 정보') + '에 대한 학생 예상');
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
  if (s.트랙 === '예측') {
    const m = s.무관변수 || {};
    if (!있(m.이름)) 부족.push('도움 안 될 것 같은 값 하나');
    else if (!(m.최대 > m.최소)) 부족.push('도움 안 될 것 같은 값의 범위');
  }
  const 글자 = v => String(v || '').replace(/\s/g, '').length;
  if (글자(s.이유) < 6) 부족.push('주제를 고른 이유');
  if (글자(s.기대효과) < 6) 부족.push('이 모델이 있으면 무엇이 달라지는지');
  return 부족;
}

function 세기_(history) {
  const 대신패턴 = /(알아서|네가\s*정|너가\s*정|아무거나|아무렇게|대신\s*(해|정|써)|그냥\s*해)/;
  let 대신 = 0, 도움 = 0;
  (history || []).forEach(m => {
    const c = String(m.content || '');
    if (m.role === 'user' && 대신패턴.test(c)) 대신++;
    if (m.role === 'assistant' && /"도움요청"\s*:\s*true/.test(c)) 도움++;
  });
  return { 대신: 대신, 도움: 도움 };
}

function 확정_(req) {
  const a = 인증_(req.token);
  if (!a.ok) return a;

  const 정리 = req.정리 || {};
  const 부족 = 검사_(정리);
  if (부족.length) return { 통과: false, 부족: 부족 };

  const 반정보 = req.반정보 || {};
  const 점검 = req.주제점검 || {};
  const 수 = 세기_(req.history);

  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (e) { return { 통과: false, 부족: ['지금 저장이 몰려 있습니다. 10초 뒤 다시 눌러 주세요.'] }; }

  try {
    const ss = 스프레드시트_();
    const sh = 머리글_(ss);            // 머리글이 없으면 여기서 만들어 둔다
    const f = 정리.특성 || [];
    const 칸 = i => {
      const x = f[i] || {};
      return [x.이름 || '', x.단위 || '', x.최소 == null ? '' : x.최소,
              x.최대 == null ? '' : x.최대, x.근거 || '',
              x.학생예상 || '', x.영향 || '', x.높은쪽 || '', x.실자료 || ''];
    };
    const m = 정리.무관변수 || {};
    const t = 정리.타깃 || {};

    지우기_(sh, a.메일);          // 다시 확정하면 이전 행을 지운다

    sh.appendRow([].concat(
      [new Date(), a.메일, a.학번, a.이름 || 반정보.이름 || '',
       반정보.학년 || '', 반정보.반 || '', 반정보.번호 || ''],
      [정리.트랙, 정리.주제, 정리.대상 || '', 정리.예측시점 || '', 정리.자료등급 || ''],
      [t.이름 || '', t.단위 || '', t.최소 == null ? '' : t.최소, t.최대 == null ? '' : t.최대,
       t.근거 || '', t.실자료 || ''],
      [정리.범주A || '', 정리.범주B || ''],
      칸(0), 칸(1), 칸(2), 칸(3),
      [m.이름 || '', m.단위 || '', m.최소 == null ? '' : m.최소, m.최대 == null ? '' : m.최대],
      [정리.이유 || '', 정리.기대효과 || ''],
      [점검.통과 ? 'O' : '△', (점검.메모 || '') +
        ((점검.걸린기준 && 점검.걸린기준.length && !점검.통과)
          ? ' / 걸린 것: ' + 점검.걸린기준.join(', ') : '')],
      [수.대신, 수.도움],
      [(req.history || []).length, JSON.stringify(req.history || []).slice(0, 45000)]
    ));
    return { 통과: true };
  } finally {
    lock.releaseLock();
  }
}

function 지우기_(sh, 메일) {
  const v = sh.getDataRange().getValues();
  const 시작 = 시작줄_(sh);
  for (let r = v.length - 1; r >= 시작; r--) {
    if (String(v[r][1]).toLowerCase() === String(메일).toLowerCase()) sh.deleteRow(r + 1);
  }
}

function 내기록_(메일) {
  try {
    const sh = 스프레드시트_().getSheetByName(시트이름);
    const v = sh.getDataRange().getValues();
    const 시작 = 시작줄_(sh);
    for (let r = v.length - 1; r >= 시작; r--) {
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
    const 버전 = 머리버전_(sh);
    const v = sh.getDataRange().getValues();
    const 행 = [];
    let 경고 = '';
    if (버전 === 0)
      경고 = '시트1에 머리글이 없습니다. 첫 줄부터 학생 기록으로 읽고 있습니다. ' +
             'Apps Script 에서 최초설정() 을 한 번 실행하면 머리글이 다시 만들어집니다.';
    else if (버전 === 1)
      경고 = '시트1 머리글이 예전 형식입니다. 열 위치가 달라 내용이 어긋나 보일 수 있습니다. ' +
             '쌓인 기록을 다른 시트로 옮긴 뒤 1행을 지우고 최초설정() 을 다시 실행하세요.';
    for (let r = 시작줄_(sh); r < v.length; r++) {
      const f = [];
      for (let k = 0; k < 4; k++) {
        const b = 20 + k * 9;
        if (v[r][b]) f.push({ 이름: v[r][b], 단위: v[r][b+1], 최소: v[r][b+2], 최대: v[r][b+3],
                              근거: v[r][b+4], 학생예상: v[r][b+5],
                              영향: v[r][b+6], 높은쪽: v[r][b+7], 실자료: v[r][b+8] });
      }
      행.push({
        시각: String(v[r][0]), 메일: v[r][1], 학번: v[r][2], 이름: v[r][3],
        학년: v[r][4], 반: v[r][5], 번호: v[r][6],
        트랙: v[r][7], 주제: v[r][8], 대상: v[r][9], 예측시점: v[r][10], 자료등급: v[r][11],
        타깃: { 이름: v[r][12], 단위: v[r][13], 최소: v[r][14], 최대: v[r][15],
                근거: v[r][16], 실자료: v[r][17] },
        범주A: v[r][18], 범주B: v[r][19],
        특성: f,
        무관: { 이름: v[r][56], 단위: v[r][57], 최소: v[r][58], 최대: v[r][59] },
        이유: v[r][60], 기대효과: v[r][61],
        점검: v[r][62], 점검메모: v[r][63],
        대신요청: v[r][64], 도움요청: v[r][65],
        주고받은수: v[r][66]
      });
    }
    return { ok: true, 시트주소: ss.getUrl(), 행: 행, 경고: 경고, 시트행수: v.length };
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

function 머리목록_() {
  const 특성머리 = n => ['정보'+n+'_이름','정보'+n+'_단위','정보'+n+'_최소',
                        '정보'+n+'_최대','정보'+n+'_근거','정보'+n+'_학생예상',
                        '정보'+n+'_실제영향','정보'+n+'_실제큰쪽','정보'+n+'_실자료'];
  return [].concat(
    ['시각','메일','학번','이름','학년','반','번호'],
    ['트랙','주제','대상','예측시점','자료등급'],
    ['타깃_이름','타깃_단위','타깃_최소','타깃_최대','타깃_근거','타깃_실자료'],
    ['범주A','범주B'],
    특성머리(1), 특성머리(2), 특성머리(3), 특성머리(4),
    ['무관_이름','무관_단위','무관_최소','무관_최대'],
    ['고른이유','기대효과'],
    ['주제점검','점검메모'],
    ['대신요청수','도움요청수'],
    ['주고받은수','대화내용(JSON)']
  );
}

/* 0 = 머리글 없음, 1 = 예전 형식, 2 = 지금 형식
   머리글이 없으면 기록을 읽는 쪽이 첫 학생을 건너뛰어 버리므로 반드시 확인한다. */
function 머리버전_(sh) {
  if (!sh || sh.getLastRow() === 0) return 0;
  if (String(sh.getRange(1, 1).getValue()).trim() !== '시각') return 0;
  const w = Math.max(sh.getLastColumn(), 1);
  const h = sh.getRange(1, 1, 1, w).getValues()[0];
  return (h[11] === '자료등급' && h[25] === '정보1_학생예상') ? 2 : 1;
}

/* 머리글이 없으면 만든다. 이미 학생 기록이 있으면 맨 위에 끼워 넣는다. */
function 머리글_(ss) {
  const sh = ss.getSheetByName(시트이름) || ss.insertSheet(시트이름);
  if (머리버전_(sh) !== 0) return sh;

  const 머리 = 머리목록_();
  if (sh.getLastRow() === 0) sh.appendRow(머리);
  else {
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, 머리.length).setValues([머리]);
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, 머리.length).setFontWeight('bold');
  sh.setColumnWidth(머리.length, 120);   // 대화 열은 좁게 — 눈에 걸리지 않게
  return sh;
}

/* 데이터가 시작되는 줄 번호 (머리글이 없으면 0) */
function 시작줄_(sh) { return 머리버전_(sh) === 0 ? 0 : 1; }

function 최초설정() {
  const ss = 스프레드시트_();
  머리글_(ss);
  const sh = ss.getSheetByName(시트이름);
  const 버전 = 머리버전_(sh);
  const 학생수 = Math.max(sh.getLastRow() - 시작줄_(sh), 0);

  if (버전 === 2) Logger.log('머리글 정상 (68열)');
  else if (버전 === 1) {
    Logger.log('⚠ 머리글이 예전 형식입니다. 열 위치가 달라 관리자 화면 내용이 어긋납니다.');
    Logger.log('  쌓인 기록을 다른 시트로 복사해 둔 뒤, 시트1의 1행과 기존 기록을 지우고 다시 실행하세요.');
  } else Logger.log('⚠ 머리글을 만들지 못했습니다. 시트1 이름을 확인하세요.');

  Logger.log('쌓인 학생 기록 : ' + 학생수 + '명');
  Logger.log('기록 시트 : ' + ss.getUrl());
  const k = API키_();
  Logger.log(k ? 'OpenAI 키 확인됨 (' + k.slice(0, 7) + '…' + k.slice(-4) + ')'
               : '⚠ OpenAI 키를 찾지 못했습니다. KEY 시트 A2 칸을 확인하세요.');
  Logger.log('대화 모델 : ' + MODEL + ' / 자료 찾기 모델 : ' + SEARCH_MODEL);
  Logger.log('CLIENT_ID : ' + CLIENT_ID);
  Logger.log('이제 배포 → 배포 관리 → 새 버전으로 다시 배포하세요 (주소는 그대로).');
}

/* 시트가 지금 어떤 상태인지만 확인한다 — 아무것도 고치지 않는다 */
function 시트점검() {
  const ss = 스프레드시트_();
  const sh = ss.getSheetByName(시트이름);
  if (!sh) { Logger.log('⚠ "' + 시트이름 + '" 시트가 없습니다.'); return; }
  const 버전 = 머리버전_(sh);
  Logger.log('시트 : ' + ss.getUrl());
  Logger.log('머리글 : ' + (버전 === 2 ? '정상(68열)' : 버전 === 1 ? '예전 형식' : '없음'));
  Logger.log('전체 줄 수 : ' + sh.getLastRow() + ' / 열 수 : ' + sh.getLastColumn());
  Logger.log('학생 기록 : ' + Math.max(sh.getLastRow() - 시작줄_(sh), 0) + '명');
  if (sh.getLastRow() > 0) {
    const 첫 = sh.getRange(1, 1, 1, Math.min(9, Math.max(sh.getLastColumn(), 1))).getValues()[0];
    Logger.log('1행 앞부분 : ' + JSON.stringify(첫));
  }
}

/* ════════ 점검용 — 스크립트 편집기에서 직접 돌려 볼 수 있다 ════════ */
function 검색시험() {
  const r = 자료찾기_([{ 항목: '시험', 검색어: '편의점 하루 도시락 판매량 평균' }]);
  Logger.log(JSON.stringify(r, null, 2));
}
