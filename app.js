const API = "https://boatraceopenapi.github.io/api/v1/today.json";

const STADIUMS = {
  1:"桐生",
  2:"戸田",
  3:"江戸川",
  4:"平和島",
  5:"多摩川",
  6:"浜名湖",
  7:"蒲郡",
  8:"常滑",
  9:"津",
  10:"三国",
  11:"びわこ",
  12:"住之江",
  13:"尼崎",
  14:"鳴門",
  15:"丸亀",
  16:"児島",
  17:"宮島",
  18:"徳山",
  19:"下関",
  20:"若松",
  21:"芦屋",
  22:"福岡",
  23:"唐津",
  24:"大村"
};

const PURCHASE_KEY = "cyber_hatchan_purchased_v2";
const PREDICTION_KEY = "cyber_hatchan_predictions_v2";

let allRaces = [];
let selectedStadium = "all";
let lastUpdated = null;


/* =========================
   基本ユーティリティ
========================= */

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function now() {
  return new Date();
}

function todayString() {
  const d = now();

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function formatDateJP(date) {
  if (!date) return "";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function cutoffDate(value) {
  if (!value) return null;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return null;

  return d;
}

function isBeforeCutoff(race) {
  const cutoff = cutoffDate(race.closed_at);

  if (!cutoff) return true;

  return cutoff.getTime() > now().getTime();
}

function minutesUntilCutoff(race) {
  const cutoff = cutoffDate(race.closed_at);

  if (!cutoff) return 9999;

  return Math.round((cutoff.getTime() - now().getTime()) / 60000);
}


/* =========================
   LocalStorage
========================= */

function getPurchased() {
  try {
    return JSON.parse(localStorage.getItem(PURCHASE_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePurchased(list) {
  localStorage.setItem(PURCHASE_KEY, JSON.stringify(list));
}

function getPredictions() {
  try {
    return JSON.parse(localStorage.getItem(PREDICTION_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePredictions(list) {
  localStorage.setItem(PREDICTION_KEY, JSON.stringify(list));
}


/* =========================
   選手データ
========================= */

function racerName(r) {
  if (!r) return "不明";

  return (
    r.name ||
    r.racer_name ||
    r.player_name ||
    r.racerName ||
    "不明"
  );
}

function racerClass(r) {
  if (!r) return "";

  return (
    r.rank ||
    r.class ||
    r.grade ||
    r.racer_rank ||
    ""
  );
}

function nationalWin(r) {
  if (!r) return 0;

  return num(
    r.national_win_rate ??
    r.national_win ??
    r.win_rate ??
    r.winRate
  );
}

function national3(r) {
  if (!r) return 0;

  return num(
    r.national_3rentai_rate ??
    r.national_three_rate ??
    r.national_3_rate ??
    r.three_rate
  );
}

function localWin(r) {
  if (!r) return 0;

  return num(
    r.local_win_rate ??
    r.local_win ??
    r.localWinRate
  );
}

function motor3(r) {
  if (!r) return 0;

  return num(
    r.motor_3rentai_rate ??
    r.motor_three_rate ??
    r.motor_3_rate ??
    r.motorRate
  );
}

function exhibitionTime(r) {
  if (!r) return 0;

  return num(
    r.exhibition_time ??
    r.exhibitionTime ??
    r.exhibition
  );
}

function exhibitionST(r) {
  if (!r) return 0;

  return num(
    r.start_timing ??
    r.startTiming ??
    r.st
  );
}

function previewCourse(r) {
  if (!r) return 0;

  return num(
    r.course ??
    r.exhibition_course ??
    r.start_course ??
    r.lane
  );
}


/* =========================
   レース取得
========================= */

function normalizeRace(race, stadiumNumber) {
  if (!race) return null;

  const racersSource =
    race.racers ||
    race.entries ||
    race.players ||
    {};

  const previewSource =
    race.preview?.racers ||
    race.preview_racers ||
    race.exhibition?.racers ||
    {};

  const racers = [];

  for (let i = 1; i <= 6; i++) {

    let r = racersSource[i] ||
            racersSource[String(i)] ||
            null;

    let p = previewSource[i] ||
            previewSource[String(i)] ||
            null;

    if (!r && !p) continue;

    racers.push({
      lane: i,
      ...(r || {}),
      preview: p || {}
    });
  }

  return {
    date: race.date || todayString(),
    stadium_number: num(
      race.stadium_number || stadiumNumber,
      stadiumNumber
    ),
    race_number: num(
      race.race_number ||
      race.raceNo ||
      race.number
    ),
    closed_at: race.closed_at || race.closedAt || null,
    grade_number: race.grade_number || race.grade || "",
    title: race.title || "",
    subtitle: race.subtitle || "",
    day_number: race.day_number || race.day || "",
    racers
  };
}

function extractRaces(data) {
  const result = [];

  const programs = data?.programs?.stadiums || {};

  Object.keys(programs).forEach(stadiumKey => {

    const stadium = programs[stadiumKey];

    const stadiumNumber =
      num(stadium.stadium_number || stadiumKey);

    const races = stadium?.races || {};

    Object.keys(races).forEach(raceKey => {

      const normalized =
        normalizeRace(
          races[raceKey],
          stadiumNumber
        );

      if (
        normalized &&
        normalized.race_number
      ) {
        result.push(normalized);
      }
    });
  });

  return result.sort((a, b) => {

    if (a.stadium_number !== b.stadium_number) {
      return a.stadium_number - b.stadium_number;
    }

    return a.race_number - b.race_number;
  });
}


/* =========================
   進入・展示情報
========================= */

function getPreview(race, lane) {

  const racer = race.racers.find(
    r => r.lane === lane
  );

  if (!r) {
    return {
      course: 0,
      st: 0,
      time: 0
    };
  }

  const p = racer.preview || {};

  return {
    course: previewCourse(p),
    st: exhibitionST(p),
    time: exhibitionTime(p)
  };
}

function courseOrder(race) {

  const arr = [];

  race.racers.forEach(r => {

    const p = getPreview(race, r.lane);

    if (p.course >= 1 && p.course <= 6) {

      arr.push({
        lane: r.lane,
        course: p.course
      });
    }
  });

  return arr.sort(
    (a, b) => a.course - b.course
  );
}

function hasChangedEntry(race) {

  const order = courseOrder(race);

  if (!order.length) return false;

  const first = order[0];

  return first.lane !== 1;
}


/* =========================
   選手評価
========================= */

function playerScore(racer) {

  if (!racer) return 0;

  const win = nationalWin(racer);
  const three = national3(racer);
  const local = localWin(racer);
  const motor = motor3(racer);

  let score = 0;

  score += clamp(win * 7, 0, 50);
  score += clamp(three * 0.22, 0, 22);
  score += clamp(local * 2, 0, 12);
  score += clamp(motor * 0.12, 0, 12);

  return score;
}

function previewScore(race, lane) {

  const p = getPreview(race, lane);

  let score = 0;

  if (p.time > 0) {

    if (p.time <= 6.65) {
      score += 15;
    } else if (p.time <= 6.75) {
      score += 12;
    } else if (p.time <= 6.85) {
      score += 8;
    } else if (p.time <= 6.95) {
      score += 4;
    }
  }

  if (p.st > 0) {

    const abs = Math.abs(p.st);

    if (abs <= 0.05) {
      score += 10;
    } else if (abs <= 0.10) {
      score += 7;
    } else if (abs <= 0.15) {
      score += 4;
    }
  }

  return score;
}


/* =========================
   レース評価
========================= */

function scoreRace(race) {

  const racers =
    [...race.racers]
      .sort((a, b) => a.lane - b.lane);

  if (racers.length < 6) {
    return null;
  }

  const scores = racers.map(r => {

    const base = playerScore(r);

    const preview =
      previewScore(race, r.lane);

    let laneBonus = 0;

    if (r.lane === 1) {
      laneBonus = 22;
    } else if (r.lane === 2) {
      laneBonus = 12;
    } else if (r.lane === 3) {
      laneBonus = 10;
    } else if (r.lane === 4) {
      laneBonus = 8;
    } else {
      laneBonus = 3;
    }

    return {
      lane: r.lane,
      racer: r,
      total: base + preview + laneBonus
    };
  });

  scores.sort(
    (a, b) => b.total - a.total
  );

  const first =
    scores.find(x => x.lane === 1);

  const best =
    scores[0];

  const second =
    scores.find(x => x.lane !== best.lane);

  if (!first || !best || !second) {
    return null;
  }

  const margin =
    best.total - second.total;

  let confidence = 45;

  confidence +=
    clamp(first.total * 0.42, 0, 30);

  confidence +=
    clamp(margin * 0.85, 0, 15);

  const p1 =
    getPreview(race, 1);

  if (p1.time > 0) {

    if (p1.time <= 6.70) {
      confidence += 7;
    } else if (p1.time <= 6.80) {
      confidence += 4;
    }
  }

  if (hasChangedEntry(race)) {
    confidence -= 5;
  }

  const remaining =
    minutesUntilCutoff(race);

  if (remaining >= 0 && remaining <= 10) {
    confidence -= 2;
  }

  confidence =
    Math.round(
      clamp(confidence, 45, 96)
    );

  let level = "候補";

  if (confidence >= 88 && margin >= 8) {
    level = "激アツ";
  } else if (confidence >= 78) {
    level = "本命";
  } else if (confidence >= 68) {
    level = "有力";
  }

  const firstIs1 =
    best.lane === 1;

  let show = false;

  if (
    confidence >= 60 &&
    firstIs1
  ) {
    show = true;
  }

  if (
    confidence >= 58 &&
    margin >= 5
  ) {
    show = true;
  }

  if (
    confidence < 58 &&
    margin < 3
  ) {
    show = false;
  }

  const hot =
    confidence >= 88 &&
    margin >= 8 &&
    firstIs1;

  const opponent =
    scores
      .filter(x => x.lane !== best.lane)
      .slice(0, 3);

  const bets = [];

  const opponentLanes =
    opponent.map(x => x.lane);

  if (best.lane === 1) {

    opponentLanes.forEach(lane => {

      bets.push(`1-${lane}-2`);
      bets.push(`1-${lane}-3`);

    });

    bets.push("1-2-3");
    bets.push("1-3-2");

  } else {

    bets.push(
      `${best.lane}-1-2`
    );

    bets.push(
      `${best.lane}-1-3`
    );

    bets.push(
      `${best.lane}-2-1`
    );
  }

  const reasons = [];

  if (firstIs1) {
    reasons.push("1号艇を軸評価");
  }

  if (margin >= 8) {
    reasons.push("相手との差が大きい");
  } else if (margin >= 5) {
    reasons.push("相手との差を確保");
  }

  if (p1.time > 0) {

    if (p1.time <= 6.70) {
      reasons.push("展示タイム良好");
    } else if (p1.time <= 6.80) {
      reasons.push("展示タイムまずまず");
    }
  }

  if (p1.st !== 0) {

    if (Math.abs(p1.st) <= 0.10) {
      reasons.push("展示ST良好");
    }
  }

  if (hasChangedEntry(race)) {
    reasons.push("展示で進入変化あり");
  }

  if (!reasons.length) {
    reasons.push("選手成績を総合評価");
  }

  return {
    ...race,

    scores,

    bestLane: best.lane,

    confidence,

    margin,

    level,

    hot,

    show,

    bets: [...new Set(bets)].slice(0, 6),

    reason: reasons.join("・"),

    bestRacer: best.racer,

    opponent
  };
}


/* =========================
   予想変更理由
========================= */

function predictionId(item) {

  return [
    item.date,
    item.stadium_number,
    item.race_number
  ].join("_");
}

function getPreviousPrediction(item) {

  const list = getPredictions();

  return list.find(
    x => x.id === predictionId(item)
  );
}

function buildChangeReason(previous, current) {

  if (!previous) return "";

  const reasons = [];

  if (
    previous.bestLane !==
    current.bestLane
  ) {
    reasons.push(
      `本命が${previous.bestLane}号艇→${current.bestLane}号艇に変更`
    );
  }

  if (
    Math.abs(
      num(previous.confidence) -
      num(current.confidence)
    ) >= 5
  ) {
    reasons.push(
      `自信度が${previous.confidence}→${current.confidence}に変化`
    );
  }

  if (
    previous.hasChangedEntry !==
    hasChangedEntry(current)
  ) {
    reasons.push(
      "展示の進入体系が変化"
    );
  }

  if (
    previous.exhibitionTime1 !==
    getPreview(current, 1).time
  ) {
    reasons.push(
      "1号艇の展示タイムが変化"
    );
  }

  if (
    previous.exhibitionST1 !==
    getPreview(current, 1).st
  ) {
    reasons.push(
      "展示STが変化"
    );
  }

  return reasons.join("・");
}

function savePrediction(item) {

  const list =
    getPredictions();

  const id =
    predictionId(item);

  const previous =
    list.find(x => x.id === id);

  const p1 =
    getPreview(item, 1);

  const changeReason =
    buildChangeReason(
      previous,
      item
    );

  const record = {

    id,

    date: item.date,

    stadium_number:
      item.stadium_number,

    race_number:
      item.race_number,

    bestLane:
      item.bestLane,

    confidence:
      item.confidence,

    level:
      item.level,

    exhibitionTime1:
      p1.time,

    exhibitionST1:
      p1.st,

    hasChangedEntry:
      hasChangedEntry(item),

    changeReason,

    updatedAt:
      new Date().toISOString()
  };

  const index =
    list.findIndex(
      x => x.id === id
    );

  if (index >= 0) {
    list[index] = record;
  } else {
    list.push(record);
  }

  savePredictions(list);

  return changeReason;
}


/* =========================
   購入済み
========================= */

function purchaseId(item) {

  return predictionId(item);
}

function isPurchased(item) {

  const list =
    getPurchased();

  return list.some(
    x => x.id === purchaseId(item)
  );
}

function markPurchased(item) {

  const list =
    getPurchased();

  const id =
    purchaseId(item);

  const exists =
    list.find(
      x => x.id === id
    );

  if (exists) return;

  list.push({

    id,

    date: item.date,

    stadium_number:
      item.stadium_number,

    race_number:
      item.race_number,

    closed_at:
      item.closed_at,

    title:
      item.title,

    subtitle:
      item.subtitle,

    confidence:
      item.confidence,

    level:
      item.level,

    bestLane:
      item.bestLane,

    bestName:
      racerName(item.bestRacer),

    bets:
      item.bets,

    purchasedAt:
      new Date().toISOString(),

    result:
      null

  });

  savePurchased(list);
}


/* =========================
   結果判定
========================= */

function normalizeResult(result) {

  if (!result) return null;

  const candidates = [
    result,
    result.result,
    result.results
  ];

  let obj = candidates.find(
    x => x && typeof x === "object"
  );

  if (!obj) return null;

  let order = [];

  if (Array.isArray(obj)) {
    order = obj;
  }

  if (
    Array.isArray(obj.order)
  ) {
    order = obj.order;
  }

  if (
    Array.isArray(obj.arrival)
  ) {
    order = obj.arrival;
  }

  if (
    Array.isArray(obj.rank)
  ) {
    order = obj.rank;
  }

  if (!order.length) {

    const keys = [
      "first",
      "second",
      "third"
    ];

    keys.forEach(k => {

      if (obj[k] != null) {
        order.push(
          num(
            obj[k],
            0
          )
        );
      }

    });
  }

  order =
    order
      .map(x => {

        if (
          typeof x === "object"
        ) {
          return num(
            x.lane ||
            x.course ||
            x.number
          );
        }

        return num(x);
      })
      .filter(
        x => x >= 1 && x <= 6
      );

  return {
    order
  };
}

function isHit(purchased, result) {

  if (
    !result ||
    !result.order ||
    result.order.length < 3
  ) {
    return null;
  }

  const first =
    result.order[0];

  const bets =
    purchased.bets || [];

  for (const bet of bets) {

    const parts =
      String(bet)
        .split("-")
        .map(Number);

    if (parts.length !== 3) {
      continue;
    }

    if (
      parts[0] === first &&
      parts[1] === result.order[1] &&
      parts[2] === result.order[2]
    ) {
      return true;
    }
  }

  return false;
}


/* =========================
   表示用
========================= */

function gradeText(value) {

  const n =
    String(value || "")
      .toUpperCase();

  if (n.includes("SG")) return "SG";

  if (n.includes("G1")) return "G1";

  if (n.includes("G2")) return "G2";

  if (n.includes("G3")) return "G3";

  if (n.includes("一般")) return "一般";

  if (n) return n;

  return "";
}

function renderRacers(item) {

  return item.racers
    .slice()
    .sort(
      (a, b) => a.lane - b.lane
    )
    .map(r => {

      const p =
        getPreview(
          item,
          r.lane
        );

      return `
        <div class="racer">

          <div class="racer-no">
            ${r.lane}
          </div>

          <div class="racer-info">

            <b>
              ${esc(racerName(r))}
            </b>

            <span>
              ${esc(racerClass(r))}
              全国 ${nationalWin(r).toFixed(2)}
              /3連 ${national3(r).toFixed(1)}%
              ${p.course ? `/進${p.course}` : ""}
            </span>

          </div>

          <div class="racer-time">
            ${
              p.time
                ? p.time.toFixed(2)
                : "-"
            }
          </div>

        </div>
      `;

    })
    .join("");
}

function renderRace(item) {

  const purchased =
    isPurchased(item);

  const grade =
    gradeText(
      item.grade_number
    );

  const cutoff =
    cutoffDate(
      item.closed_at
    );

  const cutoffText =
    cutoff
      ? cutoff.toLocaleTimeString(
          "ja-JP",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )
      : "--:--";

  const best =
    item.bestRacer;

  const opponentText =
    item.opponent
      .slice(0, 3)
      .map(
        x =>
          `${x.lane}号艇 ${racerName(x.racer)}`
      )
      .join(" / ");

  const change =
    getPreviousPrediction(item)
      ?.changeReason || "";

  return `
    <article
      class="race-card ${item.hot ? "hot" : ""}"
      data-id="${esc(predictionId(item))}"
    >

      <div class="race-top">

        <div>

          <div class="race-title">
            ${STADIUMS[item.stadium_number] || "不明"}
            ${item.race_number}R

            ${
              grade
                ? `<span class="grade">${esc(grade)}</span>`
                : ""
            }
          </div>

          <div class="event-title">
            ${esc(item.title)}
          </div>

          ${
            item.subtitle
              ? `
                <div class="subtitle">
                  ${esc(item.subtitle)}
                </div>
              `
              : ""
          }

          <div class="deadline">
            締切 ${cutoffText}
          </div>

        </div>

        <div class="confidence">

          <span class="level ${
            item.hot
              ? "hot-level"
              : ""
          }">
            ${esc(item.level)}
          </span>

          <strong>
            ${item.confidence}
          </strong>

          <small>
            自信度
          </small>

        </div>

      </div>


      <div class="main-pick">

        <div class="pick-label">
          本命
        </div>

        <div class="pick-name">
          ${item.bestLane}号艇
          ${esc(racerName(best))}
        </div>

        <div class="pick-reason">
          ${esc(item.reason)}
        </div>

      </div>


      <div class="place">

        <div>

          <b>相手筆頭</b>

          ${esc(opponentText)}

        </div>

        <div>

          <b>展示進入</b>

          ${
            courseOrder(item)
              .map(
                x =>
                  `${x.course}:${x.lane}`
              )
              .join(" ")
              || "データなし"
          }

        </div>

      </div>


      <div class="bets">

        <div class="bets-title">
          推奨買い目
        </div>

        <div class="bet-list">

          ${
            item.bets
              .map(
                bet =>
                  `<div class="bet">
                    ${esc(
                      bet
                        .split("-")
                        .join(" - ")
                    )}
                  </div>`
              )
              .join("")
          }

        </div>

      </div>


      ${
        change
          ? `
            <div class="change">
              <b>予想変更</b>
              <span>${esc(change)}</span>
            </div>
          `
          : ""
      }


      <div class="racers">

        ${renderRacers(item)}

      </div>


      <div class="buy-area">

        <div class="buy-note">
          購入済みにすると結果・的中率を記録
        </div>

        <button
          class="buy-button ${
            purchased
              ? "purchased"
              : ""
          }"
          type="button"
          onclick="handlePurchase('${esc(
            predictionId(item)
          )}')"
        >
          ${
            purchased
              ? "購入済み"
              : "買った"
          }
        </button>

      </div>

    </article>
  `;
}


/* =========================
   購入ボタン
========================= */

window.handlePurchase = function(id) {

  const item =
    allRaces.find(
      x => predictionId(x) === id
    );

  if (!item) return;

  if (isPurchased(item)) {
    return;
  }

  markPurchased(item);

  renderMain();
};


/* =========================
   場タブ
========================= */

function renderStadiumTabs(items) {

  const stadiumNumbers =
    [
      ...new Set(
        items.map(
          x => x.stadium_number
        )
      )
    ]
    .sort(
      (a, b) => a - b
    );

  return `
    <div class="stadium-tabs">

      <button
        class="stadium-tab ${
          selectedStadium === "all"
            ? "active"
            : ""
        }"
        onclick="selectStadium('all')"
      >
        <span>全場</span>
        <small>${items.length}レース</small>
      </button>

      ${
        stadiumNumbers
          .map(n => {

            const count =
              items.filter(
                x =>
                  x.stadium_number === n
              ).length;

            return `
              <button
                class="stadium-tab ${
                  selectedStadium === String(n)
                    ? "active"
                    : ""
                }"
                onclick="selectStadium('${n}')"
              >

                <span>
                  ${esc(
                    STADIUMS[n] || n
                  )}
                </span>

                <small>
                  ${count}レース
                </small>

              </button>
            `;

          })
          .join("")
      }

    </div>
  `;
}

window.selectStadium = function(value) {

  selectedStadium =
    String(value);

  renderMain();
};


/* =========================
   メイン表示
========================= */

function renderMain() {

  const container =
    document.getElementById(
      "picks"
    );

  if (!container) return;

  const beforeCutoff =
    allRaces.filter(
      isBeforeCutoff
    );

  const scored =
    beforeCutoff
      .map(scoreRace)
      .filter(Boolean);

  scored.forEach(item => {

    const previous =
      getPreviousPrediction(item);

    item.changeReason =
      buildChangeReason(
        previous,
        item
      );

  });

  allRaces =
    allRaces.map(original => {

      const scoredItem =
        scored.find(
          x =>
            predictionId(x) ===
            predictionId(original)
        );

      return scoredItem || original;
    });

  const candidates =
    scored
      .filter(
        x => x.show
      )
      .sort(
        (a, b) =>
          b.confidence -
          a.confidence
      );

  let selected =
    candidates.slice(0, 24);

  /*
    固いレースが少ない日でも
    次回更新で候補が出るよう、
    締切前レースから最低限の候補を表示。
  */

  if (selected.length < 10) {

    const fallback =
      scored
        .filter(
          x =>
            isBeforeCutoff(x)
        )
        .sort(
          (a, b) =>
            b.confidence -
            a.confidence
        );

    fallback.forEach(x => {

      if (
        selected.length >= 20
      ) {
        return;
      }

      if (
        !selected.some(
          y =>
            predictionId(y) ===
            predictionId(x)
        )
      ) {
        selected.push(x);
      }

    });
  }

  /*
    表示する予想を保存。
    保存前のデータと比較することで
    次回更新時の変更理由を保持。
  */

  selected.forEach(item => {
    savePrediction(item);
  });

  /*
    激アツ
  */

  const hot =
    selected
      .filter(
        x => x.hot
      )
      .sort(
        (a, b) =>
          b.confidence -
          a.confidence
      );

  /*
    通常
  */

  let normal =
    selected
      .filter(
        x => !x.hot
      )
      .sort(
        (a, b) =>
          b.confidence -
          a.confidence
      );

  if (
    selectedStadium !== "all"
  ) {
    normal =
      normal.filter(
        x =>
          String(
            x.stadium_number
          ) === selectedStadium
      );
  }

  const status =
    document.getElementById(
      "status"
    );

  if (status) {

    status.textContent =
      `分析 ${allRaces.length}R / 推奨 ${selected.length}R`;
  }

  const date =
    document.getElementById(
      "date"
    );

  if (date) {

    date.textContent =
      `${todayString()} 今日の予想`;
  }

  const updated =
    document.getElementById(
      "updated"
    );

  if (updated) {

    updated.textContent =
      lastUpdated
        ? `更新 ${formatDateJP(lastUpdated)}`
        : "";
  }

  /*
    HTML
  */

  let html = "";

  if (hot.length) {

    html += `
      <section class="hot-section">

        <div class="section-title">

          <span>
            激アツ
          </span>

          <small>
            特に自信の高いレース
          </small>

        </div>

        ${
          hot
            .map(renderRace)
            .join("")
        }

      </section>
    `;

  } else {

    html += `
      <section class="hot-section">

        <div class="section-title">

          <span>
            激アツ
          </span>

          <small>
            現時点では該当なし
          </small>

        </div>

        <div class="no-hot">
          現時点で「激アツ」基準を満たすレースはありません。
          次回更新で展示・進入情報が変われば再判定します。
        </div>

      </section>
    `;
  }


  if (normal.length) {

    html += `
      <section>

        <div class="normal-title">
          その他の有力レース
        </div>

        ${
          renderStadiumTabs(
            selected
          )
        }

        ${
          normal
            .map(renderRace)
            .join("")
        }

      </section>
    `;

  } else if (!hot.length) {

    html += `
      <div class="empty">

        <div class="empty-title">
          現在表示できる推奨レースはありません
        </div>

        <div class="empty-text">
          全レースを分析しています。
          展示・進入情報の更新後に再度「更新」を押してください。
        </div>

      </div>
    `;

  }

  container.innerHTML = html;
}


/* =========================
   購入済みページ
========================= */

async function loadPurchasedPage() {

  const container =
    document.getElementById(
      "purchasedList"
    );

  if (!container) {
    return false;
  }

  const purchased =
    getPurchased();

  const count =
    document.getElementById(
      "purchaseCount"
    );

  if (count) {
    count.textContent =
      `${purchased.length}件`;
  }

  if (!purchased.length) {

    container.innerHTML = `
      <div class="empty">

        <div class="empty-title">
          購入済みレースはありません
        </div>

        <div class="empty-text">
          予想画面で「買った」を押したレースがここに表示されます。
        </div>

      </div>
    `;

    return true;
  }

  container.innerHTML =
    purchased
      .slice()
      .reverse()
      .map(p => {

        const hit =
          p.result?.hit;

        let resultText =
          "結果確認前";

        if (
          p.result &&
          p.result.order
        ) {

          resultText =
            hit === true
              ? "的中"
              : "不的中";
        }

        return `
          <article class="race-card">

            <div class="race-top">

              <div>

                <div class="race-title">
                  ${
                    esc(
                      STADIUMS[
                        p.stadium_number
                      ] ||
                      "不明"
                    )
                  }
                  ${p.race_number}R
                </div>

                <div class="event-title">
                  ${esc(p.title)}
                </div>

                <div class="deadline">
                  購入：
                  ${formatDateJP(p.purchasedAt)}
                </div>

              </div>

              <div class="confidence">

                <strong>
                  ${p.confidence || "-"}
                </strong>

                <small>
                  自信度
                </small>

              </div>

            </div>

            <div class="main-pick">

              <div class="pick-label">
                本命
              </div>

              <div class="pick-name">
                ${p.bestLane}号艇
                ${esc(p.bestName)}
              </div>

            </div>

            <div class="bets">

              <div class="bets-title">
                購入した買い目
              </div>

              <div class="bet-list">

                ${
                  (p.bets || [])
                    .map(
                      bet =>
                        `<div class="bet">
                          ${esc(
                            bet
                              .split("-")
                              .join(" - ")
                          )}
                        </div>`
                    )
                    .join("")
                }

              </div>

            </div>

            <div class="buy-area">

              <div class="buy-note">
                ${
                  p.result?.order
                    ? `結果：${p.result.order.join("-")}`
                    : "結果確認中"
                }
              </div>

              <div
                style="
                  font-weight:900;
                  font-size:12px;
                  color:${
                    hit === true
                      ? "#8fe0a9"
                      : hit === false
                        ? "#d88787"
                        : "#91a4b7"
                  };
                "
              >
                ${resultText}
              </div>

            </div>

          </article>
        `;

      })
      .join("");

  return true;
}


/* =========================
   購入済み結果更新
========================= */

async function updatePurchasedResults() {

  const purchased =
    getPurchased();

  if (!purchased.length) {
    return;
  }

  /*
    過去日のAPIを取得。
  */

  const dates =
    [
      ...new Set(
        purchased.map(
          x => x.date
        )
      )
    ];

  for (const date of dates) {

    try {

      const url =
        date === todayString()
          ? API
          : `https://boatraceopenapi.github.io/api/v1/${date.replaceAll("-", "/")}.json`;

      const response =
        await fetch(
          url,
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {
        continue;
      }

      const data =
        await response.json();

      const races =
        extractRaces(data);

      purchased.forEach(p => {

        if (
          p.date !== date ||
          p.result
        ) {
          return;
        }

        const race =
          races.find(
            r =>
              r.stadium_number ===
                p.stadium_number &&
              r.race_number ===
                p.race_number
          );

        if (!race) {
          return;
        }

        const raw =
          data?.programs
            ?.stadiums?.[
              String(
                p.stadium_number
              )
            ]?.races?.[
              String(
                p.race_number
              )
            ]?.result;

        if (!raw) {
          return;
        }

        const result =
          normalizeResult(raw);

        if (
          !result ||
          result.order.length < 3
        ) {
          return;
        }

        p.result = {
          order: result.order,
          hit: isHit(
            p,
            result
          ),
          checkedAt:
            new Date().toISOString()
        };

      });

    } catch (error) {

      console.log(
        "結果取得エラー",
        error
      );

    }
  }

  savePurchased(purchased);
}


/* =========================
   データ取得
========================= */

async function loadData() {

  const status =
    document.getElementById(
      "status"
    );

  const picks =
    document.getElementById(
      "picks"
    );

  if (status) {
    status.textContent =
      "データ取得中…";
  }

  if (picks) {
    picks.innerHTML = `
      <div class="loading">
        出走表・直前情報を取得しています…
      </div>
    `;
  }

  try {

    const response =
      await fetch(
        `${API}?t=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    const races =
      extractRaces(data);

    if (!races.length) {
      throw new Error(
        "レースデータがありません"
      );
    }

    allRaces = races;

    lastUpdated =
      new Date();

    renderMain();

    /*
      購入済み情報も更新
    */

    await updatePurchasedResults();

    if (
      document.getElementById(
        "purchasedList"
      )
    ) {
      await loadPurchasedPage();
    }

  } catch (error) {

    console.error(
      "API取得エラー:",
      error
    );

    if (status) {

      status.textContent =
        "データ取得に失敗しました";
    }

    if (picks) {

      picks.innerHTML = `
        <div class="empty">

          <div class="empty-title">
            データを取得できませんでした
          </div>

          <div class="empty-text">
            「更新」を押して再試行してください。<br>
            API側の更新タイミングによって一時的に取得できない場合があります。
          </div>

        </div>
      `;
    }
  }
}


/* =========================
   更新ボタン
========================= */

function setupRefresh() {

  const button =
    document.getElementById(
      "refresh"
    );

  if (!button) return;

  button.addEventListener(
    "click",
    async () => {

      button.disabled = true;
      button.textContent =
        "更新中…";

      try {
        await loadData();
      } finally {

        button.disabled = false;
        button.textContent =
          "更新";
      }

    }
  );
}


/* =========================
   自動更新
========================= */

function setupAutoUpdate() {

  setInterval(
    () => {

      loadData();

    },
    3 * 60 * 1000
  );
}


/* =========================
   購入履歴削除
========================= */

function setupDeletePurchased() {

  const button =
    document.getElementById(
      "clearPurchased"
    );

  if (!button) return;

  button.addEventListener(
    "click",
    () => {

      if (
        !confirm(
          "購入済み履歴をすべて削除しますか？"
        )
      ) {
        return;
      }

      localStorage.removeItem(
        PURCHASE_KEY
      );

      loadPurchasedPage();

    }
  );
}


/* =========================
   購入済みページ集計
========================= */

function renderPurchaseStats() {

  const purchased =
    getPurchased();

  const finished =
    purchased.filter(
      x =>
        x.result &&
        Array.isArray(
          x.result.order
        ) &&
        x.result.order.length >= 3
    );

  const hits =
    finished.filter(
      x =>
        x.result.hit === true
    );

  const rate =
    finished.length
      ? Math.round(
          hits.length /
          finished.length *
          100
        )
      : 0;

  const count =
    document.getElementById(
      "purchaseCount"
    );

  if (count) {
    count.textContent =
      `${purchased.length}件`;
  }

  const resultCount =
    document.getElementById(
      "resultCount"
    );

  if (resultCount) {
    resultCount.textContent =
      `${finished.length}件`;
  }

  const hitRate =
    document.getElementById(
      "hitRate"
    );

  if (hitRate) {
    hitRate.textContent =
      finished.length
        ? `${rate}%`
        : "-";
  }
}


/* =========================
   起動
========================= */

async function init() {

  setupRefresh();

  setupDeletePurchased();

  setupAutoUpdate();

  /*
    購入済みページなら
    そちらを表示。
  */

  if (
    document.getElementById(
      "purchasedList"
    )
  ) {

    await updatePurchasedResults();

    await loadPurchasedPage();

    renderPurchaseStats();

    return;
  }

  /*
    通常の予想ページ
  */

  await loadData();
}

document.addEventListener(
  "DOMContentLoaded",
  init
);
