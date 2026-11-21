"use client";

/**
 * Coffee Pour Menu. Designed & built by Aakash Mehra.
 *
 * A menu of drinks beside a hand-drawn SVG stage. Picking a drink knocks the
 * current cup off the stage, springs the next vessel in and pours its recipe
 * with a small hand-rolled physics loop (gravity, springs, damped waves).
 *
 * CoffeeStatus additions: any liquid from LIQUIDS (juices, purees, tea, syrups,
 * soda), drinks grouped under tabs, ice and soda bubbles, and a recipe card that
 * counts the millilitres of each layer while it pours.
 */

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

/** Vessel the drink is served in. */
export type CoffeeVessel = "demitasse" | "glass-mug" | "cup" | "tall-glass" | "tumbler" | "jar";

/** A liquid that can be poured: one of the keys of LIQUIDS. */
export type CoffeeLiquid = keyof typeof LIQUIDS;

export interface CoffeeLayer {
  /** What is poured. */
  type: CoffeeLiquid;
  /**
   * How much, as a fraction (0 to 1) of the vessel's inner height. Without it
   * the layer takes its share of the item's `fill`, in proportion to `ml`.
   */
  amount?: number;
  /** Volume shown on the recipe card. */
  ml?: number;
  /** Name on the recipe card when it differs from the liquid's own, e.g. "Susu evaporasi". */
  label?: string;
}

export interface CoffeeItem {
  /** Unique id, used for selection. */
  id: string;
  /** Display name, e.g. "Cappuccino". */
  name: string;
  /** Small line under the name, e.g. "180 ml, velvety". */
  subtitle?: string;
  /** Spoken by screen readers when the drink is shown. */
  description?: string;
  /** Vessel to serve it in. */
  vessel: CoffeeVessel;
  /** Pours in order. A milk pour after espresso overlaps it slightly. */
  layers: CoffeeLayer[];
  /** Fill height (0 to 1) shared out by `ml` among layers that have no `amount`. Default 0.8. */
  fill?: number;
  /** Golden crema on top (espresso style). */
  crema?: boolean;
  /** Foam cap thickness, as a fraction of the vessel's inner height. */
  foam?: number;
  /** Foam colour as hex when it is not milk foam (juice froth, soda head). */
  foamColor?: string;
  /** Latte art drawn on the surface once settled. */
  art?: "heart" | "none";
  /** How completely the pours blend, 0 (stay layered) to 1 (fully mixed). Default 1. */
  blend?: number;
  /** Ice cubes in the glass, 0 to 4. They rest on the bottom until the drink lifts them. */
  ice?: number;
  /** Solids muddled in the glass before the pour (mint leaves, lime slices). Listed on the recipe card. */
  garnish?: CoffeeGarnish[];
  /** Soda bubbles rise through the drink for a few seconds. */
  fizz?: boolean;
}

export interface CoffeeGarnish {
  /** Mint leaves (up to 8, plus a sprig on top once poured) or lime slices (up to 3). */
  type: "mint" | "lime";
  count: number;
}

export interface CoffeeCategory {
  id: string;
  /** Tab label. */
  label: string;
  items: CoffeeItem[];
}

export interface CoffeePourMenuProps {
  /** Drinks to show. Defaults to Espresso, Americano, Cappuccino and Latte. */
  items?: CoffeeItem[];
  /** Drinks grouped under tabs. Takes the place of `items`. */
  categories?: CoffeeCategory[];
  /** Show the recipe card that counts each layer's ml while it pours. Default true. */
  showRecipe?: boolean;
  /** Initially selected id (uncontrolled). Defaults to the first item. */
  defaultValue?: string;
  /** Selected id (controlled). */
  value?: string;
  /** Called when the user picks a drink. */
  onValueChange?: (id: string) => void;
  /** Extra classes for the root element. */
  className?: string;
}

export const DEFAULT_COFFEE_ITEMS: CoffeeItem[] = [
  {
    id: "espresso",
    name: "Espresso",
    subtitle: "30 ml, pekat",
    description: "satu shot pendek dan pekat dengan crema keemasan",
    vessel: "demitasse",
    layers: [{ type: "espresso", amount: 0.72, ml: 30 }],
    crema: true,
  },
  {
    id: "americano",
    name: "Americano",
    subtitle: "240 ml, ringan",
    description: "espresso dituang di atas air panas",
    vessel: "glass-mug",
    layers: [
      { type: "water", amount: 0.54, ml: 180, label: "Air panas" },
      { type: "espresso", amount: 0.24, ml: 60 },
    ],
    crema: true,
    blend: 0.9,
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    subtitle: "180 ml, berbusa",
    description: "espresso dengan susu panas dan busa tebal",
    vessel: "cup",
    layers: [
      { type: "espresso", amount: 0.3, ml: 60 },
      { type: "milk", amount: 0.44, ml: 120, label: "Susu panas" },
    ],
    foam: 0.14,
    art: "heart",
  },
  {
    id: "latte",
    name: "Latte",
    subtitle: "300 ml, lembut",
    description: "espresso dengan banyak susu panas dan busa tipis",
    vessel: "tall-glass",
    layers: [
      { type: "espresso", amount: 0.25, ml: 60 },
      { type: "milk", amount: 0.51, ml: 240, label: "Susu panas" },
    ],
    foam: 0.11,
    blend: 0.15,
  },
];

/* -------------------------------------------------------------------------- */
/*                                  Geometry                                  */
/* -------------------------------------------------------------------------- */

const W = 360;
const H = 400;
const FLOOR = 330;
const CX = 180;
const SRC = -FLOOR - 10; // pour source, local y, just above the stage
const P = 0.34; // ellipse squash: how far above the table we look from
const N = 14; // liquid column cells

/** Quadratic wall: top radius r, bottom radius rb, control x c (y is linear in t). */
type Profile = { top: number; r: number; bot: number; rb: number; c: number };

type Geo = {
  outer: Profile;
  inner: Profile;
  glass: boolean;
  glaze?: "cream" | "terra";
  saucer?: { y: number; r: number };
  handle?: string;
  handleW?: number;
  /** Screw-thread lines on a glass, as distances below the rim. */
  rings?: number[];
  height: number;
  shadowR: number;
  streamX: number;
  streamW: number;
};

const GEO: Record<CoffeeVessel, Geo> = {
  demitasse: {
    outer: { top: -86, r: 46, bot: -14, rb: 27, c: 53 },
    // shallow on purpose: an opaque cup only shows liquid near the rim
    inner: { top: -86, r: 41, bot: -60, rb: 33, c: 42 },
    glass: false,
    glaze: "terra",
    saucer: { y: -6, r: 90 },
    handle: "M41 -74C66 -80 76 -56 60 -44C52 -38 42 -37 34 -39",
    handleW: 8,
    height: 92,
    shadowR: 90,
    streamX: 0.12,
    streamW: 3,
  },
  "glass-mug": {
    outer: { top: -170, r: 58, bot: 0, rb: 52, c: 55 },
    inner: { top: -170, r: 53.5, bot: -16, rb: 46.5, c: 50 },
    glass: true,
    handle: "M55 -148C94 -148 98 -130 98 -100C98 -64 92 -42 53 -40",
    handleW: 13,
    height: 172,
    shadowR: 62,
    streamX: 0.14,
    streamW: 4.2,
  },
  cup: {
    outer: { top: -114, r: 80, bot: -16, rb: 38, c: 95 },
    inner: { top: -114, r: 74.5, bot: -76, rb: 57, c: 74 },
    glass: false,
    glaze: "cream",
    saucer: { y: -6, r: 132 },
    handle: "M75 -98C112 -106 126 -68 98 -52C88 -46 78 -45 66 -47",
    handleW: 11,
    height: 120,
    shadowR: 132,
    streamX: 0.13,
    streamW: 4,
  },
  "tall-glass": {
    outer: { top: -238, r: 48, bot: 0, rb: 39, c: 43.5 },
    inner: { top: -238, r: 44.5, bot: -24, rb: 35, c: 39.8 },
    glass: true,
    height: 240,
    shadowR: 48,
    streamX: 0.12,
    streamW: 4,
  },
  // short, wide glass for iced drinks
  tumbler: {
    outer: { top: -136, r: 58, bot: 0, rb: 49, c: 54 },
    inner: { top: -136, r: 54, bot: -20, rb: 44, c: 49.5 },
    glass: true,
    height: 138,
    shadowR: 60,
    streamX: 0.14,
    streamW: 4.2,
  },
  // mason-jar mug: near-straight walls with a slight belly
  jar: {
    outer: { top: -200, r: 45, bot: 0, rb: 46, c: 52 },
    inner: { top: -200, r: 41, bot: -16, rb: 41.5, c: 47.5 },
    glass: true,
    handle: "M47 -168C84 -168 90 -148 90 -112C90 -76 84 -58 48 -56",
    handleW: 12,
    rings: [7, 13],
    height: 202,
    shadowR: 50,
    streamX: 0.13,
    streamW: 4.2,
  },
};

const f1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mid = (p: Profile) => (p.top + p.bot) / 2;
/** Wall radius at t (0 top, 1 bottom). */
const wallR = (p: Profile, t: number) =>
  (1 - t) * (1 - t) * p.r + 2 * t * (1 - t) * p.c + t * t * p.rb;

/** Closed outline seen through the opening: back rim arc, walls, front bottom arc. */
function silhouette(p: Profile) {
  const m = mid(p);
  return `M${-p.r} ${p.top}A${p.r} ${f1(p.r * P)} 0 0 1 ${p.r} ${p.top}Q${p.c} ${m} ${p.rb} ${p.bot}A${p.rb} ${f1(p.rb * P)} 0 0 1 ${-p.rb} ${p.bot}Q${-p.c} ${m} ${-p.r} ${p.top}Z`;
}
/** Outer body whose top edge is the front of the rim. */
function bodyPath(p: Profile) {
  const m = mid(p);
  return `M${-p.r} ${p.top}Q${-p.c} ${m} ${-p.rb} ${p.bot}A${p.rb} ${f1(p.rb * P)} 0 0 0 ${p.rb} ${p.bot}Q${p.c} ${m} ${p.r} ${p.top}A${p.r} ${f1(p.r * P)} 0 0 1 ${-p.r} ${p.top}Z`;
}
/** Band between two concentric front arcs (rim lip, saucer edge, glass base). */
function frontBand(r1: number, y1: number, r2: number, y2: number) {
  return `M${-r1} ${y1}A${r1} ${f1(r1 * P)} 0 0 0 ${r1} ${y1}L${r2} ${y2}A${r2} ${f1(r2 * P)} 0 0 1 ${-r2} ${y2}Z`;
}
/** A line running down the wall at a fraction k of its radius. */
function wallLine(p: Profile, k: number, t0: number, t1: number) {
  const y0 = lerp(p.top, p.bot, t0);
  const y1 = lerp(p.top, p.bot, t1);
  const ym = (y0 + y1) / 2;
  return `M${f1(k * wallR(p, t0))} ${f1(y0)}Q${f1(k * wallR(p, (t0 + t1) / 2) * 1.02)} ${f1(ym)} ${f1(k * wallR(p, t1))} ${f1(y1)}`;
}

/* -------------------------------------------------------------------------- */
/*                                   Colour                                   */
/* -------------------------------------------------------------------------- */

type RGB = [number, number, number];
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
function ramp(stops: [number, RGB][], t: number): RGB {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [p, c] = stops[i];
    if (t <= p) {
      const [p0, c0] = stops[i - 1];
      return mixRGB(c0, c, (t - p0) / (p - p0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}
const MILK: RGB = [248, 242, 232];
const COFFEE_RAMP: [number, RGB][] = [
  [0, [236, 230, 218]],
  [0.3, [172, 104, 50]],
  [0.7, [100, 54, 25]],
  [1, [40, 21, 11]],
];
const MILK_RAMP: [number, RGB][] = [
  [0.3, [108, 62, 32]],
  [0.55, [168, 112, 66]],
  [0.75, [208, 165, 118]],
  [0.9, [236, 217, 190]],
  [1, MILK],
];
/** Colour and opacity of a mix of espresso, water and milk. */
function shade(e: number, w: number, m: number): [RGB, number] {
  const s = e + w + m || 1;
  e /= s;
  w /= s;
  m /= s;
  const c = e + w > 1e-4 ? 1 - Math.pow(1 - e / (e + w), 2) : 1;
  let rgb = ramp(COFFEE_RAMP, c);
  const aC = c < 0.35 ? lerp(0.18, 0.88, c / 0.35) : lerp(0.88, 1, Math.min(1, (c - 0.35) / 0.35));
  if (m > 0.001) {
    const st: [number, RGB][] = [[0, rgb], ...MILK_RAMP.map(([p, col]) => [p, mixRGB(MILK, col, c)] as [number, RGB])];
    rgb = ramp(st, m);
  }
  return [rgb, 1 - (1 - aC) * (1 - Math.min(1, m * 3))];
}
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const hexRGB = (h: string): RGB => {
  const n = parseInt(h.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

type LiquidDef = {
  /** Name on the recipe card. */
  label: string;
  /** Colour of a glass full of it. */
  color: RGB;
  /** Colour by concentration when clear liquids dilute it (espresso, tea). */
  ramp?: [number, RGB][];
  /** 0 is clear like water, 1 is opaque like milk. */
  opacity: number;
  /** How strongly it colours a mix. Below 0.1 it counts as a clear diluent. */
  tint: number;
  /** Pour stream: fill, opacity at the bottom, highlight strength, width factor. */
  stream: { fill: string; a: number; hi: number; w: number };
  /** Swirl it leaves on the surface when poured into something else. */
  swirl: string;
  /** How deep (pen) and how hard (jet) the pour mixes into the liquid below. */
  pen: number;
  jet: number;
};

/** Every pourable liquid. Espresso, water and milk must stay first: their mixes keep the original coffee shading. */
const LIQUIDS = {
  espresso: { label: "Espresso", color: [58, 30, 14], ramp: COFFEE_RAMP, opacity: 1, tint: 3, stream: { fill: "rgb(58,30,14)", a: 1, hi: 0.35, w: 1.3 }, swirl: "rgb(60,30,14)", pen: 0.3, jet: 0.9 },
  water: { label: "Air", color: [214, 226, 228], opacity: 0.12, tint: 0.05, stream: { fill: "rgb(188,204,208)", a: 0.7, hi: 1, w: 1.5 }, swirl: "rgb(230,225,215)", pen: 0.1, jet: 0.5 },
  milk: { label: "Susu", color: MILK, opacity: 1, tint: 1, stream: { fill: "rgb(250,245,236)", a: 1, hi: 0.9, w: 1.9 }, swirl: "rgb(252,247,238)", pen: 0.18, jet: 0.8 },
  orange: { label: "Jus jeruk", color: [247, 160, 40], opacity: 0.9, tint: 1.2, stream: { fill: "rgb(244,150,30)", a: 0.95, hi: 0.8, w: 1.6 }, swirl: "rgb(252,196,110)", pen: 0.2, jet: 0.7 },
