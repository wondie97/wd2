// js/sprite.js - 스프라이트 기반 플레이어 (이동 + 점프 + 공격 + 피격) & 간단한 적

// 각 시트는 1행 구조, 프레임이 가로로 나열.
// 모든 시트의 프레임 크기는 128x128.

const SPRITES = {
  idle:   { img: new Image(), src: "img/sprites/Idle.png",     frameCount: 6,  loop: true },
  walk:   { img: new Image(), src: "img/sprites/Run.png",      frameCount: 8,  loop: true },
  jump:   { img: new Image(), src: "img/sprites/Jump.png",     frameCount: 10, loop: true },
  attack: { img: new Image(), src: "img/sprites/Attack_1.png", frameCount: 4,  loop: false },
  hurt:   { img: new Image(), src: "img/sprites/Hurt.png",     frameCount: 3,  loop: false },
  dead:   { img: new Image(), src: "img/sprites/Dead.png",     frameCount: 4,  loop: false },
};

const FRAME_W = 128;
const FRAME_H = 128;

Object.values(SPRITES).forEach(sheet => {
  sheet.img.src = sheet.src;
});

// 적 전용 스프라이트 (미노타우로스)
const ENEMY_SPRITES = {
  idle: {
    img: new Image(),
    src: "img/sprites/monster_idle.png",
    cols: 3,
    rows: 2,
    frameCount: 6,
    loop: true,
  },
  walk: {
    img: new Image(),
    src: "img/sprites/monster_walk.png",
    cols: 4,
    rows: 4,     // 시트는 4x4 그리드라고 가정
    frameCount: 4, // ✅ 걷는 프레임은 첫 줄 4개만 사용
    loop: true,
  },
};

Object.values(ENEMY_SPRITES).forEach(sheet => {
  sheet.img.src = sheet.src;
});

class Player {
  constructor(x, y, nickname) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;

    // 물리 충돌 박스
    this.width = 52;
    this.height = 96;

    this.moveSpeed = 260;
    this.jumpPower = 520;
    this.gravity = 1500;
    this.maxFallSpeed = 900;

    this.onGround = false;
    this.facing = 1; // 1: 오른쪽, -1: 왼쪽
    this.movingH = false;

    this.nickname = nickname || "Player";

    // 🔹 리스폰 정보 (추가)
    this.spawnX = x;
    this.spawnY = y;
    this.respawnTimer = 0;

    // 전투 상태
    this.maxHp = 5;
    this.hp = this.maxHp;
    this.invincibleTime = 0; // 피격 후 무적 시간(초)
    this.dead = false;

    // 레벨/경험치 (향후 확장용)
    this.level = 1;
    this.exp = 0;
    this.expToNext = 10;

    // 애니메이션 상태
    this.state = "idle";  // idle | walk | jump | attack | hurt | dead
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frameDuration = 0.08; // 기본 12.5fps 느낌

    // 공격 중 여부
    this.attacking = false;
  }

  moveLeft() {
    this.vx = -this.moveSpeed;
    this.facing = -1;
    this.movingH = true;
  }

  moveRight() {
    this.vx = this.moveSpeed;
    this.facing = 1;
    this.movingH = true;
  }

  stopHorizontal() {
    this.vx = 0;
    this.movingH = false;
  }

  jump() {
    if (this.dead) return;
    if (this.onGround && !this.attacking) {
      this.vy = -this.jumpPower;
      this.onGround = false;
    }
  }

  startAttack() {
    if (this.dead) return;
    if (this.attacking) return;
    // 공중에서는 공격 잠시 막아두자 (원하면 지워도 됨)
    if (!this.onGround) return;

    this.attacking = true;
    if (this.currentAttackId == null) this.currentAttackId = 0;
    this.currentAttackId++;
    this.state = "attack";
    this.frameIndex = 0;
    this.frameTimer = 0;
  }

  takeHit(damage, knockbackX = 0) {
    if (this.dead) return;
    if (this.invincibleTime > 0) return;

    this.hp -= damage;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.state = "dead";
      this.frameIndex = 0;
      this.frameTimer = 0;
      this.vx = 0;
      // 약간 뒤로 넘어지는 느낌
      this.vy = -this.jumpPower * 0.4;
    } else {
      this.state = "hurt";
      this.frameIndex = 0;
      this.frameTimer = 0;
      this.invincibleTime = 1.0; // 1초 무적
      // 넉백
      this.vx = knockbackX;
      this.vy = -this.jumpPower * 0.3;
    }
  }

  applyPhysics(dt, groundY, worldWidth) {
    // 🔹 사망 후 일정 시간 지나면 리스폰
    if (this.dead) {
      this.respawnTimer += dt;
      if (this.respawnTimer >= 2.0) {  // 2초 후 부활
        this.respawnTimer = 0;
        this.dead = false;
        this.hp = this.maxHp;
        this.state = "idle";
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.vx = 0;
        this.vy = 0;
        this.invincibleTime = 1.0; // 부활 직후 1초 무적
      }
    }

    if (this.invincibleTime > 0) {
      this.invincibleTime -= dt;
      if (this.invincibleTime < 0) this.invincibleTime = 0;
    }

    // 중력
    this.vy += this.gravity * dt;
    if (this.vy > this.maxFallSpeed) this.vy = this.maxFallSpeed;

    // 위치
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 바닥 충돌
    const feet = this.y + this.height;
    if (feet >= groundY) {
      this.y = groundY - this.height;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // 좌우 경계
    if (this.x < 0) this.x = 0;
    if (this.x + this.width > worldWidth) this.x = worldWidth - this.width;

    this.updateAnimation(dt);
  }

  updateAnimation(dt) {
    // 사망 상태면 고정
    if (this.dead) {
      this.state = "dead";
    } else if (this.attacking) {
      this.state = "attack";
    } else if (this.invincibleTime > 0 && this.state === "hurt") {
      // 피격 모션 유지
      this.state = "hurt";
    } else {
      // 이동/점프 상태
      if (!this.onGround) {
        this.state = "jump";
      } else if (this.movingH && Math.abs(this.vx) > 5) {
        this.state = "walk";
      } else {
        this.state = "idle";
      }
    }

    const sheet = SPRITES[this.state];
    if (!sheet || !sheet.img.complete) return;

    this.frameTimer += dt;
    let duration = this.frameDuration;
    if (this.state === "attack") duration = 0.07;
    else if (this.state === "hurt") duration = 0.09;
    else if (this.state === "dead") duration = 0.12;

    if (this.frameTimer >= duration) {
      this.frameTimer -= duration;
      this.frameIndex++;

      if (this.frameIndex >= sheet.frameCount) {
        if (sheet.loop) {
          this.frameIndex = 0;
        } else {
          // one-shot 종료 처리
          this.frameIndex = sheet.frameCount - 1;
          if (this.state === "attack") {
            this.attacking = false;
          } else if (this.state === "hurt") {
            // 피격 모션 끝나면 다시 idle/walk/jump 로 돌아가도록 invincibleTime만 유지
            if (this.onGround) this.state = "idle";
          }
        }
      }
    }
  }

  draw(ctx) {
    const sheet = SPRITES[this.state];
    if (!sheet || !sheet.img.complete) {
      this.drawFallback(ctx);
      return;
    }

    // 피격 무적 중에는 깜빡이기
    if (this.invincibleTime > 0 && Math.floor(this.invincibleTime * 20) % 2 === 0) {
      // 그리기 스킵 (투명 프레임)
      return;
    }

    const fw = FRAME_W;
    const fh = FRAME_H;
    const sx = fw * Math.floor(this.frameIndex);
    const sy = 0;

    // 충돌 박스 높이에 맞춰 스케일
    const scale = this.height / fh;
    const drawW = fw * scale;
    const drawH = fh * scale;

    const drawX = this.x + (this.width - drawW) / 2;
    const drawY = this.y + (this.height - drawH);

    ctx.save();

    // 그림자
    ctx.beginPath();
    const shadowY = this.y + this.height + 6;
    ctx.ellipse(
      this.x + this.width / 2,
      shadowY,
      this.width * 0.6,
      6,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fill();

    // 좌우 반전
    if (this.facing === -1) {
      ctx.translate(drawX + drawW / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(drawX + drawW / 2), 0);
    }

    ctx.drawImage(sheet.img, sx, sy, fw, fh, drawX, drawY, drawW, drawH);

    // 닉네임 (캐릭터 아래)
    if (this.nickname) {
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const nameY = this.y + this.height + 4;
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillText(this.nickname, this.x + this.width / 2 + 1, nameY + 1);
      ctx.fillStyle = "#f8f8f8";
      ctx.fillText(this.nickname, this.x + this.width / 2, nameY);
    }

    ctx.restore();
  }

  drawFallback(ctx) {
    const x = this.x;
    const y = this.y;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.beginPath();
    const shadowY = y + h + 6;
    ctx.ellipse(
      x + w / 2,
      shadowY,
      w * 0.6,
      6,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fill();

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "#ffd166");
    grad.addColorStop(1, "#fca311");

    const r = 10;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.stroke();

    // 닉네임 (캐릭터 아래)
    if (this.nickname) {
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const nameY = y + h + 4;
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillText(this.nickname, x + w / 2 + 1, nameY + 1);
      ctx.fillStyle = "#f8f8f8";
      ctx.fillText(this.nickname, x + w / 2, nameY);
    }

    ctx.restore();
  }
}

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 80;
    this.height = 80;

    this.speed = 90;
    this.direction = -1; // -1 왼쪽, 1 오른쪽

    this.patrolRange = 140;
    this.originX = x;

    this.baseHp = 3;
    this.hp = this.baseHp;
    this.dead = false;
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frameDuration = 0.12;

    // 사망 연출: 3초 동안 시체 보이고, 그 뒤 4초 숨었다가 리젠
    this.deathVisibleDuration = 3.0;
    this.respawnDelay = 4.0;
    this.respawnTimer = 0;
  }

  get rect() {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }

  takeHit(attackId, knockbackDir = 1) {
    if (this.dead) return false;

    let died = false;
    this.hp -= 1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.respawnTimer = 0;
      died = true;
    }

    // 간단 넉백
    this.x += knockbackDir * 8;
    return died;
  }

  update(dt, groundY) {
    if (this.dead) {
      // 리젠 타이머: 3초 동안은 시체가 보이고, 이후 4초간은 숨김
      this.respawnTimer += dt;
      const totalWait = this.deathVisibleDuration + this.respawnDelay;
      if (this.respawnTimer >= totalWait) {
        this.dead = false;
        this.hp = this.baseHp;
        this.x = this.originX;
        this.direction = -1;
        this.respawnTimer = 0;
      }
    } else {
      this.x += this.speed * this.direction * dt;

      if (this.x < this.originX - this.patrolRange) {
        this.x = this.originX - this.patrolRange;
        this.direction = 1;
      } else if (this.x > this.originX + this.patrolRange) {
        this.x = this.originX + this.patrolRange;
        this.direction = -1;
      }
    }

    // 항상 "히트박스 하단 = groundY" 로 고정
    this.y = groundY - this.height;

    // 애니메이션
    this.frameTimer += dt;
    const sheet = ENEMY_SPRITES.walk;
    if (!sheet || !sheet.img.complete) return;

    if (this.frameTimer >= this.frameDuration) {
      this.frameTimer -= this.frameDuration;
      this.frameIndex = (this.frameIndex + 1) % sheet.frameCount;
    }
  }

  draw(ctx) {
    if (this.dead) {
      // 사망 상태: 일정 시간 동안은 시체 스프라이트(idle 포즈) 보여주고, 이후에는 숨김
      if (this.respawnTimer > this.deathVisibleDuration) {
        return;
      }
    }

    const sheet = this.dead ? ENEMY_SPRITES.idle : ENEMY_SPRITES.walk;
    if (!sheet || !sheet.img.complete) {
      // fallback 사각형
      ctx.fillStyle = "#ff7675";
      ctx.fillRect(this.x, this.y, this.width, this.height);
      return;
    }

    const cols = sheet.cols || 1;
    const rows = sheet.rows || 1;
    const fw = sheet.img.width / cols;
    const fh = sheet.img.height / rows;

    // walk 시트는 첫 번째 줄 4프레임만 사용
    let frame = Math.floor(this.frameIndex) % sheet.frameCount;
    let sx, sy;
    if (sheet === ENEMY_SPRITES.walk) {
      sx = fw * frame;
      sy = 0;
    } else {
      sx = fw * (frame % cols);
      sy = fh * Math.floor(frame / cols);
    }

    // 기본 스케일
    const scale = this.height / fh;
    const drawW = fw * scale;
    const drawH = fh * scale;
    const drawX = this.x + (this.width - drawW) / 2;

    // 프레임 아래 여백 보정 (위로 올림)
    const FOOT_OFFSET = 55;          // 필요하면 50~65 사이에서 조절
    const drawY = this.y + (this.height - drawH) - FOOT_OFFSET * scale;

    ctx.save();

    // 그림자
    ctx.beginPath();
    const shadowY = this.y + this.height + 6;
    ctx.ellipse(
      this.x + this.width / 2,
      shadowY,
      this.width * 0.6,
      6,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fill();

    // 방향 (플레이어와 반대로 좌우 반전)
    if (this.direction === 1) {
      ctx.translate(drawX + drawW / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(drawX + drawW / 2), 0);
    }

    ctx.drawImage(sheet.img, sx, sy, fw, fh, drawX, drawY, drawW, drawH);

    ctx.restore();
  }
}

window.Player = Player;
window.Enemy = Enemy;
