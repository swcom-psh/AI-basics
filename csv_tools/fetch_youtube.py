"""YouTube Data API v3 로 채널의 모든 업로드 영상 정보를 받아 csv_work/youtube/<이름>.csv 로 저장한다.
키는 .env 의 YOUTUBE_KEY (깃에 올리지 않음). 영상 목록(1유닛/50개)과 영상 정보(1유닛/50개)만 써서 하루 한도(1만 유닛)를 거의 쓰지 않는다."""
import re
import sys
import time
import requests
import pandas as pd
from common import env, WORK

KEY = env("YOUTUBE_KEY")
API = "https://www.googleapis.com/youtube/v3"
CH = {"침착맨": "UCUj6rrhMTR9pipbAWBAMvUQ", "지식채널e": "UCL44YGs2BXxtM4GZRH-wnrQ", "세바시": "UCgheNMc3gGHLsT-RISdCzDQ", "마디아디자이너": "UCxRnfrmJAkRLarzeBJETB5g"}


def get(path, **p):
    for t in range(5):
        r = requests.get(f"{API}/{path}", params={**p, "key": KEY}, timeout=60)
        if r.status_code == 200:
            return r.json()
        if r.status_code in (429, 500, 503):
            time.sleep(3 * (t + 1))
            continue
        raise RuntimeError(f"{path} {r.status_code} {r.text[:200]}")
    raise RuntimeError("재시도 실패")


def dur_sec(iso):
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return None
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def uploads(cid):
    pl = "UU" + cid[2:]
    ids, tok = [], None
    while True:
        j = get("playlistItems", part="contentDetails", playlistId=pl, maxResults=50, **({"pageToken": tok} if tok else {}))
        ids += [it["contentDetails"]["videoId"] for it in j["items"]]
        tok = j.get("nextPageToken")
        if not tok:
            return ids


def details(ids):
    rows = []
    for i in range(0, len(ids), 50):
        j = get("videos", part="snippet,contentDetails,statistics", id=",".join(ids[i:i + 50]))
        for it in j["items"]:
            sn, st, cd = it["snippet"], it.get("statistics", {}), it["contentDetails"]
            rows.append({"영상": it["id"], "게시시각": sn["publishedAt"], "제목": sn["title"], "설명글자수": len(sn.get("description", "")), "태그수": len(sn.get("tags", [])),
                         "카테고리": sn.get("categoryId"), "길이초": dur_sec(cd["duration"]), "자막": cd.get("caption") == "true", "라이브": sn.get("liveBroadcastContent"),
                         "조회수": int(st["viewCount"]) if "viewCount" in st else None, "좋아요": int(st["likeCount"]) if "likeCount" in st else None,
                         "댓글": int(st["commentCount"]) if "commentCount" in st else None})
    return pd.DataFrame(rows)


if __name__ == "__main__":
    out = WORK / "youtube"
    out.mkdir(exist_ok=True)
    for name in (sys.argv[1:] or CH):
        ids = uploads(CH[name])
        d = details(ids)
        d["게시시각"] = pd.to_datetime(d["게시시각"], utc=True).dt.tz_convert("Asia/Seoul").dt.strftime("%Y-%m-%d %H:%M:%S")
        d.sort_values("게시시각").to_csv(out / f"{name}.csv", index=False, encoding="utf-8-sig")
        print(name, len(d), "영상", d["게시시각"].min()[:10], "~", d["게시시각"].max()[:10])
