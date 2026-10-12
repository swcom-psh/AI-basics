// 전체 시험: node tests/run.js   (index.html 의 스크립트와 코드.gs 를 임시 폴더로 뽑아 각 시험을 돌린다. 하나라도 FAIL 이면 종료 코드 1)
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitopic-'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const 스크립트 = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
fs.writeFileSync(path.join(tmp, 'html_script.js'), 스크립트);
fs.copyFileSync(path.join(root, 'apps-script', '코드.gs'), path.join(tmp, 'gs_check.js'));
let 실패 = 0, 통과 = 0;
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'run.js')) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { cwd: tmp, encoding: 'utf8' });
  const 줄 = (r.stdout + r.stderr).split(/\r?\n/);
  const p = 줄.filter(l => l.startsWith('PASS')).length, x = 줄.filter(l => l.startsWith('FAIL')).length;
  const 죽음 = r.status !== 0;
  통과 += p; 실패 += x + (죽음 ? 1 : 0);
  console.log((x || 죽음 ? 'FAIL ' : 'ok   ') + f + ' (통과 ' + p + ', 실패 ' + x + (죽음 ? ', 오류 종료' : '') + ')');
  if (x || 죽음) 줄.filter(l => l.startsWith('FAIL') || /Error/.test(l)).slice(0, 5).forEach(l => console.log('   ' + l));
}
console.log(실패 ? '\n실패 ' + 실패 + '건' : '\n전부 통과 (' + 통과 + '건)');
process.exit(실패 ? 1 : 0);
