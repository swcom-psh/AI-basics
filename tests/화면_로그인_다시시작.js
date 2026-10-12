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
  // A) 새로고침: 이 탭에 로그인 정보가 남아 있으면 자동으로 들어간다
  sandbox.sessionStorage.s.idt='TOKEN123';
  run('window.onload()');
  await new Promise(r=>setTimeout(r,400));
  ok(calls[0]&&calls[0].action==='login'&&run('토큰')==='TOKEN123','새로고침 시 저장된 로그인 정보(TOKEN123)로 자동 로그인 요청');
  ok(hidden['login']===true&&hidden['app']===false,'로그인 화면이 닫히고 앱이 열림');
  ok(run("히스토리.length")>=2&&run("히스토리[0].보일말")==='옛말','서버가 돌려준 진행 중 대화를 이어서 보여 줌');
  // B) 처음부터 다시: 새로 읽지 않고(로그인 유지) 화면만 처음으로
  await run("보내기('체육학과',{})");
  const 전ID=run('대화ID'); const 전길이=run('히스토리.length');
  const nlogin=calls.filter(c=>c.action==='login').length;
  await run('restart()');
  await new Promise(r=>setTimeout(r,400));
  ok(reloads===0,'페이지를 새로 읽지 않음(reload 0회)');
  ok(calls.filter(c=>c.action==='login').length===nlogin,'로그인을 다시 요청하지 않음');
  ok(calls.some(c=>c.action==='leave'&&c.기록.대화ID===전ID),'서버에 이전 대화를 끝냈다고 기록');
  ok(sandbox.sessionStorage.s.idt==='TOKEN123','로그인 정보(탭 보관)는 그대로');
  ok(run('대화ID')!==전ID&&run('대화ID').indexOf('20262111-')===0,'새 대화번호로 시작: '+run('대화ID'));
  const 새히스토리=run('히스토리.map(m=>m.보일말).join("|")');
  ok(새히스토리.indexOf('옛말')<0&&새히스토리.indexOf('체육학과')<0,'예전 대화(서버가 돌려줬던 것 포함)가 되살아나지 않음: '+새히스토리.slice(0,60));
  ok(hidden['done']===true&&hidden['app']===false,'완료 화면이 닫히고 대화 화면이 열림');
  ok(run('순번')>=2&&run('확정입력.length')===0&&true,'순번·화면 입력 초기화 후 첫 인사 진행');
  // C) 로그아웃은 로그인 정보를 지우고 새로 읽는다
  run('confirm = () => true; 로그아웃()');
  ok(sandbox.sessionStorage.s.idt===undefined&&reloads===1,'로그아웃: 로그인 정보 삭제 + 새로 읽기(다음에는 다시 로그인)');
  process.exit(0);
})();
