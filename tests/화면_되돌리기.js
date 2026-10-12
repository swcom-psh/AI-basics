const fs=require('fs'), vm=require('vm');
let src=fs.readFileSync('html_script.js','utf8');
// 로그인용 window.onload 등은 그대로 두고, 필요한 함수만 쓰는 샌드박스
const els={};
const mk=id=>els[id]||(els[id]={id,innerHTML:'',textContent:'',value:'',disabled:false,style:{},classList:{add(){},remove(){},contains(){return false}},appendChild(){},remove(){},querySelector(){return {textContent:''}},focus(){},addEventListener(){},scrollTop:0,scrollHeight:0});
const calls=[];
const sandbox={console,setTimeout,clearInterval,setInterval,Promise,JSON,Math,Date,Object,Array,String,Number,
  document:{getElementById:mk,createElement:()=>mk('tmp'+Math.random()),addEventListener(){}},
  window:{},localStorage:{store:{},getItem(k){return this.store[k]||null},setItem(k,v){this.store[k]=v},removeItem(k){delete this.store[k]}},
  sessionStorage:{setItem(){},removeItem(){}},location:{reload(){}},
  confirm:()=>true, alert(){}, fetch:async()=>({json:async()=>({})})};
vm.createContext(sandbox);
// api 호출을 가로채 서버 흉내
src+=`
var __n=0;
api = async function(body){
  __calls.push(JSON.parse(JSON.stringify(body)));
  if(body.action==='chat'){
    __n++;
    return {답변:'봇답'+__n, 단계:['관심분야','방식정하기','맞힐것정하기','요인정하기'][Math.min(__n-1,3)], 확정가능:false, 도움요청:false,
            주제점검:{통과:false,걸린기준:[],메모:''}, 정리:{주제:'주제'+__n,특성:[]}};
  }
  return {ok:true};
};
`;
sandbox.__calls=calls;
vm.runInContext(src,sandbox);
const run=code=>vm.runInContext(code,sandbox);
(async()=>{
  const ok=(c,m)=>console.log(c?'PASS':'FAIL',m);
  run("나={학번:'20262111',이름:'테스트',메일:'a@b',관리자:false}; 반정보={학년:'2',반:'1',번호:'1'}; 대화ID='D1'; 히스토리=[]; 순번=0;");
  await run("보내기('안녕',{숨김:true})");          // 0,1
  await run("보내기('체육',{})");                     // 2,3
  await run("보내기('체육학과',{})");                 // 4,5
  await run("보내기('예측',{})");                     // 6,7
  console.log('보낸 뒤 순서:',run("히스토리.map(m=>m.순서).join()"),'| 순번',run("순번"));
  ok(run("히스토리.map(m=>m.순서).join()")==='0,1,2,3,4,5,6,7','되돌리기 전 순서 0~7');
  // 3번(도우미 '봇답2') 으로 되돌리기
  await run("되돌리기(3)");
  ok(run("히스토리.length")===4,'3번까지만 남음(길이 4)');
  ok(run("정리.주제")==='주제2','계획서가 3번 말의 상태(주제2)로 복원');
  ok(run("현재단계")==='맞힐것정하기','단계가 그 말의 단계로 복원');
  const rw=calls.filter(c=>c.action==='rewind');
  ok(rw.length===1 && rw[0].기록.순서===3 && rw[0].기록.대화ID==='D1','서버에 되돌림(순서 3) 기록 요청');
  ok(run("순번")===8,'순번은 줄지 않고 8 유지');
  await run("보내기('스포츠과학',{})");
  const last=calls.filter(c=>c.action==='chat').pop();
  ok(last.기록.순서===8,'새 말의 순서가 8 (예전 방식이면 4 → 기록 누락)');
  ok(run("히스토리.map(m=>m.순서).join()")==='0,1,2,3,8,9','되돌린 뒤 순서 0,1,2,3,8,9');
  ok(last.history.length===5,'서버로 보내는 대화에는 취소된 말이 없음(5개)');
  // localStorage 저장·복원에서 순번 유지
  const saved=JSON.parse(sandbox.localStorage.getItem(run('KEY')));
  ok(saved.순번===10,'저장된 순번 10');
  // 마지막 도우미 말에는 되돌리기 버튼이 없고 앞 말에는 있다
  run("draw()");
  const html=els['log'].innerHTML;
  const n=(html.match(/class="backbtn"/g)||[]).length;
  ok(n===2,'되돌리기 버튼 개수: 마지막 말 제외 도우미 말 수(=2)  실제 '+n);
})();
