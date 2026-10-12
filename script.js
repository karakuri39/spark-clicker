// ============================================================
// 1. 状態（state） ― このゲームが「今どうなっているか」を表す唯一の場所。
//    画面の見た目はすべてこの state から作られる。逆に言うと、
//    state を書き換えて画面に反映する、を繰り返すのがゲームループの本質。
// ============================================================
const state = {
  points: 0,          // 保有エネルギー
  pointsPerClick: 1,  // クリック1回あたりの獲得量
};

// アップグレード定義。id・名前・説明・基本価格・価格上昇率・現在の所持数・効果を持つ。
// 「effect: 'click'」は手動クリックの威力を上げるタイプ、
// 「effect: 'auto'」は放っておいても毎秒自動で増えるタイプ。
const upgrades = [
  {
    id: "boost",
    name: "手動ブースト",
    description: "クリック1回の獲得量 +1",
    baseCost: 10,
    costScale: 1.15,
    owned: 0,
    effect: "click",
    amount: 1,
  },
  {
    id: "generator",
    name: "発電機",
    description: "毎秒 +1 を自動生成",
    baseCost: 25,
    costScale: 1.15,
    owned: 0,
    effect: "auto",
    amount: 1,
  },
  {
    id: "turbine",
    name: "タービン",
    description: "毎秒 +5 を自動生成",
    baseCost: 150,
    costScale: 1.15,
    owned: 0,
    effect: "auto",
    amount: 5,
  },
];

// ============================================================
// 2. DOM要素の取得 ― HTML側に書いた id="..." を JS 側でつかまえる。
//    以後はこの変数越しに画面を書き換える。
// ============================================================
const scoreEl = document.getElementById("score");
const rateEl = document.getElementById("rate");
const sparkButton = document.getElementById("sparkButton");
const shopListEl = document.getElementById("shopList");
const resetButton = document.getElementById("resetButton");

const SAVE_KEY = "spark-clicker-save";

// ============================================================
// 3. 派生値の計算
// ============================================================

// 現在の「毎秒自動生成量」は auto タイプのアップグレードの所持数から毎回計算する。
// state に直接持たせずその都度計算することで、値がズレる心配がなくなる。
function getPointsPerSecond() {
  return upgrades
    .filter((u) => u.effect === "auto")
    .reduce((sum, u) => sum + u.amount * u.owned, 0);
}

// 今の所持数における「次の1個」の価格。指数的に値上がりする典型的なクリッカー式。
function getUpgradeCost(upgrade) {
  return Math.ceil(upgrade.baseCost * Math.pow(upgrade.costScale, upgrade.owned));
}

// ============================================================
// 4. 画面描画（render） ― state を見て、DOM のテキストや属性を書き換える。
//    「クリックした」「1秒経った」など何かが起きるたびにこの関数を呼び直す。
// ============================================================
function render() {
  scoreEl.textContent = Math.floor(state.points).toLocaleString();
  rateEl.textContent = `毎秒 +${getPointsPerSecond().toLocaleString()}`;

  // ショップ一覧は毎回まるごと作り直す。要素数が少ないゲームなので
  // パフォーマンス的にも気にする必要はなく、実装がシンプルになるメリットの方が大きい。
  shopListEl.innerHTML = "";
  upgrades.forEach((upgrade) => {
    const cost = getUpgradeCost(upgrade);
    const canAfford = state.points >= cost;

    const li = document.createElement("li");
    li.className = "shop__item";
    li.innerHTML = `
      <div>
        <p class="shop__item-name">${upgrade.name}</p>
        <p class="shop__item-desc">${upgrade.description}</p>
        <p class="shop__item-owned">所持: ${upgrade.owned}</p>
      </div>
      <button class="shop__buy" data-id="${upgrade.id}" ${canAfford ? "" : "disabled"}>
        ${cost.toLocaleString()}
      </button>
    `;
    shopListEl.appendChild(li);
  });
}

// ============================================================
// 5. イベント処理 ― ユーザーの操作を state の変更に翻訳する部分。
// ============================================================

// スパークをクリック（またはEnter）したときの処理
sparkButton.addEventListener("click", () => {
  state.points += state.pointsPerClick;

  // クリック演出：一度クラスを外してから付け直すことで、
  // 連打してもアニメーションが毎回リスタートするようにしている
  sparkButton.classList.remove("is-pulsing");
  void sparkButton.offsetWidth; // リフローを強制してアニメーションをリセット
  sparkButton.classList.add("is-pulsing");

  render();
  save();
});

// ショップのボタンはイベント委任（親要素1つにリスナーを1つだけ付ける）で処理する。
// 一覧を作り直すたびに個々のボタンへイベントを付け直す必要がなくなり、コードが単純になる。
shopListEl.addEventListener("click", (event) => {
  const button = event.target.closest(".shop__buy");
  if (!button) return;

  const upgrade = upgrades.find((u) => u.id === button.dataset.id);
  const cost = getUpgradeCost(upgrade);
  if (state.points < cost) return;

  state.points -= cost;
  upgrade.owned += 1;

  // クリック威力を上げるタイプは、購入した瞬間に効果を反映する
  if (upgrade.effect === "click") {
    state.pointsPerClick += upgrade.amount;
  }

  render();
  save();
});

resetButton.addEventListener("click", () => {
  if (!confirm("セーブデータを削除して最初からやり直しますか？")) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
});

// ============================================================
// 6. 自動生成ループ ― 「毎秒◯◯増える」を実現する部分。
//    setInterval で一定間隔ごとに state を書き換え、render() し直す。
//    100msごとに1/10ずつ加算しているのは、数字が1秒に一度カクッと
//    増えるのではなく、なめらかに増えているように見せるため。
// ============================================================
setInterval(() => {
  const perSecond = getPointsPerSecond();
  if (perSecond > 0) {
    state.points += perSecond / 10;
    render();
  }
}, 100);

// 自動生成分はこまめに変わるので、セーブは3秒おきにまとめて行う
setInterval(save, 3000);

// ============================================================
// 7. 保存・復元 ― localStorage はブラウザに紐づく簡易的なデータ保存領域。
//    JSON文字列としてしか保存できないので、書き込み時はstringify、
//    読み込み時はparseする。
// ============================================================
function save() {
  const data = {
    points: state.points,
    pointsPerClick: state.pointsPerClick,
    upgrades: upgrades.map((u) => ({ id: u.id, owned: u.owned })),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    state.points = data.points ?? 0;
    state.pointsPerClick = data.pointsPerClick ?? 1;
    (data.upgrades || []).forEach((saved) => {
      const upgrade = upgrades.find((u) => u.id === saved.id);
      if (upgrade) upgrade.owned = saved.owned;
    });
  } catch (e) {
    console.warn("セーブデータの読み込みに失敗しました。初期状態で開始します。", e);
  }
}

// ============================================================
// 8. 起動処理
// ============================================================
load();
render();
