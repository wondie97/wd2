// js/main.js - 0.6-side (이동 + 점프 + 공격 + 히트 연출 + 부활 대응)

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const nickname = localStorage.getItem("wondie_nickname");
if (!nickname) {
  window.location.href = "index.html";
}

document.getElementById("hudNickname").textContent = `닉네임: ${nickname}`;
const hudHpEl = document.getElementById("hudHp");
const hudLvEl = document.getElementById("hudLv");
const hudExpEl = document.getElementById("hudExp");


// 🔹 게이지 바 엘리먼트
const hpFillEl  = document.querySelector(".stat-fill.hp");
const mpFillEl  = document.querySelector(".stat-fill.mp");
const expFillEl = document.querySelector(".stat-fill.exp");
document.getElementById("btnBack").addEventListener("click", () => {
  localStorage.removeItem("wondie_nickname");
  window.location.href = "index.html";
});

const world = {
  width: 2400,
  height: canvas.height,
  groundY: canvas.height - 90,
};

const camera = {
  x: 0,
  y: 0,
  width: canvas.width,
  height: canvas.height,
  follow(player) {
    const targetX = player.x + player.width / 2 - this.width / 2;
    const t = 0.15;
    this.x += (targetX - this.x) * t;
    if (this.x < 0) this.x = 0;
    if (this.x + this.width > world.width) this.x = world.width - this.width;
  },
};

const player = new window.Player(120, world.groundY - 96, nickname);

const enemies = [
  new window.Enemy(600, world.groundY - 96),
  new window.Enemy(980, world.groundY - 96),
];

// 데미지 텍스트(히트 숫자) 리스트
const damageTexts = [];

let hitStopTimer = 0;      // 히트스톱 시간
let screenShake = 0;       // 화면 흔들림 강도

function spawnDamageText(x, y, value, color = "#ffd166") {
  damageTexts.push({
    x,
    y,
    value,
    color,
    life: 0.6,
    maxLife: 0.6,
    vy: -42,
    offsetX: (Math.random() * 8) - 4, // 살짝 좌우 랜덤
  });
}

// LV / HP / EXP 숫자 갱신
// LV / HP / EXP 숫자 + 게이지 갱신
function updateHpHud() {
  // 텍스트
  if (hudHpEl) {
    hudHpEl.textContent = `${player.hp} / ${player.maxHp}`;
  }
  if (hudLvEl) {
    hudLvEl.textContent = `${player.level}`;
  }
  if (hudExpEl) {
    hudExpEl.textContent = `${player.exp} / ${player.expToNext}`;
  }

  // HP 게이지
  if (hpFillEl) {
    const ratio = player.maxHp > 0 ? player.hp / player.maxHp : 0;
    const clamped = Math.max(0, Math.min(1, ratio));
    hpFillEl.style.width = (clamped * 100).toFixed(1) + "%";
  }

  // EXP 게이지
  if (expFillEl) {
    const ratioExp = player.expToNext > 0 ? player.exp / player.expToNext : 0;
    const clampedExp = Math.max(0, Math.min(1, ratioExp));
    expFillEl.style.width = (clampedExp * 100).toFixed(1) + "%";
  }

  // MP는 아직 로직 없으면 임시로 항상 풀 게이지
  if (mpFillEl) {
    mpFillEl.style.width = "100%";
  }
}

updateHpHud();

const keys = new Set();

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  // 죽어 있을 때는 입력 받지 않음
  if (player.dead) return;

  if (["arrowleft","arrowright","arrowup"," ","a","d","w","j"].includes(key)) {
    e.preventDefault();
  }

  // 공격 키: J
  if (key === "j") {
    player.startAttack();
    return;
  }

  keys.add(key);
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  keys.delete(key);
});

function handleInput() {
  let movingH = false;

  if (keys.has("arrowleft") || keys.has("a")) {
    player.moveLeft();
    movingH = true;
  }
  if (keys.has("arrowright") || keys.has("d")) {
    player.moveRight();
    movingH = true;
  }
  if (!movingH) {
    player.stopHorizontal();
  }

  if (keys.has("arrowup") || keys.has("w") || keys.has(" ")) {
    player.jump();
  }
}

let lastTime = 0;

function loop(ts) {
  const dt = (ts - lastTime) / 1000;
  lastTime = ts;

  update(dt);
  render();
  requestAnimationFrame(loop);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

let lastAttackId = 0;

function update(dt) {
  // 히트스톱/스크린 셰이크 시간 감소
  if (hitStopTimer > 0) {
    hitStopTimer -= dt;
    if (hitStopTimer < 0) hitStopTimer = 0;
  }
  if (screenShake > 0) {
    screenShake -= dt * 20;
    if (screenShake < 0) screenShake = 0;
  }

  const frozen = hitStopTimer > 0;
  const simDt = frozen ? 0 : dt;

  handleInput();
  player.applyPhysics(simDt, world.groundY, world.width);

  // 적 업데이트
  enemies.forEach(e => e.update(simDt, world.groundY));

  // 데미지 텍스트 업데이트 (히트스톱과 상관없이 부드럽게)
  for (let i = damageTexts.length - 1; i >= 0; i--) {
    const t = damageTexts[i];
    t.life -= dt;
    t.y += t.vy * dt;
    if (t.life <= 0) {
      damageTexts.splice(i, 1);
    }
  }

  // 플레이어 공격 판정
  if (player.attacking && !player.dead) {
    const attackWidth = 56;
    const attackRect = {
      x: player.facing === 1 ? player.x + player.width : player.x - attackWidth,
      y: player.y,
      w: attackWidth,
      h: player.height,
    };

    enemies.forEach(enemy => {
      if (enemy.dead) return;
      if (rectsOverlap(attackRect, enemy.rect)) {
        const died = enemy.takeHit(player.currentAttackId, player.facing);

        const ex = enemy.x + enemy.width / 2;
        const ey = enemy.y - 10;
        spawnDamageText(ex, ey, 1, "#ffeaa7");

        // 히트 연출 강화
        hitStopTimer = Math.max(hitStopTimer, died ? 0.08 : 0.05);
        screenShake = Math.max(screenShake, died ? 6 : 4);

        if (died) {
          const gain = 3;
          player.exp += gain;
          spawnDamageText(ex, ey - 12, `+${gain} EXP`, "#74b9ff");

          // 레벨업 체크
          while (player.exp >= player.expToNext) {
            player.exp -= player.expToNext;
            player.level += 1;
            player.expToNext = Math.floor(player.expToNext * 1.4 + 3);
            player.maxHp += 1;
            player.hp = player.maxHp;
            spawnDamageText(
              player.x + player.width / 2,
              player.y - 14,
              `LEVEL UP!`,
              "#55efc4"
            );
          }

          updateHpHud();
        }
      }
    });
  }

  // 적과 플레이어 충돌 (플레이어 피해)
  enemies.forEach(enemy => {
    if (enemy.dead) return;
    if (player.dead) return; // 🔹 죽어 있을 땐 더 이상 맞지 않음

    const prect = { x: player.x, y: player.y, w: player.width, h: player.height };

    // 🔹 무적 시간일 때는 데미지/히트 연출 없음
    if (rectsOverlap(prect, enemy.rect) && player.invincibleTime <= 0) {
      const dir = player.x < enemy.x ? -1 : 1;
      player.takeHit(1, -dir * 220);

      const px = player.x + player.width / 2;
      const py = player.y - 8;
      spawnDamageText(px, py, 1, "#ff7675");

      hitStopTimer = Math.max(hitStopTimer, 0.09);
      screenShake = Math.max(screenShake, 7);

      updateHpHud();
    }
  });

  camera.follow(player);
  updateHpHud(); // 🔹 부활/레벨업 후 HUD 항상 최신 상태로
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let shakeX = 0;
  let shakeY = 0;
  if (screenShake > 0) {
    const mag = screenShake;
    shakeX = (Math.random() * 2 - 1) * mag;
    shakeY = (Math.random() * 2 - 1) * mag;
  }

  ctx.save();
  ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

  drawBackground();
  drawGround();
  drawDecor();
  enemies.forEach(e => e.draw(ctx));
  player.draw(ctx);

  // 데미지 텍스트 렌더링 (더 크게, 오프셋 반영)
  damageTexts.forEach(t => {
    const alpha = Math.max(t.life / t.maxLife, 0);
    const drawX = t.x + (t.offsetX || 0);
    const drawY = t.y;
    ctx.font = "16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
    ctx.fillText(t.value, drawX + 1, drawY + 1);
    ctx.fillStyle = t.color || "#ffffff";
    ctx.globalAlpha = alpha;
    ctx.fillText(t.value, drawX, drawY);
    ctx.globalAlpha = 1.0;
  });

  ctx.restore();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, world.height);
  grad.addColorStop(0, "#74b9ff");
  grad.addColorStop(0.4, "#4b7bec");
  grad.addColorStop(1, "#1e272e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  for (let i = 0; i < 6; i++) {
    const baseX = i * 420;
    ctx.beginPath();
    ctx.moveTo(baseX - 80, world.groundY);
    ctx.lineTo(baseX + 120, world.groundY - 120);
    ctx.lineTo(baseX + 320, world.groundY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGround() {
  const gy = world.groundY;
  const h = world.height - gy;

  ctx.fillStyle = "#2d3436";
  ctx.fillRect(0, gy, world.width, h);

  ctx.fillStyle = "#636e72";
  ctx.fillRect(0, gy - 4, world.width, 4);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  const tileW = 40;
  for (let x = 0; x < world.width; x += tileW) {
    ctx.fillRect(x + 4, gy - 10, tileW - 8, 6);
  }
}

function drawDecor() {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let i = 0; i < 8; i++) {
    const baseX = 160 + i * 260;
    ctx.fillRect(baseX, world.groundY - 80, 8, 80);
    ctx.beginPath();
    ctx.arc(baseX + 4, world.groundY - 90, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(world.width / 2 - 100, world.groundY - 110);
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, 200, 60);
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fillRect(8, 8, 184, 44);

  ctx.font = "16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f5f6fa";
  ctx.fillText("WonDieWorld Plaza", 100, 30);
  ctx.restore();
}

requestAnimationFrame(loop);

