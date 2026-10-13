"""실제 기계학습 연습용 공개 자료를 모아 「선택자료 csv」 폴더에 CSV 로 저장한다(가공 없이 원본 그대로 + 목록.csv).
사용: python collect_datasets.py [파일이름…]   (이름이 없으면 전부)
출처: OpenML(sklearn fetch_openml), UCI(archive.ics.uci.edu 의 zip), GitHub raw(seaborn-data), sklearn 내장.
받기 실패한 것은 건너뛰고 목록에 「실패」로 남긴다."""
import io
import sys
import time
import zipfile
import pandas as pd
import requests
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "선택자료 csv"
OUT.mkdir(exist_ok=True)
SB = "https://raw.githubusercontent.com/mwaskom/seaborn-data/master/"


def openml(name, version=None):
    from sklearn.datasets import fetch_openml
    d = fetch_openml(name=name, version=version or "active", as_frame=True, parser="auto")
    return d.frame


def uci(id_, **kw):
    """UCI 저장소의 정리된 단일 표(data.csv: 입력 열 + 맞힐 값 열)."""
    return pd.read_csv(f"https://archive.ics.uci.edu/static/public/{id_}/data.csv", **kw)


def gh(name):
    return pd.read_csv(SB + name)


def sk(fn, **kw):
    import sklearn.datasets as S
    return getattr(S, fn)(as_frame=True, **kw).frame


# (파일이름, 한글 제목, 분야, 과제, 맞힐 값 후보, 출처, 라이선스·비고, 로더)
CAT = [
    ("유방암_세포측정", "유방암 세포핵 측정값(위스콘신 진단)", "의료·생명·간호·약학", "분류", "target(악성/양성)", "UCI WDBC / sklearn", "CC BY 4.0", lambda: sk("load_breast_cancer")),
    ("당뇨_진행도", "당뇨 환자 1년 뒤 진행도", "의료·생명·간호·약학", "예측", "target(진행도)", "sklearn load_diabetes", "공개", lambda: sk("load_diabetes", scaled=False)),
    ("피마인디언_당뇨", "당뇨병 발병 여부(Pima Indians)", "의료·간호·약학", "분류", "class(당뇨 여부)", "OpenML diabetes / UCI", "공개", lambda: openml("diabetes")),
    ("심장병_270", "심장병 유무(Statlog Heart)", "의료·간호", "분류", "class(심장병)", "OpenML heart-statlog / UCI", "CC BY 4.0", lambda: openml("heart-statlog")),
    ("간질환_ILPD", "인도 간질환 환자 여부", "의료·간호·약학", "분류", "Class(간질환)", "OpenML ilpd / UCI", "CC BY 4.0", lambda: openml("ilpd")),
    ("콜레스테롤_303", "심장 질환 환자 콜레스테롤", "의료·간호", "예측", "chol", "OpenML cholesterol", "공개", lambda: openml("cholesterol")),
    ("헌혈_재방문", "헌혈 재방문 여부(수혈 서비스센터)", "의료·보건", "분류", "Class(재방문)", "OpenML blood-transfusion-service-center / UCI", "CC BY 4.0", lambda: openml("blood-transfusion-service-center")),
    ("전복_나이", "전복의 껍질 고리 수(나이)", "생명·동물·수산", "예측", "Class_number_of_rings", "OpenML abalone / UCI", "CC BY 4.0", lambda: openml("abalone")),
    ("펭귄_측정", "펭귄 종·몸 크기", "생명·동물·생태", "분류·예측", "species 또는 body_mass_g", "seaborn-data penguins", "CC0(Palmer Station LTER)", lambda: gh("penguins.csv")),
    ("건강지출_국가", "나라별 기대수명·건강 지출", "보건·경제·사회", "예측", "Life_Expectancy", "seaborn-data healthexp", "공개", lambda: gh("healthexp.csv")),
    ("운동_맥박", "운동 종류별 맥박", "체육·스포츠·간호", "예측", "pulse", "seaborn-data exercise", "공개", lambda: gh("exercise.csv")),
    ("자동차_연비", "자동차 연비(mpg)와 제원", "기계·자동차·공학", "예측", "mpg", "seaborn-data mpg / UCI Auto MPG", "공개", lambda: gh("mpg.csv")),
    ("콘크리트_강도", "콘크리트 압축강도", "건축·토목·재료·화학공학", "예측", "compressive strength", "UCI Concrete(165)", "CC BY 4.0", lambda: uci(165)),
    ("건물_에너지효율", "건물 모양별 난방·냉방 부하", "건축·환경·에너지", "예측", "Y1·Y2(난방·냉방 부하)", "UCI Energy Efficiency(242)", "CC BY 4.0", lambda: uci(242)),
    ("복합화력_출력", "복합화력발전소 전력 출력", "전기전자·에너지·기계", "예측", "PE(출력)", "UCI CCPP(294)", "CC BY 4.0", lambda: uci(294)),
    ("에어포일_소음", "날개 단면 자체 소음", "항공·기계", "예측", "소음(dB)", "OpenML airfoil_self_noise / UCI", "CC BY 4.0", lambda: openml("airfoil_self_noise")),
    ("요트_저항", "요트 선체 저항", "조선·기계·해양", "예측", "residuary resistance", "OpenML yacht_hydrodynamics / UCI", "CC BY 4.0", lambda: openml("yacht_hydrodynamics")),
    ("서울_자전거_대여", "서울 따릉이 시간별 대여 수와 날씨", "환경·도시·교통·경영", "예측", "Rented Bike Count", "UCI Seoul Bike Sharing Demand(560)", "CC BY 4.0", lambda: uci(560)),
    ("자전거_대여_워싱턴", "자전거 시간별 대여 수와 날씨(워싱턴)", "환경·교통·경영", "예측", "count", "OpenML Bike_Sharing_Demand / UCI", "CC BY 4.0", lambda: openml("Bike_Sharing_Demand", 2)),
    ("대기질_이탈리아", "도시 대기 오염 센서와 농도", "환경·대기·화학", "예측", "CO(GT) 등", "UCI Air Quality(360)", "CC BY 4.0", lambda: uci(360)),
    ("산불_포르투갈", "포르투갈 산불 피해 면적과 날씨", "환경·산림·재난", "예측", "area", "UCI Forest Fires(162)", "CC BY 4.0", lambda: uci(162)),
    ("가전_에너지사용", "가정 가전 전력 사용량과 실내외 날씨", "전기전자·에너지·건축", "예측", "Appliances", "UCI Appliances Energy(374)", "CC BY 4.0", lambda: uci(374)),
    ("집값_캘리포니아", "캘리포니아 주택 가격", "경제·부동산·도시", "예측", "median_house_value", "OpenML houses / sklearn", "공개", lambda: openml("houses")),
    ("부동산_대만", "타이베이 부동산 단가", "경제·부동산·도시", "예측", "price per unit area", "UCI Real Estate Valuation(477)", "CC BY 4.0", lambda: uci(477)),
    ("신용_독일", "대출 고객의 신용 위험(좋음/나쁨)", "경영·경제·금융", "분류", "class", "OpenML credit-g / UCI Statlog German Credit", "CC BY 4.0", lambda: openml("credit-g")),
    ("은행_마케팅", "은행 전화 마케팅 가입 여부", "경영·마케팅·광고", "분류", "y(가입)", "OpenML bank-marketing / UCI", "CC BY 4.0", lambda: openml("bank-marketing")),
    ("성인_소득", "성인 소득 5만 달러 초과 여부", "경제·사회·행정", "분류", "class(소득)", "OpenML adult / UCI", "CC BY 4.0", lambda: openml("adult")),
    ("통신_이탈고객", "통신사 고객 이탈 여부", "경영·마케팅", "분류", "Churn", "OpenML Telco-Customer-Churn", "공개", lambda: openml("Telco-Customer-Churn")),
    ("다이아몬드_가격", "다이아몬드 가격과 품질", "경제·경영·소비", "예측", "price", "seaborn-data diamonds", "공개", lambda: gh("diamonds.csv")),
    ("택시_요금", "뉴욕 택시 요금과 거리", "교통·경영·도시", "예측", "fare", "seaborn-data taxis", "공개", lambda: gh("taxis.csv")),
    ("팁_식당", "식당 계산서와 팁", "외식·경영·서비스", "예측", "tip", "seaborn-data tips", "공개", lambda: gh("tips.csv")),
    ("교통사고_미국주별", "미국 주별 교통사고 사망 통계", "경찰·교통·행정·보험", "예측", "total(운전자 1억 마일당 사망)", "seaborn-data car_crashes", "공개", lambda: gh("car_crashes.csv")),
    ("타이타닉_생존", "타이타닉 승객 생존 여부", "사회·역사·교양", "분류", "survived", "seaborn-data titanic", "공개", lambda: gh("titanic.csv")),
    ("학생_성적", "포르투갈 학생 성적과 생활 환경", "교육·사회복지·초등교육", "예측·분류", "G3(최종 성적)", "UCI Student Performance(320)", "CC BY 4.0", lambda: uci(320)),
    ("뉴스_공유수", "온라인 뉴스 기사 공유 수(조회수와 비슷)", "미디어·광고·소프트웨어", "예측·분류", "shares", "UCI Online News Popularity(332)", "CC BY 4.0", lambda: uci(332)),
    ("와인_품질", "와인 화학 성분과 품질", "화학·식품·화학공학", "예측·분류", "quality", "OpenML wine_quality / UCI", "CC BY 4.0", lambda: openml("wine_quality")),
    ("와인_3종", "와인 성분으로 포도 품종 분류(178건)", "화학·식품", "분류", "target", "sklearn load_wine / UCI", "CC BY 4.0", lambda: sk("load_wine")),
    ("천문_행성", "발견된 외계행성의 질량·공전주기", "천문·물리", "예측", "mass·orbital_period", "seaborn-data planets", "공개", lambda: gh("planets.csv")),
    ("해빙_면적", "북극 해빙 면적(일별)", "환경·대기·기후", "예측", "Extent", "seaborn-data seaice", "공개", lambda: gh("seaice.csv")),
    ("항공_탑승객", "월별 항공 탑승객", "항공·경영·통계", "예측", "passengers", "seaborn-data flights", "공개", lambda: gh("flights.csv")),
]


def main():
    want = set(sys.argv[1:])
    rows = []
    for fn, title, field, task, ycand, src, lic, loader in CAT:
        if want and fn not in want:
            continue
        t0 = time.time()
        try:
            d = loader().copy()
            d.columns = [str(c) for c in d.columns]
            d.to_csv(OUT / f"{fn}.csv", index=False, encoding="utf-8-sig")
            rows.append((fn, title, field, task, ycand, len(d), d.shape[1], int(d.select_dtypes("number").shape[1]), int(d.isna().any(axis=1).sum()), src, lic, "받음"))
            print(f"OK   {fn} {d.shape} {time.time()-t0:.0f}s", flush=True)
        except Exception as e:
            rows.append((fn, title, field, task, ycand, "", "", "", "", src, lic, "실패: " + str(e)[:60]))
            print(f"FAIL {fn} {str(e)[:90]}", flush=True)
    cols = ["파일", "제목", "분야", "과제", "맞힐 값 후보", "행 수", "열 수", "숫자 열 수", "결측 행 수", "출처", "라이선스·비고", "상태"]
    new = pd.DataFrame(rows, columns=cols)
    f = OUT / "목록.csv"
    if want and f.exists():
        old = pd.read_csv(f, encoding="utf-8-sig")
        new = pd.concat([old[~old["파일"].isin(new["파일"])], new])
    new.to_csv(f, index=False, encoding="utf-8-sig")


if __name__ == "__main__":
    main()
