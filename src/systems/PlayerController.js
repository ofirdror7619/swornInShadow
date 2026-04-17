import Phaser from "phaser";
import { EventBus } from "../core/EventBus";

const SPEED = 250;
const DASH_VELOCITY = 650;
const DASH_TIME_MS = 140;
const MAX_FLY_HEIGHT_Y = 70;

export class PlayerController {
  constructor(scene, player, abilitySystem) {
    this.scene = scene;
    this.player = player;
    this.abilitySystem = abilitySystem;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.keys = scene.input.keyboard.addKeys({
      left: "A",
      right: "D",
      up: "W",
      down: "S",
      dash: "SHIFT"
    });

    this.isDashing = false;
    this.dashTimeLeft = 0;
    this.facing = 1;
  }

  update(deltaMs) {
    const body = this.player.body;
    const moveLeft = this.cursors.left.isDown || this.keys.left.isDown;
    const moveRight = this.cursors.right.isDown || this.keys.right.isDown;
    const moveUp = this.cursors.up.isDown || this.keys.up.isDown;
    const moveDown = this.cursors.down.isDown || this.keys.down.isDown;
    const dashPressed = Phaser.Input.Keyboard.JustDown(this.keys.dash);

    if (moveLeft) this.facing = -1;
    if (moveRight) this.facing = 1;
    this.player.facing = this.facing;

    if (dashPressed && this.abilitySystem.canDash() && !this.isDashing) {
      this.isDashing = true;
      this.dashTimeLeft = DASH_TIME_MS;
      body.velocity.y = 0;
      body.velocity.x = DASH_VELOCITY * this.facing;
      EventBus.emit("player-dashed");
    }

    if (this.isDashing) {
      this.dashTimeLeft -= deltaMs;
      body.velocity.y = 0;
      this.applyFlightCeiling();
      if (this.dashTimeLeft <= 0) {
        this.isDashing = false;
      }
      return;
    }

    if (moveLeft === moveRight) {
      body.setVelocityX(0);
    } else if (moveLeft) {
      body.setVelocityX(-SPEED);
    } else if (moveRight) {
      body.setVelocityX(SPEED);
    }

    if (moveUp === moveDown) {
      body.setVelocityY(0);
    } else if (moveUp) {
      body.setVelocityY(-SPEED);
    } else if (moveDown) {
      body.setVelocityY(SPEED);
    }

    this.applyFlightCeiling();
  }

  applyFlightCeiling() {
    if (this.player.y < MAX_FLY_HEIGHT_Y) {
      this.player.y = MAX_FLY_HEIGHT_Y;
      if (this.player.body.velocity.y < 0) {
        this.player.body.setVelocityY(0);
      }
    }
  }
}
