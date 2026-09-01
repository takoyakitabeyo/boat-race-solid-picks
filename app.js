const API =
  "https://boatraceopenapi.github.io/api/v1/today.json";

const STADIUMS = {
  1:"桐生", 2:"戸田", 3:"江戸川", 4:"平和島",
  5:"多摩川", 6:"浜名湖", 7:"蒲郡", 8:"常滑",
  9:"津", 10:"三国", 11:"びわこ", 12:"住之江",
  13:"尼崎", 14:"鳴門", 15:"丸亀", 16:"児島",
  17:"宮島", 18:"徳山", 19:"下関", 20:"若松",
  21:"芦屋", 22:"福岡", 23:"唐津", 24:"大村"
};

const GRADES = {
  1: "一般",
  2: "G3",
  3: "G2",
  4: "G1",
  5: "SG"
};

const $ = s => document.querySelector(s);

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const clamp = (v, min, max) =>
  Math.max(min, Math.min(max, v));

function rankName(n) {
  return {
    1:"A1",
    2:"A2",
    3:"B1",
    4:"B2"
  }[n] || "-";
}

function fmtTime(v) {
  const m = String(v || "")
    .match(/(\d{2}):(\d{2})/);

  return m
    ? `${m[1]}:${m[2]}`
    : "--:--";
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}


/* =========================
   レースの評価
========================= */

function scoreRace(r) {

  const racers =
    Object.values(r.racers || {})
      .sort((a,b) =>
        Number(a.entry_number) -
        Number(b.entry_number)
      );

  if (racers.length !== 6) {
    return null;
  }

  const one =
    racers.find(x =>
      Number(x.entry_number) === 1
    );

  if (!one) {
    return null;
  }

  const preview =
    r.preview?.racers || {};

  const p1 =
    preview["1"] || {};

  let score = 0;

  const rank =
    num(one.rank_number);

  const national =
    num(one.national_win_rate) || 0;

  const local =
    num(one.local_win_rate) || 0;

  const national3 =
    num(one.national_top_3_percent) || 0;

  const local3 =
    num(one.local_top_3_percent) || 0;

  const motor3 =
    num(one.motor_top_3_percent) || 0;


  /* 級別 */

  score += ({
    1:22,
    2:15,
    3:8,
    4:2
  }[rank] || 0);


  /* 全国成績 */

  score += clamp(
    national * 3.2,
    0,
    24
  );

  score += clamp(
    local * 2.2,
    0,
    14
  );

  score += clamp(
    national3 * 0.10,
    0,
    9
  );

  score += clamp(
    local3 * 0.06,
    0,
    5
  );

  score += clamp(
    motor3 * 0.05,
    0,
    4
  );


  /* 平均ST */

  const avgST =
    num(one.average_start_timing);

  if (avgST !== null) {

    score += clamp(
      (0.25 - avgST) * 25,
      -3,
      5
    );

  }


  /* 1号艇 */

  if (
    num(p1.course_number) === 1 ||
    p1.course_number == null
  ) {
    score += 5;
  }


  /* 展示タイム */

  const exhibition =
    racers.map(x => {

      const p =
        preview[String(x.entry_number)] || {};

      return {
        entry: Number(x.entry_number),
        time: num(p.exhibition_time)
      };

    })
    .filter(x => x.time !== null);


  if (exhibition.length === 6) {

    exhibition.sort(
      (a,b) => a.time - b.time
    );

    const position =
      exhibition.findIndex(
        x => x.entry === 1
      );

    if (position === 0)
