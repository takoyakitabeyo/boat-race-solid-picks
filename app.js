const API = "https://boatraceopenapi.github.io/api/v1/today.json";

document.body.innerHTML = `
  <main style="
    max-width:900px;
    margin:0 auto;
    padding:24px 16px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#071426;
    color:#fff;
    min-height:100vh;
    box-sizing:border-box;
  ">

    <h1 style="
      font-size:28px;
      margin:0 0 8px;
    ">
      予想屋サイバーはっちゃん
    </h1>

    <div style="
      color:#8ea3bb;
      margin-bottom:24px;
    ">
      APIデータ確認
    </div>

    <div id="status" style="
      padding:18px;
      border-radius:14px;
      background:#10233a;
      margin-bottom:20px;
    ">
      データ取得中…
    </div>

    <div id="result"></div>

    <button id="refresh" style="
      margin-top:20px;
      width:100%;
      padding:15px;
      border:0;
      border-radius:12px;
      background:#1683ff;
      color:white;
      font-size:16px;
      font-weight:bold;
    ">
      更新
    </button>

  </main>
`;

const status = document.getElementById("status");
const result = document.getElementById("result");
const refresh = document.getElementById("refresh");

async function load() {

  status.textContent = "APIデータ取得中…";
  result.innerHTML = "";

  try {

    const response = await fetch(API, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    console.log("取得したAPIデータ:", data);

    const programs = data.programs || {};
    const stadiums = programs.stadiums || {};

    const stadiumList = Object.values(stadiums);

    let races = [];

    for (const stadium of stadiumList) {

      const stadiumRaces = stadium.races || {};

      for (const race of Object.values(stadiumRaces)) {
        races.push(race);
      }

    }

    status.innerHTML = `
      <div style="
        font-size:20px;
        font-weight:bold;
        margin-bottom:12px;
      ">
        APIデータ取得成功
      </div>

      <div>
        開催場数：<b>${stadiumList.length}</b>
      </div>

      <div style="margin-top:6px;">
        レース数：<b>${races.length}</b>
      </div>
    `;

    if (races.length === 0) {

      result.innerHTML = `
        <div style="
          padding:20px;
          background:#32151a;
          border-radius:14px;
        ">
          レースデータが0件です。
        </div>
      `;

      return;
    }

    /*
      最初のレースの実データを確認する
    */

    const firstRace = races[0];

    const racerData =
      Object.values(firstRace.racers || {});

    result.innerHTML = `

      <div style="
        padding:20px;
        border-radius:14px;
        background:#10233a;
        margin-bottom:20px;
      ">

        <h2 style="margin-top:0;">
          最初のレース
        </h2>

        <div style="font-size:18px;margin-bottom:10px;">
          場：
          <b>${firstRace.stadium_number ?? "-"}</b>
        </div>

        <div style="font-size:18px;margin-bottom:10px;">
          レース：
          <b>${firstRace.race_number ?? "-"}R</b>
        </div>

        <div style="margin-bottom:10px;">
          タイトル：
          ${firstRace.title ?? "-"}
        </div>

        <div>
          出走選手：
          <b>${racerData.length}人</b>
        </div>

      </div>

      <div style="
        padding:20px;
        border-radius:14px;
        background:#10233a;
      ">

        <h2 style="margin-top:0;">
          出走表
        </h2>

        ${
          racerData.length
            ? racerData.map(r => `
                <div style="
                  padding:12px 0;
                  border-bottom:1px solid #294057;
                ">

                  <b style="font-size:20px;">
                    ${r.entry_number ?? "-"}号艇
                  </b>

                  <span style="margin-left:10px;">
                    ${r.name ?? "-"}
                  </span>

                  <span style="
                    margin-left:10px;
                    color:#8ea3bb;
                  ">
                    ${r.rank_number ?? "-"}
                  </span>

                </div>
              `).join("")
            : `
              <div>
                出走選手データを取得できませんでした。
              </div>
            `
        }

      </div>

      <details style="
        margin-top:20px;
        padding:15px;
        background:#10233a;
        border-radius:14px;
      ">

        <summary style="
          cursor:pointer;
          font-weight:bold;
        ">
          APIの実データを確認
        </summary>

        <pre style="
          white-space:pre-wrap;
          word-break:break-word;
          font-size:11px;
          color:#b8c7d9;
          margin-top:15px;
        ">${escapeHtml(JSON.stringify(firstRace,null,2))}</pre>

      </details>
    `;

  } catch (error) {

    console.error(error);

    status.innerHTML = `
      <b>API取得エラー</b>
      <div style="margin-top:8px;">
        ${escapeHtml(error.message)}
      </div>
    `;

  }
}

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

refresh.addEventListener("click", load);

load();
