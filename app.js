const API = "https://boatraceopenapi.github.io/api/v1/today.json";

const $ = (s) => document.querySelector(s);

async function load() {
  $("#status").textContent = "データ取得中…";
  $("#picks").innerHTML = "";

  try {
    const response = await fetch(API, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    console.log("API DATA:", data);

    let stadiumCount = 0;
    let raceCount = 0;

    const stadiums =
      data.programs?.stadiums || {};

    for (const stadium of Object.values(stadiums)) {

      stadiumCount++;

      const races =
        stadium.races || {};

      raceCount += Object.keys(races).length;
    }

    $("#status").textContent =
      "APIデータ取得成功";

    $("#updated").textContent =
      "取得時刻 " +
      new Date().toLocaleTimeString("ja-JP");

    $("#picks").innerHTML = `
      <div class="empty">

        <h2>データ取得テスト</h2>

        <p>
          場数：<b>${stadiumCount}</b>
        </p>

        <p>
          レース数：<b>${raceCount}</b>
        </p>

        <p>
          APIからデータを取得できています。
        </p>

      </div>
    `;

  } catch (error) {

    console.error(error);

    $("#status").textContent =
      "APIデータ取得失敗";

    $("#picks").innerHTML = `
      <div class="empty">

        <h2>データ取得エラー</h2>

        <p>
          ${error.message}
        </p>

        <p>
          APIに接続できていません。
        </p>

      </div>
    `;
  }
}

$("#refresh")?.addEventListener(
  "click",
  load
);

load();
