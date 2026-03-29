// ==========================================
// game.js - 【真・完全版】■前半
// ==========================================

// --- 1. 定数・変数定義 ---
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const minimapCanvas = document.getElementById("minimap");
const mCtx = minimapCanvas ? minimapCanvas.getContext("2d") : null;
const timerDisplay = document.getElementById("timerDisplay");
const titleScreen = document.getElementById("titleScreen");
const selectScreen = document.getElementById("selectScreen");
const priestScreen = document.getElementById("priestScreen");
const confirmDiv = document.getElementById("confirmDiv");
const confirmMsg = document.getElementById("confirmMsg");
const resultScreen = document.getElementById("resultScreen");
const goButton = document.getElementById("goButton");

let currentStage = null;
let player = { x: 0, y: 0, dir: 0, viewX: 0, viewY: 0, viewDir: 0, targetX: 0, targetY: 0, targetDir: 0, moving: false, turning: false };
let items = [];
let exploredMap = [];
let gameActive = false;
let startMsgTimer = 0;
let getMsgTimer = 0;
let timerFrame = 0;
let currentLimit = 0;
let isFading = false;
let fadeAlpha = 0;
let userGold = parseInt(localStorage.getItem('userGold')) || 300;

let selectedTime = 60;
let selectedCost = 100;
let tempStageKey = "";

const keys = { up: false, left: false, right: false, down: false };

const itemImage = new Image();
itemImage.src = "images/fukidashi_mugon_white.png";
let itemImageReady = false;
itemImage.onload = () => { itemImageReady = true; };

const sounds = {
  menuBgm: new Audio("sounds/maou_game_dangeon05.mp3"),
  dungeonBgm: new Audio("sounds/maou_game_dangeon17.mp3"),
  itemGet: new Audio("sounds/maou_se_onepoint30.wav"),
  clearJingle: new Audio("sounds/maou_se_jingle05.wav"),
  failJingle: new Audio("sounds/maou_se_jingle08.wav")
};

sounds.menuBgm.loop = true;
sounds.dungeonBgm.loop = true;

// 【修正箇所】BGMの安定化（二重再生ガード）
function playBgm(targetBgm) {
  if (targetBgm && !targetBgm.paused) return; // すでに鳴ってたら何もしない
  
  [sounds.menuBgm, sounds.dungeonBgm].forEach(s => {
    if (s !== targetBgm) {
      s.pause();
      // 実機安定のため currentTime=0 は頻繁に行わない
    }
  });
  
  if (targetBgm) {
    targetBgm.play().catch(e => console.log("再生制限:", e));
  }
}

function updatePriestUI() {
  document.getElementById("currentGoldDisplay").innerText = userGold;
  const btns = document.querySelectorAll(".opt-btn");
  btns.forEach(b => {
    if (b.innerText.includes(selectedTime + "秒")) b.classList.add("selected");
    else b.classList.remove("selected");
  });
  goButton.disabled = (userGold < selectedCost);
}

window.selectMagic = function(time, cost) {
  selectedTime = time; 
  selectedCost = cost;
  updatePriestUI();
};

function showScene(scene) {
  const allScenes = [titleScreen, selectScreen, priestScreen, canvas, document.getElementById("controls"), timerDisplay, confirmDiv, resultScreen, minimapCanvas];
  allScenes.forEach(s => { if(s) s.style.display = "none"; });

  if (scene === "title" || scene === "select" || scene === "priest") {
    if (sounds.menuBgm.paused) playBgm(sounds.menuBgm);
    if (scene === "title") titleScreen.style.display = "flex";
    else if (scene === "select") { selectScreen.style.display = "flex"; renderMissionList(); }
    else if (scene === "priest") { priestScreen.style.display = "flex"; updatePriestUI(); }
  } else if (scene === "exploration") {
    // 【修正】ここで制限時間をセット
    currentLimit = selectedTime;
    playBgm(sounds.dungeonBgm);
    canvas.style.display = "block";
    document.getElementById("controls").style.display = "grid";
    timerDisplay.style.display = "block";
    if(minimapCanvas) minimapCanvas.style.display = "block";
    resize();
  } else if (scene === "none") {
    playBgm(null);
  }
}

function renderMissionList() {
  const list = document.getElementById("missionList");
  list.innerHTML = "";
  Object.keys(STAGES).forEach(key => {
    const s = STAGES[key];
    const best = localStorage.getItem(`bestTime_${s.id}`) || "--";
    const exploredData = localStorage.getItem(`explored_${s.id}`);
    let mapRate = 0;
    if (exploredData) {
      const grid = JSON.parse(exploredData);
      const total = grid.length * grid[0].length;
      const count = grid.flat().filter(v => v === true).length;
      mapRate = Math.floor((count / total) * 100);
    }
    const card = document.createElement("div");
    card.className = "mission-card";
    card.innerHTML = `
      <h3>${s.name}</h3>
      <p>${s.description}</p>
      <div class="mission-stats">
        自己ベスト: <span>${best}秒</span> / 踏破率: <span>${mapRate}%</span>
      </div>
      <div class="mission-info">報酬: ${s.reward}G</div>
    `;
    card.onclick = () => { tempStageKey = key; showScene("priest"); };
    list.appendChild(card);
  });
}

function loadExploration(id, rows, cols) {
  const data = localStorage.getItem(`explored_${id}`);
  if (data) return JSON.parse(data);
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}

function saveExploration(id) { 
  localStorage.setItem(`explored_${id}`, JSON.stringify(exploredMap)); 
}

      //■後半
      function initGame(stageKey) {
  currentStage = STAGES[stageKey];
  player.x = Math.floor(currentStage.startPos.x);
  player.y = Math.floor(currentStage.startPos.y);
  player.dir = currentStage.startPos.dir;
  player.viewX = currentStage.startPos.x;
  player.viewY = currentStage.startPos.y;
  player.viewDir = (currentStage.startPos.dir * Math.PI) / 2;
  player.targetX = player.viewX;
  player.targetY = player.viewY;
  player.targetDir = player.dir;
  player.moving = false;
  player.turning = false;

  const rows = currentStage.map.length;
  const cols = currentStage.map[0].length;
  exploredMap = loadExploration(currentStage.id, rows, cols);
  updateExploredArea(); 

  startMsgTimer = 90;
  getMsgTimer = 0;
  timerFrame = 0;
  gameActive = false;
  isFading = false;
  fadeAlpha = 0;

  items = [];
  let possibleLocs = [];
  const startX = Math.floor(currentStage.startPos.x);
  const startY = Math.floor(currentStage.startPos.y);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (currentStage.map[y][x] === 0) {
        const distToStart = Math.abs(x - startX) + Math.abs(y - startY);
        if (distToStart >= 3) possibleLocs.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
  }
  for (let i = 0; i < currentStage.itemCount; i++) {
    if (possibleLocs.length === 0) break;
    const idx = Math.floor(Math.random() * possibleLocs.length);
    const loc = possibleLocs.splice(idx, 1)[0];
    items.push({ x: loc.x, y: loc.y, collected: false });
  }
}

function updateExploredArea() {
  const px = Math.floor(player.x), py = Math.floor(player.y), dir = player.dir;
  setExplored(px, py);
  let targets = [];
  if (dir === 0) targets = [[px+1, py], [px+1, py-1], [px+1, py+1]];
  else if (dir === 1) targets = [[px, py+1], [px+1, py+1], [px-1, py+1]];
  else if (dir === 2) targets = [[px-1, py], [px-1, py+1], [px-1, py-1]];
  else if (dir === 3) targets = [[px, py-1], [px-1, py-1], [px+1, py-1]];
  targets.forEach(pos => setExplored(pos[0], pos[1]));
  saveExploration(currentStage.id);
}

function setExplored(x, y) {
  if (currentStage && exploredMap[y] && exploredMap[y][x] !== undefined) exploredMap[y][x] = true;
}

function update() {
  if (gameActive && !player.moving && !player.turning && confirmDiv.style.display !== "flex") {
    if (keys.up) {
      const angle = player.dir * (Math.PI / 2);
      const nx = player.x + Math.round(Math.cos(angle)), ny = player.y + Math.round(Math.sin(angle));
      if (currentStage.map[ny] && currentStage.map[ny][nx] === 0) {
        player.targetX = nx + 0.5; player.targetY = ny + 0.5; player.moving = true;
      }
    } else if (keys.left) { player.targetDir = (player.dir + 3) % 4; player.turning = true;
    } else if (keys.right) { player.targetDir = (player.dir + 1) % 4; player.turning = true;
    } else if (keys.down) { player.targetDir = (player.dir + 2) % 4; player.turning = true; }
  }

  if (gameActive && confirmDiv.style.display !== "flex") {
    timerFrame++;
    if (timerFrame >= 60) {
      currentLimit--; timerFrame = 0;
      document.getElementById("timerDisplay").innerText = `TIME: ${currentLimit}`;
      if (currentLimit <= 0) { gameActive = false; isFading = true; fadeAlpha = 0; }
    }
  }

  if (isFading) {
    fadeAlpha += 1 / 60;
    if (fadeAlpha >= 1) { isFading = false; showResult(false, true); }
  }

  if (startMsgTimer > 0) { startMsgTimer--; if (startMsgTimer === 0) gameActive = true; }
  if (getMsgTimer > 0) getMsgTimer--; 

  if (player.moving) {
    const dx = player.targetX - player.viewX, dy = player.targetY - player.viewY;
    player.viewX += dx * 0.15; player.viewY += dy * 0.15;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      player.viewX = player.targetX; player.viewY = player.targetY;
      player.x = Math.floor(player.targetX); player.y = Math.floor(player.targetY);
      player.moving = false; updateExploredArea();
      
      items.forEach(it => {
        if (!it.collected && player.x === Math.floor(it.x) && player.y === Math.floor(it.y)) {
          it.collected = true; 
          getMsgTimer = 180;
          window.itemFlash = 0.8;
          sounds.itemGet.currentTime = 0;
          sounds.itemGet.play();
          const collectedCount = items.filter(i => i.collected).length;
          const totalItems = items.length;
          // game.js の update 関数内、items.forEach の中
          // --- ここから修正 ---
          let itemName = "";
          if (currentStage.itemNames && currentStage.itemNames[collectedCount - 1]) {
            // 設定された名前（「スクロール」など）をそのまま使う
            itemName = currentStage.itemNames[collectedCount - 1];
          } else {
            // 設定がない場合のみ「アイテム1」のように表示
            itemName = "アイテム" + (totalItems > 1 ? collectedCount : "");
          }
          // --- ここまで ---

          const allSet = (collectedCount === totalItems);
          if (allSet) {
            // itemName（名前） + "を発見した！" と直接書く
            currentStage.activeMessage = itemName + "を発見した！\n全てのアイテムを回収した！\n元の魔法陣に戻って脱出しよう！";
          } else {
            // こちらも itemName + "を発見した！" に統一
            currentStage.activeMessage = itemName + "を発見した！\n（残り " + (totalItems - collectedCount) + " 個）";
          }
        }
      });
      if (player.x === Math.floor(currentStage.startPos.x) && player.y === Math.floor(currentStage.startPos.y)) {
        gameActive = false; confirmDiv.style.display = "flex";
        const allSet = items.every(it => it.collected);
        confirmMsg.innerHTML = allSet ? "回収完了。脱出しますか？" : "まだ依頼品があります。脱出しますか？";
      }
    }
  }

  if (player.turning) {
    const tA = player.targetDir * (Math.PI/2);
    let diff = tA - player.viewDir;
    while (diff > Math.PI) diff -= Math.PI*2;
    while (diff < -Math.PI) diff += Math.PI*2;
    player.viewDir += diff * 0.2;
    if (Math.abs(diff) < 0.001) { player.viewDir = tA; player.dir = player.targetDir; player.turning = false; updateExploredArea(); }
  }
}

const texturedCache = {};
function getColoredTexture(color) {
  if (texturedCache[color]) return texturedCache[color];
  const c = document.createElement('canvas');
  c.width = textureCanvas.width; c.height = textureCanvas.height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(textureCanvas, 0, 0);
  ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
  texturedCache[color] = c;
  return c;
}

function draw() {
  const w = canvas.width, h = canvas.height, fov = Math.PI / 3;
  let floorBaseColor = "#131", magicCircleColor = "#033", wallColor = null;
  if (currentStage.type === "wood") { floorBaseColor = "#4d3926"; magicCircleColor = "#2d1e12"; wallColor = "#deb887"; }
  const currentWallTex = wallColor ? getColoredTexture(wallColor) : textureCanvas;
  ctx.fillStyle = "#111"; ctx.fillRect(0, 0, w, h/2);
  for (let y = h/2; y < h; y++) {
    const directDist = (h / 2) / (y - h / 2);
    for (let x = 0; x < w; x += 4) {
      const angle = player.viewDir + (x / w - 0.5) * fov;
      const realDist = directDist / Math.cos(angle - player.viewDir);
      const worldX = player.viewX + Math.cos(angle) * realDist, worldY = player.viewY + Math.sin(angle) * realDist;
      const dx = worldX - currentStage.startPos.x, dy = worldY - currentStage.startPos.y;
      const distStart = Math.sqrt(dx*dx + dy*dy);
      if (distStart < 0.6 && distStart > 0.5) ctx.fillStyle = "#0ff";
      else if (distStart < 0.5) {
        const isStanding = (Math.abs(player.viewX - currentStage.startPos.x) < 0.3 && Math.abs(player.viewY - currentStage.startPos.y) < 0.3);
        ctx.fillStyle = isStanding ? "#066" : magicCircleColor;
      } else ctx.fillStyle = floorBaseColor;
      ctx.fillRect(x, y, 4, 1);
    }
  }
  const zBuffer = new Array(w);
  for (let i = 0; i < w; i++) {
    const angle = player.viewDir + (i / w - 0.5) * fov;
    const rawDist = castRay(player.viewX, player.viewY, angle);
    zBuffer[i] = rawDist;
    const dist = Math.max(0.1, rawDist * Math.cos(angle - player.viewDir));
    const wallH = h / dist, top = h/2 - wallH/2;
    const hX = player.viewX + Math.cos(angle) * rawDist, hY = player.viewY + Math.sin(angle) * rawDist;
    let tX = (Math.abs(hY % 1) > Math.abs(hX % 1)) ? hY % 1 : hX % 1;
    if (tX < 0) tX += 1;
    ctx.drawImage(currentWallTex, Math.floor(tX * texSize), 0, 1, texSize, i, top, 1, wallH);
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, dist * 0.18)})`; ctx.fillRect(i, top, 1, wallH);
  }
  drawSprites(zBuffer, w, h, fov);
  if (startMsgTimer > 0) {
    ctx.save(); ctx.font = "bold 60px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, startMsgTimer/30)})`;
    ctx.fillText("START!", w/2, h/2); ctx.restore();
  }
  if (getMsgTimer > 0) {
    ctx.save(); ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = "white"; ctx.strokeStyle = "black"; ctx.lineWidth = 4;
    const msg = currentStage.activeMessage || "";
    const lines = msg.split('\n');
    lines.forEach((l, idx) => { const py = (h/2+50)+(idx*30); ctx.strokeText(l, w/2, py); ctx.fillText(l, w/2, py); });
    ctx.restore();
  }
  if (fadeAlpha > 0) { ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`; ctx.fillRect(0, 0, w, h); }
  if (minimapCanvas && minimapCanvas.style.display !== "none") drawMinimap();
  if (window.itemFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${window.itemFlash})`; ctx.fillRect(0, 0, w, h);
    window.itemFlash -= 0.05;
  }
}

function drawMinimap() {
  const mSize = minimapCanvas.width;
  const mapData = currentStage.map;
  const rows = mapData.length, cols = mapData[0].length;
  const viewRange = 5; const cellSize = mSize / (viewRange * 2 + 1); 
  mCtx.clearRect(0, 0, mSize, mSize);
  const centerX = player.viewX, centerY = player.viewY;
  for (let dy = -viewRange; dy <= viewRange; dy++) {
    for (let dx = -viewRange; dx <= viewRange; dx++) {
      const tx = Math.floor(centerX + dx), ty = Math.floor(centerY + dy);
      if (ty >= 0 && ty < rows && tx >= 0 && tx < cols && exploredMap[ty][tx]) {
        const drawX = (dx + viewRange) * cellSize, drawY = (dy + viewRange) * cellSize;
        mCtx.fillStyle = (mapData[ty][tx] === 1) ? "rgba(120, 120, 120, 0.9)" : "rgba(40, 40, 40, 0.5)";
        mCtx.fillRect(drawX, drawY, cellSize - 1, cellSize - 1);
        if (tx === Math.floor(currentStage.startPos.x) && ty === Math.floor(currentStage.startPos.y)) {
          mCtx.fillStyle = "#0ff"; mCtx.fillRect(drawX + 1, drawY + 1, cellSize - 2, cellSize - 2);
        }
        items.forEach(it => { if (it.collected && Math.floor(it.x) === tx && Math.floor(it.y) === ty) {
          mCtx.fillStyle = "#ffff00"; mCtx.beginPath(); mCtx.arc(drawX + cellSize/2, drawY + cellSize/2, cellSize/4, 0, Math.PI * 2); mCtx.fill();
        }});
      }
    }
  }
  const ps = viewRange * cellSize + cellSize / 2;
  mCtx.save(); mCtx.translate(ps, ps); mCtx.rotate(player.viewDir);
  mCtx.fillStyle = "#fff"; mCtx.beginPath(); mCtx.moveTo(cellSize/3, 0); mCtx.lineTo(-cellSize/4, -cellSize/4); mCtx.lineTo(-cellSize/4, cellSize/4); mCtx.fill(); mCtx.restore();
}

function castRay(px, py, angle) {
  let dist = 0; const map = currentStage.map;
  while (dist < 20) {
    const rx = px + Math.cos(angle) * dist, ry = py + Math.sin(angle) * dist;
    const x = Math.floor(rx), y = Math.floor(ry);
    if (!map[y] || map[y][x] === undefined || map[y][x] === 1) return dist;
    dist += 0.03;
  }
  return dist;
}

const texSize = 64, textureCanvas = document.createElement("canvas");
textureCanvas.width = texSize; textureCanvas.height = texSize;
const tCtx = textureCanvas.getContext("2d");
tCtx.fillStyle = "#822"; tCtx.fillRect(0, 0, texSize, texSize);
tCtx.strokeStyle = "#211"; tCtx.lineWidth = 2;
for(let i=0; i<=4; i++) tCtx.strokeRect(0, i*(texSize/4), texSize, 0);
for(let i=0; i<4; i++) { for(let j=0; j<2; j++) {
    const x = j*(texSize/2) + (i%2===0 ? 0 : texSize/4);
    tCtx.strokeRect(x, i*(texSize/4), 0, texSize/4);
}}

function drawSprites(zBuffer, w, h, fov) {
  if (!itemImageReady || items.length === 0) { drawFallBackItems(zBuffer, w, h, fov); return; }
  items.forEach(it => {
    if (it.collected) return;
    const dx = it.x - player.viewX, dy = it.y - player.viewY;
    const vX = Math.cos(player.viewDir), vY = Math.sin(player.viewDir);
    const distPos = dx * vX + dy * vY;
    if (distPos <= 0.2) return;
    const rX = Math.cos(player.viewDir + Math.PI/2), rY = Math.sin(player.viewDir + Math.PI/2);
    const distR = dx * rX + dy * rY, sAngle = Math.atan2(distR, distPos);
    if (Math.abs(sAngle) > fov/2) return;
    const wallD = distPos * Math.cos(sAngle), sH = (h / wallD) * 0.25, sW = sH;
    const sXCenter = (0.5 + sAngle / fov) * w;
    const dXStart = Math.floor(sXCenter - sW/2), dXEnd = Math.floor(sXCenter + sW/2);
    const dYTop = Math.floor(h/2 - sH/2 + (h/wallD)*0.05);
    for (let i = dXStart; i < dXEnd; i++) {
        if (i >= 0 && i < w && zBuffer[i] >= distPos - 0.1) {
            ctx.drawImage(itemImage, Math.floor((i-dXStart)/sW*itemImage.width), 0, 1, itemImage.height, i, dYTop, 1, Math.floor(sH));
        }
    }
  });
}

function drawFallBackItems(zBuffer, w, h, fov) {
    items.forEach(it => {
        if (it.collected) return;
        const dx = it.x - player.viewX, dy = it.y - player.viewY;
        const distPos = dx * Math.cos(player.viewDir) + dy * Math.sin(player.viewDir);
        if (distPos <= 0.2) return;
        const distR = dx * Math.cos(player.viewDir + Math.PI/2) + dy * Math.sin(player.viewDir + Math.PI/2);
        const sAngle = Math.atan2(distR, distPos);
        if (Math.abs(sAngle) > fov/2) return;
        const wallD = distPos * Math.cos(sAngle), sH = (h / wallD) * 0.25, sW = sH;
        const sXCenter = (0.5 + sAngle / fov) * w;
        const dXStart = Math.floor(sXCenter - sW/2);
        if (dXStart >= 0 && dXStart < w && zBuffer[dXStart] >= distPos - 0.1) {
            ctx.fillStyle = "yellow"; ctx.fillRect(dXStart, h/2 - sH/2, sW, sH);
        }
    });
}

function startLevel(stageKey) {
  showScene("exploration"); initGame(stageKey);
  document.getElementById("timerDisplay").innerText = `TIME: ${currentLimit}`;
  if (!window.isLooping) { loop(); window.isLooping = true; }
}

function showResult(isSuccess, isTimeOut) {
  const stageId = currentStage.id;
  showScene("none");
  resultScreen.style.display = "flex";
  const resultTitle = document.getElementById("resultTitle");
  const resultDesc = document.getElementById("resultDesc");
  const resultGold = document.getElementById("resultGold");

  if (isSuccess) {
    sounds.clearJingle.currentTime = 0; sounds.clearJingle.play();
    resultTitle.innerText = "CLEAR !"; resultTitle.className = "success";
    const clientName = currentStage.name.includes("：") ? currentStage.name.split("：")[1] : "依頼人";
    resultDesc.innerHTML = `<span class="success">【${clientName}】</span><br>${(currentStage.successMsg || "任務を完遂しました。").replace(/\n/g, '<br>')}`;
    resultGold.innerText = `${currentStage.reward} ゴールド獲得！！`;
    userGold += currentStage.reward; localStorage.setItem('userGold', userGold);
    const timeUsed = selectedTime - currentLimit;
    const prevBest = localStorage.getItem(`bestTime_${stageId}`);
    if (!prevBest || timeUsed < parseInt(prevBest)) localStorage.setItem(`bestTime_${stageId}`, timeUsed);
  } else {
    sounds.failJingle.currentTime = 0; sounds.failJingle.play();
    resultTitle.innerText = "FAILED ..."; resultTitle.className = "failed";
    resultDesc.innerText = isTimeOut ? "魔法の効果が切れたが、何とか脱出した…" : "依頼品を回収できずに帰還した。";
    resultGold.innerText = "報酬なし";
  }
}

const setupInput = (id, keyName) => {
    const btn = document.getElementById(id); if (!btn) return;
    const start = (e) => { if (e.cancelable) e.preventDefault(); keys[keyName] = true; };
    const end = (e) => { if (e.cancelable) e.preventDefault(); keys[keyName] = false; };
    btn.addEventListener("touchstart", start, { passive: false });
    btn.addEventListener("touchend", end, { passive: false });
    btn.addEventListener("touchcancel", end, { passive: false });
    btn.addEventListener("mousedown", start); btn.addEventListener("mouseup", end); btn.addEventListener("mouseleave", end);
};
setupInput("up", "up"); setupInput("left", "left"); setupInput("right", "right"); setupInput("down", "down");
window.addEventListener("keydown", (e) => { if(e.key.includes("Arrow")) keys[e.key.replace("Arrow","").toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { if(e.key.includes("Arrow")) keys[e.key.replace("Arrow","").toLowerCase()] = false; });
window.addEventListener('contextmenu', (e) => e.preventDefault());

document.getElementById("toSelectButton").onclick = () => {
  sounds.menuBgm.play().then(() => showScene("select")).catch(() => showScene("select"));
};
document.getElementById("backToTitle").onclick = () => showScene("title");
document.getElementById("backToSelect").onclick = () => showScene("select");
document.getElementById("exitNo").onclick = () => { confirmDiv.style.display = "none"; gameActive = true; };

document.getElementById("exitYes").onclick = () => { 
  confirmDiv.style.display = "none"; 
  const allCollected = items.every(it => it.collected); 
  showResult(allCollected, false); 
};

document.getElementById("backFromResult").onclick = () => { resultScreen.style.display = "none"; showScene("title"); };
goButton.onclick = () => {
  if (userGold < selectedCost) { alert("ゴールドが足りません！"); return; }
  userGold -= selectedCost;
  localStorage.setItem('userGold', userGold);
  startLevel(tempStageKey);
  if (document.getElementById("missionModal")) document.getElementById("missionModal").style.display = "none";
};

function resize() {
  const c = document.getElementById("gameContainer");
  if (c) { canvas.width = c.clientWidth; canvas.height = c.clientHeight * 0.66; }
}
window.addEventListener("resize", resize);
function loop() { update(); draw(); requestAnimationFrame(loop); }
showScene("title");

document.addEventListener('touchstart', (e) => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime(); if (now - lastTouchEnd <= 300 && e.cancelable) e.preventDefault(); lastTouchEnd = now;
}, false);
document.addEventListener('touchmove', (e) => { if (!e.target.closest('#missionList') && e.cancelable) e.preventDefault(); }, { passive: false });
let audioStarted = false;
window.startAudio = function() { if (audioStarted) return; playBgm(sounds.menuBgm); audioStarted = true; };
window.resetAllData = function() { if (confirm("これまでの踏破記録や所持金をすべてリセットしますか？")) { localStorage.clear(); location.reload(); } };