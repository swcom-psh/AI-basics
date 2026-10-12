const fs=require('fs');
const src=fs.readFileSync('gs_check.js','utf8');
const a=src.indexOf('/* 학생이 직접 쓴 말만'), b=src.indexOf('function 세기_');
eval(src.slice(a,b)+';globalThis.검사_=검사_;');
const ok=(c,m)=>console.log(c?'PASS':'FAIL',m);
const 주제='따릉이 하루 대여 건수를 전날 대여 건수와 기온으로 맞혀 본다';
const 활용='대여소 운영자가 자전거를 미리 옮겨 두어 빈 거치대 문제를 줄이는 데 쓴다';
const hist=[{role:'user',content:'[정보 선택]\n대상: 마곡나루역 2번 출구'},{role:'user',content:'[마무리 서술]\n내 주제: '+주제+'\n문제 해결 활용: '+활용}];
const base={트랙:'예측',주제:'따릉이 대여 예측',연계학과:'환경공학과',대상:'마곡나루역 2번 출구',대상확인:true,예측시점:'전날 저녁',타깃:{이름:'하루 대여 건수',단위:'건'},
 특성:['a','b','c','d','e'].map((n,i)=>({이름:'정보'+n,형태:'숫자',떠올린사람:'보기',가설:'늘어날 것 같다'})),확인문장:주제,활용방안:활용};
ok(검사_(base,{도움:false,history:hist}).length===0,'정상: 대상·정보 5·가설·확인문장·활용방안 → 통과');
ok(검사_({...base,활용방안:''},{도움:false,history:hist}).some(x=>/문제 해결/.test(x)),'활용방안이 비면 거부');
ok(검사_({...base,활용방안:'짧다'},{도움:false,history:hist}).some(x=>/문제 해결/.test(x)),'활용방안 15자 미만 거부');
ok(검사_({...base,활용방안:'연구자가 채혈 없이 몸 크기만으로 성별을 알아내는 문제를 푸는 데 쓸 수 있다'},{도움:false,history:hist}).some(x=>/직접 쓴 말/.test(x)),'학생이 쓰지 않은 활용 문장(챗봇이 만든 문장)은 거부');
ok(검사_({...base,활용방안:''},{도움:true,history:hist}).length===0,'도움요청 학생은 활용방안 면제');
ok(검사_({...base,특성:base.특성.map(x=>({...x,떠올린사람:'학생'}))},{도움:false,history:hist}).length===0,'떠올린사람 학생도 허용');
ok(검사_({...base,특성:base.특성.slice(0,4)},{도움:false,history:hist}).some(x=>/5개/.test(x)),'정보 4개는 거부');
ok(검사_({...base,특성:base.특성.concat([{...base.특성[0],이름:'정보f'}])},{도움:false,history:hist}).some(x=>/5개/.test(x)),'정보 6개는 거부');
