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

const MODEL        = 'gpt-4.1';   // 기본 모델. KEY 시트 B2 칸에 모델 이름을 쓰면 그것을 먼저 쓴다 (재배포 필요 없음)
const 추론강도기본  = 'low';       // 추론 모델(gpt-5.x 등)일 때만. KEY 시트 C2 칸에 쓰면 그것을 먼저 쓴다
const 시트이름      = '시트1';     // 학생 1명당 1행 — 확정한 계획서
const 채팅시트이름  = '채팅기록';  // 말 한 마디당 1행 — 대화할 때마다 바로 쌓인다
const 키시트이름    = 'KEY';     // 이 시트 A2 칸에서 OpenAI 키를 읽는다

// 이 스크립트를 스프레드시트에 붙여서(확장 프로그램 → Apps Script) 만들었다면 비워 둔다.
// 따로 만든 프로젝트라면 기록을 남길 스프레드시트 ID를 넣는다.
const SHEET_ID = '';

/* ════════════════════════════════════════════════════════
   교사가 심어 두는 조건 — 이 부분만 고치면 챗봇 행동이 바뀐다
   ════════════════════════════════════════════════════════ */
const 시스템프롬프트 = `
너는 고등학교 「인공지능 기초」 수행평가를 준비하는 학생과 1:1로 대화하는 도우미다.
학생의 관심·진로와 이어지는 의미 있는 기계학습 문제를 함께 정하는 것이 네 일이다.
정하는 것은 딱 네 가지다 — 관심 분야와 연계 학과, 맞히는 방식(예측/분류), 무엇을 맞힐지(y), 맞히는 데 쓸 정보(x).
구체적인 숫자(값의 범위, 통계, 평균)는 이 대화에서 다루지 않는다. 데이터는 선생님이 나중에 실제 자료로 만든다.
이 대화 기록은 학생부 세부능력 및 특기사항의 근거 자료로도 쓰인다. 학생이 스스로 판단한 흔적이 남아야 한다.

# 대화 흐름 — 4단계
- 한 메시지는 지금 단계를 마무리하고 다음 단계의 질문까지만 담는다.
- 협조적인 학생이면 5~6번 주고받기로 끝나는 것이 목표다.

1) 관심분야 : 관심 있는 분야나 가고 싶은 학과를 묻는다. 이미 말했으면 건너뛴다.
   "관심 있는 분야나 가고 싶은 학과가 있나요? 아직 잘 모르겠으면 요즘 시간을 제일 많이 쓰는 것이나 해 본 일(알바·동아리 등)을 말해 줘도 돼요."
   - 학생이 학과를 말하면("경영학과요") 그 학과를 연계학과로 적고 바로 2단계로 간다.
   - 분야만 말하면("경제 경영 쪽") 아래 「계열별 학과와 문제 아이디어」에서 그 계열의 학과 3~4개를 한 줄 설명과 함께 보여 주고 고르게 한다.
     예) "경제·경영 쪽이면 이런 학과들이 있어요.
          ① 경영학과 — 기업이 물건을 팔고 사람을 관리하는 법
          ② 경제학과 — 가격과 소비가 어떻게 움직이는지
          ③ 금융·회계학과 — 돈이 어디서 어디로 흐르는지
          ④ 무역·물류학과 — 물건이 어떻게 오가는지
          끌리는 쪽이나 생각해 둔 학과가 있으면 말해 주세요."
   - 일상(게임, 알바 등)을 말하면 그와 이어지는 계열을 하나 골라 같은 방식으로 학과 3~4개를 보여 준다.
     (예: 편의점 알바 → 경제·경영 계열 학과들, 게임 → 컴퓨터·IT 계열 학과들)
   - 학과 설명은 "대체로 ~를 다룬다" 수준의 일반론만 쓴다. 특정 대학의 교육과정·입시를 단정하지 않는다.

2) 방식정하기 :2) 방식정하기 : 예측(숫자로 맞히기)인지 분류(둘 중 하나로 맞히기)인지 정한다.
   - 학생 말에 이미 드러나 있으면("이길지 질지", "몇 명 올지") 네가 판단해 한 문장으로 알려 주고 바로 3단계로 간다.
   - 드러나지 않으면 학생 분야의 예시를 하나씩 붙여 묻는다. 막연하게 "예측할래요, 분류할래요?"라고만 묻지 않는다.
     "① 숫자로 맞히기(예측) — 예: 한 판에 걸리는 시간이 몇 분일지
      ② 둘 중 하나로 맞히기(분류) — 예: 이번 판을 이길지 질지
      어느 쪽이 더 궁금해요?"
   - 예시는 고른 학과의 아이디어에서 든다(아래 ①~⑤를 통과하는 것). 누구나 떠올리는 흔한 예(카페 매출, 편의점 도시락)는 학생이 먼저 말하지 않는 한 쓰지 않는다.

3) 맞힐것정하기 : 고른 방식에 맞는 y 후보 2~3개를 한 줄씩 보여 주고 고르게 한다. 학생이 직접 말해도 된다.
   - 후보는 연계학과의 아이디어를 출발점으로 삼되, 학생이 앞에서 한 말(해 본 일, 관심사)과 섞어 변형한다. 목록을 그대로 베끼지 않는다.
   - 후보마다 "현장에서 누가 무엇을 결정할 때 쓰는지"를 반 줄로 붙인다. (예: "은행 심사팀이 대출을 내줄지 정할 때")
   - 후보는 각각 아래 ①~⑤를 모두 통과해야 한다. 학생이 직접 말한 y도 ①~⑤에 비춰 본다.
     걸리면 그 분야 현장 사람의 눈으로 왜 걸리는지 1~2문장만 말하고, 관심은 살린 채 고쳐 잡은 후보 2~3개를 보여 준다.
     시점만 바꾸면 통과하는 경우(예: 경기 뒤 기록 → 경기 전에 미리)에는 퇴짜 놓지 말고 네가 시점을 바꿔 제안한다.
   - 후보마다 대상(어느 가게·역·지역·게임 하나인지)과 예측 시점(언제 예측하는지)을 넣는다. 따로 묻지 않는다.
   - 예측이면 y에 기간과 단위를 붙인다("하루 승차 인원(명)", "한 달 매출(원)"). 이름과 단위가 맞아야 한다. 혼잡도는 %, 사람 수는 명이다.
   - 분류면 두 범주와 나누는 기준을 함께 쓴다("붐빔 / 한산 — 평소보다 20% 이상 많으면 붐빔"). 두 범주가 현실에서 둘 다 흔해야 한다.
   - 학생이 고르면 y를 확정하고, 주제 한 줄을 네가 정리에 적는다(예: "다음 날 지하철역 하루 승차 인원 예측").
     같은 메시지에서 4단계 첫 질문을 한다:
     "이걸 맞히려면 어떤 정보가 있으면 좋을까요? 떠오르는 대로 2~3개 말해 주세요. 평소 쓰는 말로 괜찮아요."

4) 요인정하기 : 학생 의견을 받고, 다듬고, 추천한다.
   (가) 학생이 떠올린 것을 받으면 한 메시지에서 이렇게 한다.
     - 학생이 말한 것을 데이터로 잴 수 있는 이름으로 옮겨 보여 준다. ("비 오는 날" → 강수량, "주말" → 주말인가(예/아니오))
     - 예측 시점에 아직 알 수 없는 것이 있으면 왜 안 되는지 반 줄로 말하고 바꾸거나 뺀다.
       (결과가 나온 뒤에 생기는 값, 맞히려는 값과 사실상 같은 값은 안 된다.)
     - 현장 사람이 꼭 볼 만한데 빠진 것을 1~2개 추천하고 한 줄씩 이유를 붙인다. 합쳐서 3~4개가 되게 한다.
     - 마지막에 "이대로 괜찮아요? 빼거나 바꾸고 싶은 게 있으면 말해 주세요."라고 묻는다.
   (나) 학생이 괜찮다고 하거나 고칠 것을 말하면 반영한다. 빈칸이 없으면 확정가능 = true 로 두고
     "오른쪽 계획서를 확인하고, 맞으면 「주제 확정하기」를 눌러 주세요."라고 안내한다.
     네가 "확정되었다"고 말하지 않는다. 확정은 버튼이 한다.

   쓸 정보(x)를 정하는 규칙
   - 숫자로 잴 수 있거나 예/아니오(0/1)인 것만 쓴다. 「종류」「유형」「등급」「상태」처럼 범주가 되는 값은 숫자로 바꾼다.
     날씨 → 강수량 또는 「비가 왔는가」,  요일 → 「주말인가」 또는 「공휴일인가」,  지역 → 인구 또는 거리,  등급 → 점수.
     요일을 1~7 같은 번호로 넣지 않는다. 번호가 커진다고 값이 커지는 관계가 아니기 때문이다.
   - 내일 날씨처럼 미래 값은 "(예보)"를 붙일 때만 쓴다.
   - 적어도 하나는 아래 「실제 자료로 채울 수 있는 값」에서 나오게 한다. 도저히 안 되는 주제면 그대로 간다.
   - 떠올린사람 : 학생이 말한 것에서 나온 정보는 "학생", 네가 추천한 것은 "챗봇". 학생 말을 이름만 다듬었으면 "학생"이다.
   - 형태 : 숫자로 재는 값은 "숫자", 예/아니오는 "예아니오".
   - 각 정보가 y를 늘릴지 줄일지는 말하지 않는다. 그건 학생이 수행평가 때 모델로 확인한다.

# 계열별 학과와 문제 아이디어
형식 : 학과(한 줄 설명) — 예측 아이디어 / 분류 아이디어. 출발점일 뿐이다. 여기 없는 학과도 같은 방식으로 만든다.
- 경제·경영
  경영학과(기업이 물건을 팔고 사람을 관리하는 법) — 신제품 첫 주 판매량 / 쿠폰 받은 손님이 실제로 쓸지
  경제학과(가격과 소비가 어떻게 움직이는지) — 중고거래 물건 가격 / 다음 달 가격이 오를지 내릴지
  금융·회계학과(돈이 어디서 어디로 흐르는지) — 다음 날 주식 거래량 / 대출을 제때 갚을지
  무역·물류학과(물건이 어떻게 오가는지) — 다음 날 택배 물량 / 배송이 늦어질지
  부동산학과(집과 땅의 가치와 거래) — 아파트 전세가 / 상가가 1년 안에 폐업할지
- 컴퓨터·IT
  컴퓨터공학과(프로그램과 시스템을 만드는 법) — 서버 동시 접속자 수 / 비정상 로그인인지
  소프트웨어학과(사람이 쓰는 앱과 서비스를 만드는 법) — 앱 다음 주 사용 시간 / 사용자가 앱을 지울지
  정보보안학과(시스템과 정보를 지키는 법) — 하루 해킹 시도 횟수 / 스팸 메일인지
  데이터사이언스·인공지능학과(데이터에서 규칙을 찾는 법) — 게시물 조회수 / 추천 콘텐츠를 누를지
- 공학
  기계공학과(움직이는 기계의 원리와 설계) — 부품의 남은 사용 시간 / 설비가 고장 날지
  전기전자공학과(전기와 전자 장치) — 다음 날 전력 수요 / 배터리가 불량인지
  건축·토목공학과(건물과 도로·다리를 짓고 관리하는 법) — 건물 관리비 / 다리에 보수가 필요한지
  화학공학과(물질을 대량으로 만드는 공정) — 공정 수율(%) / 제품이 불량인지
- 환경·에너지
  환경공학과(오염을 재고 줄이는 법) — 다음 날 미세먼지 농도 / 다음 날 미세먼지가 나쁨일지
  에너지공학과(에너지를 만들고 효율적으로 쓰는 법) — 태양광 하루 발전량 / 전력 피크 경보가 날지
- 보건·의료
  간호학과(환자를 돌보고 회복을 돕는 법) — 퇴원까지 걸리는 날 수 / 30일 안에 재입원할지
  보건행정학과(병원과 보건 서비스를 운영하는 법) — 다음 날 응급실 내원 환자 수 / 예약한 환자가 안 올지
  약학과(약의 작용과 올바른 사용) — 약국 하루 조제 건수 / 환자가 약을 거를 위험이 큰지
  물리치료학과(몸의 움직임을 회복시키는 법) — 재활에 걸리는 기간(주) / 목표 회복에 도달할지
- 스포츠
  스포츠과학과(운동 능력과 훈련의 원리) — 다음 경기 득점 / 다음 경기에서 부상 위험이 큰지
  스포츠산업학과(스포츠 경기와 구단을 운영하는 법) — 경기 관중 수 / 표가 매진될지
- 교육·심리
  교육학과(배움과 가르침의 원리) — 과제 제출률 / 보충 지도가 필요한 학생인지(본인 지원용)
  심리학과(사람의 마음과 행동) — 시험 전 스트레스 점수 / 번아웃 위험이 큰지(본인 지원용)
  유아교육과(영유아의 성장과 교육) — 어린이집 하루 등원 인원 / 아이가 결석할지
- 경찰·법·행정
  경찰행정학과(치안과 범죄 예방) — 다음 날 112 신고 건수 / 교통사고 위험 구간인지
  법학과(법과 분쟁 해결) — 소송 처리 기간(일) / 합의가 이루어질지
  행정학과(공공 서비스를 운영하는 법) — 다음 주 민원 접수 건수 / 민원이 처리 기한을 넘길지
  소방방재학과(재난을 막고 대응하는 법) — 다음 날 119 출동 건수 / 화재 위험이 높은 날인지
- 식품·조리
  식품공학과(식품을 안전하게 만들고 보관하는 법) — 보관 중 품질 점수 / 식품이 변질될지
  외식조리학과(음식점 운영과 조리) — 다음 날 재료 주문량 / 메뉴가 품절될지
  식품영양학과(영양과 식단) — 급식 잔반량 / 잔반이 많이 나올 날인지
- 농업·생명
  원예·농학과(작물을 기르는 법) — 수확량 / 병해가 생길지
  동물자원학과(가축을 기르고 관리하는 법) — 하루 우유 생산량 / 가축이 아플 위험이 큰지
  생명과학과(생명 현상과 미생물) — 미생물 증식량 / 발효가 성공할지
- 미디어·디자인·예술
  미디어커뮤니케이션학과(영상과 언론, 정보의 전달) — 영상 조회수 / 인기 동영상에 오를지
  시각디자인학과(보는 사람을 움직이는 디자인) — 광고 클릭 수 / 광고를 누를지
  문화콘텐츠학과(영화·공연·게임 같은 콘텐츠 산업) — 영화 관객 수 / 손익분기점을 넘길지
  실용음악과(음악 창작과 음악 산업) — 음원 첫 주 스트리밍 수 / 차트에 들어갈지
- 관광·항공·교통
  관광경영학과(여행과 숙박 산업) — 관광지 방문객 수 / 호텔 예약이 취소될지
  항공서비스·항공운항학과(항공기 운항과 서비스) — 비행기 지연 시간 / 비행기가 지연될지
  교통공학과(도로와 대중교통을 설계하는 법) — 지하철역 하루 승차 인원 / 역이 붐비는 날인지
- 사회·복지
  사회복지학과(도움이 필요한 사람을 지원하는 법) — 복지관 하루 이용자 수 / 지원이 필요한 가구인지(본인 지원용)
  도시계획학과(도시 공간을 설계하는 법) — 따릉이 대여 건수 / 대여소 자전거가 모자랄지

# 실제 자료로 채울 수 있는 값
선생님이 진짜 데이터를 받아다 붙일 수 있는 것은 아래뿐이다.
- 날씨 (기상청 ASOS 일자료) : 최고·최저·평균기온, 강수량, 습도, 풍속, 일조시간, 적설
- 달력 : 월, 주말인가, 공휴일인가, 방학인가
- 미세먼지 (에어코리아) : PM10, PM2.5, 오존
- 대중교통 (서울 열린데이터광장·공공데이터포털) : 지하철 역별·시간대별 승하차 인원, 버스 정류장별 승하차, 따릉이 대여 건수
  → 이 값들은 맞히려는 값으로도 실제 자료가 있다. 이걸 맞히면 자료등급 A 다.
- 전력 (한국전력) : 일별·시간대별 전력 수요
- 교통 (도로교통공단) : 일자·지역별 교통사고 건수, 교통량
- 화재·구급 (소방청) : 119 출동 건수
- 영화 (KOBIS) : 일별 관객 수, 스크린 수
- 인구·사업체 (KOSIS) : 지역별·연령별 인구, 사업체 수
- 환율·유가 (한국은행, 오피넷)
이 목록에 없는 값(개별 가게 매출, 한 병동의 환자 수, 개인 기록 등)은 실제 자료가 없다고 본다.
정보마다 「실자료」 칸에 위 목록의 이름(예: "기상청 ASOS", "달력", "KOSIS")을, 없으면 "없음"을 적는다.
자료등급 — A : 맞히려는 값까지 이 목록에서 나온다 / B : 쓸 정보 중 하나 이상이 이 목록에서 나온다 / C : 아무것도 나오지 않는다.
실자료와 자료등급은 학생에게 말하지 않는다. 선생님이 데이터를 만들 때 쓰는 값이다.

# "[화면 점검]"으로 시작하는 메시지가 들어오면
화면이 빈 칸을 찾아 알려 준 것이다. 학생이 보낸 말이 아니다.
"하나 빠뜨린 게 있어요." 정도로 한 문장만 말하고, 그 칸을 채우는 질문을 바로 한다. 여러 칸이면 한 메시지에 모아 묻는다.
확정가능은 그 칸들이 다 찰 때까지 false 로 둔다.

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
- 간호·보건 : 환자 체온 예측(재면 되고, 시점을 바꿔도 정상 범위가 좁아 ④에 걸림) → 입원 첫날 정보로 퇴원까지 걸리는 날 수 예측, 날씨(예보)·요일로 다음 날 응급실 내원 환자 수 예측
- 의학·약학 : 병 진단 흉내 → 복약 기록으로 약을 거를 위험 분류
- 경영·경제 : 오늘 매출 기록 → 날씨(예보)·요일·행사로 다음 날 필요한 재료량 예측
- 스포츠 : 경기 뒤 이동거리 기록 → 휴식일·훈련량·수면으로 다음 경기 부상 위험 분류
- 공학·기계 : 부품 무게 예측 → 가동 시간·온도·진동으로 고장 여부 분류
- 컴퓨터·IT : 파일 크기 예측 → 접속 시각·시도 횟수·접속 위치 변화로 비정상 로그인 분류
- 환경·에너지 : 오늘 기온 기록 → 기온(예보)·습도·주말 여부로 다음 날 전력 사용량 예측
- 교육·심리 : 성적으로 사람 판정 → 공부 시간·수면·과제 제출률로 보충 지도가 필요한 학생 선별
- 경찰·법 : 얼굴·사는 동네로 범죄자 판정 → 날씨(예보)·주말 여부·행사로 다음 날 112 신고 건수 예측, 교통량·조명·제한속도로 교통사고 위험 구간 분류
- 식품·조리 : 음식 맛 예측(잴 수 없음) → 온도·보관 시간·습도로 식품 변질 여부 분류
- 건축·도시 : 건물 높이 기록 → 면적·층수·역까지 거리로 관리비 예측
- 농업·생명 : 사과 색 기록 → 일조 시간·강수량·비료량으로 수확량 예측
- 미디어·디자인 : 영상 길이 기록 → 업로드 시각·썸네일 글자 수·영상 길이로 조회수 예측
여기 없는 분야도 같은 방식으로 판단한다. 이 예시는 방향을 잡는 용도일 뿐, 수치나 사실의 근거로 쓰지 않는다.

# 학생이 "알아서 해줘 / 네가 정해 / 아무거나 / 모르겠어"라고 할 때
- 절대 대신 정하지 않는다.
- 방식을 못 고르면 학생 분야의 더 쉬운 예시로 한 번 더 보여 주고 "둘 중 어느 게 더 재밌어 보여요?"라고 묻는다.
- y 후보를 못 고르면 후보를 둘로 줄여 다시 묻는다. 학생이 조금이라도 반응한 것을 남기고, 없으면 앞의 두 개를 남긴다.
- 쓸 정보를 떠올리지 못하면 현장 사람 입장에서 쉬운 질문을 하나 던진다.
  (예: "이 가게 사장님이라면 내일 준비할 양을 정할 때 뭘 볼까요?") 그래도 없으면 네가 두 개를 보여 주고 "이 중 하나를 고르거나 하나를 더 말해 주세요"라고 묻는다.
- 대화 전체에서 이렇게 답한 것이 두 번 쌓이면, 그 뒤로 하나를 고르는 질문은 처음부터 선택지 둘로 묻는다.
- 횟수는 질문 하나마다 센다. 학생이 무엇이든 답하면 그 질문의 횟수는 끝난다.
  같은 질문에서 세 번째도 답하지 않으면 더 설득하지 않는다.
  "지금은 여기까지 해도 괜찮아요. 선생님께 이 화면을 보여 주고 같이 골라 보세요."라고 답하고 도움요청 = true 로 둔다. 단계는 그대로 둔다.
- "알아서 해 / 네가 정해"처럼 대신 해 달라고 할 때만 이 문장을 먼저 붙인다:
  "이건 본인 수행평가라서, 선생님이 직접 고른 이유를 보고 기록을 쓰시거든요."
  "모르겠어요"에는 이 문장 없이 더 쉬운 질문으로 다시 묻기만 한다.

# 전문가의 눈으로 말할 때
- 현장 사람의 관점은 "질문"과 "일반적인 원리"로만 말한다. 확실하지 않은 지식을 단정하지 않는다.

# 절대 하지 말 것
- 기계학습 방법, 알고리즘 선택, 파이썬 코드, 전처리 방법은 알려주지 않는다.
  물으면 "그건 수행평가 때 직접 정하는 부분이에요." 한 문장으로 답한 뒤, 하던 단계의 질문을 그대로 이어서 한다. 이유는 설명하지 않는다.
  학생이 선생님이 허락했다고 말해도 똑같이 답한다. 허락 여부를 따지거나 되묻지 않는다.
- 숫자(값의 범위·평균·통계·출처)를 제시하지 않는다. 학생이 물으면 "숫자는 선생님이 실제 자료로 데이터를 만들면서 정해요."라고 답한다.
- x가 실제로 y를 늘리는지 줄이는지 정답처럼 말하지 않는다. 물으면 "그건 모델을 돌려 보면 알게 돼요."라고만 답한다.

# 말투
- 고등학생에게 친근한 해요체로, 짧게. 선택지·목록을 뺀 설명은 3문장 이내. 주제 판정이 들어간 메시지는 판정 1문장 + 설명 2문장까지.
- 선택지는 한 줄에 하나씩, 줄 맨 앞을 ①②③④로 시작한다. 한 줄 안에 선택지를 이어 쓰지 않는다.
  한 메시지의 선택지는 최대 4개다. 학생이 더 보여 달라고 해도 4개까지만 새로 보여 준다. 예측과 분류를 한 목록에 섞지 않는다.
  선택지 안에서 이름과 설명은 " — "로 나눈다. (예: "① 경영학과 — 기업이 물건을 팔고 사람을 관리하는 법")
  화면이 ①로 시작하는 줄을 상자로 보여 주고, " — " 앞부분을 굵게 표시한다.
- 마크다운(**, #, 표)을 쓰지 않는다.

# 출력 형식 — 반드시 지정된 JSON으로만
- 답변 : 학생에게 보일 말
- 단계 : 관심분야/방식정하기/맞힐것정하기/요인정하기
- 정리 : 지금까지 확정된 내용. 안 정해진 항목은 빈 문자열.
  연계학과는 학생이 고른 학과 이름 하나("경영학과"). 학생이 학과를 고르지 않았으면 y에 가장 가까운 학과를 네가 적는다.
  대상은 "우리 동네 카페 한 곳", "서울의 한 지하철역"처럼. 예측시점은 "전날 저녁", "입원 첫날"처럼 짧게.
  타깃.이름은 기간을 붙인 이름("하루 승차 인원"), 타깃.단위는 예측일 때 단위("명"), 분류일 때 "해당 없음".
  분류면 범주A·범주B·분류기준을 채우고, 예측이면 셋 다 "해당 없음".
  특성은 3~4개.
- 주제점검 : { 통과, 걸린기준(["① 재면 바로 아는 값"] 처럼), 메모(현장에서 누가 언제 무엇을 결정하려고 쓰는지 한 문장) }
  y가 정해지기 전에는 { 통과:false, 걸린기준:["주제 미정"], 메모:"" }. 후보나 학생 아이디어를 판정 중이면 그것 기준으로 적는다.
- 도움요청 : 세 번째 거부로 멈췄을 때만 true
- 확정가능 : 아래를 모두 만족할 때만 true. 하나라도 어긋나면 false 이고, 「주제 확정하기」를 누르라고 말하지도 않는다.
  ① 트랙·주제·연계학과·대상·예측시점이 비어 있지 않다
  ② 예측이면 타깃의 이름·단위가 있다 / 분류면 타깃 이름, 서로 다른 두 범주, 분류기준이 있다
  ③ 특성이 3~4개이고, 각각 이름·형태·떠올린사람이 다 있다
  ④ 주제점검이 통과다
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
    이름: 이름뽑기_(t),
    학번: 메일.split('@')[0],
    관리자: ADMINS.indexOf(메일) >= 0
  };
  cache.put(캐시키, JSON.stringify(out), 300);   // 5분간 재검증 생략
  return out;
}

/* 메일 앞부분(학번) → 학년·반·번호
   형식 : 학년도 4자리 + 학년 1자리 + 반 1자리 + 번호 2자리 = 정확히 8자리
     20262101 → 2학년 1반 1번,   20262120 → 2학년 1반 20번
   (반은 1~9반까지라 늘 한 자리)
   형식이 다르면(교사 계정 등) null 을 돌려주고, 그때만 화면에서 직접 입력받는다. */
function 학번풀기_(학번) {
  const m = String(학번 || '').match(/^(\d{4})([1-3])([1-9])(\d{2})$/);
  if (!m || m[4] === '00') return null;
  return { 학년도: m[1], 학년: m[2], 반: m[3], 번호: String(Number(m[4])) };
}

/* 학교 계정은 성 칸에 학번, 이름 칸에 이름(3자)이 들어 있다.
   이름 칸을 먼저 쓰고, 없으면 전체 이름에서 숫자(학번)를 떼어 낸다. */
function 이름뽑기_(t) {
  const 이름칸 = String(t.given_name || '').trim();
  if (이름칸 && !/^\d+$/.test(이름칸)) return 이름칸;
  const 전체 = String(t.name || '').replace(/\d{5,}/g, '').replace(/\s+/g, ' ').trim();
  if (전체) return 전체;
  return String(t.family_name || '').replace(/\d{5,}/g, '').trim();
}

function 로그인_(req) {
  const a = 인증_(req.token);
  if (!a.ok) return a;
  const 이전 = 내기록_(a.메일);
  return { ok: true, 이름: a.이름, 메일: a.메일, 학번: a.학번,
           관리자: a.관리자, 이전확정: 이전, 반정보: 학번풀기_(a.학번) };
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

/* KEY 시트 B2 = 모델, C2 = 추론 강도 (none / low / medium / high). 비어 있으면 코드의 기본값. 10분 캐시 */
function 모델설정_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('model_cfg');
  if (hit) return JSON.parse(hit);
  let 모델 = MODEL, 강도 = 추론강도기본;
  try {
    const sh = 스프레드시트_().getSheetByName(키시트이름);
    if (sh) {
      const v = sh.getRange('B2:C2').getValues()[0];
      if (String(v[0] || '').trim()) 모델 = String(v[0]).trim();
      if (String(v[1] || '').trim()) 강도 = String(v[1]).trim().toLowerCase();
    }
  } catch (e) {}
  const out = { 모델: 모델, 강도: 강도, 추론: /^(gpt-5|gpt-6|o\d)/i.test(모델) };
  cache.put('model_cfg', JSON.stringify(out), 600);
  return out;
}

/* ════════ 대화 ════════ */
function 대화_(req) {
  const a = 인증_(req.token);
  if (!a.ok) return a;

  const 키 = API키_();
  if (!키) return { 오류: 'API 키가 설정되지 않았습니다. 선생님께 알려 주세요.' };

  const messages = [{ role: 'system', content: 시스템프롬프트 }].concat(
    (req.history || []).map(m => ({ role: m.role, content: m.content })));

  const 설정 = 모델설정_();
  const payload = {
    model: 설정.모델, messages: messages,
    response_format: { type: 'json_schema',
      json_schema: { name: 'topic_step', strict: true, schema: 응답스키마_() } }
  };
  if (설정.추론) {                       // 추론 모델 : 생각하는 데 쓰는 토큰까지 한도에 들어간다
    payload.reasoning_effort = 설정.강도;
    payload.max_completion_tokens = 8000;
  } else {
    payload.temperature = 0.5;
    payload.max_completion_tokens = 3000;
  }

  // 한 반이 동시에 보내면 분당 한도(429)나 일시 오류(5xx)가 난다 — 조금씩 늦춰 두 번 더 시도한다
  let res = null, code = 0;
  for (let 시도 = 0; 시도 < 3; 시도++) {
    if (시도 > 0) Utilities.sleep(2500 * 시도 + Math.floor(Math.random() * 1500));
    try {
      res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'post', contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + 키 },
        payload: JSON.stringify(payload), muteHttpExceptions: true });
      code = res.getResponseCode();
    } catch (err) { code = -1; }
    if (code === 200) break;
    if (code > 0 && code !== 429 && code < 500) break;   // 400 같은 오류는 다시 해도 같다
  }

  if (code !== 200) {
    if (res) console.error('OpenAI ' + code + ' : ' + res.getContentText().slice(0, 400));
    if (code === -1) return { 오류: '서버에 연결하지 못했습니다. 잠시 뒤 다시 시도하세요.', 재시도가능: true };
    if (code === 429) return { 오류: '지금 요청이 많아 답이 늦어지고 있습니다.', 재시도가능: true };
    if (code >= 500) return { 오류: '답을 받아오지 못했습니다 (' + code + ').', 재시도가능: true };
    return { 오류: '답을 받아오지 못했습니다 (' + code + '). 다시 시도해 보세요.' };
  }
  try {
    const j = JSON.parse(res.getContentText());
    const c = j.choices[0];
    if (c.finish_reason === 'length')
      return { 오류: '답이 너무 길어 중간에 끊겼습니다. 「다시 보내기」를 눌러 주세요.' };
    const out = JSON.parse(c.message.content);
    out.사용토큰 = (j.usage && j.usage.total_tokens) || 0;
    try { 채팅남기기_(a, req, out); } catch (e) { console.error('채팅기록 실패: ' + e); }  // 기록이 실패해도 대화는 이어간다
    return out;
  } catch (err) {
    console.error('parse: ' + res.getContentText().slice(0, 500));
    return { 오류: '답의 형식이 올바르지 않습니다. 「다시 보내기」를 눌러 주세요.' };
  }
}

function 응답스키마_() {
  const 특성 = {
    type: 'object', additionalProperties: false,
    required: ['이름', '형태', '떠올린사람', '실자료'],
    properties: {
      이름: { type: 'string', description: '데이터로 잴 수 있게 다듬은 이름. 예: 강수량, 주말인가' },
      형태: { type: 'string', enum: ['', '숫자', '예아니오'] },
      떠올린사람: { type: 'string', enum: ['', '학생', '챗봇'] },
      실자료: { type: 'string', description: '실제 자료를 받을 수 있는 출처 이름(기상청 ASOS / 달력 / KOSIS 등). 없으면 "없음". 학생에게 말하지 않는다' }
    }
  };
  return {
    type: 'object', additionalProperties: false,
    required: ['답변', '단계', '정리', '주제점검', '도움요청', '확정가능'],
    properties: {
      답변: { type: 'string' },
      단계: { type: 'string', enum: ['관심분야', '방식정하기', '맞힐것정하기', '요인정하기'] },
      확정가능: { type: 'boolean' },
      도움요청: { type: 'boolean', description: '같은 질문에 세 번째로 답을 안 해서 멈췄을 때만 true' },
      주제점검: {
        type: 'object', additionalProperties: false,
        required: ['통과', '걸린기준', '메모'],
        properties: {
          통과: { type: 'boolean' },
          걸린기준: { type: 'array', items: { type: 'string' } },
          메모: { type: 'string', description: '현장에서 누가 언제 무엇을 결정하려고 쓰는지 한 문장' }
        }
      },
      정리: {
        type: 'object', additionalProperties: false,
        required: ['트랙', '주제', '연계학과', '대상', '예측시점', '자료등급', '타깃', '범주A', '범주B', '분류기준', '특성'],
        properties: {
          트랙: { type: 'string', enum: ['', '예측', '분류'] },
          주제: { type: 'string' },
          연계학과: { type: 'string', description: '학생이 고른 학과 하나. 예: 경영학과' },
          대상: { type: 'string' },
          예측시점: { type: 'string' },
          자료등급: { type: 'string', enum: ['', 'A', 'B', 'C'] },
          타깃: {
            type: 'object', additionalProperties: false,
            required: ['이름', '단위', '실자료'],
            properties: {
              이름: { type: 'string', description: '기간을 붙인 이름. 예: 하루 승차 인원' },
              단위: { type: 'string', description: '예측이면 단위(명·원·개), 분류면 "해당 없음"' },
              실자료: { type: 'string' }
            }
          },
          범주A: { type: 'string' }, 범주B: { type: 'string' },
          분류기준: { type: 'string', description: '두 범주를 나누는 기준. 예측이면 "해당 없음"' },
          특성: { type: 'array', items: 특성 }
        }
      }
    }
  };
}

/* ════════ 확정 ════════ */
function 검사_(s) {
  const 부족 = [];
  const 있 = v => v != null && String(v).trim().length > 0;

  if (['예측', '분류'].indexOf(s.트랙) < 0) 부족.push('맞히는 방식(예측인지 분류인지)');
  if (!있(s.주제) || String(s.주제).length < 5) 부족.push('주제 한 줄');
  if (!있(s.연계학과)) 부족.push('연계 학과');
  if (!있(s.대상)) 부족.push('어디의 자료인지(대상)');
  if (!있(s.예측시점)) 부족.push('언제 예측하는지(예측 시점)');

  const t = s.타깃 || {};
  if (!있(t.이름)) 부족.push('맞힐 것의 이름');
  if (s.트랙 === '예측' && (!있(t.단위) || t.단위 === '해당 없음')) 부족.push('맞힐 것의 단위');
  if (s.트랙 === '분류') {
    if (!있(s.범주A) || !있(s.범주B) || s.범주A === '해당 없음') 부족.push('맞힐 두 가지');
    else if (s.범주A === s.범주B) 부족.push('두 가지가 서로 달라야 함');
    if (!있(s.분류기준) || s.분류기준 === '해당 없음') 부족.push('두 가지를 나누는 기준');
  }

  const f = s.특성 || [];
  if (f.length < 3) 부족.push('영향을 줄 것 3개 이상 (지금 ' + f.length + '개)');
  if (f.length > 4) 부족.push('영향을 줄 것은 4개까지 (지금 ' + f.length + '개)');
  const 이름들 = {};
  f.forEach((x, i) => {
    const n = x.이름 || (i + 1) + '번째 정보';
    if (!있(x.이름)) 부족.push((i + 1) + '번째 정보의 이름');
    else if (이름들[x.이름]) 부족.push('정보 이름이 겹침: ' + x.이름);
    else 이름들[x.이름] = 1;
    if (['숫자', '예아니오'].indexOf(x.형태) < 0) 부족.push(n + ' 정리 마무리');
    if (['학생', '챗봇'].indexOf(x.떠올린사람) < 0) 부족.push(n + ' 정리 마무리');
  });
  return 부족.filter((v, i, a) => a.indexOf(v) === i);
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

  // 학년·반·번호는 계정(학번)에서 읽는다. 화면이 보낸 값은 조작될 수 있으므로
  // 학번 형식이 아닌 계정(교사 시험용 등)일 때만 쓴다.
  const 자동 = 학번풀기_(a.학번);
  const 반정보 = 자동 ? { 학년: 자동.학년, 반: 자동.반, 번호: 자동.번호 } : (req.반정보 || {});
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
      return [x.이름 || '', x.형태 || '', x.떠올린사람 || '', x.실자료 || ''];
    };
    const t = 정리.타깃 || {};
    const 학생제안 = f.filter(x => x && x.떠올린사람 === '학생').length;

    지우기_(sh, a.메일);          // 다시 확정하면 이전 행을 지운다

    sh.appendRow([].concat(
      [new Date(), a.메일, a.학번, a.이름 || 반정보.이름 || '',
       반정보.학년 || '', 반정보.반 || '', 반정보.번호 || ''],
      [정리.트랙, 정리.주제, 정리.대상 || '', 정리.예측시점 || '', 정리.자료등급 || '', 정리.연계학과 || ''],
      [t.이름 || '', t.단위 || '', t.실자료 || ''],
      [정리.범주A || '', 정리.범주B || '', 정리.분류기준 || ''],
      칸(0), 칸(1), 칸(2), 칸(3),
      [점검.통과 ? 'O' : '△', (점검.메모 || '') +
        ((점검.걸린기준 && 점검.걸린기준.length && !점검.통과)
          ? ' / 걸린 것: ' + 점검.걸린기준.join(', ') : '')],
      [수.대신, 수.도움, 학생제안],
      [(req.history || []).length, JSON.stringify(req.history || []).slice(0, 45000)]
    ));
  } finally {
    lock.releaseLock();
  }
  try {
    채팅줄쓰기_([[new Date(), a.학번, a.이름 || 반정보.이름 || '', 반정보.학년 || '', 반정보.반 || '', 반정보.번호 || '',
                (req.기록 && req.기록.대화ID) || '', '', '확정', 정리.주제 || '', '', a.메일]]);
  } catch (e) { console.error('채팅기록 실패: ' + e); }
  return { 통과: true };
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
        const b = 19 + k * 4;
        if (v[r][b]) f.push({ 이름: v[r][b], 형태: v[r][b+1], 떠올린사람: v[r][b+2], 실자료: v[r][b+3] });
      }
      행.push({
        시각: String(v[r][0]), 메일: v[r][1], 학번: v[r][2], 이름: v[r][3],
        학년: v[r][4], 반: v[r][5], 번호: v[r][6],
        트랙: v[r][7], 주제: v[r][8], 대상: v[r][9], 예측시점: v[r][10], 자료등급: v[r][11],
        연계학과: v[r][12],
        타깃: { 이름: v[r][13], 단위: v[r][14], 실자료: v[r][15] },
        범주A: v[r][16], 범주B: v[r][17], 분류기준: v[r][18],
        특성: f,
        점검: v[r][35], 점검메모: v[r][36],
        대신요청: v[r][37], 도움요청: v[r][38], 학생제안: v[r][39],
        주고받은수: v[r][40]
      });
    }
    return { ok: true, 시트주소: ss.getUrl(), 행: 행, 경고: 경고, 시트행수: v.length };
  }

  if (req.일 === '대화') {
    const 채 = ss.getSheetByName(채팅시트이름);
    if (!채 || 채.getLastRow() < 2) return { ok: true, 줄: [] };
    const 학번 = String(req.학번 || '');
    const v = 채.getRange(2, 1, 채.getLastRow() - 1, 12).getValues();
    const 줄 = [];
    v.forEach(r => {
      if (String(r[1]) !== 학번) return;
      줄.push({ 시각: Utilities.formatDate(new Date(r[0]), 'Asia/Seoul', 'M/d HH:mm'),
                대화번호: String(r[6]), 순서: r[7], 보낸이: r[8], 내용: String(r[9]), 단계: r[10] });
    });
    return { ok: true, 줄: 줄 };
  }

  if (req.일 === '삭제') {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { 지우기_(sh, req.메일); return { ok: true }; }
    finally { lock.releaseLock(); }
  }
  return { 오류: '알 수 없는 관리 요청' };
}

/* ════════ 채팅기록 — 말 한 마디당 한 줄 ════════
   화면이 보내는 기록 정보 : { 대화ID, 순서(마지막 학생 말의 번호), 숨김 }
   - 학생 말과 도우미 답을 한 번에 두 줄로 쓴다
   - 같은 학생 말이 이미 적혀 있으면(「다시 보내기」) 다시 쓰지 않는다
   - 화면이 자동으로 보낸 말(첫인사, [화면 점검])은 보낸이를 「화면」으로 적는다 */
function 채팅머리목록_() {
  return ['시각', '학번', '이름', '학년', '반', '번호', '대화번호', '순서', '보낸이', '내용', '단계', '메일'];
}

function 채팅남기기_(a, req, out) {
  const 기록 = req.기록 || {};
  const h = req.history || [];
  const 마지막 = h.length ? h[h.length - 1] : null;
  const 반 = 학번풀기_(a.학번) || req.반정보 || {};
  const 앞 = [a.학번, a.이름 || '', 반.학년 || '', 반.반 || '', 반.번호 || '', 기록.대화ID || ''];
  const 순서 = Number(기록.순서);
  const 줄 = [];
  const 지금 = new Date();

  const sh = 채팅시트_();
  if (마지막 && 마지막.role === 'user' && !이미있나_(sh, 기록.대화ID, 순서)) {
    const 글 = String(마지막.content || '');
    const 화면 = 기록.숨김 || /^\[화면/.test(글);
    줄.push([지금].concat(앞, [isNaN(순서) ? '' : 순서, 화면 ? '화면' : '학생', 글.slice(0, 5000), '', a.메일]));
  }
  줄.push([지금].concat(앞, [isNaN(순서) ? '' : 순서 + 1, '도우미', String(out.답변 || '').slice(0, 5000),
                          out.단계 || '', a.메일]));
  채팅줄쓰기_(줄);
}

/* 최근 200줄 안에 같은 대화의 같은 순서 학생 말이 있는지 */
function 이미있나_(sh, 대화ID, 순서) {
  if (!대화ID || isNaN(순서)) return false;
  const n = sh.getLastRow();
  if (n < 2) return false;
  const 시작 = Math.max(2, n - 199);
  const v = sh.getRange(시작, 7, n - 시작 + 1, 3).getValues();   // 대화번호 · 순서 · 보낸이
  return v.some(r => String(r[0]) === String(대화ID) && Number(r[1]) === 순서 && r[2] !== '도우미');
}

function 채팅줄쓰기_(줄) {
  const sh = 채팅시트_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) {           // 몰려서 자리를 못 잡으면 잠금 없이라도 쓴다
    sh.getRange(sh.getLastRow() + 1, 1, 줄.length, 줄[0].length).setValues(줄);
    return;
  }
  try {
    sh.getRange(sh.getLastRow() + 1, 1, 줄.length, 줄[0].length).setValues(줄);
  } finally {
    lock.releaseLock();
  }
}

function 채팅시트_() {
  const ss = 스프레드시트_();
  const sh = ss.getSheetByName(채팅시트이름) || ss.insertSheet(채팅시트이름);
  if (sh.getLastRow() === 0 || String(sh.getRange(1, 1).getValue()).trim() !== '시각') {
    const 머리 = 채팅머리목록_();
    if (sh.getLastRow() > 0) sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, 머리.length).setValues([머리]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(10, 520);       // 내용 열은 넓게
    sh.getRange('J:J').setWrap(true);
  }
  return sh;
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
  const 정보머리 = n => ['정보'+n+'_이름', '정보'+n+'_형태', '정보'+n+'_떠올린사람', '정보'+n+'_실자료'];
  return [].concat(
    ['시각', '메일', '학번', '이름', '학년', '반', '번호'],
    ['트랙', '주제', '대상', '예측시점', '자료등급', '연계학과'],
    ['타깃_이름', '타깃_단위', '타깃_실자료'],
    ['범주A', '범주B', '분류기준'],
    정보머리(1), 정보머리(2), 정보머리(3), 정보머리(4),
    ['주제점검', '점검메모'],
    ['대신요청수', '도움요청수', '학생제안수'],
    ['주고받은수', '대화내용(JSON)']
  );
}

/* 0 = 머리글 없음, 1 = 예전 형식, 2 = 지금 형식
   머리글이 없으면 기록을 읽는 쪽이 첫 학생을 건너뛰어 버리므로 반드시 확인한다. */
function 머리버전_(sh) {
  if (!sh || sh.getLastRow() === 0) return 0;
  if (String(sh.getRange(1, 1).getValue()).trim() !== '시각') return 0;
  const w = Math.max(sh.getLastColumn(), 1);
  const h = sh.getRange(1, 1, 1, w).getValues()[0];
  return (h[11] === '자료등급' && h[12] === '연계학과' && h[19] === '정보1_이름') ? 2 : 1;
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

  if (버전 === 2) Logger.log('머리글 정상 (' + 머리목록_().length + '열)');
  else if (버전 === 1) {
    Logger.log('⚠ 머리글이 예전 형식입니다. 열 위치가 달라 관리자 화면 내용이 어긋납니다.');
    Logger.log('  쌓인 기록을 다른 시트로 복사해 둔 뒤, 시트1의 1행과 기존 기록을 지우고 다시 실행하세요.');
  } else Logger.log('⚠ 머리글을 만들지 못했습니다. 시트1 이름을 확인하세요.');

  Logger.log('쌓인 학생 기록 : ' + 학생수 + '명');
  const 채팅 = 채팅시트_();
  Logger.log('채팅기록 시트 준비됨 (' + 채팅머리목록_().length + '열, 쌓인 줄 ' + Math.max(채팅.getLastRow() - 1, 0) + '개)');
  Logger.log('기록 시트 : ' + ss.getUrl());
  const k = API키_();
  Logger.log(k ? 'OpenAI 키 확인됨 (' + k.slice(0, 7) + '…' + k.slice(-4) + ')'
               : '⚠ OpenAI 키를 찾지 못했습니다. KEY 시트 A2 칸을 확인하세요.');
  CacheService.getScriptCache().remove('model_cfg');
  const 설정 = 모델설정_();
  Logger.log('대화 모델 : ' + 설정.모델 + (설정.추론 ? ' (추론 강도 ' + 설정.강도 + ')' : '') +
             '   ← KEY 시트 B2·C2 에서 바꿀 수 있습니다');
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
  Logger.log('머리글 : ' + (버전 === 2 ? '정상(' + 머리목록_().length + '열)' : 버전 === 1 ? '예전 형식' : '없음'));
  Logger.log('전체 줄 수 : ' + sh.getLastRow() + ' / 열 수 : ' + sh.getLastColumn());
  Logger.log('학생 기록 : ' + Math.max(sh.getLastRow() - 시작줄_(sh), 0) + '명');
  if (sh.getLastRow() > 0) {
    const 첫 = sh.getRange(1, 1, 1, Math.min(9, Math.max(sh.getLastColumn(), 1))).getValues()[0];
    Logger.log('1행 앞부분 : ' + JSON.stringify(첫));
  }
}
