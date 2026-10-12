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
  run("나={학번:'20262111',이름:'테스트',메일:'a@b',관리자:false}; 반정보={학년:'2',반:'1',번호:'1'}; 대화ID='D1'; 히스토리=[]; 순번=0;");
  // 1) 연계 학과가 비어 있어도(진로 선택) 계획서가 그려진다
  let 던짐 = false;
  try{ run("정리={주제:'가나다라마',트랙:'예측',대상:'우리 학교',연계학과:'',특성:[],x보기:[],대상후보:[]}; 계획서HTML(정리, null)"); }catch(e){ 던짐 = e.message; }
  ok(!던짐, '연계 학과가 빈칸이어도 계획서가 그려진다 '+(던짐||''));
  // 2) 답을 받은 뒤 화면 그리기에서 오류가 나도 보내기 버튼은 풀린다
  run("paintSpec = function(){ throw new Error('그리기 실패'); };");
  await run("보내기('안녕',{})");
  ok(run("보내는중")===false && els.send.disabled===false, '그리기 오류가 나도 보내기 버튼이 잠기지 않음');

  // 3) 요인 화면에 「언제 쓰는 값인가요?」가 있고, 고른 시점이 [정보 선택] 말과 계획서에 들어간다
  run("paintSpec = function(){};");
  run("정리={주제:'가나다라마',트랙:'예측',타깃:{이름:'하루 이용(명)'},대상후보:['A역'],특성:[],x보기:['a','b','c','d'].map(n=>({이름:'정보'+n,형태:'숫자',설명:'',종류:'',실자료:'없음'}))};");
  const html = run("요인HTML(정리)");
  ok(/언제 쓰는 값인가요/.test(html) && /일주일 전/.test(html), '요인 화면에 예측 시점 선택이 있음');
  run("요인.대상선택='A역'; 요인.시점선택='일주일 전'; ['a','b','c','d'].forEach(n=>{ 요인.고름['정보'+n]={관계:'늘어날 것 같다',한줄:''}; });");
  run("보내는중=false;");
  await run("요인제출()");
  const 마지막 = run("히스토리.filter(m=>m.role==='user').pop().content");
  ok(/예측 시점: 일주일 전/.test(마지막), '[정보 선택] 말에 예측 시점이 들어감');
  run("정리={주제:'가나다라마',특성:[],x보기:[]}; 정리보정();");
  ok(run("정리.예측시점")==='일주일 전', '계획서의 예측 시점이 학생이 고른 값으로 채워짐');
})();
