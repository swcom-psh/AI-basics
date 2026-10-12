const fs=require('fs'), vm=require('vm');
let src=fs.readFileSync('html_script.js','utf8');
const els={}; const hidden={}; const msgs=[];
const mk=id=>els[id]||(els[id]={id,_html:'',get innerHTML(){return this._html},set innerHTML(v){this._html=v},_t:'',get textContent(){return this._t},set textContent(v){this._t=v; if(id==='loginmsg')msgs.push(v)},value:'',disabled:false,style:{},dataset:{},
  classList:{add(c){if(c==='hide')hidden[id]=true},remove(c){if(c==='hide')hidden[id]=false},toggle(){},contains(c){return c==='hide'&&!!hidden[id]}},
  appendChild(){},remove(){},querySelector(){return null},focus(){},addEventListener(){},scrollTop:0,scrollHeight:0});
const sandbox={console,setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,5)),clearInterval,setInterval:()=>0,Promise,JSON,Math,Date,Object,Array,String,Number,Set,
  document:{getElementById:mk,createElement:()=>mk('t'+Math.random()),addEventListener(){}},window:{},
  localStorage:{s:{},getItem(k){return this.s[k]||null},setItem(k,v){this.s[k]=v},removeItem(k){delete this.s[k]}},
  sessionStorage:{s:{},getItem(k){return this.s[k]||null},setItem(k,v){this.s[k]=v},removeItem(k){delete this.s[k]}},
  location:{reload(){}},confirm:()=>true,alert(){},fetch:async()=>({json:async()=>({})})};
vm.createContext(sandbox);
src+=`
var __logins=0, __mode='busy3';
api = async function(body){
  if(body.action==='login'){ __logins++;
    if(__mode==='busy3' && __logins<=3) return {오류:'지금 로그인 확인이 늦어지고 있습니다.',재시도가능:true};
    if(__mode==='busyForever') return {오류:'지금 로그인 확인이 늦어지고 있습니다.',재시도가능:true};
    return {ok:true,이름:'테스트',메일:'t@x',학번:'20262111',관리자:false,이전확정:{있음:false},반정보:{학년:'2',반:'1',번호:'1'},이어서:null}; }
  return {ok:true};
};`;
vm.runInContext(src,sandbox);
const run=c=>vm.runInContext(c,sandbox);
(async()=>{
  const ok=(c,m)=>console.log(c?'PASS':'FAIL',m);
  // A) 서버가 3번 바쁘다가 4번째에 성공 — 로그인 정보를 버리지 않고 자동으로 다시 시도해 들어간다
  await run("onCredential({credential:'TOK'})"); await new Promise(r=>setTimeout(r,100));
  ok(run('__logins')===4&&hidden['login']===true&&sandbox.sessionStorage.s.idt==='TOK','서버가 3번 바빠도 자동 재시도(총 4번 요청)로 입장, 로그인 정보 유지');
  ok(msgs.some(m=>m.indexOf('늦어지고 있어요')>=0),'재시도 중에는 안내 문구가 나옴: '+msgs.filter(m=>m.indexOf('늦어')>=0)[0]);
  // B) 자동 입장과 구글 버튼이 동시에 와도 한 번만 처리 (화면이 왔다 갔다 하지 않게)
  run("__logins=0; __mode='ok'; hidden=undefined"); hidden['login']=false;
  await Promise.all([run("onCredential({credential:'T2'})"), run("onCredential({credential:'T2'})"), run("onCredential({credential:'T2'})")]);
  ok(run('__logins')===1,'동시에 3번 불려도 로그인 요청은 1번: '+run('__logins'));
  // C) 계속 바쁘면 4번 시도 뒤 포기하고 안내(로그인 화면으로)
  run("__logins=0; __mode='busyForever'; 로그인중=false"); hidden['login']=false; msgs.length=0;
  await run("onCredential({credential:'T3'})");
  ok(run('__logins')===5&&sandbox.sessionStorage.s.idt===undefined&&hidden['login']===false,'계속 바쁘면 총 5번(처음+재시도 4번) 시도 뒤 안내하고 로그인 화면 유지: 요청 '+run('__logins')+'번');
  process.exit(0);
})().catch(e=>console.log('ERR',e.message));
