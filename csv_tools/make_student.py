"""학생 CSV 를 한 명씩 안전하게 만든다 — 유일한 생성 입구. build_v*.py 는 직접 실행하지 않는다.

사용: python make_student.py 학번 [학번 …] [--dry] [--force]
  1. build_registry.py 에서 그 학번의 「현재본」 함수를 찾는다(옛 버전으로 덮어쓰는 사고 방지).
  2. 임시 폴더에서 만든 뒤 점검(규칙·평가지 흐름·채점)을 한다. 실패하면 반영하지 않는다(--force 는 실패해도 반영).
  3. 지금 csv_out 파일과 같으면 「변화 없음」. 다르면 이전 파일을 csv_work/_보관/학생CSV/학번/시각/ 에 남기고 반영,
     csv_work/갱신기록.json 에 시각을 적는다(build_guide.py 가 읽어 download 화면이 학생에게 다시 묻게 한다). 끝으로 안내 파일을 다시 쓴다.
  --dry: 만들고 비교·점검만 하고 반영하지 않는다.
"""
import contextlib, importlib, io, json, shutil, subprocess, sys, tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import common
import gen_common
import 점검

ROOT = TOOLS.parent
GAL = common.WORK / "갱신기록.json"
KST = timezone(timedelta(hours=9))


def build_temp(학번, tmp):
    """현재본 함수를 임시 폴더에서 실행 → (data, md, spec) 경로."""
    from build_registry import CURRENT
    if 학번 not in CURRENT:
        raise SystemExit(f"{학번}: build_registry.py 에 등록되지 않은 학번입니다(새 학생이면 함수 작성 후 CURRENT 에 추가).")
    mod, fn = CURRENT[학번]
    _, 이름 = common.class_dir(학번)
    (tmp / "specs").mkdir(parents=True, exist_ok=True)
    real = gen_common.class_dir, gen_common.WORK
    gen_common.class_dir, gen_common.WORK = (lambda h: (tmp, 이름)), tmp
    try:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            getattr(importlib.import_module(mod), fn)()
    finally:
        gen_common.class_dir, gen_common.WORK = real
    return tmp / f"{학번}_data.csv", tmp / f"{학번}_{이름}_데이터사전.md", tmp / "specs" / f"{학번}.json", 이름


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry, force = "--dry" in sys.argv, "--force" in sys.argv
    if not args:
        raise SystemExit(__doc__)
    갱신 = json.loads(GAL.read_text(encoding="utf-8")) if GAL.exists() else {}
    바뀜 = []
    for 학번 in args:
        with tempfile.TemporaryDirectory() as t:
            tmp = Path(t)
            data, md, spec, 이름 = build_temp(학번, tmp)
            folder, _ = common.class_dir(학번)
            cur = folder / f"{학번}_data.csv"
            same = cur.exists() and cur.read_bytes() == data.read_bytes()
            sp = json.loads(spec.read_text(encoding="utf-8"))
            P, W, info = 점검.점검(dict(kind="학생", name=학번, file=str(data), track=sp["track"], x=sp["x_cols"], y=sp["y"],
                                      md=md.read_text(encoding="utf-8"), spec=sp))
            print(f"■ {학번} {'변화 없음' if same else '내용 바뀜'} | 점검 {'실패' if P else '통과'}{' · 주의 ' + str(len(W)) if W else ''}")
            for p in P: print("   문제:", p)
            for w in W: print("   주의:", w)
            if same:
                continue
            if P and not force:
                print("   → 반영하지 않음(점검 실패). 고친 뒤 다시 실행하거나 --force.")
                continue
            if dry:
                print("   → --dry: 반영하지 않음")
                continue
            stamp = datetime.now(KST)
            keep = common.WORK / "_보관" / "학생CSV" / 학번 / stamp.strftime("%Y%m%d_%H%M%S")
            keep.mkdir(parents=True, exist_ok=True)
            for f in list(folder.glob(f"{학번}_*")) + [common.WORK / "specs" / f"{학번}.json"]:
                if f.exists() and not f.name.endswith("_안내.json"):
                    shutil.copy2(f, keep / f.name)
            shutil.copy2(data, cur)
            shutil.copy2(md, folder / md.name)
            shutil.copy2(spec, common.WORK / "specs" / f"{학번}.json")
            갱신[학번] = stamp.isoformat(timespec="seconds")
            바뀜.append(학번)
            print(f"   → 반영. 이전 파일: {keep.relative_to(ROOT)}")
    if 바뀜:
        GAL.write_text(json.dumps(갱신, ensure_ascii=False, indent=1), encoding="utf-8")
        r = subprocess.run([sys.executable, str(TOOLS / "build_guide.py")], capture_output=True, text=True, encoding="utf-8", errors="replace")
        print("안내 파일:", (r.stdout or r.stderr).strip().splitlines()[-1] if (r.stdout or r.stderr) else "?")
        print("갱신 기록:", ", ".join(바뀜), "— download 화면이 이 학생들에게 「데이터가 바뀌었어요」로 다시 묻습니다.")


if __name__ == "__main__":
    main()
