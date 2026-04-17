import Phaser from "phaser";

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
const MAX_HEALTH = 30;
const CONTACT_DAMAGE = 12;
const RENDER_DEPTH = 500;
const PHYSICS_BODY_WIDTH = 96;
const PHYSICS_BODY_HEIGHT = 136;
const PHYSICS_OFFSET_X = 82;
const PHYSICS_OFFSET_Y = 350;

export class EnemyDemon extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, patrol) {
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
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (this.isDead) return;

    this.attackCooldownLeft = Math.max(0, this.attackCooldownLeft - delta);
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
      this.body.setVelocity(dir.x * CHASE_SPEED, dir.y * CHASE_SPEED);
      if (Math.abs(this.body.velocity.x) > 4) {
        this.setFlipX(this.body.velocity.x < 0);
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

    if (this.state === "windup") {
      this.stateTimeLeft -= deltaMs;
      this.body.setVelocity(0, 0);
      if (this.stateTimeLeft <= 0) {
        this.clearTint();
        this.state = "lunge";
        this.stateTimeLeft = LUNGE_MS;
        this.body.setVelocity(this.attackVector.x * LUNGE_SPEED, this.attackVector.y * LUNGE_SPEED);
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
        this.attackCooldownLeft = ATTACK_COOLDOWN_MS;
      }
    }
  }

  runPatrolStep() {
    if (this.x >= this.rightBound) {
      this.patrolDir = -1;
    } else if (this.x <= this.leftBound) {
      this.patrolDir = 1;
    }
    this.body.setVelocity(this.patrolDir * PATROL_SPEED, (this.patrolY - this.y) * 2.8);
    this.setFlipX(this.patrolDir < 0);
  }

  canDamagePlayer() {
    return !this.isDead && this.state === "lunge";
  }

  takeDamage(amount, hitDir) {
    if (this.isDead) return false;

    this.health -= amount;
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
      this.body.setVelocity(0, 0);
      this.disableBody(true, true);
      return true;
    }

    if (this.state === "windup" || this.state === "lunge") {
      this.state = "recover";
      this.stateTimeLeft = RECOVER_MS;
      this.attackCooldownLeft = ATTACK_COOLDOWN_MS;
    }

    return false;
  }
}
