const API = "https://boatraceopenapi.github.io/api/v1/today.json";

const STADIUMS = {
  1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",
  7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",
  13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",
  19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村"
};

const GRADE = {
  1:"SG",
  2:"GⅠ",
  3:"GⅡ",
  4:"GⅢ",
  5:"一般"
};

const RANK = {
  1:"A1",
  2:"A2",
  3:"B1",
  4:"B2"
};

const $ = s => document.querySelector(s);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function rankName(v) {
  return RANK[num(v)] || "-";
}

function gradeName(v) {
  return GRADE[num(v)] || "一般";
}

function fmtTime(v) {
  if (!v) return "--:--";

  const m = String(v).match(/(\d{2}):(\d{2})/);

  return m ? `${m[1]}:${m[2]}` : "--:--";
}

function storageGet(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/* =========================
   予想スコア
========================= */

function scoreRace(r) {

  const racers = Object.values(r.racers || {})
    .sort((a,b) => num(a.entry_number) - num(b.entry_number));

  if (racers.length !== 6) return null;

  const preview = r.preview?.racers || {};

  const one = racers.find(x => num(x.entry_number) === 1);

  if (!one) return null;

  const p1 = preview["1"] || {};

  const rank1 = num(one.rank_number);

  let score = 0;

  /* 級別 */
  score += ({
    1:22,
    2:15,
    3:8,
    4:2
  }[rank1] || 0);

  /* 全国勝率 */
  score += clamp(
    (num(one.national_win_rate) || 0) * 3.2,
    0,
    24
  );

  /* 当地勝率 */
  score += clamp(
    (num(one.local_win_rate) || 0) * 2.2,
    0,
    14
  );

  /* 全国3連対率 */
  score += clamp(
    (num(one.national_top_3_percent) || 0) * 0.10,
    0,
    9
  );

  /* 当地3連対率 */
  score += clamp(
    (num(one.local_top_3_percent) || 0) * 0.06,
    0,
    5
  );

  /* モーター */
  score += clamp(
    (num(one.motor_top_3_percent) || 0) * 0.05,
    0,
    4
  );

  /* 平均ST */
  const avgST = num(one.average_start_timing);

  if (avgST !== null) {
    score += clamp(
      (0.25 - avgST) * 25,
      -3,
      5
    );
  }

  /* 1号艇 */
  score += 5;

  /* 展示タイム */
  const exhibition = racers.map(x => ({
    boat: num(x.entry_number),
    time: num(preview[String(x.entry_number)]?.exhibition_time)
  })).filter(x => x.time !== null);

  if (exhibition.length === 6) {

    exhibition.sort((a,b) => a.time - b.time);

    const pos = exhibition.findIndex(x => x.boat === 1);

    if (pos === 0) score += 6;
    else if (pos === 1) score += 2;
    else if (pos >= 4) score -= 5;
  }

  /* 展示ST */
  const st = num(p1.start_timing);

  if (st !== null) {

    if (st <= 0.10) score += 3;
    else if (st >= 0.20) score -= 3;
  }

  /* 2・3着候補 */
  const candidates = racers.slice(1).map(x => {

    const p = preview[String(x.entry_number)] || {};

    let v = 0;

    v += ({
      1:17,
      2:13,
      3:8,
      4:3
    }[num(x.rank_number)] || 0);

    v += clamp(
      (num(x.national_win_rate) || 0) * 1.8,
      0,
      12
    );

    v += clamp(
      (num(x.national_top_3_percent) || 0) * 0.08,
      0,
      7
    );

    v += clamp(
      (num(x.local_top_3_percent) || 0) * 0.04,
      0,
      4
    );

    v += clamp(
      (num(x.motor_top_3_percent) || 0) * 0.04,
      0,
      4
    );

    if (num(p.course_number) !== null &&
        num(p.course_number) <= 3) {
      v += 2;
    }

    const et = num(p.exhibition_time);

    if (et !== null) {
      v += Math.max(0, 1 - et) * 8;
    }

    return {
      boat: num(x.entry_number),
      name: x.name,
      value: v
    };

  }).sort((a,b) => b.value - a.value);

  const confidence = clamp(
    Math.round(score),
    0,
    100
  );

  /*
    あまり厳しすぎる条件にすると
    「出走表はあるのに推奨なし」
    になりやすいため、今回は
    信頼度を中心に判定する。
  */

  const safe =
    confidence >= 62 &&
    rank1 <= 2 &&
    (num(one.national_top_3_percent) || 0) >= 45;

  const hot =
    confidence >= 82 &&
    rank1 === 1 &&
    (num(one.national_win_rate) || 0) >= 6.8;

  return {
    race: r,
    one,
    racers,
    preview,
    confidence,
    safe,
    hot,
    second: candidates[0]?.boat || null,
    third: candidates[1]?.boat || null,
    fourth: candidates[2]?.boat || null
  };
}

/* =========================
   買い目
========================= */

function combinations(x) {

  if (!x.second) return [];

  const result = [
    `1-${x.second}-${x.third}`,
    `1-${x.third}-${x.second}`
  ];

  if (x.fourth) {
    result.push(`1-${x.second}-${x.fourth}`);
    result.push(`1-${x.fourth}-${x.second}`);
  }

  return [...new Set(result)];
}

/* =========================
   予想理由
========================= */

function makeReasons(x) {

  const o = x.one;
  const p = x.preview["1"] || {};

  const reasons = [];

  reasons.push(
    `${rankName(o.rank_number)}`
  );

  if (num(o.national_win_rate) !== null) {
    reasons.push(
      `全国勝率 ${num(o.national_win_rate).toFixed(2)}`
    );
  }

  if (num(o.local_win_rate) !== null) {
    reasons.push(
      `当地勝率 ${num(o.local_win_rate).toFixed(2)}`
    );
  }

  if (num(o.national_top_3_percent) !== null) {
    reasons.push(
      `全国3連対率 ${num(o.national_top_3_percent).toFixed(1)}%`
    );
  }

  if (num(o.motor_top_3_percent) !== null) {
    reasons.push(
      `モーター3連対率 ${num(o.motor_top_3_percent).toFixed(1)}%`
    );
  }

  if (num(p.exhibition_time) !== null) {
    reasons.push(
      `展示 ${num(p.exhibition_time).toFixed(2)}`
    );
  }

  if (num(p.course_number) !== null) {
    reasons.push(
      `進入 ${num(p.course_number)}コース`
    );
  }

  if (num(p.start_timing) !== null) {
    reasons.push(
      `展示ST ${num(p.start_timing).toFixed(2)}`
    );
  }

  return reasons.join(" / ");
}

/* =========================
   変更理由
========================= */

function makeChangeReason(x) {

  const p = x.preview["1"] || {};

  const reasons = [];

  if (num(p.course_number) !== null &&
      num(p.course_number) !== 1) {

    reasons.push(
      `進入 ${num(p.course_number)}コース`
    );
  }

  if (num(p.exhibition_time) !== null) {

    reasons.push(
      `展示 ${num(p.exhibition_time).toFixed(2)}秒`
    );
  }

  if (num(p.start_timing) !== null) {

    reasons.push(
      `展示ST ${num(p.start_timing).toFixed(2)}`
    );
  }

  if (!reasons.length) {
    return "出走表・選手成績を再評価";
  }

  return reasons.join(" / ");
}

/* =========================
   的中率
========================= */

function updateStats() {

  const history = storageGet(
    "cyberHacchanHistory",
    []
  );

  const today = new Date()
    .toLocaleDateString("sv-SE");

  const month = today.slice(0,7);

  function calc(list) {

    const settled = list.filter(x => x.result !== null);

    const hit = settled.filter(x => x.hit);

    return {
      total: settled.length,
      hit: hit.length,
      rate: settled.length
        ? Math.round(hit.length / settled.length * 100)
        : 0
    };
  }

  const all = calc(history);

  const day = calc(
    history.filter(x => x.date === today)
  );

  const monthly = calc(
    history.filter(x => String(x.date).startsWith(month))
  );

  const old = $("#stats");

  if (!old) return;

  old.innerHTML = `
    <div class="stat-box">
      <b>今日</b>
      <strong>${day.rate}%</strong>
      <span>${day.hit}/${day.total}</span>
    </div>

    <div class="stat-box">
      <b>今月</b>
      <strong>${monthly.rate}%</strong>
      <span>${monthly.hit}/${monthly.total}</span>
    </div>

    <div class="stat-box">
      <b>累計</b>
      <strong>${all.rate}%</strong>
      <span>${all.hit}/${all.total}</span>
    </div>
  `;
}

/* =========================
   予想履歴保存
========================= */

function savePrediction(x) {

  const r = x.race;

  const key =
    `${r.date}-${r.stadium_number}-${r.race_number}`;

  const history = storageGet(
    "cyberHacchanHistory",
    []
  );

  const exists = history.find(
    h => h.key === key
  );

  if (!exists) {

    history.push({
      key,
      date: r.date,
      stadium: r.stadium_number,
      race: r.race_number,
      picks: combinations(x),
      confidence: x.confidence,
      result: null,
      hit: false
    });

    storageSet(
      "cyberHacchanHistory",
      history
    );
  }
}

/* =========================
   結果反映
========================= */

function updateResults(races) {

  const history = storageGet(
    "cyberHacchanHistory",
    []
  );

  let changed = false;

  for (const r of races) {

    const result =
      r.result?.payouts?.trifecta?.[0]?.combination;

    if (!result) continue;

    const key =
      `${r.date}-${r.stadium_number}-${r.race_number}`;

    const h = history.find(
      x => x.key === key
    );

    if (!h || h.result !== null) continue;

    h.result = result;

    h.hit = h.picks.includes(result);

    changed = true;
  }

  if (changed) {
    storageSet(
      "cyberHacchanHistory",
      history
    );
  }
}

/* =========================
   レース表示
========================= */

function renderRace(x) {

  const r = x.race;

  const stadium =
    STADIUMS[r.stadium_number] ||
    `場${r.stadium_number}`;

  const grade =
    gradeName(r.grade_number);

  const picks =
    combinations(x);

  const racers =
    x.racers.map(z => {

      const p =
        x.preview[String(z.entry_number)] || {};

      const course =
        num(p.course_number);

      const exhibition =
        num(p.exhibition_time);

      return `
        <div class="racer">
          <b>${esc(z.entry_number)}号艇</b>
          <span>${esc(z.name)}</span>
          <small>
            ${rankName(z.rank_number)}
            ${course ? ` / 進入${course}` : ""}
            ${exhibition !== null
              ? ` / 展示${exhibition.toFixed(2)}`
              : ""}
          </small>
        </div>
      `;

    }).join("");

  return `
    <article class="race-card ${x.hot ? "hot-race" : ""}">

      <div class="race-head">

        <div>

          <div class="race-name">
            ${esc(stadium)}
            ${esc(r.race_number)}R
          </div>

          <div class="race-meta">
            <b>${esc(grade)}</b>
            ${esc(r.title || "")}
          </div>

          ${
            r.subtitle
              ? `<div class="muted">
                   ${esc(r.subtitle)}
                 </div>`
              : ""
          }

          <div class="muted">
            ${num(r.day_number)
              ? `開催${num(r.day_number)}日目 / `
              : ""}
            締切 ${fmtTime(r.closed_at)}
          </div>

        </div>

        <div class="score">

          ${
            x.hot
              ? `<div class="hot-badge">激アツ</div>`
              : ""
          }

          <strong>
            ${x.confidence}
          </strong>

          <small>
            信頼度
          </small>

        </div>

      </div>

      <div class="pick">

        <div class="pick-label">
          1着本命
        </div>

        <div class="pick-main">
          ① ${esc(x.one.name)}
        </div>

        <div class="rows">

          <div class="metric">
            <b>本線</b>
            <span>
              ${esc(picks.slice(0,2).join(" / ") || "—")}
            </span>
          </div>

          <div class="metric">
            <b>押さえ</b>
            <span>
              ${esc(picks.slice(2).join(" / ") || "なし")}
            </span>
          </div>

        </div>

        <div class="reason">
          ${esc(makeReasons(x))}
        </div>

        <div class="change">
          <b>予想根拠・直前情報</b>
          <span>
            ${esc(makeChangeReason(x))}
          </span>
        </div>

      </div>

      <div class="racers">
        ${racers}
      </div>

    </article>
  `;
}

/* =========================
   データ取得
========================= */

async function fetchData() {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      15000
    );

  try {

    const res = await fetch(
      API + "?t=" + Date.now(),
      {
        cache:"no-store",
        signal:controller.signal
      }
    );

    if (!res.ok) {
      throw new Error(
        `API ${res.status}`
      );
    }

    return await res.json();

  } finally {
    clearTimeout(timer);
  }
}

/* =========================
   メイン
========================= */

async function load() {

  const status = $("#status");
  const picks = $("#picks");
  const updated = $("#updated");
  const notice = $("#notice");

  if (!status || !picks) {
    console.error(
      "必要なHTML要素がありません"
    );
    return;
  }

  status.textContent =
    "データ取得中…";

  if (notice) {
    notice.classList.add("hidden");
    notice.textContent = "";
  }

  try {

    const data = await fetchData();

    const races = [];

    const stadiums =
      data?.programs?.stadiums || {};

    for (const stadium of Object.values(stadiums)) {

      for (const r of Object.values(
        stadium?.races || {}
      )) {

        races.push(r);
      }
    }

    if (!races.length) {
      throw new Error(
        "レースデータが0件です"
      );
    }

    /* 結果を先に反映 */
    updateResults(races);

    const scored =
      races
        .filter(r => !r.result?.racers)
        .map(scoreRace)
        .filter(Boolean)
        .filter(x => x.safe)
        .sort(
          (a,b) =>
            b.confidence - a.confidence
        );

    /* 予想履歴 */
    scored.forEach(
      savePrediction
    );

    /* 日付 */
    const date =
      races[0]?.date ||
      new Date().toLocaleDateString(
        "ja-JP"
      );

    if ($("#date")) {
      $("#date").textContent =
        date;
    }

    /* 更新時刻 */
    if (updated) {
      updated.textContent =
        `取得時刻 ${new Date()
          .toLocaleTimeString(
            "ja-JP",
            {
              hour:"2-digit",
              minute:"2-digit",
              second:"2-digit"
            }
          )}`;
    }

    /* ステータス */

    if (scored.length) {

      status.textContent =
        `${scored.length}レースを推奨`;

    } else {

      status.textContent =
        "本日は現時点で推奨なし";
    }

    /* レース表示 */

    if (scored.length) {

      picks.innerHTML =
        scored
          .map(renderRace)
          .join("");

    } else {

      picks.innerHTML = `
        <div class="empty">

          <h2>
            現時点で推奨できる
            固いレースはありません
          </h2>

          <p>
            出走表は取得できています。
            基準を満たすレースだけを
            表示しています。
          </p>

          <p class="muted">
            直前情報が更新されると
            予想が変わる場合があります。
          </p>

        </div>
      `;
    }

    updateStats();

    /* 最終取得時刻 */
    storageSet(
      "lastLoaded",
      new Date().toISOString()
    );

  } catch (e) {

    console.error(e);

    status.textContent =
      "データ取得に失敗しました";

    picks.innerHTML = "";

    if (notice) {

      notice.textContent =
        `データ取得エラー：${e.message}`;

      notice.classList.remove(
        "hidden"
      );
    }
  }
}

/* =========================
   更新ボタン
========================= */

$("#refresh")?.addEventListener(
  "click",
  load
);

/* =========================
   初回
========================= */

load();

/* =========================
   3分ごとに更新
========================= */

setInterval(
  load,
  180000
);
