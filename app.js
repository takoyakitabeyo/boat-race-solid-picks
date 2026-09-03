const API = "https://boatraceopenapi.github.io/api/v1/today.json";

const PURCHASED_KEY = "cyber-hacchan-purchased-v2";
const RESULTS_KEY = "boatResults";

const STADIUMS = {
  1:"桐生", 2:"戸田", 3:"江戸川", 4:"平和島", 5:"多摩川",
  6:"浜名湖", 7:"蒲郡", 8:"常滑", 9:"津", 10:"三国",
  11:"びわこ", 12:"住之江", 13:"尼崎", 14:"鳴門",
  15:"丸亀", 16:"児島", 17:"宮島", 18:"徳山",
  19:"下関", 20:"若松", 21:"芦屋", 22:"福岡",
  23:"唐津", 24:"大村"
};

const GRADE_NAMES = {
  1:"一般",
  2:"GIII",
  3:"GII",
  4:"GI",
  5:"SG"
};

const $ = (selector) => document.querySelector(selector);

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

const esc = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

function rankName(rank) {
  return ({
    1:"A1",
    2:"A2",
    3:"B1",
    4:"B2"
  })[Number(rank)] || "-";
}

function fmtTime(value) {
  const match = String(value || "").match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "--:--";
}

function normalizeDate(value) {
  const s = String(value || "");
  const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

  if (!m) return "";

  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

function raceKey(race) {
  return [
    normalizeDate(race.date),
    Number(race.stadium_number),
    Number(race.race_number)
  ].join("-");
}

function getGradeName(race) {
  const n = num(race.grade_number);
  return GRADE_NAMES[n] || "";
}

function getRaceDateTime(race) {
  const date = normalizeDate(race.date);
  const closed = String(race.closed_at || "");

  const time = closed.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);

  if (!date || !time) return null;

  return new Date(
    `${date}T${time[1]}:${time[2]}:${time[3] || "00"}+09:00`
  );
}

function isClosed(race) {
  const dt = getRaceDateTime(race);
  if (!dt) return false;
  return Date.now() >= dt.getTime();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function readPurchased() {
  try {
    const raw = localStorage.getItem(PURCHASED_KEY);
    const data = JSON.parse(raw || "[]");
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function writePurchased(data) {
  try {
    localStorage.setItem(PURCHASED_KEY, JSON.stringify(data));
  } catch (_) {}
}

function readResults() {
  try {
    return JSON.parse(localStorage.getItem(RESULTS_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

function writeResults(data) {
  try {
    localStorage.setItem(RESULTS_KEY, JSON.stringify(data));
  } catch (_) {}
}

/* =========================================================
   API
========================================================= */

async function fetchTimeout(url, timeout = 15000) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
   RESULT
========================================================= */

function extractResultCombination(race) {
  const trifecta =
    race?.result?.payouts?.trifecta;

  if (Array.isArray(trifecta) && trifecta.length) {
    const combination = trifecta[0]?.combination;

    if (combination) {
      return String(combination).replaceAll("=", "-");
    }
  }

  const resultRacers = race?.result?.racers;

  if (resultRacers && typeof resultRacers === "object") {
    const order = Object.values(resultRacers)
      .map((r) => ({
        entry: num(r.entry_number),
        place: num(r.place_number)
      }))
      .filter((r) => r.entry && r.place)
      .sort((a, b) => a.place - b.place)
      .slice(0, 3)
      .map((r) => r.entry);

    if (order.length === 3) {
      return order.join("-");
    }
  }

  return "";
}

function saveRaceResult(race) {
  const combination = extractResultCombination(race);

  if (!combination) return;

  const key = raceKey(race);
  const results = readResults();

  results[key] = {
    combination,
    date: normalizeDate(race.date),
    stadium_number: Number(race.stadium_number),
    race_number: Number(race.race_number),
    updatedAt: new Date().toISOString()
  };

  writeResults(results);
}

/* =========================================================
   RACER NORMALIZATION
========================================================= */

function getRacers(race) {
  const racers = race?.racers;

  if (!racers || typeof racers !== "object") {
    return [];
  }

  return Object.values(racers)
    .map((r) => ({
      ...r,
      entry_number: num(r.entry_number)
    }))
    .filter((r) => r.entry_number)
    .sort((a, b) => a.entry_number - b.entry_number);
}

function getPreview(race) {
  const racers = race?.preview?.racers;

  return racers && typeof racers === "object"
    ? racers
    : {};
}

function previewFor(preview, entry) {
  return preview[String(entry)] || {};
}

/* =========================================================
   SCORING
========================================================= */

function scoreRacer(racer, preview) {
  const entry = num(racer.entry_number);
  const p = previewFor(preview, entry);

  let score = 0;

  const rank = num(racer.rank_number);
  const nationalWin = num(racer.national_win_rate);
  const localWin = num(racer.local_win_rate);
  const nationalTop3 = num(racer.national_top_3_percent);
  const localTop3 = num(racer.local_top_3_percent);
  const motorTop3 = num(racer.motor_top_3_percent);
  const boatTop3 = num(racer.boat_top_3_percent);
  const averageST = num(racer.average_start_timing);

  /* 選手級別 */
  score += ({
    1: 22,
    2: 16,
    3: 10,
    4: 5
  })[rank] || 0;

  /* 全国成績 */
  if (nationalWin !== null) {
    score += clamp(nationalWin * 3.0, 0, 22);
  }

  if (nationalTop3 !== null) {
    score += clamp(nationalTop3 * 0.10, 0, 10);
  }

  /* 当地成績 */
  if (localWin !== null) {
    score += clamp(localWin * 1.8, 0, 11);
  }

  if (localTop3 !== null) {
    score += clamp(localTop3 * 0.055, 0, 5);
  }

  /* モーター */
  if (motorTop3 !== null) {
    score += clamp(motorTop3 * 0.055, 0, 6);
  }

  /* ボート */
  if (boatTop3 !== null) {
    score += clamp(boatTop3 * 0.025, 0, 3);
  }

  /* 平均ST */
  if (averageST !== null) {
    score += clamp((0.25 - averageST) * 30, -5, 7);
  }

  /* 進入 */
  const course = num(p.course_number);

  if (course !== null) {
    if (course === 1) score += 9;
    else if (course === 2) score += 4;
    else if (course === 3) score += 2;
  }

  /* 展示タイム */
  const exhibition = num(p.exhibition_time);

  if (exhibition !== null) {
    score += clamp((6.90 - exhibition) * 7, -5, 8);
  }

  /* 展示ST */
  const exhibitionST =
    num(p.start_timing ?? p.exhibition_start_timing);

  if (exhibitionST !== null) {
    if (exhibitionST <= 0.10) score += 4;
    else if (exhibitionST <= 0.14) score += 2;
    else if (exhibitionST >= 0.20) score -= 4;
  }

  return {
    racer,
    preview: p,
    entry,
    score
  };
}

/* =========================================================
   RACE ANALYSIS
========================================================= */

function analyzeRace(race) {
  const racers = getRacers(race);

  if (racers.length !== 6) {
    return null;
  }

  const preview = getPreview(race);

  const scored = racers
    .map((r) => scoreRacer(r, preview))
    .sort((a, b) => b.score - a.score);

  if (scored.length !== 6) {
    return null;
  }

  const first = scored[0];
  const second = scored[1];
  const third = scored[2];
  const fourth = scored[3];

  const firstOriginal = racers.find(
    (r) => r.entry_number === 1
  );

  const firstOriginalScore = scored.find(
    (x) => x.entry === 1
  );

  let confidence = 50;

  /* 1着候補の強さ */
  confidence += clamp(
    (first.score - 25) * 0.75,
    0,
    25
  );

  /* 1位と2位の差 */
  confidence += clamp(
    (first.score - second.score) * 0.55,
    0,
    18
  );

  /* 1号艇評価 */
  if (first.entry === 1) {
    confidence += 8;
  } else {
    confidence -= 2;
  }

  /* A1のイン逃げなどを強く評価 */
  if (
    firstOriginal &&
    firstOriginal.entry_number === 1 &&
    num(firstOriginal.rank_number) === 1
  ) {
    confidence += 5;
  }

  /* 展示で1号艇が悪化している場合 */
  const p1 = previewFor(preview, 1);
  const p1Time = num(p1.exhibition_time);

  if (p1Time !== null) {
    const exhibitionRanks = scored
      .map((x) => ({
        entry: x.entry,
        time: num(
          previewFor(preview, x.entry).exhibition_time
        )
      }))
      .filter((x) => x.time !== null)
      .sort((a, b) => a.time - b.time);

    const position = exhibitionRanks.findIndex(
      (x) => x.entry === 1
    );

    if (position === 0) confidence += 5;
    else if (position === 1) confidence += 2;
    else if (position >= 4) confidence -= 6;
  }

  /* 1号艇展示ST */
  const p1st = num(
    p1.start_timing ??
    p1.exhibition_start_timing
  );

  if (p1st !== null) {
    if (p1st <= 0.10) confidence += 4;
    else if (p1st >= 0.20) confidence -= 4;
  }

  /* 1号艇の総合力が低すぎる場合 */
  if (
    firstOriginalScore &&
    firstOriginalScore.score < second.score
  ) {
    confidence -= 3;
  }

  confidence = Math.round(
    clamp(confidence, 0, 99)
  );

  let level = "候補";
  let points = 8;

  if (confidence >= 88) {
    level = "激アツ";
    points = 2;
  } else if (confidence >= 78) {
    level = "本命";
    points = 4;
  } else if (confidence >= 69) {
    level = "有力";
    points = 6;
  }

  /*
   * あまりに拮抗しているレースは
   * 「固いレース」として表示しない。
   */
  const gap = first.score - second.score;

  if (gap < 5 && confidence < 78) {
    return null;
  }

  /*
   * 1着候補と2着候補が極端に弱い場合も除外。
   */
  if (first.score < 45) {
    return null;
  }

  const reason = buildReason(
    race,
    scored,
    confidence
  );

  const bets = makeBets({
    first,
    second,
    third,
    fourth,
    points,
    race
  });

  if (!bets.length) {
    return null;
  }

  return {
    race,
    racers,
    preview,
    scored,
    first,
    second,
    third,
    fourth,
    confidence,
    level,
    points,
    reason,
    bets
  };
}

/* =========================================================
   REASON
========================================================= */

function buildReason(race, scored, confidence) {
  const first = scored[0];
  const p = first.preview;
  const r = first.racer;

  const parts = [];

  if (num(r.rank_number) !== null) {
    parts.push(rankName(r.rank_number));
  }

  if (num(r.national_win_rate) !== null) {
    parts.push(
      `全国勝率 ${num(r.national_win_rate).toFixed(2)}`
    );
  }

  if (num(r.local_win_rate) !== null) {
    parts.push(
      `当地勝率 ${num(r.local_win_rate).toFixed(2)}`
    );
  }

  if (num(r.national_top_3_percent) !== null) {
    parts.push(
      `全国3連対率 ${num(r.national_top_3_percent).toFixed(1)}%`
    );
  }

  if (num(p.exhibition_time) !== null) {
    parts.push(
      `展示 ${num(p.exhibition_time).toFixed(2)}`
    );
  }

  const st = num(
    p.start_timing ??
    p.exhibition_start_timing
  );

  if (st !== null) {
    parts.push(
      `展示ST ${st.toFixed(2)}`
    );
  }

  if (first.entry === 1) {
    parts.unshift("イン本線");
  } else {
    parts.unshift(
      `${first.entry}号艇を1着本線`
    );
  }

  if (confidence >= 88) {
    parts.push("軸の信頼度が非常に高い");
  } else if (confidence >= 78) {
    parts.push("軸として有力");
  } else if (confidence >= 69) {
    parts.push("上位評価");
  }

  return parts.join(" / ");
}

/* =========================================================
   BET CREATION
========================================================= */

function makeBets({
  first,
  second,
  third,
  fourth,
  points,
  race
}) {
  const a = first.entry;
  const b = second.entry;
  const c = third.entry;
  const d = fourth.entry;

  const candidates = [];

  /*
   * 1着候補は分析結果のトップを使用。
   * 1号艇固定にはしない。
   */

  if (points <= 2) {
    candidates.push(
      `${a}-${b}-${c}`,
      `${a}-${c}-${b}`
    );
  }

  else if (points <= 4) {
    candidates.push(
      `${a}-${b}-${c}`,
      `${a}-${c}-${b}`,
      `${a}-${b}-${d}`,
      `${a}-${c}-${d}`
    );
  }

  else if (points <= 6) {
    candidates.push(
      `${a}-${b}-${c}`,
      `${a}-${c}-${b}`,
      `${a}-${b}-${d}`,
      `${a}-${d}-${b}`,
      `${a}-${c}-${d}`,
      `${a}-${d}-${c}`
    );
  }

  else {
    candidates.push(
      `${a}-${b}-${c}`,
      `${a}-${c}-${b}`,
      `${a}-${b}-${d}`,
      `${a}-${d}-${b}`,
      `${a}-${c}-${d}`,
      `${a}-${d}-${c}`,
      `${a}-${b}-${fourth.entry}`,
      `${a}-${fourth.entry}-${b}`
    );
  }

  const unique = [
    ...new Set(
      candidates.filter((x) => {
        const parts = x.split("-").map(Number);

        return (
          parts.length === 3 &&
          parts.every((n) => n >= 1 && n <= 6) &&
          new Set(parts).size === 3
        );
      })
    )
  ];

  return unique.slice(0, points);
}

/* =========================================================
   PURCHASE
========================================================= */

function isPurchased(race) {
  const key = raceKey(race);

  return readPurchased().some(
    (item) => item.raceKey === key
  );
}

function purchaseRace(analysis) {
  const race = analysis.race;
  const key = raceKey(race);

  const purchased = readPurchased();

  const index = purchased.findIndex(
    (item) => item.raceKey === key
  );

  const item = {
    raceKey: key,
    date: normalizeDate(race.date),
    purchasedAt: new Date().toISOString(),

    stadium_number: Number(race.stadium_number),
    stadium_name:
      STADIUMS[Number(race.stadium_number)] || "",

    race_number: Number(race.race_number),

    title: race.title || "",
    subtitle: race.subtitle || "",
    grade_number: num(race.grade_number),
    grade: getGradeName(race),

    closed_at: race.closed_at || "",

    confidence: analysis.confidence,
    level: analysis.level,
    points: analysis.points,

    main: {
      entry: analysis.first.entry,
      name: analysis.first.racer.name || ""
    },

    bets: analysis.bets.slice(),

    reason: analysis.reason
  };

  if (index >= 0) {
    purchased[index] = {
      ...purchased[index],
      ...item,
      purchasedAt:
        purchased[index].purchasedAt ||
        item.purchasedAt
    };
  } else {
    purchased.push(item);
  }

  writePurchased(purchased);

  renderCurrentPurchaseState();
}

function renderCurrentPurchaseState() {
  document
    .querySelectorAll("[data-buy-key]")
    .forEach((button) => {
      const key = button.dataset.buyKey;

      const purchased = readPurchased().some(
        (item) => item.raceKey === key
      );

      if (purchased) {
        button.textContent = "購入済み";
        button.classList.add("purchased");
      } else {
        button.textContent = "買った";
        button.classList.remove("purchased");
      }
    });
}

/* =========================================================
   DETAIL
========================================================= */

function createDetailHTML(analysis) {
  const rows = analysis.scored
    .map((item, index) => {
      const r = item.racer;
      const p = item.preview;

      const exhibition =
        num(p.exhibition_time) !== null
          ? num(p.exhibition_time).toFixed(2)
          : "-";

      const st =
        num(
          p.start_timing ??
          p.exhibition_start_timing
        ) !== null
          ? num(
              p.start_timing ??
              p.exhibition_start_timing
            ).toFixed(2)
          : "-";

      return `
        <div style="
          display:grid;
          grid-template-columns:28px 1fr auto;
          gap:7px;
          align-items:center;
          padding:7px 0;
          border-bottom:1px solid #172d43;
          color:#aebdca;
          font-size:9px;
        ">
          <b style="color:#dbe8f3;">${index + 1}</b>
          <span>
            ${esc(r.entry_number)}号艇
            ${esc(r.name)}
            <small style="color:#60758a;">
              ${rankName(r.rank_number)}
            </small>
          </span>
          <span style="color:#71869b;">
            展示 ${exhibition}<br>
            ST ${st}
          </span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="race-detail"
      style="
        display:none;
        margin-top:10px;
        padding:10px;
        border-radius:9px;
        background:#091725;
      "
    >
      <div style="
        margin-bottom:7px;
        color:#8095a9;
        font-size:9px;
        font-weight:900;
      ">
        詳細分析
      </div>

      ${rows}

      <div style="
        margin-top:9px;
        color:#60758a;
        font-size:8px;
        line-height:1.7;
      ">
        上位評価：
        ${analysis.scored
          .slice(0, 4)
          .map((x) => `${x.entry}号艇`)
          .join(" → ")}
        <br>
        1着候補：
        ${analysis.first.entry}号艇
        ${esc(analysis.first.racer.name || "")}
        <br>
        評価差：
        ${Math.max(
          0,
          analysis.first.score -
          analysis.second.score
        ).toFixed(1)}
      </div>
    </div>
  `;
}

/* =========================================================
   RENDER
========================================================= */

function renderBet(bet) {
  const parts = bet.split("-");

  return `
    <div class="bet">
      ${esc(parts[0])}
      <i>→</i>
      ${esc(parts[1])}
      <i>→</i>
      ${esc(parts[2])}
    </div>
  `;
}

function renderRaceCard(analysis, hot = false) {
  const race = analysis.race;

  const stadium =
    STADIUMS[Number(race.stadium_number)] ||
    `場${race.stadium_number}`;

  const grade = getGradeName(race);

  const purchased = isPurchased(race);

  const racersHTML = analysis.racers
    .map((r) => {
      const p = previewFor(
        analysis.preview,
        r.entry_number
      );

      const exhibition =
        num(p.exhibition_time) !== null
          ? `展示 ${num(p.exhibition_time).toFixed(2)}`
          : "";

      return `
        <div class="racer">
          <div class="racer-no">
            ${esc(r.entry_number)}
          </div>

          <div class="racer-info">
            <b>${esc(r.name || "-")}</b>
            <span>${rankName(r.rank_number)}</span>
          </div>

          <div class="racer-time">
            ${esc(exhibition)}
          </div>
        </div>
      `;
    })
    .join("");

  const betsHTML = analysis.bets
    .map(renderBet)
    .join("");

  return `
    <article
      class="race-card ${hot ? "hot" : ""}"
      data-race-card="${esc(raceKey(race))}"
    >

      <div class="race-top">

        <div>
          <div class="race-title">
            ${esc(stadium)}
            ${esc(race.race_number)}R

            ${
              grade
                ? `<span class="grade">${esc(grade)}</span>`
                : ""
            }
          </div>

          <div class="event-title">
            ${esc(race.title || "レース")}
          </div>

          ${
            race.subtitle
              ? `<div class="subtitle">${esc(race.subtitle)}</div>`
              : ""
          }

          <div class="deadline">
            締切 ${fmtTime(race.closed_at)}
          </div>
        </div>

        <div class="confidence">
          <span class="level ${
            hot ? "hot-level" : ""
          }">
            ${esc(analysis.level)}
          </span>

          <strong>
            ${analysis.confidence}
          </strong>

          <small>自信度</small>
        </div>

      </div>

      <div class="main-pick">

        <div class="pick-label">
          1着本命
        </div>

        <div class="pick-name">
          ① ${esc(analysis.first.racer.name || "-")}
          <span style="
            color:#71869b;
            font-size:11px;
            font-weight:800;
          ">
            (${analysis.first.entry}号艇)
          </span>
        </div>

        <div class="pick-reason">
          ${esc(analysis.reason)}
        </div>

      </div>

      <div class="place">

        <div>
          <b>2着本線</b>
          ${esc(analysis.second.entry)}号艇
          ${esc(analysis.second.racer.name || "")}
        </div>

        <div>
          <b>3着本線</b>
          ${esc(analysis.third.entry)}号艇
          ${esc(analysis.third.racer.name || "")}
        </div>

      </div>

      <div class="bets">

        <div class="bets-title">
          推奨買い目 ${analysis.bets.length}点
        </div>

        <div class="bet-list">
          ${betsHTML}
        </div>

      </div>

      <div class="buy-area">

        <div class="buy-note">
          ${analysis.level}
          ／
          ${analysis.bets.length}点
        </div>

        <button
          class="buy-button ${
            purchased ? "purchased" : ""
          }"
          data-buy-key="${esc(raceKey(race))}"
          type="button"
        >
          ${purchased ? "購入済み" : "買った"}
        </button>

      </div>

      <div
        style="
          margin-top:7px;
          text-align:right;
        "
      >
        <button
          type="button"
          data-detail-button="${esc(raceKey(race))}"
          style="
            border:0;
            background:none;
            color:#607b92;
            font-size:9px;
            font-weight:800;
            cursor:pointer;
            padding:4px 0;
          "
        >
          詳細を見る
        </button>
      </div>

      ${createDetailHTML(analysis)}

      <div class="racers">
        ${racersHTML}
      </div>

    </article>
  `;
}

/* =========================================================
   STADIUM TABS
========================================================= */

let currentStadium = "all";
let currentAnalyses = [];

function buildStadiumTabs(analyses) {
  const container = $("#stadiumTabs");

  if (!container) return;

  const groups = {};

  analyses.forEach((analysis) => {
    const stadium =
      Number(analysis.race.stadium_number);

    groups[stadium] =
      (groups[stadium] || 0) + 1;
  });

  const stadiumNumbers = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b);

  if (
    currentStadium !== "all" &&
    !groups[Number(currentStadium)]
  ) {
    currentStadium = "all";
  }

  let html = `
    <button
      type="button"
      class="stadium-tab ${
        currentStadium === "all"
          ? "active"
          : ""
      }"
      data-stadium="all"
    >
      <span>全て</span>
      <small>${analyses.length}R</small>
    </button>
  `;

  stadiumNumbers.forEach((number) => {
    html += `
      <button
        type="button"
        class="stadium-tab ${
          String(number) === String(currentStadium)
            ? "active"
            : ""
        }"
        data-stadium="${number}"
      >
        <span>
          ${esc(STADIUMS[number] || `場${number}`)}
        </span>
        <small>${groups[number]}R</small>
      </button>
    `;
  });

  container.innerHTML = html;
}

function renderNormalRaces() {
  const container = $("#picks");

  if (!container) return;

  let list = currentAnalyses;

  if (currentStadium !== "all") {
    list = list.filter(
      (analysis) =>
        String(
          analysis.race.stadium_number
        ) === String(currentStadium)
    );
  }

  if (!list.length) {
    container.innerHTML = `
      <div class="empty">
        <b>この競艇場には現在おすすめレースがありません。</b>
      </div>
    `;
    return;
  }

  container.innerHTML = list
    .map((analysis) =>
      renderRaceCard(
        analysis,
        false
      )
    )
    .join("");

  bindRaceEvents();
}

/* =========================================================
   EVENTS
========================================================= */

function bindRaceEvents() {
  document
    .querySelectorAll("[data-buy-key]")
    .forEach((button) => {

      button.addEventListener("click", () => {

        const key =
          button.dataset.buyKey;

        const analysis =
          currentAnalyses.find(
            (item) =>
              raceKey(item.race) === key
          );

        if (!analysis) return;

        purchaseRace(analysis);
      });
    });

  document
    .querySelectorAll("[data-detail-button]")
    .forEach((button) => {

      button.addEventListener("click", () => {

        const key =
          button.dataset.detailButton;

        const card =
          document.querySelector(
            `[data-race-card="${CSS.escape(key)}"]`
          );

        if (!card) return;

        const detail =
          card.querySelector(".race-detail");

        if (!detail) return;

        const hidden =
          getComputedStyle(detail).display === "none";

        detail.style.display =
          hidden ? "block" : "none";

        button.textContent =
          hidden
            ? "詳細を閉じる"
            : "詳細を見る";
      });
    });
}

function bindTabs() {
  const container = $("#stadiumTabs");

  if (!container) return;

  container.addEventListener("click", (event) => {

    const button =
      event.target.closest(
        "[data-stadium]"
      );

    if (!button) return;

    currentStadium =
      button.dataset.stadium || "all";

    buildStadiumTabs(currentAnalyses);
    renderNormalRaces();
  });
}

/* =========================================================
   HOT RACES
========================================================= */

function renderHotRaces(analyses) {
  const container = $("#hotRaces");

  if (!container) return;

  const hot = analyses
    .filter(
      (analysis) =>
        analysis.level === "激アツ"
    )
    .sort(
      (a, b) =>
        b.confidence -
        a.confidence
    )
    .slice(0, 3);

  if (!hot.length) {
    container.innerHTML = `
      <div class="no-hot">
        現時点で「激アツ」と判断できるレースはありません。
      </div>
    `;

    return;
  }

  container.innerHTML = hot
    .map((analysis) =>
      renderRaceCard(
        analysis,
        true
      )
    )
    .join("");

  bindRaceEvents();
}

/* =========================================================
   MAIN LOAD
========================================================= */

async function load() {
  const status = $("#status");

  if (!status) return;

  status.textContent =
    "データ取得中…";

  if ($("#hotRaces")) {
    $("#hotRaces").innerHTML = `
      <div class="loading">
        データ取得中…
      </div>
    `;
  }

  if ($("#picks")) {
    $("#picks").innerHTML = `
      <div class="loading">
        全開催場を分析しています…
      </div>
    `;
  }

  try {
    const response =
      await fetchTimeout(API, 15000);

    if (!response.ok) {
      throw new Error(
        `API ${response.status}`
      );
    }

    const data =
      await response.json();

    const stadiums =
      data?.programs?.stadiums;

    if (
      !stadiums ||
      typeof stadiums !== "object"
    ) {
      throw new Error(
        "stadiums data missing"
      );
    }

    const allRaces = [];

    for (
      const stadium of Object.values(stadiums)
    ) {

      if (
        !stadium ||
        !stadium.races ||
        typeof stadium.races !== "object"
      ) {
        continue;
      }

      for (
        const race of Object.values(
          stadium.races
        )
      ) {

        if (!race) continue;

        /*
         * APIに存在する実レースのみ採用。
         */
        const racers =
          getRacers(race);

        if (racers.length !== 6) {
          continue;
        }

        /*
         * 結果が存在するレースは
         * 結果を保存して予想一覧から除外。
         */
        if (
          race.result &&
          race.result.racers
        ) {
          saveRaceResult(race);
          continue;
        }

        allRaces.push(race);
      }
    }

    /*
     * 締切済みを通常一覧から除外。
     * ただし分析対象カウントは
     * 「今日APIから取得できたレース」を基本にする。
     */
    const openRaces =
      allRaces.filter(
        (race) => !isClosed(race)
      );

    const analyses = [];

    for (
      const race of openRaces
    ) {
      const analysis =
        analyzeRace(race);

      if (analysis) {
        analyses.push(analysis);
      }
    }

    /*
     * 自信度順。
     * 同点なら締切が早い順。
     */
    analyses.sort((a, b) => {

      const confidenceDiff =
        b.confidence -
        a.confidence;

      if (confidenceDiff !== 0) {
        return confidenceDiff;
      }

      const ta =
        getRaceDateTime(a.race)?.getTime() ||
        Number.MAX_SAFE_INTEGER;

      const tb =
        getRaceDateTime(b.race)?.getTime() ||
        Number.MAX_SAFE_INTEGER;

      return ta - tb;
    });

    currentAnalyses = analyses;

    /*
     * 日付表示
     */
    const today =
      allRaces[0]?.date ||
      data?.date ||
      new Date().toISOString().slice(0, 10);

    const dateText =
      normalizeDate(today);

    if ($("#analysisCount")) {
      $("#analysisCount").textContent =
        `分析対象 ${allRaces.length}R`;
    }

    if ($("#recommendCount")) {
      $("#recommendCount").textContent =
        `推奨 ${analyses.length}R`;
    }

    if ($("#hotCount")) {
      $("#hotCount").textContent =
        `激アツ ${
          analyses.filter(
            (x) => x.level === "激アツ"
          ).length
        }R`;
    }

    if ($("#updatedAt")) {
      $("#updatedAt").textContent =
        `更新 ${new Date().toLocaleTimeString(
          "ja-JP",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        )}`;
    }

    /*
     * ステータス
     */
    if (analyses.length) {
      const hotCount =
        analyses.filter(
          (x) =>
            x.level === "激アツ"
        ).length;

      status.textContent =
        hotCount
          ? `${analyses.length}レースを推奨中（激アツ ${hotCount}R）`
          : `${analyses.length}レースを推奨中`;
    } else {
      status.textContent =
        "現時点で推奨できるレースはありません";
    }

    /*
     * 激アツ
     */
    renderHotRaces(analyses);

    /*
     * 通常タブ
     */
    buildStadiumTabs(analyses);

    renderNormalRaces();

    /*
     * 最終更新保存
     */
    localStorage.setItem(
      "lastLoaded",
      new Date().toISOString()
    );

  } catch (error) {

    console.error(
      "Cyber Hacchan API error:",
      error
    );

    status.textContent =
      "データを取得できませんでした";

    if ($("#analysisCount")) {
      $("#analysisCount").textContent =
        "分析対象 --";
    }

    if ($("#recommendCount")) {
      $("#recommendCount").textContent =
        "推奨 --";
    }

    if ($("#hotCount")) {
      $("#hotCount").textContent =
        "激アツ --";
    }

    if ($("#hotRaces")) {
      $("#hotRaces").innerHTML = `
        <div class="no-hot">
          レースデータを取得できませんでした。<br>
          <span style="
            display:block;
            margin-top:5px;
            color:#53697e;
            font-size:9px;
          ">
            「更新」を押して再取得してください。
          </span>
        </div>
      `;
    }

    if ($("#picks")) {
      $("#picks").innerHTML = `
        <div class="empty">
          <b>レースデータを取得できませんでした。</b>
          <br>
          <span class="muted">
            APIまたは通信状態を確認して、
            もう一度「更新」を押してください。
          </span>
        </div>
      `;
    }
  }
}

/* =========================================================
   PURCHASE BUTTON STATE
========================================================= */

function refreshPurchaseButtons() {
  const purchased =
    readPurchased();

  document
    .querySelectorAll("[data-buy-key]")
    .forEach((button) => {

      const key =
        button.dataset.buyKey;

      const exists =
        purchased.some(
          (item) =>
            item.raceKey === key
        );

      if (exists) {
        button.textContent =
          "購入済み";

        button.classList.add(
          "purchased"
        );
      } else {
        button.textContent =
          "買った";

        button.classList.remove(
          "purchased"
        );
      }
    });
}

/* =========================================================
   INITIALIZE
========================================================= */

$("#refreshBtn")?.addEventListener(
  "click",
  () => load()
);

bindTabs();

load();

/*
 * APIは約3分間隔で更新されるため、
 * アプリ側も3分ごとに再取得。
 */
setInterval(
  () => load(),
  180000
);

/*
 * ページ復帰時にも取得。
 */
document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState === "visible"
    ) {
      load();
    }
  }
);
