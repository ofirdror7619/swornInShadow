import Phaser from "phaser";
import "./styles/style.css";
import { createGameConfig } from "./config/gameConfig";

const game = new Phaser.Game(createGameConfig());

window.__GAME__ = game;
