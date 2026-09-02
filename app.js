const API = "https://boatraceopenapi.github.io/api/v1/today.json";

const STADIUMS = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川",
  6: "浜名湖", 7: "蒲郡", 8: "常滑", 9: "津", 10: "三国",
  11: "びわこ", 12: "住之江", 13: "尼崎", 14: "鳴門", 15: "丸亀",
  16: "児島", 17: "宮島", 18: "徳山", 19: "下関", 20: "若松",
  21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村"
};

const STORAGE_PREDICTIONS = "cyber-hacchan-predictions-v2";
const STORAGE_PURCHASED = "cyber-hacchan-purchased-v2";

let allRaces = [];
let selectedStadium = "all";

function $(id) {
  return document.getElementById(id);
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return "";
}

function getRacer(racers, no) {
  if (!racers) return {};

  return (
    racers[no] ||
    racers[String(no)] ||
    racers.find?.((r) => {
      return safeNumber(
        firstValue(
          r?.number,
          r?.entry_number,
          r?.racer_number,
          r?.boat_number,
          r?.lane
        ),
        0
      ) === no;
    }) ||
    {}
  );
}

function getName(racer) {
  return firstValue(
    racer?.name,
    racer?.racer_name,
    racer?.full_name,
    racer?.player_name,
    "選手情報なし"
  );
}

function getClass(racer) {
  return firstValue(
    racer?.class,
    racer?.grade,
    racer?.racer_class,
    racer?.rank,
    ""
  );
}

function getWinRate(racer) {
  return safeNumber(
    firstValue(
      racer?.national_win_rate,
      racer?.win_rate,
      racer?.national?.win_rate,
      racer?.zenkoku_win_rate
    ),
    0
  );
}

function getTripleRate(racer) {
  return safeNumber(
    firstValue(
      racer?.national_triple_rate,
      racer?.triple_rate,
      racer?.national?.triple_rate,
      racer?.zenkoku_triple_rate,
      racer?.national_top_3_percent
    ),
    0
  );
}

function getLocalWinRate(racer) {
  return safeNumber(
    firstValue(
      racer?.local_win_rate,
      racer?.stadium_win_rate,
      racer?.local?.win_rate,
      racer?.touchi_win_rate
    ),
    0
  );
}

function getMotorTripleRate(racer) {
  return safeNumber(
    firstValue(
      racer?.motor_triple_rate,
      racer?.motor?.triple_rate,
      racer?.motor_3ren_rate,
      racer?.motor_top_3_percent
    ),
    0
  );
}

function getPreviewRacer(previewRacers, no) {
  if (!previewRacers) return {};

  return (
    previewRacers[no] ||
    previewRacers[String(no)] ||
    previewRacers.find?.((r) => {
      return safeNumber(
        firstValue(
          r?.number,
          r?.entry_number,
          r?.racer_number,
          r?.boat_number,
          r?.lane
        ),
        0
      ) === no;
    }) ||
    {}
  );
}

function getCourse(previewRacer) {
  return safeNumber(
    firstValue(
      previewRacer?.course,
      previewRacer?.course_number,
      previewRacer?.entry_course,
      previewRacer?.in_course
    ),
    0
  );
}

function getExhibition(previewRacer) {
  return safeNumber(
    firstValue(
      previewRacer?.exhibition_time,
      previewRacer?.exhibition,
      previewRacer?.tenji_time
    ),
    0
  );
}

function getStartTiming(previewRacer) {
  return safeNumber(
    firstValue(
      previewRacer?.start_timing,
      previewRacer?.st,
      previewRacer?.start
    ),
    0
  );
}

function isBeforeCutoff(race) {
  if (!race.closed_at) return true;

  const cutoff = new Date(
    String(race.closed_at).replace(" ", "T")
  ).getTime();

  if (!Number.isFinite(cutoff)) return true;

  return Date.now() < cutoff;
}

function formatTime(value) {
  if (!value) return "--:--";

  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const text = String(value);

  if (text.includes("T")) {
    return text.split("T")[1].slice(0, 5);
  }

  return text.slice(-5);
}

function gradeName(value) {
  const n = safeNumber(value, 0);

  const map = {
    1: "一般",
    2: "GIII",
    3: "GII",
    4: "GI",
    5: "SG"
  };

  return map[n] || (value ? String(value) : "一般");
}

function extractRaces(data) {
  const result = [];
  const stadiums = data?.programs?.stadiums;

  if (!stadiums) return result;

  Object.entries(stadiums).forEach(([stadiumKey, stadiumData]) => {
    const stadiumNo = safeNumber(stadiumKey, 0);
    const races = stadiumData?.races;

    if (!races) return;

    Object.entries(races).forEach(([raceKey, raceData]) => {
      const raceNo = safeNumber(raceKey, 0);

      if (!raceNo || !raceData) return;

      result.push({
        ...raceData,
        stadium_number: firstValue(
          raceData.stadium_number,
          stadiumNo
        ),
        race_number: firstValue(
          raceData.race_number,
          raceNo
        )
      });
    });
  });

  return result;
}

function normalizeRace(race) {
  const racers = race.racers || {};
  const previewRacers = race.preview?.racers || {};

  return {
    ...race,
    stadiumNo: safeNumber(race.stadium_number, 0),
    stadiumName:
      STADIUMS[safeNumber(race.stadium_number, 0)] ||
      `場${race.stadium_number}`,
    raceNo: safeNumber(race.race_number, 0),
    title: firstValue(race.title, ""),
    subtitle: firstValue(race.subtitle, ""),
    dayNumber: firstValue(race.day_number, ""),
    grade: gradeName(race.grade_number),
    cutoff: race.closed_at,
    date: firstValue(
      race.date,
      race.closed_at?.slice?.(0, 10),
      ""
    ),
    racers,
    previewRacers,
    result: race.result || null
  };
}

function playerScore(racer, boatNo) {
  const win = getWinRate(racer);
  const triple = getTripleRate(racer);
  const local = getLocalWinRate(racer);
  const motor = getMotorTripleRate(racer);

  let score =
    win * 5.2 +
    triple * 0.85 +
    local * 2.4 +
    motor * 1.4;

  if (boatNo === 1) score += 13;

  if (getClass(racer) === "A1") score += 7;
  if (getClass(racer) === "A2") score += 3;

  return score;
}

function previewScore(previewRacer, boatNo) {
  const course = getCourse(previewRacer);
  const exhibition = getExhibition(previewRacer);
  const st = getStartTiming(previewRacer);

  let score = 0;

  if (course === 1) score += 15;
  else if (course === 2) score += 7;
  else if (course === 3) score += 5;

  if (exhibition > 0) {
    if (exhibition <= 6.70) score += 8;
    else if (exhibition <= 6.75) score += 5;
    else if (exhibition <= 6.80) score += 2;
    else if (exhibition >= 6.95) score -= 5;
  }

  if (st !== 0) {
    const absSt = Math.abs(st);

    if (absSt <= 0.03) score += 8;
    else if (absSt <= 0.06) score += 5;
    else if (absSt <= 0.10) score += 2;
    else if (absSt >= 0.20) score -= 4;
  }

  if (boatNo === 1 && course === 1) score += 9;

  return score;
}

function buildBets(data, level, first, second, third) {
  const top = data.slice(0, 4).map((x) => x.no);
  const fourth = top[3];

  const bets = [];

  function add(a, b, c) {
    const bet = `${a}-${b}-${c}`;

    if (
      a === b ||
      a === c ||
      b === c ||
      bets.includes(bet)
    ) {
      return;
    }

    bets.push(bet);
  }

  if (first.no === 1) {
    add(1, second.no, third.no);
    add(1, third.no, second.no);

    if (level !== "激アツ") {
      add(1, second.no, fourth);
      add(1, fourth, second.no);
    }

    if (level === "有力" || level === "候補") {
      add(1, third.no, fourth);
      add(1, fourth, third.no);
    }
  } else {
    add(first.no, 1, second.no);
    add(first.no, second.no, 1);
    add(1, first.no, second.no);

    if (level !== "激アツ") {
      add(first.no, 1, third.no);
      add(1, first.no, third.no);
    }

    if (level === "候補") {
      add(first.no, third.no, 1);
    }
  }

  return bets;
}

function scoreRace(race) {
  const racers = race.racers;
  const previewRacers = race.previewRacers;

  const data = [];

  for (let no = 1; no <= 6; no++) {
    const racer = getRacer(racers, no);

    if (!racer || Object.keys(racer).length === 0) {
      continue;
    }

    const preview = getPreviewRacer(
      previewRacers,
      no
    );

    const base = playerScore(racer, no);
    const previewValue = previewScore(
      preview,
      no
    );

    data.push({
      no,
      racer,
      preview,
      score: base + previewValue
    });
  }

  if (data.length < 6) return null;

  data.sort((a, b) => b.score - a.score);

  const first = data[0];
  const second = data[1];
  const third = data[2];
  const boat1 = data.find((x) => x.no === 1);

  const firstIsBoat1 = first.no === 1;

  const diff =
    first.score > 0
      ? ((first.score - second.score) /
          first.score) *
        100
      : 0;

  const boat1Advantage =
    firstIsBoat1 ? 15 : 0;

  let confidence =
    52 +
    diff * 1.25 +
    boat1Advantage;

  if (getCourse(boat1?.preview) === 1) {
    confidence += 5;
  }

  if (
    getExhibition(boat1?.preview) > 0 &&
    getExhibition(boat1?.preview) <= 6.75
  ) {
    confidence += 4;
  }

  confidence = Math.round(
    Math.max(
      45,
      Math.min(96, confidence)
    )
  );

  let level = "候補";
  let hot = false;

  if (
    confidence >= 84 &&
    firstIsBoat1 &&
    diff >= 7
  ) {
    level = "激アツ";
    hot = true;
  } else if (
    confidence >= 76 &&
    firstIsBoat1
  ) {
    level = "本命";
  } else if (
    confidence >= 68
  ) {
    level = "有力";
  }

  const bets = buildBets(
    data,
    level,
    first,
    second,
    third
  );

  const reasonParts = [];

  if (firstIsBoat1) {
    reasonParts.push("1号艇を本命評価");
  } else {
    reasonParts.push(
      `${first.no}号艇の総合評価が最上位`
    );
  }

  const course1 =
    getCourse(boat1?.preview);

  if (course1 === 1) {
    reasonParts.push("進入1コース");
  }

  const ex1 =
    getExhibition(boat1?.preview);

  if (ex1 > 0) {
    reasonParts.push(
      `展示${ex1.toFixed(2)}`
    );
  }

  const st1 =
    getStartTiming(boat1?.preview);

  if (st1 !== 0) {
    reasonParts.push(
      `ST ${
        st1 > 0 ? "+" : ""
      }${st1.toFixed(2)}`
    );
  }

  return {
    ...race,
    scored: true,
    confidence,
    level,
    hot,
    mainNo: first.no,
    mainName: getName(first.racer),
    secondNo: second.no,
    thirdNo: third.no,
    bets,
    reason: reasonParts.join(" / "),
    rankings: data,
    generatedAt: Date.now()
  };
}

function getPredictionHistory() {
  try {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_PREDICTIONS
      ) || "{}"
    );
  } catch {
    return {};
  }
}

function savePrediction(item) {
  const history =
    getPredictionHistory();

  const key =
    `${item.stadiumNo}-${item.raceNo}`;

  const previous = history[key];

  let changeReason = "";

  if (previous) {
    if (
      previous.mainNo !==
      item.mainNo
    ) {
      changeReason =
        `本命変更：${previous.mainNo}号艇 → ${item.mainNo}号艇`;
    } else if (
      Math.abs(
        safeNumber(previous.confidence) -
        safeNumber(item.confidence)
      ) >= 5
    ) {
      changeReason =
        `自信度変化：${previous.confidence} → ${item.confidence}`;
    }
  }

  history[key] = {
    stadiumNo: item.stadiumNo,
    raceNo: item.raceNo,
    mainNo: item.mainNo,
    secondNo: item.secondNo,
    thirdNo: item.thirdNo,
    bets: item.bets,
    confidence: item.confidence,
    level: item.level,
    changeReason,
    savedAt: Date.now()
  };

  localStorage.setItem(
    STORAGE_PREDICTIONS,
    JSON.stringify(history)
  );

  return changeReason;
}

function getPurchased() {
  try {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_PURCHASED
      ) || "{}"
    );
  } catch {
    return {};
  }
}

function savePurchased(item) {
  const purchased =
    getPurchased();

  const key =
    `${item.stadiumNo}-${item.raceNo}`;

  purchased[key] = {
    key,
    stadiumNo: item.stadiumNo,
    stadiumName: item.stadiumName,
    raceNo: item.raceNo,
    date: item.date || "",
    title: item.title,
    subtitle: item.subtitle,
    grade: item.grade,
    cutoff: item.cutoff,
    mainNo: item.mainNo,
    mainName: item.mainName,
    secondNo: item.secondNo,
    thirdNo: item.thirdNo,
    bets: item.bets,
    confidence: item.confidence,
    level: item.level,
    purchasedAt: Date.now(),
    result: null,
    hit: null
  };

  localStorage.setItem(
    STORAGE_PURCHASED,
    JSON.stringify(purchased)
  );
}

function removePurchased(item) {
  const purchased =
    getPurchased();

  const key =
    `${item.stadiumNo}-${item.raceNo}`;

  delete purchased[key];

  localStorage.setItem(
    STORAGE_PURCHASED,
    JSON.stringify(purchased)
  );
}

function isPurchased(item) {
  const purchased =
    getPurchased();

  return Boolean(
    purchased[
      `${item.stadiumNo}-${item.raceNo}`
    ]
  );
}

function normalizeResult(result) {
  if (!result) return null;

  // 現行APIの結果形式
  // result.racers の place_number を利用
  if (result.racers) {
    const rows = [];

    Object.entries(
      result.racers
    ).forEach(([key, racer]) => {
      const boatNo = safeNumber(
        key,
        safeNumber(
          racer?.entry_number,
          0
        )
      );

      const placeNo =
        safeNumber(
          racer?.place_number,
          0
        );

      if (
        boatNo >= 1 &&
        boatNo <= 6 &&
        placeNo >= 1 &&
        placeNo <= 6
      ) {
        rows.push({
          boatNo,
          placeNo
        });
      }
    });

    rows.sort(
      (a, b) =>
        a.placeNo - b.placeNo
    );

    if (rows.length >= 3) {
      return rows
        .slice(0, 3)
        .map((x) => x.boatNo);
    }
  }

  const order =
    result.order ||
    result.result ||
    result.rankings ||
    result.ranking ||
    result.arrival ||
    result.arrivals;

  if (Array.isArray(order)) {
    const nums = order
      .map((x) => {
        if (typeof x === "number") {
          return x;
        }

        return safeNumber(
          firstValue(
            x?.boat_number,
            x?.boat,
            x?.number,
            x?.entry_number,
            x?.rank_number,
            x
          ),
          0
        );
      })
      .filter(Boolean);

    if (nums.length >= 3) {
      return nums.slice(0, 3);
    }
  }

  if (
    result.first &&
    result.second &&
    result.third
  ) {
    return [
      safeNumber(result.first, 0),
      safeNumber(result.second, 0),
      safeNumber(result.third, 0)
    ].filter(Boolean);
  }

  return null;
}

function checkHit(item, result) {
  const actual =
    normalizeResult(result);

  if (
    !actual ||
    actual.length < 3
  ) {
    return null;
  }

  const key =
    `${item.stadiumNo}-${item.raceNo}`;

  const purchased =
    getPurchased();

  const saved =
    purchased[key];

  if (!saved) return null;

  const bets =
    saved.bets || [];

  const actualText =
    actual.join("-");

  const hit =
    bets.some(
      (bet) =>
        bet === actualText
    );

  saved.result = actual;
  saved.hit = hit;
  saved.resultUpdatedAt =
    Date.now();

  purchased[key] = saved;

  localStorage.setItem(
    STORAGE_PURCHASED,
    JSON.stringify(purchased)
  );

  return hit;
}

function syncPurchasedResults(races) {
  const purchased =
    getPurchased();

  let changed = false;

  races.forEach((race) => {
    const key =
      `${race.stadiumNo}-${race.raceNo}`;

    const saved =
      purchased[key];

    if (!saved) return;
    if (!race.result) return;

    const actual =
      normalizeResult(
        race.result
      );

    if (
      !actual ||
      actual.length < 3
    ) {
      return;
    }

    const actualText =
      actual.join("-");

    const bets =
      saved.bets || [];

    const hit =
      bets.some(
        (bet) =>
          bet === actualText
      );

    if (
      JSON.stringify(saved.result) !==
        JSON.stringify(actual) ||
      saved.hit !== hit
    ) {
      saved.result = actual;
      saved.hit = hit;
      saved.resultUpdatedAt =
        Date.now();

      purchased[key] = saved;
      changed = true;
    }
  });

  if (changed) {
    localStorage.setItem(
      STORAGE_PURCHASED,
      JSON.stringify(purchased)
    );
  }
}

function renderRacer(race, no) {
  const racer =
    getRacer(
      race.racers,
      no
    );

  const preview =
    getPreviewRacer(
      race.previewRacers,
      no
    );

  const name =
    getName(racer);

  const cls =
    getClass(racer);

  const exhibition =
    getExhibition(
      preview
    );

  const st =
    getStartTiming(
      preview
    );

  const course =
    getCourse(preview);

  let detail =
    cls || "";

  if (course) {
    detail +=
      `${detail ? " / " : ""}${course}コース`;
  }

  if (exhibition) {
    detail +=
      `${detail ? " / " : ""}展示 ${exhibition.toFixed(2)}`;
  }

  if (st) {
    detail +=
      `${detail ? " / " : ""}ST ${
        st > 0 ? "+" : ""
      }${st.toFixed(2)}`;
  }

  return `
    <div class="racer">
      <div class="racer-no">${no}</div>

      <div class="racer-info">
        <b>${escapeHtml(name)}</b>
        <span>
          ${escapeHtml(
            detail || "情報なし"
          )}
        </span>
      </div>

      <div class="racer-time">
        ${
          exhibition
            ? exhibition.toFixed(2)
            : "--"
        }
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function renderRace(item) {
  const purchased =
    isPurchased(item);

  const changeReason =
    savePrediction(item);

  const racersHtml =
    [1,2,3,4,5,6]
      .map((no) =>
        renderRacer(
          item,
          no
        )
      )
      .join("");

  const betsHtml =
    item.bets
      .map((bet) => {
        const parts =
          bet.split("-");

        return `
          <div class="bet">
            ${parts
              .map(
                (n, index) =>
                  `${
                    index
                      ? "<i>→</i>"
                      : ""
                  }${n}`
              )
              .join("")}
          </div>
        `;
      })
      .join("");

  const changeHtml =
    changeReason
      ? `
        <div class="change">
          <b>予想変更</b>
          <span>
            ${escapeHtml(
              changeReason
            )}
          </span>
        </div>
      `
      : "";

  return `
    <article
      class="race-card ${
        item.hot ? "hot" : ""
      }"
    >

      <div class="race-top">

        <div>

          <div class="race-title">
            ${item.raceNo}R
            <span class="grade">
              ${escapeHtml(
                item.grade
              )}
            </span>
          </div>

          <div class="event-title">
            ${escapeHtml(
              item.title ||
              "レース"
            )}
          </div>

          <div class="subtitle">
            ${escapeHtml(
              item.subtitle ||
              ""
            )}
          </div>

          <div class="deadline">
            締切
            ${formatTime(
              item.cutoff
            )}
          </div>

        </div>

        <div class="confidence">

          <span
            class="level ${
              item.hot
                ? "hot-level"
                : ""
            }"
          >
            ${item.level}
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
          ${item.mainNo}号艇
          ${escapeHtml(
            item.mainName
          )}
        </div>

        <div class="pick-reason">
          ${escapeHtml(
            item.reason
          )}
        </div>

      </div>

      <div class="place">

        <div>
          <b>2着候補</b>
          ${item.secondNo}号艇
        </div>

        <div>
          <b>3着候補</b>
          ${item.thirdNo}号艇
        </div>

      </div>

      <div class="bets">

        <div class="bets-title">
          推奨買い目
          <small>
            ${item.bets.length}点
          </small>
        </div>

        <div class="bet-list">
          ${betsHtml}
        </div>

      </div>

      ${changeHtml}

      <div class="racers">
        ${racersHtml}
      </div>

      <div class="buy-area">

        <div class="buy-note">
          購入したレースだけ
          履歴・的中率に反映
        </div>

        <button
          class="buy-button ${
            purchased
              ? "purchased"
              : ""
          }"
          data-buy="${
            item.stadiumNo
          }-${item.raceNo}"
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

function renderTabs(items) {
  const tabs =
    $("stadiumTabs");

  if (!tabs) return;

  const counts = {};

  items.forEach(
    (item) => {
      counts[item.stadiumNo] =
        (counts[
          item.stadiumNo
        ] || 0) + 1;
    }
  );

  const stadiumNos =
    Object.keys(counts)
      .map(Number)
      .sort(
        (a, b) => a - b
      );

  tabs.innerHTML = `
    <button
      class="stadium-tab ${
        selectedStadium ===
        "all"
          ? "active"
          : ""
      }"
      data-stadium="all"
    >
      <span>全場</span>
      <small>
        ${items.length}R
      </small>
    </button>

    ${stadiumNos
      .map(
        (no) => `
          <button
            class="stadium-tab ${
              selectedStadium ===
              String(no)
                ? "active"
                : ""
            }"
            data-stadium="${no}"
          >
            <span>
              ${escapeHtml(
                STADIUMS[no]
              )}
            </span>

            <small>
              ${counts[no]}R
            </small>
          </button>
        `
      )
      .join("")}
  `;

  tabs
    .querySelectorAll(
      ".stadium-tab"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            selectedStadium =
              button.dataset.stadium;

            renderMain();
          }
        );
      }
    );
}

function renderMain() {
  const hot =
    allRaces
      .filter(
        (x) =>
          x.hot &&
          isBeforeCutoff(x)
      )
      .sort(
        (a, b) =>
          b.confidence -
          a.confidence
      )
      .slice(0, 3);

  const hotBox =
    $("hotRaces");

  if (hotBox) {
    if (hot.length) {
      hotBox.innerHTML =
        hot
          .map(renderRace)
          .join("");
    } else {
      hotBox.innerHTML = `
        <div class="no-hot">
          現在、激アツ判定のレースはありません。<br>
          次回更新で再分析します。
        </div>
      `;
    }
  }

  const normal =
    allRaces
      .filter(
        (x) => !x.hot
      )
      .filter(
        isBeforeCutoff
      )
      .sort(
        (a, b) =>
          b.confidence -
          a.confidence
      );

  renderTabs(normal);

  const filtered =
    selectedStadium ===
    "all"
      ? normal
      : normal.filter(
          (x) =>
            String(
              x.stadiumNo
            ) ===
            String(
              selectedStadium
            )
        );

  const picks =
    $("picks");

  if (!picks) return;

  if (!filtered.length) {
    picks.innerHTML = `
      <div class="empty">
        現在、この場に推奨レースはありません。
      </div>
    `;
  } else {
    picks.innerHTML =
      filtered
        .map(renderRace)
        .join("");
  }

  bindBuyButtons();
}

function bindBuyButtons() {
  document
    .querySelectorAll(
      "[data-buy]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const key =
              button.dataset.buy;

            const item =
              allRaces.find(
                (x) =>
                  `${x.stadiumNo}-${x.raceNo}` ===
                  key
              );

            if (!item) return;

            if (
              isPurchased(item)
            ) {
              removePurchased(
                item
              );
            } else {
              savePurchased(
                item
              );
            }

            renderMain();
          }
        );
      }
    );
}

async function load() {
  const status =
    $("status");

  if (status) {
    status.textContent =
      "データ取得中…";
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
      extractRaces(data)
        .map(
          normalizeRace
        )
        .filter(
          (race) =>
            race.raceNo >= 1 &&
            race.raceNo <= 12
        );

    // 購入済みレースの結果を自動反映
    syncPurchasedResults(
      races
    );

    const scored =
      races
        .map(scoreRace)
        .filter(Boolean);

    allRaces =
      scored.sort(
        (a, b) =>
          b.confidence -
          a.confidence
      );

    const now =
      new Date();

    if (status) {
      status.textContent =
        `分析完了：${allRaces.length}R`;
    }

    if ($("updatedAt")) {
      $("updatedAt").textContent =
        now.toLocaleTimeString(
          "ja-JP",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        );
    }

    if ($("analysisCount")) {
      $("analysisCount").textContent =
        `分析対象 ${races.length}R`;
    }

    if ($("recommendCount")) {
      $("recommendCount").textContent =
        `推奨 ${
          allRaces.filter(
            (x) =>
              !x.hot &&
              isBeforeCutoff(x)
          ).length
        }R`;
    }

    if ($("hotCount")) {
      $("hotCount").textContent =
        `激アツ ${
          allRaces.filter(
            (x) =>
              x.hot &&
              isBeforeCutoff(x)
          ).length
        }R`;
    }

    renderMain();

    // 購入ページなら成績表示を更新
    if (
      typeof renderPurchasedPage ===
      "function"
    ) {
      renderPurchasedPage();
    }

  } catch (error) {
    console.error(error);

    if (status) {
      status.textContent =
        "データ取得に失敗しました";
    }

    const picks =
      $("picks");

    if (picks) {
      picks.innerHTML = `
        <div class="empty">
          データを取得できませんでした。<br>
          「更新」を押して再試行してください。
        </div>
      `;
    }

    const hot =
      $("hotRaces");

    if (hot) {
      hot.innerHTML = `
        <div class="no-hot">
          データ取得待ちです。
        </div>
      `;
    }
  }
}

function init() {
  const refresh =
    $("refreshBtn");

  if (refresh) {
    refresh.addEventListener(
      "click",
      () => {
        load();
      }
    );
  }

  load();

  setInterval(
    () => {
      load();
    },
    180000
  );
}

document.addEventListener(
  "DOMContentLoaded",
  init
);
