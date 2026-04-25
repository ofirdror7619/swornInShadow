import Phaser from "phaser";
import { GameState } from "../core/GameState";

const ENEMY_SCALE = 0.46;
const PATROL_SPEED = 78;
const CHASE_SPEED = 110;
const CHASE_RADIUS = 260;
const ATTACK_RANGE = 84;
const ATTACK_COOLDOWN_MS = 1300;
const WINDUP_MS = 360;
const LUNGE_MS = 220;
const RECOVER_MS = 360;
const LUNGE_SPEED = 300;
const SHADOWSTEP_WINDUP_MS = 190;
const SHADOWSTEP_LUNGE_SPEED = 370;
const SHADOWSTEP_COOLDOWN_MS = 2400;
const SHADOWSTEP_MIN_RANGE = 120;
const SHADOWSTEP_MAX_RANGE = 320;
const SHADOWSTEP_OFFSET_X_MIN = 90;
const SHADOWSTEP_OFFSET_X_MAX = 130;
const SHADOWSTEP_OFFSET_Y = 44;
const FEINT_MIN_RANGE = 90;
const FEINT_MAX_RANGE = 220;
const FEINT_WINDUP_MS = 170;
const FEINT_STEP_MS = 120;
const FEINT_STEP_SPEED = 290;
const FEINT_LUNGE_WINDUP_MS = 140;
const FEINT_LUNGE_SPEED = 410;
const FEINT_COOLDOWN_MS = 2100;
const MAX_HEALTH = 30;
const CONTACT_DAMAGE = 12;
const RENDER_DEPTH = 500;
const PHYSICS_BODY_WIDTH = 96;
const PHYSICS_BODY_HEIGHT = 136;
const PHYSICS_OFFSET_X = 82;
const PHYSICS_OFFSET_Y = 350;

export class EnemyDemon extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, patrol, options = {}) {
    super(scene, x, y, "demon-body");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(ENEMY_SCALE);
    this.setOrigin(0.5);
    this.setDepth(RENDER_DEPTH);
    this.setCollideWorldBounds(true);
    this.body.setAllowGravity(false);
    this.body.setDrag(1600, 1600);
    this.body.setMaxVelocity(320, 320);
    this.body.setSize(PHYSICS_BODY_WIDTH, PHYSICS_BODY_HEIGHT);
    this.body.setOffset(PHYSICS_OFFSET_X, PHYSICS_OFFSET_Y);

    this.leftBound = patrol.left;
    this.rightBound = patrol.right;
    this.patrolY = patrol.y;
    this.patrolDir = 1;
    this.state = "patrol";
    this.attackCooldownLeft = Phaser.Math.Between(180, 520);
    this.stateTimeLeft = 0;
    this.attackVector = new Phaser.Math.Vector2(1, 0);
    this.health = MAX_HEALTH;
    this.isDead = false;
    this.contactDamage = CONTACT_DAMAGE;
    this.enemyType = "demon";
    this.behaviorProfile = options.behavior ?? "brute";
    this.shadowstepCooldownLeft =
      this.behaviorProfile === "shadowstep"
        ? Phaser.Math.Between(500, 1300)
        : SHADOWSTEP_COOLDOWN_MS;
    this.feintCooldownLeft = Phaser.Math.Between(800, 1700);
    this.feintDir = 1;
    this.enraged = false;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (this.isDead) return;

    this.attackCooldownLeft = Math.max(0, this.attackCooldownLeft - delta);
    this.shadowstepCooldownLeft = Math.max(0, this.shadowstepCooldownLeft - delta);
    this.feintCooldownLeft = Math.max(0, this.feintCooldownLeft - delta);

    if (!this.enraged && this.health <= MAX_HEALTH * 0.4) {
      this.enterEnrage();
    }

    if (this.enraged && (this.state === "patrol" || this.state === "chase" || this.state === "recover")) {
      const pulse = 0.5 + Math.sin(time * 0.02) * 0.5;
      const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xff4d4d),
        Phaser.Display.Color.ValueToColor(0xff9a5b),
        100,
        Math.round(pulse * 100)
      ).color;
      this.setTint(tint);
    }
  }

  updateBehavior(player, deltaMs) {
    if (this.isDead || !player?.active) return;

    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (this.state === "patrol") {
      this.runPatrolStep();
      if (distance <= CHASE_RADIUS) {
        this.state = "chase";
      }
      return;
    }

    if (this.state === "chase") {
      const toPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y);
      const dir = toPlayer.clone().normalize();
      const chaseSpeed = this.enraged ? CHASE_SPEED * 1.18 : CHASE_SPEED;
      this.body.setVelocity(dir.x * chaseSpeed, dir.y * chaseSpeed);
      if (Math.abs(this.body.velocity.x) > 4) {
        this.setFlipX(this.body.velocity.x < 0);
      }

      if (this.shouldShadowstep(distance)) {
        this.state = "shadowstep_windup";
        this.stateTimeLeft = SHADOWSTEP_WINDUP_MS;
        this.body.setVelocity(0, 0);
        this.setTint(0xc48cff);
        return;
      }

      if (this.shouldFeint(distance)) {
        this.state = "feint_windup";
        this.stateTimeLeft = FEINT_WINDUP_MS;
        this.body.setVelocity(0, 0);
        this.feintDir = Math.random() < 0.5 ? -1 : 1;
        this.setTint(0xd782ff);
        return;
      }

      if (distance <= ATTACK_RANGE && this.attackCooldownLeft <= 0) {
        this.state = "windup";
        this.stateTimeLeft = WINDUP_MS;
        this.attackVector = dir.lengthSq() > 0.001 ? dir : new Phaser.Math.Vector2(1, 0);
        this.body.setVelocity(0, 0);
        this.setTint(0xffa64d);
        return;
      }

      if (distance > CHASE_RADIUS * 1.25) {
        this.state = "patrol";
      }
      return;
    }

    if (this.state === "shadowstep_windup") {
      this.stateTimeLeft -= deltaMs;
      this.body.setVelocity(0, 0);
      if (this.stateTimeLeft <= 0) {
        this.clearTint();
        this.executeShadowstep(player);
        this.state = "lunge";
        this.stateTimeLeft = LUNGE_MS;
        this.body.setVelocity(
          this.attackVector.x * SHADOWSTEP_LUNGE_SPEED,
          this.attackVector.y * SHADOWSTEP_LUNGE_SPEED
        );
        this.attackCooldownLeft = this.getAttackCooldownMs();
      }
      return;
    }

    if (this.state === "feint_windup") {
      this.stateTimeLeft -= deltaMs;
      this.body.setVelocity(0, 0);
      if (this.stateTimeLeft <= 0) {
        this.clearTint();
        this.state = "feint_step";
        this.stateTimeLeft = FEINT_STEP_MS;
      }
      return;
    }

    if (this.state === "feint_step") {
      this.stateTimeLeft -= deltaMs;
      const toPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y);
      const side = new Phaser.Math.Vector2(-toPlayer.y, toPlayer.x);
      const safeSide = side.lengthSq() > 0.001 ? side.normalize() : new Phaser.Math.Vector2(this.feintDir, 0);
      this.body.setVelocity(
        safeSide.x * FEINT_STEP_SPEED * this.feintDir,
        safeSide.y * FEINT_STEP_SPEED * this.feintDir
      );
      if (this.stateTimeLeft <= 0) {
        this.state = "feint_lunge_windup";
        this.stateTimeLeft = FEINT_LUNGE_WINDUP_MS;
        this.body.setVelocity(0, 0);
        const towardPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y);
        this.attackVector =
          towardPlayer.lengthSq() > 0.0001
            ? towardPlayer.normalize()
            : new Phaser.Math.Vector2(this.feintDir, 0);
        this.setTint(0xffcb79);
      }
      return;
    }

    if (this.state === "feint_lunge_windup") {
      this.stateTimeLeft -= deltaMs;
      this.body.setVelocity(0, 0);
      if (this.stateTimeLeft <= 0) {
        this.clearTint();
        this.state = "lunge";
        this.stateTimeLeft = LUNGE_MS;
        const lungeSpeed = this.enraged ? FEINT_LUNGE_SPEED * 1.08 : FEINT_LUNGE_SPEED;
        this.body.setVelocity(this.attackVector.x * lungeSpeed, this.attackVector.y * lungeSpeed);
        this.attackCooldownLeft = this.getAttackCooldownMs();
        this.feintCooldownLeft = FEINT_COOLDOWN_MS;
      }
      return;
    }

    if (this.state === "windup") {
      this.stateTimeLeft -= deltaMs;
      this.body.setVelocity(0, 0);
      if (this.stateTimeLeft <= 0) {
        this.clearTint();
        this.state = "lunge";
        this.stateTimeLeft = LUNGE_MS;
        const lungeSpeed = this.enraged ? LUNGE_SPEED * 1.1 : LUNGE_SPEED;
        this.body.setVelocity(this.attackVector.x * lungeSpeed, this.attackVector.y * lungeSpeed);
      }
      return;
    }

    if (this.state === "lunge") {
      this.stateTimeLeft -= deltaMs;
      if (this.stateTimeLeft <= 0) {
        this.state = "recover";
        this.stateTimeLeft = RECOVER_MS;
        this.body.setVelocity(0, 0);
      }
      return;
    }

    if (this.state === "recover") {
      this.stateTimeLeft -= deltaMs;
      this.body.setVelocity(0, 0);
      if (this.stateTimeLeft <= 0) {
        this.state = "chase";
        this.attackCooldownLeft = this.getAttackCooldownMs();
      }
    }
  }

  runPatrolStep() {
    if (this.x >= this.rightBound) {
      this.patrolDir = -1;
    } else if (this.x <= this.leftBound) {
      this.patrolDir = 1;
    }
    const patrolSpeed = this.enraged ? PATROL_SPEED * 1.2 : PATROL_SPEED;
    this.body.setVelocity(this.patrolDir * patrolSpeed, (this.patrolY - this.y) * 2.8);
    this.setFlipX(this.patrolDir < 0);
  }

  canDamagePlayer() {
    return !this.isDead && this.state === "lunge";
  }

  shouldShadowstep(distance) {
    if (this.behaviorProfile !== "shadowstep") return false;
    if (this.shadowstepCooldownLeft > 0) return false;
    return distance >= SHADOWSTEP_MIN_RANGE && distance <= SHADOWSTEP_MAX_RANGE;
  }

  shouldFeint(distance) {
    if (this.feintCooldownLeft > 0) return false;
    if (this.state !== "chase") return false;
    return distance >= FEINT_MIN_RANGE && distance <= FEINT_MAX_RANGE;
  }

  executeShadowstep(player) {
    const fromX = this.x;
    const fromY = this.y;
    const playerHeading =
      player.body?.velocity.x < -20 ? -1 : player.body?.velocity.x > 20 ? 1 : player.x >= this.x ? 1 : -1;
    const behindX =
      player.x - playerHeading * Phaser.Math.Between(SHADOWSTEP_OFFSET_X_MIN, SHADOWSTEP_OFFSET_X_MAX);
    const rawX = Phaser.Math.Clamp(behindX, this.leftBound + 36, this.rightBound - 36);
    const rawY = player.y + Phaser.Math.Between(-SHADOWSTEP_OFFSET_Y, SHADOWSTEP_OFFSET_Y);
    const worldBounds = this.scene.physics.world.bounds;
    const x = Phaser.Math.Clamp(rawX, worldBounds.x + 28, worldBounds.right - 28);
    const y = Phaser.Math.Clamp(rawY, worldBounds.y + 48, worldBounds.bottom - 48);

    this.shadowstepCooldownLeft = SHADOWSTEP_COOLDOWN_MS;
    this.body.reset(x, y);
    this.spawnShadowstepBurst(fromX, fromY);
    this.spawnShadowstepBurst(x, y);

    const toPlayer = new Phaser.Math.Vector2(player.x - x, player.y - y);
    this.attackVector = toPlayer.lengthSq() > 0.001 ? toPlayer.normalize() : new Phaser.Math.Vector2(playerHeading, 0);
    this.setFlipX(this.attackVector.x < 0);
  }

  spawnShadowstepBurst(x, y) {
    const flash = this.scene.add.image(x, y, "fx-gold");
    flash.setDepth(RENDER_DEPTH + 1);
    flash.setScale(2.4);
    flash.setTint(0xbe7dff);
    flash.setBlendMode("ADD");
    flash.setAlpha(0.72);
    this.scene.tweens.add({
      targets: flash,
      scale: 0.45,
      alpha: 0,
      duration: 170,
      ease: "Sine.easeOut",
      onComplete: () => flash.destroy()
    });
  }

  takeDamage(amount, hitDir) {
    if (this.isDead) return false;

    this.health -= amount;
    if (this.isRoomEnemy && this.spawnRoomId && this.spawnEnemyId) {
      GameState.setRoomEnemyHealth(this.spawnRoomId, this.spawnEnemyId, this.health);
    }
    this.setTint(0xff5f5f);
    this.scene.time.delayedCall(90, () => {
      if (this.active) this.clearTint();
    });

    if (hitDir && this.body) {
      this.body.velocity.x += hitDir.x * 110;
      this.body.velocity.y += hitDir.y * 110;
    }

    if (this.health <= 0) {
      this.isDead = true;
      if (this.isRoomEnemy && this.spawnRoomId && this.spawnEnemyId) {
        GameState.setRoomEnemyHealth(this.spawnRoomId, this.spawnEnemyId, 0);
        GameState.markRoomEnemyDefeated(this.spawnRoomId, this.spawnEnemyId);
      }
      this.body.setVelocity(0, 0);
      this.disableBody(true, true);
      return true;
    }

    if (
      this.state === "windup" ||
      this.state === "shadowstep_windup" ||
      this.state === "lunge" ||
      this.state === "feint_windup" ||
      this.state === "feint_step" ||
      this.state === "feint_lunge_windup"
    ) {
      this.state = "recover";
      this.stateTimeLeft = RECOVER_MS;
      this.attackCooldownLeft = this.getAttackCooldownMs();
    }

    return false;
  }

  enterEnrage() {
    this.enraged = true;
    this.contactDamage += 4;
    this.spawnShadowstepBurst(this.x, this.y);
    this.scene.cameras.main.shake(70, 0.0018);
  }

  getAttackCooldownMs() {
    return this.enraged ? Math.round(ATTACK_COOLDOWN_MS * 0.72) : ATTACK_COOLDOWN_MS;
  }
}
