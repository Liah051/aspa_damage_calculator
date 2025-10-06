// -------------------- ユーティリティ --------------------
function rangeDist(min, max) {
  const dist = {};
  const n = max - min + 1;
  for (let i = min; i <= max; i++) dist[i] = 1 / n;
  return dist;
}
function fixedDist(value) {
  return { [value]: 1 };
}

function combineDist(dist1, dist2) {
  const result = {};
  for (const [v1, p1] of Object.entries(dist1)) {
    for (const [v2, p2] of Object.entries(dist2)) {
      const sum = Number(v1) + Number(v2);
      result[sum] = (result[sum] || 0) + p1 * p2;
    }
  }
  return result;
}

// -------------------- カード定義 --------------------
const attackCards = [
  { name: "攻撃(中)", img: "images/攻撃中.jpg", dist: rangeDist(1, 3) },
  { name: "攻撃(大)", img: "images/攻撃大.jpg", dist: rangeDist(1, 6) },
  { name: "攻撃(特大)", img: "images/攻撃特大.jpg", dist: rangeDist(1, 10) },
  { name: "名刀:ガオー切り", img: "images/ガオー切り.jpg", dist: rangeDist(1, 20) },
  { name: "シャドウアタック", img: "images/シャドアタ.jpg", dist: fixedDist(3) },
  { name: "チャージ", img: "images/チャージ.jpg", dist: fixedDist(5) },
  { name: "会心の一撃", img: "images/会心.jpg", dist: fixedDist(6), multiplier: 1.5 },
];

const defenseCards = [
  { name: "ガード(中)", img: "images/防御中.jpg", min: 1, max: 3 },
  { name: "ガード(大)", img: "images/防御大.jpg", min: 1, max: 6 },
  { name: "ガード(特大)", img: "images/防御特大.jpg", min: 1, max: 10 },
];

// -------------------- UI生成 --------------------
function createCardElements(cards, containerId, type) {
  const container = document.getElementById(containerId);
  cards.forEach((card, i) => {
    const div = document.createElement("div");
    div.className = "card";

    const img = document.createElement("img");
    img.src = card.img;
    img.alt = card.name;

    const label = document.createElement("label");
    label.textContent = `${card.name} ×`;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = "0";
    input.id = `${containerId}-count-${i}`;
    input.dataset.type = type;

    div.appendChild(img);
    div.appendChild(label);
    div.appendChild(input);
    container.appendChild(div);
  });
}

createCardElements(attackCards, "attackCards", "attack");
createCardElements(defenseCards, "defenseCards", "defense");

// -------------------- ダメージ計算 --------------------
document.getElementById("calculateBtn").addEventListener("click", () => {
  const baseAtk = Number(document.getElementById("baseAttack").value);
  const baseDef = Number(document.getElementById("baseDefense").value);
  
  // --- ヒールスタック処理 ---
  const healStack = Number(document.getElementById("healStack")?.value || 0);

  // 選択中のカッター数をカウント
  let knifeCount = 0;
  if (activeItems.has("purpleKnife")) knifeCount++;
  if (activeItems.has("goldKnife")) knifeCount++;

  // ヒールスタックによる加算分
  const healBonus = healStack * knifeCount;

  //懐中電灯処理
  const starlightStack = Number(document.getElementById("starlightStack")?.value || 0);
  
  let flashlightCount = 0;
  if (activeItems.has("goldflashlight")) flashlightCount++;

  const starlightBonus = Math.ceil(starlightStack / 3) * flashlightCount;
  
  //　スターコインハンマー処理
  const coinCount = Number(document.getElementById("coinCount")?.value || 0);
  let hammerCount = 0;
  if(activeItems.has("starCoinHammer")) hammerCount++;
  const coinBonus = Math.ceil(0.3 * coinCount * hammerCount);
  //マーク処理
  let markCount = Number(document.getElementById("markCount")?.value || 0);

  let sightcount = 0;
  if(activeItems.has("goldsight")){
    sightcount++;
    markCount ++;
  }
  if(activeItems.has("purplesight"))markCount ++;
  const markDebuff = markCount > 0 ? 1 : 0;
  const markBonus = Math.ceil(markCount * sightcount * 2);


  // --- 攻撃側 ---
  let atkDist = rangeDist(1, 6); // ダイス
  let atkMultiplier = 1.0;
  attackCards.forEach((card, i) => {
    const count = Number(document.getElementById(`attackCards-count-${i}`).value);
    for (let c = 0; c < count; c++) {
      atkDist = combineDist(atkDist, card.dist);
      if (card.multiplier && atkMultiplier === 1.0) atkMultiplier *= card.multiplier;
    }
  });

  // --- 防御側 ---
  let defDist = rangeDist(1, 6); // ダイス
  defenseCards.forEach((card, i) => {
    const count = Number(document.getElementById(`defenseCards-count-${i}`).value);
    for (let c = 0; c < count; c++) {
      defDist = combineDist(defDist, rangeDist(card.min, card.max));
    }
  });

  // --- 最終攻撃力・防御力分布 ---
  const atkFinalDist = {};
  for (const [val, prob] of Object.entries(atkDist)) {
    const atkVal = Math.round((baseAtk + Number(val) + healBonus + starlightBonus + coinBonus + markBonus) * atkMultiplier);
    atkFinalDist[atkVal] = (atkFinalDist[atkVal] || 0) + prob;
  }

  const defFinalDist = {};
  for (const [val, prob] of Object.entries(defDist)) {
    const defVal = baseDef + Number(val);
    defFinalDist[defVal] = (defFinalDist[defVal] || 0) + prob;
  }

  // --- ダメージ分布 ---
  const damageDist = {};
  for (const [atkVal, pA] of Object.entries(atkFinalDist)) {
    for (const [defVal, pD] of Object.entries(defFinalDist)) {
      let dmg = Number(atkVal) > Number(defVal) ? Number(atkVal) - Number(defVal) : 1;
      dmg += markDebuff; //マークデバフ適用
      damageDist[dmg] = (damageDist[dmg] || 0) + pA * pD;
    }
  }

  // --- 期待値計算 ---
  let expected = 0;
  for (const [dmg, prob] of Object.entries(damageDist)) {
    expected += Number(dmg) * prob;
  }

  // --- 表示 ---
  document.getElementById("expectedDamage").textContent =`期待値: ${expected.toFixed(2)}`;


  // --- 結果表示 ---
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";
  const totalProb = Object.values(damageDist).reduce((a, b) => a + b, 0);
  Object.entries(damageDist)
    .sort((a, b) => a[0] - b[0])
    .forEach(([dmg, prob]) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${dmg}</td><td>${(prob / totalProb * 100).toFixed(2)}</td>`;
      tbody.appendChild(row);
    });
});

// -------------------- リセットボタン --------------------
document.getElementById("resetBtn").addEventListener("click", () => {
  /*// 基礎値リセット
  document.getElementById("baseAttack").value = 4;
  document.getElementById("baseDefense").value = 2;*/

  // 攻撃カード枚数リセット
  attackCards.forEach((_, i) => {
    const input = document.getElementById(`attackCards-count-${i}`);
    input.value = 0;
  });

  // 防御カード枚数リセット
  defenseCards.forEach((_, i) => {
    const input = document.getElementById(`defenseCards-count-${i}`);
    input.value = 0;
  });

  // 期待値リセット
  document.getElementById("expectedDamage").textContent = "期待値: -";

  // 結果テーブルクリア
  document.querySelector("#resultTable tbody").innerHTML = "";

  // カードアニメーション
  animateCards("attackCards");
  animateCards("defenseCards");
});

// -------------------- カードアニメーション --------------------
function animateCards(containerId) {
  const cards = document.getElementById(containerId).children;
  for (const card of cards) {
    card.classList.remove("reset-animation"); // 再適用用に一度削除
    void card.offsetWidth; // 強制再描画
    card.classList.add("reset-animation");
  }
}


// --- Advancedセクション開閉 ---
document.getElementById("toggleAdvanced").addEventListener("click", () => {
  const adv = document.getElementById("advancedContent");
  adv.classList.toggle("hidden");
  document.getElementById("toggleAdvanced").textContent =
    adv.classList.contains("hidden") ? "Advanced ▶" : "Advanced ▼";
});

// --- アイテム選択（クリックでON/OFF） ---
const activeItems = new Set();
document.querySelectorAll(".item").forEach(item => {
  item.addEventListener("click", () => {
    const id = item.dataset.item;
    if (activeItems.has(id)) {
      activeItems.delete(id);
      item.classList.remove("active");
    } else {
      activeItems.add(id);
      item.classList.add("active");
    }
    console.log("選択中アイテム:", [...activeItems]);
  });
});

