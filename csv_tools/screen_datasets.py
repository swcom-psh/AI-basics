"""선택자료(실제 공개 자료)를 시험 규칙으로 검사해서 「쓸 수 있는 과제 목록」을 만든다.

과제 하나 = 자료 하나 + 맞힐 값(y) + 후보 열 여러 개. 후보에서 x 5개 조합을 찾아(빠른 사전 검사 → gen_common.finish 로 결측·이상치 넣고
check_csv 전체 검사) 통과하는 조합이 있으면 학생용 CSV(한글 열 이름)와 교사용 데이터 사전을 만든다.

사용: python screen_datasets.py [과제ID …]      (없으면 전부)
결과: 선택자료 csv/사용가능_목록.csv, 검사결과_전체.csv, 학생용_한글/*.csv, 교사용_데이터사전/*.md
"""
import contextlib
import io
import itertools
import json
import shutil
import sys
import time
import warnings

import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.model_selection import train_test_split

import gen_common
import check_csv
from common import WORK

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parent.parent / "선택자료 csv"
TMP = WORK / "_screen_tmp"
TMP.mkdir(exist_ok=True)
gen_common.class_dir = lambda 학번: (TMP, "검사")      # finish 가 csv_out 이 아니라 임시 폴더에 쓰게 한다


# ───────────────────────── 열·과제 정의 ─────────────────────────
def N(col, ko, log=False, zn=False, neg=False, mul=1.0, dec=None, add=0.0, sqrt=False):
    if log and "로그" not in ko:
        ko = ko.split("(")[0] + "(상용로그)"            # 로그를 씌운 열은 이름에 밝힌다(단위를 그대로 두면 학생이 헷갈림)
    return dict(col=col, ko=ko, kind="num", log=log, zn=zn, neg=neg, mul=mul, dec=dec, add=add, sqrt=sqrt)


def B(col, ko, fn):
    return dict(col=col, ko=ko, kind="bin", fn=fn)


def T(id_, file, title, field, track, y, X, prep=None, nmax=1200, ratio=None, 출처="", 비고="", loader=None):
    return dict(id=id_, file=file, title=title, field=field, track=track, y=y, X=X, prep=prep, nmax=nmax, ratio=ratio, 출처=출처, 비고=비고, loader=loader)


def Ycls(col, fn, classes):
    return dict(col=col, kind="cls", fn=fn, classes=classes, ko="분류")


def Ynum(col, ko, log=False, zn=False, mul=1.0, dec=None, add=0.0):
    return dict(col=col, ko=ko, kind="num", log=log, zn=zn, neg=False, mul=mul, dec=dec, add=add)


yes = lambda s: (s.astype(str).str.lower().isin(["yes", "y", "1", "true", "present", "male", "m", "tested_positive"])).astype(int)

TASKS = [
    T("유방암_세포_분류", "유방암_세포측정", "유방 종양 세포핵의 측정값으로 양성/악성 분류", "의료·생명·간호·약학", "분류",
      Ycls("target", lambda s: pd.Series(np.where(s == 1, "양성", "악성"), index=s.index), ("양성", "악성")),
      [N("mean radius", "핵평균반지름"), N("mean texture", "핵질감(밝기편차)"), N("mean perimeter", "핵평균둘레"), N("mean area", "핵평균면적"),
       N("mean smoothness", "핵윤곽매끄러움"), N("mean compactness", "핵치밀도"), N("mean concavity", "핵오목한정도"), N("mean symmetry", "핵윤곽대칭성"),
       N("mean fractal dimension", "핵윤곽복잡도(프랙탈차원)"), N("radius error", "핵반지름변동")], 출처="UCI WDBC (CC BY 4.0)"),
    T("당뇨진행도_예측", "당뇨_진행도", "환자의 신체·혈액 정보로 1년 뒤 당뇨 진행도 예측", "의료·생명·간호·약학", "예측", Ynum("target", "1년뒤당뇨진행도"),
      [N("age", "나이(세)"), B("sex", "성별코드(0/1)", lambda s: (s == 2).astype(int)), N("bmi", "체질량지수"), N("bp", "평균혈압(mmHg)"), N("s1", "총콜레스테롤"), N("s2", "LDL콜레스테롤"),
       N("s3", "HDL콜레스테롤"), N("s4", "총콜레스테롤HDL비"), N("s5", "혈청중성지방(로그)"), N("s6", "혈당")], 출처="Efron 외 2004 / sklearn"),
    T("당뇨발병_분류", "피마인디언_당뇨", "여성 환자의 검사 수치로 당뇨 발병 여부 분류", "의료·간호·약학", "분류",
      Ycls("class", lambda s: pd.Series(np.where(s == "tested_positive", "당뇨", "당뇨아님"), index=s.index), ("당뇨아님", "당뇨")),
      [N("preg", "임신횟수(회)"), N("plas", "혈장포도당농도", zn=True), N("pres", "확장기혈압(mmHg)", zn=True), N("skin", "삼두근피부두께(mm)", zn=True), N("mass", "체질량지수", zn=True),
       N("pedi", "당뇨가족력지수"), N("age", "나이(세)")], 출처="UCI Pima Indians Diabetes"),
    T("심장병_분류", "심장병_270", "환자의 검사 수치로 심장병 유무 분류", "의료·간호", "분류",
      Ycls("class", lambda s: pd.Series(np.where(s == "present", "심장병있음", "심장병없음"), index=s.index), ("심장병없음", "심장병있음")),
      [N("age", "나이(세)"), B("sex", "성별코드(0/1)", lambda s: s.astype(int)), N("resting_blood_pressure", "안정시혈압(mmHg)"), N("serum_cholestoral", "혈청콜레스테롤"),
       N("maximum_heart_rate_achieved", "최대심박수(회/분)"), B("exercise_induced_angina", "운동유발협심증(0/1)", lambda s: s.astype(int)), N("oldpeak", "운동후ST하강(mm)"),
       B("fasting_blood_sugar", "공복혈당120초과(0/1)", lambda s: s.astype(int))], 출처="UCI Statlog Heart"),
    T("간질환_분류", "간질환_ILPD", "환자의 혈액 검사 수치로 간질환 여부 분류", "의료·간호·약학", "분류",
      Ycls("Class", lambda s: pd.Series(np.where(s == 1, "간질환", "정상"), index=s.index), ("정상", "간질환")),
      [N("V1", "나이(세)"), N("V3", "총빌리루빈", log=True), N("V4", "직접빌리루빈", log=True), N("V5", "알칼리인산분해효소", log=True), N("V6", "ALT수치", log=True), N("V7", "AST수치", log=True),
       N("V8", "총단백질"), N("V9", "알부민"), N("V10", "알부민글로불린비")], 출처="UCI ILPD"),
    T("콜레스테롤_예측", "콜레스테롤_303", "환자 정보로 혈청 콜레스테롤 예측", "의료·간호", "예측", Ynum("chol", "혈청콜레스테롤"),
      [N("age", "나이(세)"), B("sex", "성별코드(0/1)", lambda s: s.astype(int)), N("trestbps", "안정시혈압(mmHg)"), N("thalach", "최대심박수(회/분)"), N("oldpeak", "운동후ST하강(mm)"),
       B("fbs", "공복혈당120초과(0/1)", lambda s: s.astype(int)), B("exang", "운동유발협심증(0/1)", lambda s: s.astype(int)), N("ca", "주요혈관수(개)")], 출처="OpenML cholesterol / UCI Cleveland"),
    T("전복나이_예측", "전복_나이", "전복의 크기·무게로 껍질 고리 수(나이) 예측", "생명·동물·수산", "예측", Ynum("Class_number_of_rings", "껍질고리수(개)"),
      [N("Length", "길이(mm)"), N("Diameter", "지름(mm)"), N("Height", "높이(mm)"), N("Whole_weight", "전체무게(g)"), N("Shucked_weight", "살무게(g)"), N("Viscera_weight", "내장무게(g)"),
       N("Shell_weight", "껍질무게(g)"), B("Sex", "수컷(0/1)", lambda s: (s == "M").astype(int)), B("Sex", "새끼(0/1)", lambda s: (s == "I").astype(int))], 출처="UCI Abalone"),
    T("자동차연비_예측", "자동차_연비", "자동차의 제원으로 연비(mpg) 예측", "기계·자동차·공학", "예측", Ynum("mpg", "연비(mpg)"),
      [N("cylinders", "실린더수(개)"), N("displacement", "배기량(cc급)"), N("horsepower", "마력"), N("weight", "차무게(lb)"), N("acceleration", "가속시간(초)"), N("model_year", "생산연도(년)"),
       B("origin", "미국산(0/1)", lambda s: (s == "usa").astype(int))], 출처="UCI Auto MPG / seaborn-data"),
    T("자동차연비_분류", "자동차_연비", "자동차의 제원으로 연비 좋음/나쁨 분류(중앙값 기준)", "기계·자동차·공학", "분류",
      Ycls("mpg", lambda s: pd.Series(np.where(s >= s.median(), "연비좋음", "연비나쁨"), index=s.index), ("연비좋음", "연비나쁨")),
      [N("cylinders", "실린더수(개)"), N("displacement", "배기량(cc급)"), N("horsepower", "마력"), N("weight", "차무게(lb)"), N("acceleration", "가속시간(초)"), N("model_year", "생산연도(년)"),
       B("origin", "미국산(0/1)", lambda s: (s == "usa").astype(int))], 출처="UCI Auto MPG / seaborn-data"),
    T("에어포일소음_예측", "에어포일_소음", "날개 단면 조건으로 소음(dB) 예측", "항공·기계", "예측", Ynum("pressure", "소음수준(dB)"),
      [N("frequency", "주파수(Hz)"), N("angle", "받음각(도)"), N("length", "날개길이(m)"), N("velocity", "풍속(m/s)"), N("thickness", "흡입면두께(m)")], 출처="UCI Airfoil Self-Noise (NASA)"),
    T("자전거대여_워싱턴_예측", "자전거_대여_워싱턴", "날씨·시간으로 자전거 대여 수 예측", "환경·교통·경영", "예측", Ynum("count", "대여수(대)"),
      [N("hour", "시각(시)"), N("temp", "기온(℃)"), N("feel_temp", "체감온도(℃)"), N("humidity", "습도(%)", mul=100), N("windspeed", "풍속"), B("workingday", "근무일(0/1)", lambda s: s.astype(int)),
       B("holiday", "공휴일(0/1)", lambda s: s.astype(int)), N("month", "월"), N("weekday", "요일(0~6)")], 출처="UCI Bike Sharing (Capital Bikeshare)"),
    T("캘리포니아집값_예측", "집값_캘리포니아", "지역 정보로 주택 가격 예측(로그)", "경제·부동산·도시", "예측", Ynum("median_house_value", "집값중앙값(상용로그)", log=True),
      [N("median_income", "소득중앙값(만달러)"), N("housing_median_age", "주택연령(년)"), N("total_rooms", "방총수(개)", log=True), N("population", "인구(명)", log=True), N("households", "가구수", log=True),
       N("latitude", "위도"), N("longitude", "경도")], 출처="Pace & Barry 1997 / sklearn"),
    T("독일신용_분류", "신용_독일", "대출 신청자 정보로 신용 위험(좋음/나쁨) 분류", "경영·경제·금융", "분류",
      Ycls("class", lambda s: s.astype(str).map({"good": "신용좋음", "bad": "신용나쁨"}), ("신용좋음", "신용나쁨")),
      [N("duration", "대출기간(개월)"), N("credit_amount", "대출금액(마르크)", log=True), N("installment_commitment", "상환부담률(1~4)"), N("residence_since", "거주기간(1~4)"), N("age", "나이(세)"),
       N("existing_credits", "기존대출수(건)"), B("foreign_worker", "외국인근로자(0/1)", lambda s: (s == "yes").astype(int))], 출처="UCI Statlog German Credit"),
    T("은행가입_분류", "은행_마케팅", "고객 정보로 정기예금 가입 여부 분류(가입 비율 맞춤)", "경영·마케팅·광고", "분류",
      Ycls("Class", lambda s: pd.Series(np.where(s == 2, "가입", "미가입"), index=s.index), ("미가입", "가입")),
      [N("V1", "나이(세)"), N("V6", "잔액(유로)"), N("V12", "통화시간(초)", log=True), N("V13", "이번캠페인연락횟수(회)"), N("V15", "이전캠페인연락횟수(회)"), N("V10", "마지막연락일(일)")],
      ratio=0.35, 출처="UCI Bank Marketing (Moro 외 2014)", 비고="가입 비율이 12%라 학습용으로 가입 35%가 되게 미가입을 덜어 냄"),
    T("통신이탈_분류", "통신_이탈고객", "통신사 고객 정보로 이탈 여부 분류", "경영·마케팅", "분류",
      Ycls("Churn", lambda s: pd.Series(np.where(s == "Yes", "이탈", "유지"), index=s.index), ("유지", "이탈")),
      [N("tenure", "이용기간(개월)"), N("MonthlyCharges", "월요금(달러)"), N("TotalCharges", "누적요금(달러)"), B("SeniorCitizen", "고령자(0/1)", lambda s: s.astype(int)),
       B("Contract", "월단위계약(0/1)", lambda s: (s == "Month-to-month").astype(int)), B("InternetService", "광섬유인터넷(0/1)", lambda s: (s == "Fiber optic").astype(int)),
       B("PaperlessBilling", "전자청구서(0/1)", yes), N("TC2", "누적요금(월요금×기간 혼합)")],
      prep=lambda d: d.assign(TC2=0.5 * pd.to_numeric(d["TotalCharges"], errors="coerce") + 0.5 * d["tenure"] * d["MonthlyCharges"]),
      출처="IBM Telco Customer Churn / OpenML"),
    T("다이아몬드가격_예측", "다이아몬드_가격", "다이아몬드의 크기·품질로 가격 예측(로그)", "경제·경영·소비", "예측", Ynum("price", "가격(상용로그)", log=True),
      [N("carat", "캐럿"), N("depth", "깊이비(%)"), N("table", "테이블비(%)"), N("x", "가로길이(mm)"), N("z", "높이(mm)"), B("cut", "컷이상급(0/1)", lambda s: s.isin(["Ideal", "Premium"]).astype(int))],
      출처="ggplot2 diamonds / seaborn-data"),
    T("택시요금_예측", "택시_요금", "택시 이동 정보로 요금 예측", "교통·경영·도시", "예측", Ynum("fare", "요금(달러)"),
      [N("distance", "거리(마일)"), N("passengers", "승객수(명)"), N("tolls", "통행료(달러)"), B("payment", "신용카드결제(0/1)", lambda s: (s == "credit card").astype(int)),
       B("color", "노란택시(0/1)", lambda s: (s == "yellow").astype(int))], 출처="seaborn-data taxis"),
    T("식당팁_예측", "팁_식당", "식당 계산서 정보로 팁 예측", "외식·경영·서비스", "예측", Ynum("tip", "팁(달러)"),
      [N("total_bill", "계산서금액(달러)"), N("size", "일행수(명)"), B("sex", "남성(0/1)", lambda s: (s == "Male").astype(int)), B("smoker", "흡연석(0/1)", lambda s: (s == "Yes").astype(int)),
       B("time", "저녁식사(0/1)", lambda s: (s == "Dinner").astype(int))], 출처="seaborn-data tips (Bryant & Smith 1995)"),
    T("타이타닉생존_분류", "타이타닉_생존", "승객 정보로 생존 여부 분류", "사회·역사·교양", "분류",
      Ycls("survived", lambda s: pd.Series(np.where(s == 1, "생존", "사망"), index=s.index), ("생존", "사망")),
      [N("age", "나이(세)"), N("fare", "운임(파운드)", log=True), N("sibsp", "동승형제배우자수(명)"), N("parch", "동승부모자녀수(명)"), N("pclass", "객실등급(1~3)"),
       B("sex", "남성(0/1)", lambda s: (s == "male").astype(int))], 출처="seaborn-data titanic"),
    T("와인품질_예측", "와인_품질", "와인의 화학 성분으로 품질 점수 예측", "화학·식품·화학공학", "예측", Ynum("quality", "품질점수"),
      [N("fixed.acidity", "고정산도"), N("volatile.acidity", "휘발산도"), N("citric.acid", "구연산"), N("residual.sugar", "잔당", log=True), N("chlorides", "염화물", log=True),
       N("free.sulfur.dioxide", "유리이산화황"), N("total.sulfur.dioxide", "총이산화황"), N("density", "밀도"), N("pH", "pH"), N("sulphates", "황산염"), N("alcohol", "알코올도수(%)")],
      출처="UCI Wine Quality (Cortez 외 2009)"),
    T("와인좋음_분류", "와인_품질", "와인의 화학 성분으로 좋은 와인(품질 6 이상) 분류", "화학·식품·화학공학", "분류",
      Ycls("quality", lambda s: pd.Series(np.where(s >= 6, "좋은와인", "보통와인"), index=s.index), ("좋은와인", "보통와인")),
      [N("fixed.acidity", "고정산도"), N("volatile.acidity", "휘발산도"), N("citric.acid", "구연산"), N("residual.sugar", "잔당", log=True), N("chlorides", "염화물", log=True),
       N("free.sulfur.dioxide", "유리이산화황"), N("total.sulfur.dioxide", "총이산화황"), N("density", "밀도"), N("pH", "pH"), N("sulphates", "황산염"), N("alcohol", "알코올도수(%)")],
      출처="UCI Wine Quality (Cortez 외 2009)"),
    T("콘크리트강도_예측", "콘크리트_강도", "콘크리트 배합으로 압축강도 예측", "건축·토목·재료·화학공학", "예측", Ynum("Concrete compressive strength", "압축강도(MPa)"),
      [N("Cement", "시멘트(kg/㎥)"), N("Blast Furnace Slag", "슬래그(kg/㎥)"), N("Fly Ash", "플라이애시(kg/㎥)"), N("Water", "물(kg/㎥)"), N("Superplasticizer", "고성능감수제(kg/㎥)"),
       N("Coarse Aggregate", "굵은골재(kg/㎥)"), N("Fine Aggregate", "잔골재(kg/㎥)"), N("Age", "양생일수(일)", log=True)], 출처="UCI Concrete Compressive Strength (Yeh 1998)"),
    T("건물난방부하_예측", "건물_에너지효율", "건물 모양으로 난방 부하 예측", "건축·환경·에너지", "예측", Ynum("Y1", "난방부하"),
      [N("X1", "상대밀집도"), N("X2", "표면적(㎡)"), N("X3", "벽면적(㎡)"), N("X4", "지붕면적(㎡)"), N("X5", "전체높이(m)"), N("X6", "방향(2~5)"), N("X7", "유리창비율"), N("X8", "유리창분포(0~5)")],
      출처="UCI Energy Efficiency (Tsanas & Xifara 2012)"),
    T("서울자전거대여_예측", "서울_자전거_대여", "서울의 날씨·시간으로 따릉이 대여 수 예측", "환경·도시·교통·경영", "예측", Ynum("Rented Bike Count", "대여수(대)"),
      [N("Hour", "시각(시)"), N("Temperature", "기온(℃)"), N("Humidity", "습도(%)"), N("Wind speed", "풍속(m/s)"), N("Visibility", "가시거리(10m)"), N("Dew point temperature", "이슬점온도(℃)"),
       N("Solar Radiation", "일사량"), N("Rainfall", "강수량(mm)"), N("Snowfall", "적설량(cm)")], prep=lambda d: d[d["Functioning Day"] == "Yes"], 출처="UCI Seoul Bike Sharing Demand (Sathishkumar 외)"),
    T("서울자전거대여_분류", "서울_자전거_대여", "서울의 날씨·시간으로 대여가 많은 시간/적은 시간 분류(중앙값 기준)", "환경·도시·교통·경영", "분류",
      Ycls("Rented Bike Count", lambda s: pd.Series(np.where(s >= s.median(), "대여많음", "대여적음"), index=s.index), ("대여많음", "대여적음")),
      [N("Hour", "시각(시)"), N("Temperature", "기온(℃)"), N("Humidity", "습도(%)"), N("Wind speed", "풍속(m/s)"), N("Visibility", "가시거리(10m)"), N("Dew point temperature", "이슬점온도(℃)"),
       N("Solar Radiation", "일사량")], prep=lambda d: d[d["Functioning Day"] == "Yes"], 출처="UCI Seoul Bike Sharing Demand"),
    T("대기질CO_예측", "대기질_이탈리아", "도시 대기 센서값으로 일산화탄소 농도 예측", "환경·대기·화학", "예측", Ynum("CO(GT)", "일산화탄소농도(mg/㎥)"),
      [N("PT08.S1(CO)", "일산화탄소센서", neg=True), N("PT08.S2(NMHC)", "탄화수소센서", neg=True), N("PT08.S3(NOx)", "질소산화물센서", neg=True), N("PT08.S4(NO2)", "이산화질소센서", neg=True),
       N("PT08.S5(O3)", "오존센서", neg=True), N("T", "기온(℃)", neg=True), N("RH", "상대습도(%)", neg=True), N("NOx(GT)", "질소산화물농도(ppb)", neg=True)], 출처="UCI Air Quality (De Vito 외 2008)"),
    T("산불면적_예측", "산불_포르투갈", "기상 조건으로 산불 피해 면적 예측(로그)", "환경·산림·재난", "예측", Ynum("area", "피해면적(상용로그,ha+1)", log=True),
      [N("temp", "기온(℃)"), N("RH", "상대습도(%)"), N("wind", "풍속(km/h)"), N("rain", "강수량(mm)"), N("DMC", "부식층수분지수"), N("DC", "가뭄지수"), N("ISI", "초기확산지수"), N("FFMC", "낙엽층수분지수")],
      출처="UCI Forest Fires (Cortez & Morais 2007)"),
    T("가전전력_예측", "가전_에너지사용", "집 안팎 온습도로 가전 전력 사용량 예측", "전기전자·에너지·건축", "예측", Ynum("Appliances", "가전전력(Wh)"),
      [N("T1", "주방온도(℃)"), N("RH_1", "주방습도(%)"), N("T2", "거실온도(℃)"), N("T6", "외부북쪽온도(℃)"), N("RH_out", "외부습도(%)"), N("Press_mm_hg", "기압(mmHg)"), N("Windspeed", "풍속(m/s)"),
       N("Visibility", "가시거리(km)"), N("T_out", "외부기온(℃)")], 출처="UCI Appliances Energy Prediction (Candanedo 외 2017)"),
    T("대만집값_예측", "부동산_대만", "주변 환경으로 단위면적 집값 예측", "경제·부동산·도시", "예측", Ynum("Y house price of unit area", "단위면적집값"),
      [N("X2 house age", "주택연령(년)"), N("X3 distance to the nearest MRT station", "전철역거리(m)", log=True), N("X4 number of convenience stores", "편의점수(개)"), N("X5 latitude", "위도"),
       N("X6 longitude", "경도"), N("X1 transaction date", "거래시점")], 출처="UCI Real Estate Valuation (Yeh & Hsu 2018)"),
    T("학생성적_예측", "학생_성적", "학생 생활 정보로 최종 성적(G3) 예측", "교육·사회복지·초등교육", "예측", Ynum("G3", "최종성적(0~20)"),
      [N("G1", "1기성적(0~20)"), N("studytime", "주간공부시간(1~4)"), N("failures", "과거낙제횟수(회)"), N("absences", "결석횟수(회)"), N("Medu", "어머니학력(0~4)"), N("Fedu", "아버지학력(0~4)"),
       N("goout", "친구와외출(1~5)"), N("Dalc", "평일음주(1~5)"), N("health", "건강상태(1~5)"), N("age", "나이(세)")], 출처="UCI Student Performance (Cortez & Silva 2008)"),
    T("학생성적_분류", "학생_성적", "학생 생활 정보로 최종 성적 합격(10점 이상)/불합격 분류", "교육·사회복지·초등교육", "분류",
      Ycls("G3", lambda s: pd.Series(np.where(s >= 10, "합격", "불합격"), index=s.index), ("합격", "불합격")),
      [N("G1", "1기성적(0~20)"), N("studytime", "주간공부시간(1~4)"), N("failures", "과거낙제횟수(회)"), N("absences", "결석횟수(회)"), N("Medu", "어머니학력(0~4)"), N("Fedu", "아버지학력(0~4)"),
       N("goout", "친구와외출(1~5)"), N("Dalc", "평일음주(1~5)"), N("health", "건강상태(1~5)"), N("age", "나이(세)")], 출처="UCI Student Performance"),
    T("뉴스공유수_예측", "뉴스_공유수", "온라인 기사 특징으로 공유 수(상용로그) 예측", "미디어·광고·소프트웨어", "예측", Ynum(" shares", "공유수(상용로그)", log=True),
      [N(" n_tokens_title", "제목단어수(개)"), N(" n_tokens_content", "본문단어수(개)", log=True), N(" num_imgs", "이미지수(개)"), N(" num_videos", "영상수(개)"), N(" num_hrefs", "링크수(개)"),
       N(" average_token_length", "평균단어길이"), N(" kw_avg_avg", "키워드평균공유수", log=True), N(" num_keywords", "키워드수(개)")], nmax=1200, 출처="UCI Online News Popularity (Fernandes 외 2015)"),
    T("행성질량_예측", "천문_행성", "외계행성의 궤도 정보로 질량 예측(로그)", "천문·물리", "예측", Ynum("mass", "질량(상용로그,지구=1)", log=True, add=2.502),
      [N("orbital_period", "공전주기(일,로그)", log=True), N("distance", "지구까지거리(광년,로그)", log=True), N("year", "발견연도(년)"), N("number", "항성계행성수(개)"),
       N("orbital_period", "공전주기제곱근", sqrt=True)], 출처="NASA Exoplanet Archive / seaborn-data", 비고="질량은 목성 질량의 상용로그에 2.502(=log10 317.8)를 더해 지구 질량 기준으로 바꿈"),
    T("춘천아파트_예측", "아파트_춘천_실거래가", "춘천 아파트의 면적·층·연식으로 실거래가 예측", "건축·부동산·경제·도시", "예측", Ynum("거래금액", "거래금액(만원)"),
      [N("전용면적", "전용면적(㎡)"), N("층", "층"), N("경과년수", "경과년수(년)"), N("거래연도", "거래연도(년)"), N("단지거래건수", "단지거래건수(건)")],
      prep=lambda d: _apt(d), nmax=1200, 출처="국토교통부 아파트 실거래가(춘천, 2023~2026) / 선생님 제공 실습 파일", 비고="완전 중복 행·결측 제거, 단지거래건수는 단지명으로 센 파생 열"),
]


def _apt(d):
    d = d.drop_duplicates().dropna().reset_index(drop=True)
    d["단지거래건수"] = d.groupby("단지명")["단지명"].transform("size")
    return d


def _apt(d):
    d = d.drop_duplicates().dropna().reset_index(drop=True)
    d["단지거래건수"] = d.groupby("단지명")["단지명"].transform("size")
    return d


# ───────────────────────── 계산 ─────────────────────────
def col_series(d, spec):
    s = d[spec["col"]]
    if spec["kind"] == "bin":
        return spec["fn"](s)
    s = pd.to_numeric(s, errors="coerce").astype(float)
    if spec.get("neg"):
        s = s.where(s > -100)
    if spec.get("zn"):
        s = s.where(s != 0)
    if spec.get("sqrt"):
        s = np.sqrt(s.clip(lower=0))
    if spec.get("log"):
        s = np.log10(s.where(s > 0) if spec["col"] != "area" else s.clip(lower=0) + 1)
    return s * spec.get("mul", 1.0) + spec.get("add", 0.0)


def decimals(s):
    m = float(np.nanmedian(np.abs(s)))
    return 4 if m < 0.1 else 3 if m < 1 else 2 if m < 100 else 1 if m < 10000 else 0


TH = dict(weak=0.115, gap=0.055, r2lo=0.42, r2hi=0.89, mae=0.195, pair_lo=0.855, other=0.58, acc=0.11, minor=0.22, need_pair=True, clear=False, clear_lo=0.80, clear_gap=0.15)


def quick(df, xs, y, track, classes):
    """사전 검사 — 상관·모델 몇 가지만 빠르게 본다(조합 수백 개를 거르기 위함)."""
    sub = df[xs + [y]].dropna()
    if len(sub) < 230:
        return None
    X = sub[xs].astype(float)
    if X.std().min() == 0:
        return None
    if track == "예측":
        yy = sub[y].astype(float)
        r = X.corrwith(yy).abs().sort_values()
        if r.iloc[0] > TH['weak'] or r.iloc[1] - r.iloc[0] < TH['gap']:
            return None
        keep = list(r.index[1:])
        m = LinearRegression().fit(X[keep], yy)
        p = m.predict(X[keep])
        r2 = m.score(X[keep], yy)
        mae = np.abs(p - yy).mean() / abs(yy.mean())
        if not (TH['r2lo'] <= r2 <= TH['r2hi']) or mae > TH['mae']:
            return None
        score = abs(r2 - 0.65) + 0.3 * max(0, 3 - (r > 0.2).sum()) * 0.1 + 0.5 * mae
        return dict(score=score, r2=r2, mae=mae)
    y01 = (sub[y] == classes[0]).astype(int)
    if min(y01.mean(), 1 - y01.mean()) < TH['minor']:
        return None
    c = X.corr().abs()
    pairs = [(a, b, c.loc[a, b]) for a, b in itertools.combinations(xs, 2)]
    hi = [p for p in pairs if p[2] >= TH['pair_lo']]
    if TH['clear']:
        pairs.sort(key=lambda p: -p[2])
        if pairs[0][2] < TH['clear_lo'] or pairs[0][2] >= 0.99 or pairs[0][2] - pairs[1][2] < TH['clear_gap']:
            return None
        a, b, _ = pairs[0]
        ry = X.corrwith(y01).abs()
        drop = a if ry[a] < ry[b] else b
        keep = [k for k in xs if k != drop]
    elif TH['need_pair']:
        if len(hi) != 1 or hi[0][2] >= 0.99 or any(p[2] >= TH['other'] for p in pairs if p is not hi[0]):
            return None
        a, b, _ = hi[0]
        ry = X.corrwith(y01).abs()
        drop = a if ry[a] < ry[b] else b
        keep = [k for k in xs if k != drop]
    else:
        a = b = None
        keep = list(xs)
    Xtr, Xte, ytr, yte = train_test_split(X[keep], y01, test_size=0.3, random_state=42)
    lr = LogisticRegression(max_iter=2000).fit((Xtr - Xtr.mean()) / Xtr.std(), ytr)
    acc = lr.score((Xte - Xtr.mean()) / Xtr.std(), yte)
    maj = max(yte.mean(), 1 - yte.mean())
    if acc < maj + 0.11:
        return None
    return dict(score=abs(acc - maj - 0.18), acc=acc, maj=maj, pair=(a, b))


def prepare(task):
    d = task["loader"]() if task.get("loader") else pd.read_csv(ROOT / f"{task['file']}.csv", encoding="utf-8-sig")
    if task["prep"]:
        d = task["prep"](d)
    d = d.reset_index(drop=True)
    W = pd.DataFrame(index=d.index)
    for s in task["X"]:
        W[s["ko"]] = col_series(d, s)
    ys = task["y"]
    yname = ys["ko"] if ys["kind"] != "cls" else "결과"
    if ys["kind"] == "cls":
        W[yname] = ys["fn"](d[ys["col"]])
    else:
        W[yname] = col_series(d, ys)
    return W, yname


def tweak_columns(W, task, yname, rng):
    """보정 후보 열을 만든다. 예측: 실제 열의 행을 섞은 열(y와 무관) / 분류: 연속 열에 작은 잡음을 섞은 쌍둥이 열."""
    extra = {}
    for sp in task["X"]:
        c = sp["ko"]
        if sp["kind"] == "bin" or W[c].nunique() <= 10:
            continue
        if task["track"] == "예측":
            r0 = abs(float(W[c].corr(W[yname])))
            if r0 > 0.25:                      # 맞힐 값과 실제로 강하게 이어진 열을 섞으면 현실과 반대되는 결론이 나온다 → 원래 약한 열만 섞는다
                continue
            extra[c + "§셔플"] = pd.Series(rng.permutation(W[c].values), index=W.index)
        else:
            if any(k in c for k in ("나이", "횟수", "수(", "연도", "시각", "월", "학력", "등급", "코드", "기간")):
                continue                       # 나이·횟수처럼 다시 잴 수 없는 열의 쌍둥이는 어색하다
            sd = float(W[c].std())
            extra[c + "§쌍"] = W[c] + pd.Series(rng.normal(0, sd * 0.40, len(W)), index=W.index)
    return pd.concat([W, pd.DataFrame(extra)], axis=1), list(extra)


def run_task(task, mode="순수", tries=12, seed=2026):
    t0 = time.time()
    W, yname = prepare(task)
    xs_all = [s["ko"] for s in task["X"]]
    track, ys = task["track"], task["y"]
    classes = ys.get("classes")
    rng = np.random.RandomState(seed)
    if track == "분류" and task["ratio"]:
        mino = classes[1] if task["ratio"] < 0.5 else classes[0]
        mi = W[W[yname] == mino]
        ma = W[W[yname] != mino]
        want = int(len(mi) * (1 - task["ratio"]) / task["ratio"])
        W = pd.concat([mi, ma.sample(min(want, len(ma)), random_state=seed)]).sample(frac=1, random_state=seed).reset_index(drop=True)
    extras = []
    saveTH = dict(TH)
    if mode == "예외":
        if track == "예측":
            TH.update(weak=0.50, gap=0.03, r2lo=0.34, r2hi=0.93, mae=0.36)
        else:
            TH.update(other=0.70)
    if mode == "보정":
        W, extras = tweak_columns(W, task, yname, rng)
        if track == "예측":
            TH["r2hi"] = 0.99                                  # R² 가 너무 높으면 y 에 잡음을 더해 낮춘다(아래)
    base_cols = xs_all
    combos = []
    if mode in ("순수", "예외"):
        combos = [list(c) for c in itertools.combinations(base_cols, 5)]
    elif track == "예측":
        combos = [list(c) for c in itertools.combinations(base_cols, 5)]
        for e in extras:
            b = e.split("§")[0]
            rest = [c for c in base_cols if c != b]
            combos += [list(c) + [e] for c in itertools.combinations(rest, 4)]
    else:
        for e in extras:
            b = e.split("§")[0]
            rest = [c for c in base_cols if c != b]
            combos += [[b, e] + list(c) for c in itertools.combinations(rest, 3)]
    cands = []
    for comb in combos:
        if track == "분류":
            cont = [c for c in comb if W[c].nunique() > 10]
            if not cont:
                continue
            first = min(cont, key=lambda c: abs(float(W[c].skew())))
            comb = [first] + [c for c in comb if c != first]
        q = quick(W, comb, yname, track, classes)
        if q:
            cands.append((q["score"], comb, q))
    TH.clear()
    TH.update(saveTH)
    cands.sort(key=lambda t: t[0])
    res = dict(id=task["id"], title=task["title"], track=track, 후보조합=len(cands), 결과="실패", 사유="", 모드=mode)
    if not cands:
        n_ok = len(W[xs_all + [yname]].dropna())
        res["사유"] = f"{mode}: 규칙에 맞는 x 5개 조합이 없음(사용 가능 행 {n_ok})"
        return res
    fails = []
    for rank, (sc, comb, q) in enumerate(cands[:tries]):
        sub = W[comb + [yname]].dropna().reset_index(drop=True)
        if len(sub) > task["nmax"]:
            sub = sub.sample(task["nmax"], random_state=seed).reset_index(drop=True)
        note = []
        if track == "예측" and mode == "보정":
            X = sub[comb].astype(float)
            yv = sub[yname].astype(float)
            r2 = LinearRegression().fit(X, yv).score(X, yv)
            if r2 > 0.86:                                           # x 의 R² 가 높으면 y 에 잡음을 더해 낮춘다
                sd = float(np.sqrt(yv.var() * (r2 / 0.80 - 1)))
                sub[yname] = (yv + rng.normal(0, sd, len(sub))).clip(lower=0.0 if yv.min() >= 0 else None)
                note.append(f"맞힐 값에 잡음 추가(표준편차 {sd:.3g})")
        ren = {}
        for c in comb:
            if c.endswith("§셔플"):
                ren[c] = c.split("§")[0]
                note.append(f"「{c.split('§')[0]}」열의 값을 행끼리 섞음(맞힐 값과 무관하게)")
            elif c.endswith("§쌍"):
                ren[c] = c.split("§")[0] + "(재측정)"
                note.append(f"「{c.split('§')[0]}」에 작은 오차를 섞은 「{ren[c]}」 열을 추가")
        sub = sub.rename(columns=ren)
        comb2 = [ren.get(c, c) for c in comb]
        ids = [f"{task['id'][:2]}{i+1:04d}" for i in range(len(sub))]
        sub.insert(0, "번호", ids)
        ints, bins, hard, dec, skip = [], [], {}, {}, []
        for c in comb2 + [yname]:
            s_ = sub[c]
            if s_.dtype == object:
                continue
            lo, hi = float(s_.min()), float(s_.max())
            span = max(hi - lo, 1e-9)
            hard[c] = (0.0 if lo >= 0 else lo - span, hi * 3 if lo >= 0 else hi + span)
            if set(s_.unique()) <= {0, 1}:
                bins.append(c)
            elif np.allclose(s_, s_.round()):
                ints.append(c)
            else:
                obs = next((k for k in range(5) if np.allclose(s_.round(k), s_, atol=1e-9)), None)
                dec[c] = 3 if "로그" in c else (obs if obs is not None else decimals(s_))
                sub[c] = sub[c].round(dec[c])
            if c in comb2 and c not in bins:
                q1, q3 = s_.quantile(.25), s_.quantile(.75)
                if ((s_ < q1 - 1.5 * (q3 - q1)) | (s_ > q3 + 1.5 * (q3 - q1))).mean() > 0.03 and c != (comb2[0] if track == "분류" else None):
                    skip.append(c)
        try:
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                r = gen_common.finish("SCR0000" + str(rank), sub, ids=["번호"], x=comb2, y=yname, track=track, 주제=task["title"],
                                      자료=f"{'실제 자료를 일부 보정한 자료' if mode == '보정' else '실제 자료'}: {task['출처']}",
                                      변경={"순수": "선택자료 규칙 검사", "예외": ("선택자료 규칙 검사 — 실제 자료 그대로, 예측 규칙 예외(가장 약한 열 ≤0.50·두 번째와 차이 ≥0.03, R² ≥0.34, MAE ≤36%)" if track == "예측" else "선택자료 규칙 검사 — 실제 자료 그대로, 분류 규칙 예외(직선 쌍 말고 다른 쌍 <0.70)")}.get(mode, "선택자료 규칙 검사 — 보정: " + "; ".join(note)),
                                      시드=seed + rank, 등급="B" if mode == "보정" else "A", ints=ints, bins=bins, hard=hard, dec=dec, classes=classes, skip_out=skip, 기간="",
                                      **((dict(weak_max=0.50, weak_gap=0.03, r2_min=0.34, mae_max=0.36) if track == "예측" else dict(pair_other_max=0.70)) if mode == "예외" else {}))
        except Exception as e:
            fails.append(f"오류 {str(e)[:50]}")
            continue
        if not r["fail"]:
            out = TMP / f"SCR0000{rank}_data.csv"
            md = next(TMP.glob(f"SCR0000{rank}_*_데이터사전.md"))
            fol = {"순수": "학생용_한글", "예외": "학생용_예외", "보정": "학생용_보정"}[mode]
            (ROOT / fol).mkdir(exist_ok=True)
            (ROOT / "교사용_데이터사전").mkdir(exist_ok=True)
            shutil.copy(out, ROOT / fol / f"{task['id']}.csv")
            shutil.copy(md, ROOT / "교사용_데이터사전" / f"{task['id']}{'' if mode == '순수' else '_' + mode}.md")
            M = r["metrics"]
            res.update(결과="통과", x=" | ".join(c.replace(' ', '') for c in comb2), 행수=M.get("처리후행수"), y=yname if track == "예측" else f"{classes[0]} / {classes[1]}",
                       지표=(f"R² {M.get('R2')} · MAE/평균 {M.get('MAE/평균')} · 최약열 {M.get('최약열')}" if track == "예측" else f"직선쌍 {M.get('직선쌍')} · 정확도 {M.get('정확도')} · 다수범주 {M.get('다수범주기준')}"),
                       경고=" / ".join(r["warn"]), 시도=rank + 1, 사유="", 보정=" / ".join(note), 등급={"순수": "A", "예외": "A(규칙예외)", "보정": "B"}[mode])
            break
        fails.append(" ; ".join(r["fail"])[:80])
    else:
        res["사유"] = f"{mode}: 사전 검사 통과 조합 {min(tries, len(cands))}개를 전체 검사했으나 모두 실패: " + " | ".join(fails[:2])
    res["초"] = round(time.time() - t0, 1)
    return res


def main():
    n0 = len(TASKS)
    try:
        from screen_tasks_kaggle import build_tasks
        TASKS.extend(build_tasks(N, B, T, Ycls, Ynum, yes))
    except ImportError:
        pass
    n1 = len(TASKS)
    try:
        from screen_tasks_extra import build_tasks as bt2
        TASKS.extend(bt2(N, B, T, Ycls, Ynum, yes))
    except ImportError:
        pass
    want = set(sys.argv[1:])
    if "--kaggle" in want:
        want = {t["id"] for t in TASKS[n0:n1]}
    if "--extra" in want:
        want = {t["id"] for t in TASKS[n1:]}
    rows = []
    for t in TASKS:
        if want and t["id"] not in want:
            continue
        r = run_task(t, "순수")
        for m in ("예외", "보정"):
            if r["결과"] == "통과":
                break
            r2 = run_task(t, m)
            r2["사유"] = (r["사유"] + " → " + r2["사유"]) if r2["결과"] != "통과" else ""
            r = r2
        r.update(분야=t["field"], 자료파일=t["file"], 출처=t["출처"], 비고=t["비고"])
        rows.append(r)
        print(f"{r['결과']:3s} {r.get('등급','-')} {t['id']:16s} {r.get('x','')[:60]} {r.get('지표','') or r['사유'][:90]} {('【' + r.get('보정', '') + '】') if r.get('보정') else ''}", flush=True)
    for f0 in (WORK / "specs").glob("SCR*.json"):
        f0.unlink()
    new = pd.DataFrame(rows)
    f = ROOT / "검사결과_전체.csv"
    if want and f.exists():
        old = pd.read_csv(f, encoding="utf-8-sig")
        new = pd.concat([old[~old["id"].isin(new["id"])], new])
    new.to_csv(f, index=False, encoding="utf-8-sig")
    ok = new[new["결과"] == "통과"]
    cols = ["id", "title", "분야", "등급", "track", "y", "x", "행수", "지표", "보정", "경고", "자료파일", "출처", "비고"]
    ok[[c for c in cols if c in ok.columns]].rename(columns={"id": "과제", "title": "제목", "track": "과제유형", "y": "맞힐값", "x": "x5개"}).to_csv(ROOT / "사용가능_목록.csv", index=False, encoding="utf-8-sig")
    print(f"\n통과 {len(ok)} / 전체 {len(new)}")


if __name__ == "__main__":
    main()
