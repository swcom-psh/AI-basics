const fs=require('fs'), vm=require('vm');
let src=fs.readFileSync('html_script.js','utf8');
const els={}; const hidden={}; let reloads=0;
const mk=id=>els[id]||(els[id]={id,_html:'',get innerHTML(){return this._html},set innerHTML(v){this._html=v},textContent:'',value:'',disabled:false,style:{},dataset:{},
  classList:{add(c){if(c==='hide')hidden[id]=true},remove(c){if(c==='hide')hidden[id]=false},toggle(){},contains(c){return c==='hide'&&!!hidden[id]}},
  appendChild(){},remove(){},querySelector(){return null},focus(){},addEventListener(){},scrollTop:0,scrollHeight:0});
const calls=[]; const store={};
const sandbox={console,setTimeout,clearInterval,setInterval,Promise,JSON,Math,Date,Object,Array,String,Number,Set,
  document:{getElementById:mk,createElement:()=>mk('t'+Math.random()),addEventListener(){}},window:{},
  localStorage:{store,getItem(k){return this.store[k]||null},setItem(k,v){this.store[k]=v},removeItem(k){delete this.store[k]}},
  sessionStorage:{s:{},getItem(k){return this.s[k]||null},setItem(k,v){this.s[k]=v},removeItem(k){delete this.s[k]}},
  location:{reload(){reloads++}},confirm:()=>true,alert(){},fetch:async()=>({json:async()=>({})}),__calls:calls};
vm.createContext(sandbox);
src+=`
var __n=0;
api = async function(body){
  __calls.push(JSON.parse(JSON.stringify(body)));
  if(body.action==='login') return {ok:true,이름:'테스트',메일:'t@x',학번:'20262111',관리자:false,이전확정:{있음:false},반정보:{학년:'2',반:'1',번호:'1'},이어서:{대화번호:'OLD',단계:'관심분야',다음순서:4,히스토리:[{role:'user',content:'옛말',보일말:'옛말',숨김:false,순서:0},{role:'assistant',content:'옛답',보일말:'옛답',순서:1}]}};
  if(body.action==='chat'){ __n++; return {답변:'봇'+__n,단계:'관심분야',확정가능:false,도움요청:false,주제점검:{통과:false,걸린기준:[],메모:''},정리:{특성:[],x보기:[],대상후보:[]}}; }
  return {ok:true};
};`;
vm.runInContext(src,sandbox);
const run=c=>vm.runInContext(c,sandbox);
(async()=>{
  const ok=(c,m)=>console.log(c?'PASS':'FAIL',m);
  run("나={학번:'20262111',이름:'테스트',메일:'a@b',관리자:false}; 반정보={학년:'2',반:'1',번호:'1'}; 대화ID='D1'; 히스토리=[]; 순번=0; paintSpec=function(){};");
  const 기본 = "정리={주제:'가나다라마',트랙:'예측',타깃:{이름:'이용(명)'},대상:'A역',대상확인:true,대상후보:['A역'],특성:[],제외한정보:[],x보기:['a','b','c','d','e'].map(n=>({이름:'정보'+n,형태:'숫자',설명:'',종류:'',실자료:'없음'}))};";
  const 선택 = (대상, 정보) => "확정입력=[{순서:4,종류:'요인',값:{대상:'"+대상+"',정보:"+JSON.stringify(정보)+"}}]; 히스토리=[{role:'user',content:'[정보 선택]',보일말:'',숨김:false,순서:4}];";

  // 1) 화면에서 고른 관계가 있으면 챗봇이 가설을 비워 돌려줘도 채워진다
  run(기본+선택('A역',[{이름:'정보a',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보b',관계:'줄어들 것 같다',한줄:'비가 와서',직접:false},{이름:'정보c',관계:'관계없을 것 같다',한줄:'',직접:false},{이름:'정보d',관계:'늘어날 것 같다',한줄:'',직접:false}])+"정리보정();");
  ok(run("정리.특성.length")===4 && run("정리.특성.every(x=>x.가설&&x.가설.length>=6)"), '챗봇이 특성을 비워도 고른 정보 4개와 가설이 채워짐');

  // 2) 대상: 화면 제출 뒤에 학생이 채팅으로 새 대상을 쓰고 챗봇이 정리에 반영하면 따른다
  run(기본+선택('A역',[{이름:'정보a',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보b',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보c',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보d',관계:'늘어날 것 같다',한줄:'',직접:false}]));
  run("히스토리.push({role:'user',content:'대상: 강원 사대부고 2학년 7반',보일말:'',숨김:false,순서:8}); 정리.대상='강원 사대부고 2학년 7반';");
  run("정리보정();");
  ok(run("정리.대상")==='강원 사대부고 2학년 7반', '학생이 채팅으로 쓴 새 대상은 화면의 옛 대상으로 되돌려지지 않음');
  // 챗봇이 학생이 말하지 않은 대상으로 바꾸면 화면에서 고른 대상으로 바로잡음
  run(기본+선택('A역',[{이름:'정보a',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보b',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보c',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보d',관계:'늘어날 것 같다',한줄:'',직접:false}]));
  run("정리.대상='서울의 한 지하철역'; 정리보정();");
  ok(run("정리.대상")==='A역', '학생이 말하지 않은 대상으로 챗봇이 바꾸면 화면에서 고른 대상으로 되돌림');

  // 3) 직접 추가한 정보를 챗봇이 이름을 다듬어도 가설이 사라지지 않는다
  run(기본+선택('A역',[{이름:'정보a',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보b',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보c',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'우리 학교 행사',관계:'줄어들 것 같다',한줄:'바빠서',직접:true}]));
  run("정리.특성=[{이름:'학교 행사 일정',형태:'예아니오',떠올린사람:'학생',실자료:'없음',가설:''}]; 정리보정();");
  const 행사 = run("정리.특성.find(x=>x.떠올린사람==='학생')");
  ok(행사 && /줄어들 것 같다/.test(행사.가설), '챗봇이 직접 추가 정보 이름을 다듬어도 학생의 가설이 붙음');

  // 4) 챗봇이 이유를 말하고 뺀 정보는 다시 넣지 않는다
  run(기본+선택('A역',[{이름:'정보a',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보b',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보c',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보d',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'정보e',관계:'늘어날 것 같다',한줄:'',직접:false}]));
  run("정리.제외한정보=[{이름:'정보e',이유:'맞히려는 값과 같아서'}]; 정리보정();");
  ok(run("정리.특성.length")===4 && !run("정리.특성.some(x=>x.이름==='정보e')"), '챗봇이 뺀 정보는 화면 보정이 다시 넣지 않음');

  // 5) 보내는 순간 체크 목록(화면 입력창)이 숨겨진다
  run(기본+"요인.대상선택='A역'; 정리.대상확인=false; 정리.대상=''; 정리.특성=[]; 보기그리기();");
  const 열림 = !els.xpick.classList.contains('hide');
  run("보내는중=false;");
  const p = run("보내기('테스트',{})");
  ok(hidden.xpick===true, '보내는 중에는 체크 목록이 숨겨짐');
  await p;

  // 6) 다른 자리에서 이어받을 때: 서버 기록의 [정보 선택]·[마무리 서술] 에서 화면에서 낸 값을 되살린다
  const 기록 = [
    {role:'user',content:'[정보 선택]\n대상: 강원 사대부고 2학년 7반\n정보: 전날 결석 학생 수(명) | 늘어날 것 같다 | 감기가 돌아서\n직접 추가: 우리 반 행사 | 줄어들 것 같다 |',순서:6},
    {role:'user',content:'[마무리 서술]\n내 주제: 결석 수를 예측한다\n문제 해결 활용: 담임이 수업을 준비한다',순서:10}];
  const 복 = run('확정입력복원(' + JSON.stringify(기록) + ')');
  ok(복.length===2 && 복[0].값.대상==='강원 사대부고 2학년 7반' && 복[0].값.정보.length===2 && 복[0].값.정보[0].한줄==='감기가 돌아서' && 복[0].값.정보[1].직접===true, '서버 기록에서 [정보 선택] 값(대상·관계·한 줄·직접 추가)을 되살림');
  ok(복[1].종류==='마무리' && 복[1].값.주제==='결석 수를 예측한다' && 복[1].값.활용==='담임이 수업을 준비한다', '서버 기록에서 [마무리 서술] 값을 되살림');

  // 7) 불러오는 동안 화면 전체 로딩이 뜨고, 겹쳐 불려도 마지막이 끝나야 닫힌다
  run("로딩(true,'테스트');"); run("로딩(true,'테스트2');");
  ok(hidden.loading===false, '로딩 화면이 뜸');
  run("로딩(false);");
  ok(hidden.loading===false, '겹친 로딩 중 하나가 끝나도 유지');
  run("로딩(false);");
  ok(hidden.loading===true, '모두 끝나면 닫힘');

  // 8) 새 흐름: 맞힐 것·정보를 말하는 동안에는 체크 화면이 열리지 않고, 화면 단계부터 열린다
  run("정리={주제:'가나다라마',트랙:'예측',타깃:{이름:'이용',단위:'명'},대상후보:['A역'],특성:[],x보기:['a','b','c','d'].map(n=>({이름:'정보'+n,형태:'숫자',설명:'',종류:'과거 기록',실자료:'없음'}))}; 보내는중=false; 현재단계='정보정하기'; 보기그리기();");
  ok(hidden.xpick===true, '정보정하기 단계에서는 체크 화면이 닫혀 있음');
  run("현재단계='요인정하기'; 보기그리기();");
  ok(hidden.xpick===false, '요인정하기 단계에서 체크 화면이 열림');
  // 9) 학생이 채팅으로 말한 정보(종류: 학생이 말한 정보)는 떠올린사람이 「학생」, 챗봇 제안은 「보기」
  run("정리={주제:'가나다라마',트랙:'예측',타깃:{이름:'이용',단위:'명'},대상:'A역',대상확인:true,대상후보:['A역'],특성:[],제외한정보:[],x보기:[{이름:'전날 판매량(개)',형태:'숫자',설명:'',종류:'학생이 말한 정보',실자료:'없음'},{이름:'공휴일인가',형태:'예아니오',설명:'',종류:'달력·시간',실자료:'달력'},{이름:'주말인가',형태:'예아니오',설명:'',종류:'달력·시간',실자료:'달력'},{이름:'기온(℃)',형태:'숫자',설명:'',종류:'날씨·환경',실자료:'기상청 ASOS'}]};");
  run("확정입력=[{순서:4,종류:'요인',값:{대상:'A역',정보:[{이름:'전날 판매량(개)',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'공휴일인가',관계:'줄어들 것 같다',한줄:'',직접:false},{이름:'주말인가',관계:'늘어날 것 같다',한줄:'',직접:false},{이름:'기온(℃)',관계:'관계없을 것 같다',한줄:'',직접:false}]}}]; 히스토리=[{role:'user',content:'[정보 선택]',보일말:'',숨김:false,순서:4}]; 정리보정();");
  ok(run("정리.특성.find(x=>x.이름==='전날 판매량(개)').떠올린사람")==='학생' && run("정리.특성.find(x=>x.이름==='공휴일인가').떠올린사람")==='보기', '학생이 말한 정보는 「학생」, 챗봇 제안은 「보기」로 기록');
})();
