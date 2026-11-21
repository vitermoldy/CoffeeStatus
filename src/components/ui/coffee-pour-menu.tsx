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
  carrot: { label: "Jus wortel", color: [234, 106, 28], opacity: 0.95, tint: 1.4, stream: { fill: "rgb(230,100,25)", a: 1, hi: 0.7, w: 1.6 }, swirl: "rgb(245,150,80)", pen: 0.2, jet: 0.7 },
  avocado: { label: "Jus alpukat", color: [172, 188, 88], opacity: 1, tint: 1.3, stream: { fill: "rgb(166,184,82)", a: 1, hi: 0.7, w: 2.1 }, swirl: "rgb(205,214,140)", pen: 0.14, jet: 0.6 },
  sugar: { label: "Sirup gula", color: [244, 232, 200], opacity: 0.35, tint: 0.25, stream: { fill: "rgb(238,222,184)", a: 0.85, hi: 1, w: 1 }, swirl: "rgb(250,242,220)", pen: 0.08, jet: 0.4 },
  chocolate: { label: "Susu cokelat", color: [92, 52, 30], opacity: 1, tint: 2.2, stream: { fill: "rgb(86,48,26)", a: 1, hi: 0.4, w: 1.2 }, swirl: "rgb(110,66,40)", pen: 0.1, jet: 0.45 },
  strawberry: { label: "Stroberi", color: [214, 58, 78], opacity: 0.95, tint: 1.6, stream: { fill: "rgb(206,46,70)", a: 1, hi: 0.6, w: 2 }, swirl: "rgb(236,120,140)", pen: 0.16, jet: 0.65 },
  banana: { label: "Pisang", color: [244, 226, 168], opacity: 1, tint: 0.8, stream: { fill: "rgb(240,220,156)", a: 1, hi: 0.9, w: 2.1 }, swirl: "rgb(250,240,200)", pen: 0.14, jet: 0.6 },
  yogurt: { label: "Yogurt", color: [250, 248, 240], opacity: 1, tint: 0.9, stream: { fill: "rgb(252,250,244)", a: 1, hi: 0.9, w: 2 }, swirl: "rgb(253,252,248)", pen: 0.14, jet: 0.6 },
  mango: { label: "Mangga", color: [250, 168, 28], opacity: 1, tint: 1.7, stream: { fill: "rgb(248,166,28)", a: 1, hi: 0.8, w: 2 }, swirl: "rgb(253,206,120)", pen: 0.16, jet: 0.65 },
  tea: { label: "Teh", color: [184, 70, 14], ramp: [[0, [246, 228, 186]], [0.35, [232, 146, 52]], [0.7, [208, 102, 28]], [1, [184, 70, 14]]], opacity: 0.7, tint: 2, stream: { fill: "rgb(176,78,24)", a: 0.9, hi: 0.6, w: 1.5 }, swirl: "rgb(214,128,60)", pen: 0.2, jet: 0.75 },
  condensed: { label: "Susu kental manis", color: [250, 240, 214], opacity: 1, tint: 1.1, stream: { fill: "rgb(248,236,204)", a: 1, hi: 0.9, w: 1.1 }, swirl: "rgb(252,246,228)", pen: 0.08, jet: 0.4 },
  matcha: { label: "Matcha", color: [108, 148, 48], opacity: 0.95, tint: 2, stream: { fill: "rgb(100,140,42)", a: 1, hi: 0.6, w: 1.5 }, swirl: "rgb(150,186,90)", pen: 0.12, jet: 0.5 },
  lemon: { label: "Air lemon", color: [246, 232, 120], opacity: 0.4, tint: 0.6, stream: { fill: "rgb(240,224,100)", a: 0.8, hi: 1, w: 1.1 }, swirl: "rgb(250,242,170)", pen: 0.15, jet: 0.6 },
  honey: { label: "Madu", color: [226, 150, 36], opacity: 0.75, tint: 1.2, stream: { fill: "rgb(222,144,30)", a: 0.95, hi: 0.9, w: 0.9 }, swirl: "rgb(240,190,90)", pen: 0.08, jet: 0.4 },
  syrup: { label: "Sirup merah", color: [204, 28, 58], opacity: 0.92, tint: 2.6, stream: { fill: "rgb(196,22,52)", a: 0.95, hi: 0.7, w: 1.1 }, swirl: "rgb(228,90,110)", pen: 0.08, jet: 0.4 },
  lime: { label: "Air jeruk nipis", color: [200, 222, 100], opacity: 0.38, tint: 0.8, stream: { fill: "rgb(196,214,96)", a: 0.8, hi: 1, w: 1.1 }, swirl: "rgb(226,236,160)", pen: 0.15, jet: 0.6 },
  soda: { label: "Air soda", color: [232, 240, 240], opacity: 0.08, tint: 0.04, stream: { fill: "rgb(208,224,228)", a: 0.6, hi: 1, w: 1.5 }, swirl: "rgb(240,246,246)", pen: 0.25, jet: 0.9 },
} satisfies Record<string, LiquidDef>;

const LIQ = Object.keys(LIQUIDS) as CoffeeLiquid[];
/** Number of liquids tracked in every cell of the column. */
const NL = LIQ.length;
const DEF: LiquidDef[] = LIQ.map((k) => LIQUIDS[k]);
// optical depth per unit share; opaque liquids stay opaque even when diluted 1:6
const OD = DEF.map((d) => -Math.log(1 - Math.min(0.999, d.opacity)));
const pick = <T,>(f: (d: LiquidDef) => T) =>
  Object.fromEntries(LIQ.map((k) => [k, f(LIQUIDS[k])])) as Record<CoffeeLiquid, T>;
const STREAM = pick((d) => d.stream);
const SWIRL = pick((d) => d.swirl);
const PEN = pick((d) => d.pen);
const JET = pick((d) => d.jet);
const TYPE_INDEX = Object.fromEntries(LIQ.map((k, i) => [k, i])) as Record<CoffeeLiquid, number>;

/** Any mix: tint-weighted colour, opacity from summed optical depth. */
function shadeMix(cells: Float32Array, o: number): [RGB, number] {
  let tot = 0;
  let clear = 0;
  for (let j = 0; j < NL; j++) {
    tot += cells[o + j];
    if (DEF[j].tint < 0.1) clear += cells[o + j];
  }
  if (tot <= 1e-6) return [MILK, 0];
  clear /= tot;
  let r = 0;
  let g = 0;
  let b = 0;
  let wsum = 0;
  let od = 0;
  for (let j = 0; j < NL; j++) {
    const f = cells[o + j] / tot;
    if (f <= 0) continue;
    const d = DEF[j];
    od += f * OD[j];
    const col = d.ramp ? ramp(d.ramp, 1 - Math.pow(1 - f / (f + clear), 2)) : d.color;
    const w = f * d.tint;
    r += col[0] * w;
    g += col[1] * w;
    b += col[2] * w;
    wsum += w;
  }
  wsum ||= 1;
  return [[r / wsum, g / wsum, b / wsum], 1 - Math.exp(-od)];
}

/** Colour and opacity of cell i of a column. */
function shadeAt(cells: Float32Array, i: number): [RGB, number] {
  const o = i * NL;
  let other = 0;
  for (let j = 3; j < NL; j++) other += cells[o + j];
  const coffee = shade(cells[o], cells[o + 1], cells[o + 2]);
  if (other < 1e-4) return coffee;
  const mix = shadeMix(cells, o);
  const t = Math.min(1, other * 50);
  return t >= 1 ? mix : [mixRGB(coffee[0], mix[0], t), lerp(coffee[1], mix[1], t)];
}

/** Recipe-card colour for a liquid: very light ones are darkened so they show on the card. */
function swatch(type: CoffeeLiquid) {
  const c = LIQUIDS[type].color;
  const light = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 215;
  return css(light ? mixRGB(c, [150, 112, 80], 0.62) : c);
}

/* -------------------------------------------------------------------------- */
/*                                  Physics                                   */
/* -------------------------------------------------------------------------- */

const G_STREAM = 3000;
const G_FALL = 2600;
const V0 = 220;
const PARTS = 26;
const RIPPLES = 6;
const TENDRILS = 3;
const SPILLS = 32;
const FIZZ = 14; // soda bubbles per glass
const FIZZ_T = 2.5; // seconds the soda keeps fizzing after the last pour

/** A layer with its fill height worked out and its recipe-card label. */
type Layer = { type: CoffeeLiquid; amount: number; ml?: number; label: string };

/** Layers of an item, with `amount` filled in from `fill` and `ml` where it is missing. */
export function resolveLayers(item: CoffeeItem): Layer[] {
  const total = item.layers.reduce((s, l) => s + (l.ml ?? 0), 0);
  const fill = item.fill ?? 0.8;
  return item.layers.map((l) => ({
    type: l.type,
    amount: l.amount ?? (total > 0 ? (fill * (l.ml ?? 0)) / total : fill / item.layers.length),
    ml: l.ml,
    label: l.label ?? LIQUIDS[l.type].label,
  }));
}

type Pour = {
  layer: number;
  type: CoffeeLiquid;
  amount: number;
  rate: number;
  poured: number;
  x: number;
  w: number;
  phase: "lead" | "fall" | "flow" | "tail" | "drips" | "done";
  timer: number;
  head: number;
  headV: number;
  tail: number;
  tailV: number;
  drips: number;
  lead: number;
  rippleT: number;
  slot: number;
};
type Particle = { x: number; y: number; vx: number; vy: number; r: number; col: string; drop: boolean };
type Tendril = { x: number; age: number; dir: number; ph: number; col: string };

type Els = {
  root: SVGGElement;
  shadow: SVGGElement;
  body: SVGGElement;
  liquid: SVGGElement;
  liq: SVGPathElement;
  depth: SVGPathElement | null;
  foam: SVGPathElement;
  surf: SVGPathElement;
  sclip: SVGPathElement;
  decor: SVGGElement;
  crema: SVGGElement | null;
  foamTop: SVGGElement | null;
  art: SVGGElement | null;
  base: SVGPathElement | null;
  stops: SVGStopElement[];
  swirl: SVGPathElement[];
  tendrils: SVGPathElement[];
  ripples: SVGEllipseElement[];
  streams: { path: SVGPathElement; hi: SVGPathElement; stops: SVGStopElement[] }[];
  parts: SVGCircleElement[];
  ice: SVGGElement[];
  bubbles: SVGCircleElement[];
  mint: SVGGElement[];
  lime: SVGGElement[];
  sprig: SVGGElement | null;
};

type Cup = {
  key: number;
  item: CoffeeItem;
  geo: Geo;
  mode: "wait" | "enter" | "rest" | "fall" | "fadeIn" | "fadeOut";
  wait: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  va: number;
  pivot: number;
  opacity: number;
  fallT: number;
  level: number;
  /** N cells bottom to top, each holding the share of every liquid (NL values). */
  cells: Float32Array;
  layers: Layer[];
  /** Poured fraction of each layer, 0 to 1. */
  progress: Float32Array;
  fizzT: number;
  /** Mint sprig on top, 0 hidden to 1 grown. */
  sprig: number;
  pours: Pour[];
  next: number;
  pourT: number;
  parts: Particle[];
  ripples: { x: number; age: number }[];
  tendrils: Tendril[];
  w1: number;
  v1: number;
  w2: number;
  v2: number;
  w3: number;
  mix: number;
  swirlCol: string;
  crema: number;
  foam: number;
  art: number;
  artV: number;
  spill: number;
  dirty: boolean;
  el?: Els;
};

function makeCup(key: number, item: CoffeeItem): Cup {
  const geo = GEO[item.vessel] ?? GEO.cup;
  const layers = resolveLayers(item);
  return {
    key,
    item,
    geo,
    mode: "wait",
    wait: 0,
    x: W + 160,
    y: FLOOR,
    vx: 0,
    vy: 0,
    a: 0,
    va: 0,
    pivot: 0,
    opacity: 1,
    fallT: 0,
    level: 0,
    cells: new Float32Array(N * NL),
    layers,
    progress: new Float32Array(layers.length),
    fizzT: 0,
    sprig: 0,
    pours: [],
    next: 0,
    pourT: 0,
    parts: [],
    ripples: [],
    tendrils: [],
    w1: 0,
    v1: 0,
    w2: 0,
    v2: 0,
    w3: 0,
    mix: 0,
    swirlCol: SWIRL.milk,
    crema: 0,
    foam: 0,
    art: 0,
    artV: 0,
    spill: 0,
    dirty: true,
  };
}

const foamOf = (it: CoffeeItem) => it.foam ?? (it.crema ? 0.035 : 0);
const levelY = (g: Geo, f: number) => lerp(g.inner.bot, g.inner.top, f);
const levelR = (g: Geo, f: number) => wallR(g.inner, 1 - f);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/** Add dv of a liquid on top, entraining some of it into the liquid below. */
function deposit(c: Cup, type: CoffeeLiquid, dv: number) {
  const T = TYPE_INDEX[type];
  const L0 = c.level;
  const L1 = Math.min(0.96, L0 + dv);
  const cells = c.cells;
  for (let i = 0; i < N; i++) {
    if (i / N >= L1) break;
    const o = i * NL;
    const a0 = clamp(L0 * N - i, 0, 1);
    const a1 = clamp(L1 * N - i, 0, 1);
    if (a1 > a0) {
      const k = (a1 - a0) / a1;
      for (let j = 0; j < NL; j++) cells[o + j] *= 1 - k;
      cells[o + T] += k;
    }
    if (a0 > 0) {
      const d = Math.max(0, L1 - (i + 0.5) / N);
      const k = Math.min(0.4, JET[type] * dv * N * 0.5 * Math.exp(-d / PEN[type]));
      for (let j = 0; j < NL; j++) cells[o + j] *= 1 - k;
      cells[o + T] += k;
    }
  }
  c.level = L1;
  c.dirty = true;
}

const MEAN = new Float64Array(NL);

/** Stirring: relax every filled cell toward the column's mean. */
function stir(c: Cup, k: number) {
  const cells = c.cells;
  let tot = 0;
  const m = MEAN.fill(0);
  for (let i = 0; i < N; i++) {
    const f = clamp(c.level * N - i, 0, 1);
    if (f <= 0) break;
    tot += f;
    for (let j = 0; j < NL; j++) m[j] += cells[i * NL + j] * f;
  }
  if (tot <= 0) return;
  for (let i = 0; i < N; i++) {
    if (i / N >= c.level) break;
    for (let j = 0; j < NL; j++) cells[i * NL + j] += (m[j] / tot - cells[i * NL + j]) * k;
  }
  c.dirty = true;
}

/** Local diffusion between neighbouring cells: softens layer boundaries. */
function diffuse(c: Cup, k: number) {
  const cells = c.cells;
  const top = Math.min(N - 1, Math.ceil(c.level * N) - 1);
  for (let i = 0; i < top; i++) {
    for (let j = 0; j < NL; j++) {
      const f = (cells[(i + 1) * NL + j] - cells[i * NL + j]) * k;
      cells[i * NL + j] += f;
      cells[(i + 1) * NL + j] -= f;
    }
  }
}

/** Fraction of the whole column that is liquid T. */
function share(c: Cup, T: number) {
  let tot = 0;
  let x = 0;
  for (let i = 0; i < N; i++) {
    const f = clamp(c.level * N - i, 0, 1);
    if (f <= 0) break;
    tot += f;
    x += c.cells[i * NL + T] * f;
  }
  return tot ? x / tot : 1;
}

const topCell = (c: Cup) => Math.max(0, Math.min(N - 1, Math.ceil(c.level * N) - 1));

/** Wave height at u (-1 left .. 1 right) in px. */
const wave = (c: Cup, u: number, t: number) =>
  c.w1 * u + c.w2 * Math.cos(Math.PI * u) + c.w3 * Math.sin(3 * Math.PI * u - t * 9);

function kick(c: Cup, u: number, s: number) {
  c.v1 += s * u * 40;
  c.v2 -= s * 50;
  c.w3 = Math.min(2.2, c.w3 + s * 0.9);
}

/** Pour the whole recipe at once (reduced motion). */
function fillInstantly(c: Cup) {
  for (const l of c.layers) {
    for (let v = 0; v < l.amount; v += 0.01) deposit(c, l.type, Math.min(0.01, l.amount - v));
  }
  stir(c, 1 - Math.exp(-(c.item.blend ?? 1) * 5.4));
  for (let i = 0; i < 40; i++) diffuse(c, 0.1);
  c.crema = 1;
  c.foam = 1;
  c.art = 1;
  c.progress.fill(1);
  c.fizzT = FIZZ_T;
  c.sprig = 1;
  c.next = c.layers.length;
}

function startPour(c: Cup, i: number) {
  const l = c.layers[i];
  const r = c.geo.inner.r;
  const side = i % 2 === 0 ? -1 : 1;
  c.pours.push({
    layer: i,
    type: l.type,
    amount: l.amount,
    rate: l.amount / clamp(l.amount * 2.6, 0.7, 1.6),
    poured: 0,
    x: side * c.geo.streamX * r,
    w: c.geo.streamW * STREAM[l.type].w,
    phase: l.type === "espresso" ? "lead" : "fall",
    timer: 0,
    head: SRC,
    headV: V0,
    tail: SRC,
    tailV: V0,
    drips: l.type === "espresso" ? 2 : 1,
    lead: l.type === "espresso" ? 2 : 0,
    rippleT: 0,
    slot: c.pours.filter((p) => p.phase !== "done").length > 0 ? (c.pours[c.pours.length - 1].slot + 1) % 2 : 0,
  });
}

function spawnDrop(c: Cup, p: Pour) {
  c.parts.push({ x: p.x + (Math.random() - 0.5), y: SRC + 10, vx: 0, vy: V0 * 0.6, r: p.w * 0.5 + 0.6, col: STREAM[p.type].fill, drop: true });
}

function splash(c: Cup, x: number, y: number, col: string, n: number, s: number) {
  for (let k = 0; k < n && c.parts.length < PARTS; k++) {
    c.parts.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y - 1,
      vx: (Math.random() - 0.5) * 150 * s,
      vy: -(80 + Math.random() * 180) * s,
      r: 0.8 + Math.random() * 1.5,
      col,
      drop: false,
    });
  }
  if (c.ripples.length >= RIPPLES) c.ripples.shift();
  c.ripples.push({ x, age: 0 });
}

/** Advance one cup. Returns true while anything is still moving. */
function stepCup(c: Cup, dt: number, t: number, spills: Particle[]): boolean {
  const g = c.geo;
  const it = c.item;
  let busy = false;

  /* body motion */
  if (c.mode === "wait") {
    c.wait -= dt;
    if (c.wait <= 0) c.mode = "enter";
    return true;
  }
  if (c.mode === "enter" || c.mode === "rest") {
    const ax = -130 * (c.x - CX) - 15.5 * c.vx;
    c.vx += ax * dt;
    c.x += c.vx * dt;
    const target = clamp(-ax * 0.00011, -0.14, 0.14);
    c.va += (-240 * (c.a - target) - 15 * c.va) * dt;
    c.a += c.va * dt;
    if (c.mode === "enter") {
      busy = true;
      if (Math.abs(c.x - CX) < 0.4 && Math.abs(c.vx) < 8 && Math.abs(c.a) < 0.003 && Math.abs(c.va) < 0.04) {
        c.x = CX;
        c.vx = 0;
        c.a = 0;
        c.va = 0;
        c.mode = "rest";
      }
    }
  } else if (c.mode === "fall") {
    c.fallT += dt;
    c.vy += G_FALL * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.a += c.va * dt;
    busy = true;
    // tipped far enough: liquid spills over the low side of the rim
    if (c.level > 0.2 && Math.abs(c.a) > 0.3 && spills.length < SPILLS) {
      c.spill += dt * 60 * c.level;
      while (c.spill > 1 && spills.length < SPILLS) {
        c.spill -= 1;
        const side = Math.sign(c.a) || -1;
        const qx = side < 0 ? -g.inner.r : g.inner.r;
        const qy = g.inner.top + c.pivot;
        const cs = Math.cos(c.a);
        const sn = Math.sin(c.a);
        const rx = cs * qx - sn * qy;
        const ry = sn * qx + cs * qy;
        const [col] = shadeAt(c.cells, topCell(c));
        spills.push({
          x: c.x + rx,
          y: c.y - c.pivot + ry,
          vx: c.vx - c.va * ry + side * (30 + Math.random() * 60),
          vy: c.vy + c.va * rx - 60 - Math.random() * 80,
          r: 1.2 + Math.random() * 2.2,
          col: css(col),
          drop: true,
        });
        c.level = Math.max(0.05, c.level - 0.004);
      }
    }
  } else if (c.mode === "fadeIn") {
    c.opacity = Math.min(1, c.opacity + dt / 0.3);
    if (c.opacity >= 1) c.mode = "rest";
    busy = true;
  } else if (c.mode === "fadeOut") {
    c.opacity = Math.max(0, c.opacity - dt / 0.25);
    busy = true;
  }

  /* recipe: start pours once the cup has (nearly) arrived */
  const arrived = c.mode === "rest" || (c.mode === "enter" && Math.abs(c.x - CX) < 16);
  if (arrived && c.next < c.layers.length) {
    c.pourT += dt;
    const prev = c.pours[c.pours.length - 1];
    const overlap = prev && prev.type === "espresso" && c.layers[c.next].type === "milk";
    const ready = !prev
      ? c.pourT > 0.02
      : overlap
        ? prev.poured >= prev.amount * 0.6
        : prev.phase === "drips" || prev.phase === "done";
    if (ready) startPour(c, c.next++);
    busy = true;
  }

  const fTop = c.level + foamOf(it) * easeOut(c.foam);
  const yS = levelY(g, fTop);
  const rS = levelR(g, fTop);

  /* pours */
  let flowing = false;
  for (const p of c.pours) {
    if (p.phase === "done") continue;
    busy = true;
    p.timer += dt;
    const surfY = yS + wave(c, p.x / rS, t);
    if (p.phase === "lead") {
      if (p.lead > 0 && p.timer > 0.08) {
        spawnDrop(c, p);
        p.lead--;
        p.timer = 0;
      } else if (p.lead === 0 && p.timer > 0.1) {
        p.phase = "fall";
      }
    }
    if (p.phase === "fall") {
      p.headV += G_STREAM * dt;
      p.head += p.headV * dt;
      if (p.head >= surfY) {
        p.phase = "flow";
        const top = c.cells[topCell(c) * NL + TYPE_INDEX[p.type]];
        splash(c, p.x, surfY, STREAM[p.type].fill, c.level > 0.02 ? 6 : 3, 1);
        kick(c, p.x / rS, c.level > 0.02 ? 1 : 0.3);
        if (c.level > 0.02 && top < 0.85) c.swirlCol = SWIRL[p.type];
      }
    }
    if (p.phase === "flow" || p.phase === "tail") {
      if (p.poured < p.amount) {
        const dv = Math.min(p.rate * dt, p.amount - p.poured);
        // does this pour differ from the liquid it lands in?
        const differs = c.level > 0.03 && share(c, TYPE_INDEX[p.type]) < 0.8;
        deposit(c, p.type, dv);
        p.poured += dv;
        c.progress[p.layer] = p.poured / p.amount;
        if (differs) {
          c.mix = Math.min(1, c.mix + dt * 3);
          c.swirlCol = SWIRL[p.type];
          if (g.glass && c.tendrils.length < TENDRILS && Math.random() < dt * 3.2) {
            c.tendrils.push({ x: p.x, age: 0, dir: Math.random() < 0.5 ? -1 : 1, ph: Math.random() * 6, col: STREAM[p.type].fill });
          }
        }
        flowing = true;
      }
      p.rippleT += dt;
      if (p.rippleT > 0.085) {
        p.rippleT = 0;
        splash(c, p.x, surfY, STREAM[p.type].fill, 1, 0.7);
        kick(c, p.x / rS, 0.12);
      }
      if (p.phase === "flow" && p.poured >= p.amount) p.phase = "tail";
    }
    if (p.phase === "tail") {
      p.tailV += G_STREAM * dt;
      p.tail += p.tailV * dt;
      if (p.tail >= surfY) {
        p.phase = "drips";
        p.timer = 0;
      }
    }
    if (p.phase === "drips") {
      if (p.drips > 0 && p.timer > 0.12 + Math.random() * 0.1) {
        spawnDrop(c, p);
        p.drips--;
        p.timer = 0;
      } else if (p.drips === 0 && p.timer > 0.1) {
        p.phase = "done";
      }
    }
  }

  /* particles (local) */
  for (let i = c.parts.length - 1; i >= 0; i--) {
    const q = c.parts[i];
    q.vy += G_STREAM * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    const sy = yS + wave(c, clamp(q.x / rS, -1, 1), t);
    if (q.vy > 0 && q.y >= sy) {
      if (q.drop) {
        splash(c, q.x, sy, q.col, 3, 0.6);
        kick(c, q.x / rS, 0.35);
      } else if (c.ripples.length < RIPPLES && Math.random() < 0.3) {
        c.ripples.push({ x: q.x, age: 0 });
      }
      c.parts.splice(i, 1);
    }
  }
  if (c.parts.length) busy = true;
  for (let i = c.ripples.length - 1; i >= 0; i--) {
    c.ripples[i].age += dt;
    if (c.ripples[i].age > 0.7) c.ripples.splice(i, 1);
  }
  for (let i = c.tendrils.length - 1; i >= 0; i--) {
    c.tendrils[i].age += dt;
    if (c.tendrils[i].age > 1.8) c.tendrils.splice(i, 1);
  }
  if (c.ripples.length || c.tendrils.length) busy = true;

  /* surface waves: damped springs; tilt follows the cup so liquid stays level */
  const tiltTarget = clamp(-Math.tan(c.a), -0.9, 0.9) * rS * (c.mode === "fall" ? 0.8 : 1);
  c.v1 += (-70 * (c.w1 - tiltTarget) - 3.2 * c.v1) * dt;
  c.w1 += c.v1 * dt;
  c.v2 += (-190 * c.w2 - 5 * c.v2) * dt;
  c.w2 += c.v2 * dt;
  c.w3 *= Math.exp(-2.6 * dt);
  if (c.mode !== "fall") {
    const m = rS * P * 0.8;
    c.w2 = clamp(c.w2, -m, m);
  }
  if (Math.abs(c.w1 - tiltTarget) + Math.abs(c.v1) * 0.1 + Math.abs(c.w2) + Math.abs(c.v2) * 0.1 + c.w3 > 0.02) busy = true;

  /* mixing, crema, foam, art */
  const pouring = c.next < c.layers.length || c.pours.some((p) => p.phase !== "done");
  if (it.fizz && c.level > 0.05 && c.fizzT < FIZZ_T && c.mode !== "fall") {
    if (!pouring) c.fizzT += dt; // bubbles run during the pour, then fade
    busy = true;
  }
  if (!pouring && c.level > 0 && c.sprig < 1 && c.mode !== "fall" && it.garnish?.some((g) => g.type === "mint")) {
    c.sprig = Math.min(1, c.sprig + dt / 0.6);
    busy = true;
  }
  if (!flowing) c.mix = Math.max(0, c.mix - dt * 0.85);
  if (c.mix > 0) {
    stir(c, 1 - Math.exp(-(it.blend ?? 1) * c.mix * 3.2 * dt));
    diffuse(c, Math.min(0.25, c.mix * dt * 6 * Math.sqrt(it.blend ?? 1)));
    busy = true;
  }
  if (it.crema && c.level > 0.05 && c.crema < 1) {
    c.crema = Math.min(1, c.crema + dt / (pouring ? 2.4 : 0.9));
    busy = true;
  }
  if (!pouring && c.level > 0 && c.foam < 1 && c.mode !== "fall") {
    c.foam = Math.min(1, c.foam + dt / 0.75);
    busy = true;
  }
  if (it.art === "heart" && c.foam > 0.35 && c.mix < 0.5 && c.mode !== "fall") {
    c.artV += (-120 * (c.art - 1) - 13 * c.artV) * dt;
    c.art += c.artV * dt;
    if (Math.abs(c.art - 1) + Math.abs(c.artV) * 0.05 > 0.002) busy = true;
    else c.art = 1;
  }

  return busy;
}

/* -------------------------------------------------------------------------- */
/*                                  Rendering                                 */
/* -------------------------------------------------------------------------- */

const K = 36;
const COS = Array.from({ length: K + 1 }, (_, i) => Math.cos((i / K) * Math.PI * 2 + Math.PI));
const SIN = Array.from({ length: K + 1 }, (_, i) => Math.sin((i / K) * Math.PI * 2 + Math.PI));

function streamPath(p: Pour, yBot: number, t: number) {
  const yTop = p.phase === "tail" ? p.tail : SRC;
  if (p.phase === "lead" || p.phase === "drips" || p.phase === "done" || yBot - yTop < 1) return ["", ""];
  const L: string[] = [];
  const R: string[] = [];
  const n = 12;
  let hiTop = "";
  for (let i = 0; i <= n; i++) {
    const y = lerp(yTop, yBot, i / n);
    const v = Math.sqrt(V0 * V0 + 2 * G_STREAM * Math.max(0, y - SRC));
    const hw = (p.w / 2) * Math.max(0.62, Math.pow(V0 / v, 0.3));
    const wob = Math.sin(y * 0.045 + t * 14) * 0.5 * (i / n);
    L.push(`${f1(p.x - hw + wob)} ${f1(y)}`);
    R.unshift(`${f1(p.x + hw + wob)} ${f1(y)}`);
    if (i === 1) hiTop = `M${f1(p.x - hw * 0.35 + wob)} ${f1(y)}`;
  }
  const cap = p.phase === "fall" ? `A1 1 0 0 0 ${R[0]}` : `L${R[0]}`;
  const d = `M${L.join("L")}${cap}L${R.slice(1).join("L")}Z`;
  const hwB = (p.w / 2) * 0.55;
  return [d, `${hiTop}L${f1(p.x - hwB * 0.35)} ${f1(yBot - 2)}`];
}

function renderCup(c: Cup, t: number) {
  const e = c.el;
  if (!e) return;
  const g = c.geo;
  const it = c.item;
  e.root.setAttribute("opacity", c.opacity.toFixed(3));
  e.body.setAttribute(
    "transform",
    `translate(${f1(c.x)} ${f1(c.y)}) rotate(${((c.a * 180) / Math.PI).toFixed(2)} 0 ${-c.pivot})`,
  );
  const sh = c.mode === "fall" ? Math.max(0, 1 - c.fallT * 6) : 1;
  e.shadow.setAttribute("transform", `translate(${f1(c.x)} ${FLOOR})`);
  e.shadow.setAttribute("opacity", sh.toFixed(3));

  const foamH = foamOf(it) * easeOut(c.foam);
  const fTop = c.level + foamH;
  const yS = levelY(g, fTop);
  const rS = levelR(g, fTop) * 1.02;
  const ry = rS * P;
  e.liquid.setAttribute("opacity", clamp(c.level * 50, 0, 1).toFixed(3));

  // ice rests on the bottom until the rising surface lifts it
  for (let k = 0; k < e.ice.length; k++) {
    const [u, v, sz, ang] = ICE[k];
    const s = g.inner.rb * 0.52 * sz;
    const rest = g.inner.bot + v * g.inner.rb * P * 0.5 - s * 0.45;
    const float = yS + v * ry * 0.55 + wave(c, u * 0.6, t) + s * 0.12;
    e.ice[k].setAttribute(
      "transform",
      `translate(${f1(u * rS * 0.6)} ${f1(Math.min(rest, float))}) rotate(${(ang + c.w1 * 3).toFixed(1)}) scale(${f1(s)} ${f1(s * 0.9)})`,
    );
  }

  // muddled mint and lime: most stay on the bottom, the floaters rise with the surface like the ice
  const place = (el: SVGGElement, [u, v, sz, ang, floats]: Solid, size: number, squash: number) => {
    const s = g.inner.rb * size * sz;
    const rest = g.inner.bot + v * g.inner.rb * P * 0.5 - s * 0.3;
    const float = yS + v * ry * 0.5 + wave(c, u * 0.6, t) + s * 0.15;
    const up = floats && float < rest;
    el.setAttribute(
      "transform",
      `translate(${f1(u * (up ? rS * 0.6 : g.inner.rb * 0.9))} ${f1(up ? float : rest)}) scale(1 ${squash}) rotate(${(ang + (up ? c.w1 * 3 : 0)).toFixed(1)}) scale(${f1(s)})`,
    );
  };
  for (let k = 0; k < e.mint.length; k++) place(e.mint[k], MINT[k], 0.72, 0.7);
  for (let k = 0; k < e.lime.length; k++) place(e.lime[k], LIME[k], 0.86, 0.62);
  if (c.level <= 0) return;

  if (e.sprig) {
    const k = easeOut(c.sprig);
    e.sprig.setAttribute("opacity", clamp(c.sprig * 2, 0, 1).toFixed(3));
    e.sprig.setAttribute(
      "transform",
      `translate(${f1(-rS * 0.28)} ${f1(yS + 3 + wave(c, -0.28, t))}) rotate(${(-8 + c.w1 * 2).toFixed(1)}) scale(${f1(SPRIG_H * (0.55 + 0.45 * k))})`,
    );
  }

  // surface ring and liquid body
  const pts: string[] = [];
  let back = "";
  for (let i = 0; i <= K; i++) {
    const u = COS[i];
    const pt = `${f1(rS * u)} ${f1(yS + ry * SIN[i] + wave(c, u, t))}`;
    pts.push(pt);
    if (i <= K / 2) back += (i ? "L" : "M") + pt;
  }
  const surf = `M${pts.join("L")}Z`;
  e.surf.setAttribute("d", surf);
  e.sclip.setAttribute("d", surf);
  const body = `${back}L${f1(rS + 40)} ${g.inner.bot + 40}L${f1(-rS - 40)} ${g.inner.bot + 40}Z`;
  e.liq.setAttribute("d", body);
  e.depth?.setAttribute("d", body);

  if (g.glass && foamH > 0.002) {
    const yL = levelY(g, c.level);
    const rL = levelR(g, c.level) * 1.02;
    // front arc of the liquid level, walked right to left
    let front = "";
    for (let i = K / 2; i <= K; i++) {
      const u = COS[i];
      front += `L${f1(rL * u)} ${f1(yL + rL * P * SIN[i] + wave(c, u, t))}`;
    }
    e.foam.setAttribute("d", `${back}${front}Z`);
  } else {
    e.foam.setAttribute("d", "");
  }

  if (c.dirty) {
    c.dirty = false;
    for (let i = 0; i < N; i++) {
      const [rgb, a] = shadeAt(c.cells, i);
      e.stops[i].setAttribute("stop-color", css(rgb));
      e.stops[i].setAttribute("stop-opacity", a.toFixed(3));
    }
    const [top, ta] = shadeAt(c.cells, topCell(c));
    e.surf.setAttribute("fill", css(top));
    e.surf.setAttribute("fill-opacity", Math.min(1, ta + 0.08).toFixed(3));
    e.depth?.setAttribute("opacity", (ta * 0.9).toFixed(3));
    if (e.base) {
      const [b, ba] = shadeAt(c.cells, 0);
      e.base.setAttribute("fill", css(b));
      e.base.setAttribute("fill-opacity", (ba * 0.45).toFixed(3));
    }
  }

  e.decor.setAttribute(
    "transform",
    `matrix(${f1(rS)} ${(c.w1 / 1).toFixed(2)} 0 ${f1(ry)} 0 ${f1(yS + c.w2)})`,
  );
  e.crema?.setAttribute("opacity", easeOut(c.crema).toFixed(3));
  e.foamTop?.setAttribute("opacity", easeOut(c.foam).toFixed(3));
  if (e.art) {
    const s = Math.max(0, c.art);
    e.art.setAttribute("opacity", clamp(c.art * 1.6, 0, 1).toFixed(3));
    e.art.setAttribute("transform", `translate(0 0.08) scale(${s.toFixed(3)})`);
  }

  // swirl arms on the surface
  const sa = clamp(c.mix * 1.2, 0, 1) * 0.8;
  for (let k = 0; k < e.swirl.length; k++) {
    if (sa < 0.01) {
      e.swirl[k].setAttribute("d", "");
      continue;
    }
    let d = "";
    const rot = t * 2.6 + k * Math.PI;
    for (let i = 0; i <= 22; i++) {
      const s = i / 22;
      const th = rot + s * Math.PI * 2.4;
      const rad = (0.12 + 0.72 * s) * 0.9;
      const u = Math.cos(th) * rad;
      d += `${i ? "L" : "M"}${f1(rS * u)} ${f1(yS + ry * Math.sin(th) * rad + wave(c, u, t))}`;
    }
    e.swirl[k].setAttribute("d", d);
    e.swirl[k].setAttribute("stroke", c.swirlCol);
    e.swirl[k].setAttribute("opacity", sa.toFixed(3));
  }

  // plumes sinking through the liquid (glass only)
  for (let k = 0; k < e.tendrils.length; k++) {
    const td = c.tendrils[k];
    if (!td) {
      e.tendrils[k].setAttribute("d", "");
      continue;
    }
    const grow = easeOut(td.age / 0.7);
    const depth = (yS - g.inner.bot) * 0.85 * grow;
    let d = "";
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      const x = td.x + td.dir * s * s * rS * 0.6 * grow + Math.sin(s * 5 + td.age * 3.5 + td.ph) * s * 8;
      d += `${i ? "L" : "M"}${f1(x)} ${f1(yS + 2 + s * depth)}`;
    }
    e.tendrils[k].setAttribute("d", d);
    e.tendrils[k].setAttribute("stroke", td.col);
    e.tendrils[k].setAttribute("opacity", (0.6 * (1 - td.age / 1.8)).toFixed(3));
  }

  // soda bubbles rise from the bottom and fade once the fizz is spent
  if (e.bubbles.length) {
    const fa = clamp((FIZZ_T - c.fizzT) / 2, 0, 1);
    const yb = g.inner.bot - 3;
    for (let k = 0; k < e.bubbles.length; k++) {
      const el = e.bubbles[k];
      if (fa < 0.01 || yb - yS < 8 || c.mode === "fall") {
        el.setAttribute("r", "0");
        continue;
      }
      const f = (t * (0.45 + ((k * 37) % 10) / 18) + k * 0.618) % 1;
      const y = lerp(yb, yS + 2, f);
      const wr = wallR(g.inner, clamp((y - g.inner.top) / (g.inner.bot - g.inner.top), 0, 1));
      const x = (((k * 53) % 17) / 8.5 - 1) * wr * 0.8 + Math.sin(f * 8 + k) * 1.4;
      el.setAttribute("cx", f1(x).toString());
      el.setAttribute("cy", f1(y).toString());
      el.setAttribute("r", ((0.6 + f) * (k % 3 ? 1 : 1.4)).toFixed(2));
      el.setAttribute("opacity", (fa * (0.35 + 0.5 * f)).toFixed(3));
    }
  }

  for (let k = 0; k < RIPPLES; k++) {
    const rp = c.ripples[k];
    const el = e.ripples[k];
    if (!rp) {
      el.setAttribute("opacity", "0");
      continue;
    }
    const rx = 2 + rp.age * rS * 1.3;
    el.setAttribute("cx", f1(rp.x).toString());
    el.setAttribute("cy", f1(yS + wave(c, clamp(rp.x / rS, -1, 1), t)).toString());
    el.setAttribute("rx", f1(rx).toString());
    el.setAttribute("ry", f1(rx * P).toString());
    el.setAttribute("opacity", (0.55 * (1 - rp.age / 0.7)).toFixed(3));
  }

  // streams
  for (let k = 0; k < 2; k++) {
    const p = c.pours.find((q) => q.slot === k && q.phase !== "done" && q.phase !== "drips");
    const s = e.streams[k];
    if (!p || c.mode === "fall") {
      s.path.setAttribute("d", "");
      s.hi.setAttribute("d", "");
      continue;
    }
    const yBot = p.phase === "fall" ? p.head : yS + wave(c, p.x / rS, t) + 1;
    const [d, hi] = streamPath(p, yBot, t);
    s.path.setAttribute("d", d);
    s.hi.setAttribute("d", hi);
    s.hi.setAttribute("stroke-opacity", STREAM[p.type].hi.toFixed(2));
    s.stops[0].setAttribute("stop-color", STREAM[p.type].fill);
    s.stops[1].setAttribute("stop-color", STREAM[p.type].fill);
    s.stops[1].setAttribute("stop-opacity", STREAM[p.type].a.toFixed(2));
  }

  for (let k = 0; k < PARTS; k++) {
    const q = c.parts[k];
    const el = e.parts[k];
    if (!q) {
      el.setAttribute("r", "0");
      continue;
    }
    el.setAttribute("cx", f1(q.x).toString());
    el.setAttribute("cy", f1(q.y).toString());
    el.setAttribute("r", q.r.toFixed(2));
    el.setAttribute("fill", q.col);
  }
}

function cacheEls(root: SVGGElement): Els {
  const q = <T extends Element>(k: string) => root.querySelector(`[data-k="${k}"]`) as T | null;
  const all = <T extends Element>(k: string) => Array.from(root.querySelectorAll(`[data-k="${k}"]`)) as T[];
  return {
    root,
    shadow: (q("shadow") as SVGGElement),
    body: (q("body") as SVGGElement),
    liquid: (q("liquid") as SVGGElement),
    liq: (q("liq") as SVGPathElement),
    depth: (q("depth") as SVGPathElement | null),
    foam: (q("foam") as SVGPathElement),
    surf: (q("surf") as SVGPathElement),
    sclip: (q("sclip") as SVGPathElement),
    decor: (q("decor") as SVGGElement),
    crema: (q("crema") as SVGGElement | null),
    foamTop: (q("foamtop") as SVGGElement | null),
    art: (q("art") as SVGGElement | null),
    base: (q("base") as SVGPathElement | null),
    stops: (all("stop") as SVGStopElement[]),
    swirl: (all("swirl") as SVGPathElement[]),
    tendrils: (all("tendril") as SVGPathElement[]),
    ripples: (all("ripple") as SVGEllipseElement[]),
    streams: [0, 1].map((i) => ({
      path: (q(`stream${i}`) as SVGPathElement),
      hi: (q(`streamhi${i}`) as SVGPathElement),
      stops: (all(`sstop${i}`) as SVGStopElement[]),
    })),
    parts: (all("part") as SVGCircleElement[]),
    ice: (all("ice") as SVGGElement[]),
    bubbles: (all("bub") as SVGCircleElement[]),
    mint: (all("mint") as SVGGElement[]),
    lime: (all("lime") as SVGGElement[]),
    sprig: (q("sprig") as SVGGElement | null),
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Vessel art                                 */
/* -------------------------------------------------------------------------- */

const GLAZE = {
  cream: { body: "cerCream", rim: "#fbf7f0", rimLine: "#5b331b", inner: "innerCream", edge: "edgeCream", saucer: "saucerCream", handle: "handleCream", ao: "aoCream" },
  terra: { body: "cerTerra", rim: "#f7efe3", rimLine: "", inner: "innerCream", edge: "edgeTerra", saucer: "saucerCream", handle: "handleTerra", ao: "aoTerra" },
} as const;

function Saucer({ g, id }: { g: Geo; id: (s: string) => string }) {
  if (!g.saucer) return null;
  const { y, r } = g.saucer;
  const gl = GLAZE[g.glaze ?? "cream"];
  const o = g.outer;
  return (
    <g>
      <path d={frontBand(r, y, r * 0.985, y + 7)} fill={`url(#${id(gl.edge)})`} />
      <path d={frontBand(r * 0.985, y + 7, r * 0.6, y + 11)} fill="rgba(70,45,25,0.18)" />
      <ellipse cx={0} cy={y} rx={r} ry={r * P} fill={`url(#${id(gl.saucer)})`} />
      <ellipse cx={0} cy={y - 0.6} rx={r * 0.985} ry={r * P * 0.985} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={1} />
      {g.glaze === "cream" && (
        <ellipse cx={0} cy={y} rx={r * 0.93} ry={r * P * 0.93} fill="none" stroke={gl.rimLine} strokeOpacity={0.55} strokeWidth={1.4} />
      )}
      <ellipse cx={0} cy={y + 1.6} rx={r * 0.76} ry={r * P * 0.76} fill="none" stroke="rgba(110,80,55,0.16)" strokeWidth={1.4} />
      <ellipse cx={0} cy={y + 0.6} rx={r * 0.76} ry={r * P * 0.76} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1} />
      <ellipse cx={0} cy={y + 2} rx={r * 0.44} ry={r * P * 0.44} fill="rgba(120,90,60,0.08)" />
      {/* cup's own shadow in the well */}
      <ellipse cx={7} cy={o.bot + 4} rx={o.rb * 1.75} ry={o.rb * P * 1.9} fill={`url(#${id("shadow")})`} />
      <ellipse cx={1} cy={o.bot + 2.5} rx={o.rb * 1.05} ry={o.rb * P * 1.1} fill="rgba(60,35,18,0.32)" filter={`url(#${id("blur2")})`} />
    </g>
  );
}

function VesselBack({ g, id }: { g: Geo; id: (s: string) => string }) {
  const o = g.outer;
  const i = g.inner;
  if (g.glass) {
    return (
      <g>
        {g.handle && <GlassHandle d={g.handle} w={g.handleW!} mask={id("hmask")} />}
        <path d={silhouette(i)} fill="rgba(255,250,240,0.2)" />
        <path d={`M${-i.r} ${i.top}A${i.r} ${f1(i.r * P)} 0 0 1 ${i.r} ${i.top}`} fill="none" stroke="rgba(90,58,32,0.3)" strokeWidth={1} />
        {/* back wall edges seen through the glass */}
        <path d={wallLine(i, -0.97, 0.04, 0.95)} fill="none" stroke="rgba(90,58,32,0.12)" strokeWidth={1.4} />
        <path d={wallLine(i, 0.97, 0.04, 0.95)} fill="none" stroke="rgba(90,58,32,0.12)" strokeWidth={1.4} />
      </g>
    );
  }
  const gl = GLAZE[g.glaze ?? "cream"];
  const fr = o.rb * 0.86;
  return (
    <g>
      <Saucer g={g} id={id} />
      {/* foot ring */}
      <path d={frontBand(fr, o.bot - 2, fr * 0.97, o.bot + 4)} fill={`url(#${id(gl.body)})`} />
      <path d={frontBand(fr * 0.97, o.bot + 3, fr * 0.97, o.bot + 4)} fill="rgba(60,35,18,0.35)" />
      {g.handle && (
        <g>
          <path d={g.handle} fill="none" stroke={`url(#${id(gl.handle)})`} strokeWidth={g.handleW} strokeLinecap="round" />
          <path d={g.handle} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={g.handleW! * 0.22} strokeLinecap="round" transform="translate(-0.6 -1.6)" filter={`url(#${id("blur1")})`} />
          <path d={g.handle} fill="none" stroke="rgba(60,30,15,0.18)" strokeWidth={g.handleW! * 0.25} strokeLinecap="round" transform="translate(0.8 2)" filter={`url(#${id("blur1")})`} />
        </g>
      )}
      {/* rim top and the glazed interior */}
      <ellipse cx={0} cy={o.top} rx={o.r} ry={o.r * P} fill={gl.rim} />
      <ellipse cx={0} cy={i.top + 0.8} rx={i.r} ry={i.r * P} fill={`url(#${id(gl.inner)})`} />
      <ellipse cx={0} cy={i.top + 0.8} rx={i.r} ry={i.r * P} fill="none" stroke="rgba(90,60,35,0.18)" strokeWidth={1} />
    </g>
  );
}

function VesselFront({ g, id }: { g: Geo; id: (s: string) => string }) {
  const o = g.outer;
  const i = g.inner;
  const h = o.bot - o.top;
  if (g.glass) {
    return (
      <g>
        <path d={`${silhouette(o)}${silhouette(i)}`} fillRule="evenodd" fill={`url(#${id("glassWall")})`} />
        {/* thick base: refracts the liquid above it */}
        <path data-k="base" d={frontBand(i.rb, i.bot, o.rb, o.bot)} fill="transparent" />
        <path d={frontBand(i.rb, i.bot, o.rb, o.bot)} fill={`url(#${id("glassBase")})`} />
        <path d={`M${-i.rb} ${i.bot}A${i.rb} ${f1(i.rb * P)} 0 0 0 ${i.rb} ${i.bot}`} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1} />
        <path d={`M${-o.rb + 1} ${o.bot - 1}A${o.rb - 1} ${f1((o.rb - 1) * P)} 0 0 0 ${o.rb - 1} ${o.bot - 1}`} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.2} />
        <path d={`M${-o.rb} ${o.bot}A${o.rb} ${f1(o.rb * P)} 0 0 0 ${o.rb} ${o.bot}`} fill="none" stroke="rgba(80,50,28,0.4)" strokeWidth={0.9} />
        <path d={bodyPath(o)} fill={`url(#${id("glassFace")})`} />
        {/* highlights */}
        <path d={wallLine(o, -0.78, 0.05, 0.86)} fill="none" stroke="white" strokeOpacity={0.55} strokeWidth={5} strokeLinecap="round" filter={`url(#${id("blur2")})`} />
        <path d={wallLine(o, -0.8, 0.07, 0.8)} fill="none" stroke="white" strokeOpacity={0.9} strokeWidth={1.1} strokeLinecap="round" />
        <path d={wallLine(o, 0.84, 0.08, 0.42)} fill="none" stroke="white" strokeOpacity={0.6} strokeWidth={1.6} strokeLinecap="round" />
        <path d={wallLine(o, 0.86, 0.55, 0.62)} fill="none" stroke="white" strokeOpacity={0.5} strokeWidth={1.2} strokeLinecap="round" />
        {g.rings?.map((d) => {
          const y = o.top + d;
          const r = wallR(o, d / h);
          const arc = `M${f1(-r)} ${f1(y)}A${f1(r)} ${f1(r * P)} 0 0 0 ${f1(r)} ${f1(y)}`;
          return (
            <g key={d} fill="none" strokeLinecap="round">
              <path d={arc} stroke="rgba(90,58,32,0.22)" strokeWidth={1} transform="translate(0 1.2)" />
              <path d={arc} stroke="white" strokeOpacity={0.8} strokeWidth={1.3} />
            </g>
          );
        })}
        {/* rim */}
        <ellipse cx={0} cy={o.top} rx={o.r} ry={o.r * P} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={1.4} />
        <ellipse cx={0} cy={i.top + 0.6} rx={i.r} ry={i.r * P} fill="none" stroke="rgba(90,58,32,0.32)" strokeWidth={0.8} />
        <path d={`M${-o.r} ${o.top + 1.4}A${o.r} ${f1(o.r * P)} 0 0 0 ${o.r} ${o.top + 1.4}`} fill="none" stroke="rgba(90,58,32,0.26)" strokeWidth={0.9} />
      </g>
    );
  }
  const gl = GLAZE[g.glaze ?? "cream"];
  return (
    <g>
      <path d={bodyPath(o)} fill={`url(#${id(gl.body)})`} />
      <path d={bodyPath(o)} fill={`url(#${id(gl.ao)})`} />
      {/* bounce light from the saucer, and a soft specular streak */}
      <path d={wallLine(o, 0.93, 0.35, 0.92)} fill="none" stroke="rgba(255,236,214,0.4)" strokeWidth={3} filter={`url(#${id("blur2")})`} />
      <path d={wallLine(o, -0.6, 0.12, 0.78)} fill="none" stroke="white" strokeOpacity={g.glaze === "terra" ? 0.45 : 0.85} strokeWidth={h * 0.09} strokeLinecap="round" filter={`url(#${id("blur3")})`} />
      <path d={wallLine(o, -0.62, 0.16, 0.5)} fill="none" stroke="white" strokeOpacity={0.8} strokeWidth={1.4} strokeLinecap="round" filter={`url(#${id("blur05")})`} />
      {/* rim lip in front */}
      <path d={frontBand(o.r, o.top, i.r, i.top + 0.8)} fill={gl.rim} />
      <path d={`M${-i.r} ${i.top + 0.8}A${i.r} ${f1(i.r * P)} 0 0 0 ${i.r} ${i.top + 0.8}`} fill="none" stroke="rgba(90,60,35,0.22)" strokeWidth={0.8} />
      <path d={`M${-o.r + 2} ${o.top + 0.6}A${o.r - 2} ${f1((o.r - 2) * P)} 0 0 0 ${o.r - 2} ${o.top + 0.6}`} fill="none" stroke="white" strokeOpacity={0.9} strokeWidth={0.9} />
      {gl.rimLine && (
        <path d={`M${-o.r + 0.6} ${o.top + 1.6}A${o.r - 0.6} ${f1((o.r - 0.6) * P)} 0 0 0 ${o.r - 0.6} ${o.top + 1.6}`} fill="none" stroke={gl.rimLine} strokeOpacity={0.85} strokeWidth={1.7} />
      )}
      {g.glaze === "terra" && (
        <path d={`M${-o.r} ${o.top + 3}A${o.r} ${f1(o.r * P)} 0 0 0 ${o.r} ${o.top + 3}`} fill="none" stroke="#f3e7d6" strokeOpacity={0.9} strokeWidth={2.6} />
      )}
    </g>
  );
}

function GlassHandle({ d, w, mask }: { d: string; w: number; mask: string }) {
  return (
    <g>
      <mask id={mask} maskUnits="userSpaceOnUse" x={-200} y={-300} width={400} height={400}>
        <path d={d} fill="none" stroke="white" strokeWidth={w} strokeLinecap="round" />
        <path d={d} fill="none" stroke="black" strokeWidth={w - 2.8} strokeLinecap="round" />
      </mask>
      <path d={d} fill="none" stroke="rgba(255,250,240,0.35)" strokeWidth={w} strokeLinecap="round" />
      <path d={d} fill="none" stroke="rgba(80,52,30,0.5)" strokeWidth={w} strokeLinecap="round" mask={`url(#${mask})`} />
      <path d={d} fill="none" stroke="rgba(150,110,75,0.12)" strokeWidth={w * 0.3} strokeLinecap="round" />
      <path d={d} fill="none" stroke="white" strokeOpacity={0.95} strokeWidth={1.1} strokeLinecap="round" transform="translate(-1.6 -1.2)" />
    </g>
  );
}

function Shadow({ g, id }: { g: Geo; id: (s: string) => string }) {
  const r = g.shadowR;
  return (
    <g data-k="shadow">
      <ellipse cx={10} cy={4} rx={r * 1.25} ry={r * P * 1.3} fill={`url(#${id("shadow")})`} opacity={g.glass ? 0.55 : 0.8} />
      <ellipse cx={2} cy={g.saucer ? 6 : 1} rx={r * 0.98} ry={r * P * 0.9} fill="rgba(62,34,14,0.36)" filter={`url(#${id("blur3")})`} opacity={g.glass ? 0.6 : 1} />
      {g.glass && (
        <ellipse cx={r * 0.55} cy={5} rx={r * 0.55} ry={r * P * 0.5} fill="rgba(232,160,90,0.3)" filter={`url(#${id("blur3")})`} />
      )}
    </g>
  );
}

/** Ice cubes: position across (u) and into (v) the surface, size factor, angle in degrees. */
const ICE: [number, number, number, number][] = [
  [-0.42, -0.3, 1, 12],
  [0.4, 0.1, 0.92, -18],
  [-0.02, 0.55, 0.85, 30],
  [0.5, -0.6, 0.8, 5],
];

/** Muddled solids: position across (u) and into (v) the glass, size factor, angle, 1 if it floats up. */
type Solid = [number, number, number, number, number];
const MINT: Solid[] = [
  [-0.5, 0.2, 1, -30, 0],
  [0.35, -0.3, 0.9, 40, 0],
  [0.05, 0.5, 0.95, 80, 0],
  [-0.2, -0.5, 0.85, 10, 1],
  [0.55, 0.3, 0.8, -60, 1],
  [-0.6, -0.1, 0.75, 120, 1],
  [0.2, 0.1, 0.8, -100, 0],
  [-0.35, 0.6, 0.7, 60, 1],
];
const LIME: Solid[] = [
  [0.3, 0.35, 1, -20, 0],
  [-0.4, -0.2, 0.95, 25, 1],
  [0.1, -0.6, 0.9, 5, 0],
];
/** Leaf shape, base at x -0.5, tip at x 0.5. */
const LEAF = "M-0.5 0C-0.25 -0.27 0.2 -0.27 0.5 0C0.2 0.27 -0.25 0.27 -0.5 0Z";
const SPRIG_H = 58;
/** Sprig leaves: height up the stem (0 to 1), angle, size. */
const SPRIG: [number, number, number][] = [
  [0.4, -150, 0.42],
  [0.42, -30, 0.4],
  [0.66, -140, 0.36],
  [0.68, -40, 0.35],
  [0.98, -95, 0.32],
];
const GARNISH = {
  mint: { label: "daun mint", unit: "lembar" },
  lime: { label: "jeruk nipis", unit: "iris" },
} as const;

function MintLeaf({ fill = "#4f9a44" }: { fill?: string }) {
  return (
    <>
      <path d={LEAF} fill={fill} stroke="#2f6a28" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      <path d="M-0.46 0L0.4 0" fill="none" stroke="rgba(214,238,196,0.7)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
    </>
  );
}

function LimeSlice() {
  return (
    <>
      <circle r={0.5} fill="#a9c63c" stroke="#6f8f22" strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
      <circle r={0.42} fill="#e4edb0" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <path key={i} d={`M0 0L${(Math.cos(a) * 0.4).toFixed(2)} ${(Math.sin(a) * 0.4).toFixed(2)}`} stroke="#c3d672" strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
        );
      })}
      <circle r={0.06} fill="#f3f7d6" />
    </>
  );
}

/** "6 lembar daun mint, 2 iris jeruk nipis dan es batu", or "" when there is nothing besides liquids. */
function extrasText(item: CoffeeItem) {
  const parts = (item.garnish ?? [])
    .filter((g) => g.count > 0)
    .map((g) => `${g.count} ${GARNISH[g.type].unit} ${GARNISH[g.type].label}`);
  if (item.ice) parts.push("es batu");
  if (!parts.length) return "";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} dan ${parts[parts.length - 1]}`;
}

const HEART = "M0 0.78C-0.5 0.36 -0.98 0.02 -0.68 -0.48C-0.46 -0.82 -0.1 -0.74 0 -0.4C0.1 -0.74 0.46 -0.82 0.68 -0.48C0.98 0.02 0.5 0.36 0 0.78Z";

const CupView = React.memo(function CupView({
  cup,
  id,
  register,
}: {
  cup: { key: number; item: CoffeeItem };
  id: (s: string) => string;
  register: (key: number, el: SVGGElement | null) => void;
}) {
  const it = cup.item;
  const g = GEO[it.vessel] ?? GEO.cup;
  const k = cup.key;
  const liqId = id(`liq${k}`);
  const clip = id(`clip-${it.vessel}`);
  const sclip = id(`sclip${k}`);
  // juice froth and soda heads take their own colour; milk foam keeps the shared gradients
  const froth = it.foam && it.foamColor ? hexRGB(it.foamColor) : null;
  const frothStops = froth && {
    lo: css(mixRGB(froth, [90, 60, 40], 0.18)),
    mid: css(froth),
    hi: css(mixRGB(froth, [255, 253, 248], 0.65)),
  };
  const foamFill = frothStops ? id(`fb${k}`) : it.foam ? id("foamBand") : id("cremaBand");
  const iceCount = clamp(Math.round(it.ice ?? 0), 0, ICE.length);
  const solid = (type: CoffeeGarnish["type"], max: number) =>
    clamp(Math.round(it.garnish?.find((x) => x.type === type)?.count ?? 0), 0, max);
  const mintCount = solid("mint", MINT.length);
  const limeCount = solid("lime", LIME.length);
  return (
    <g ref={(el) => register(k, el)}>
      <defs>
        {frothStops && (
          <>
            <linearGradient id={id(`fb${k}`)} x1={0} y1={1} x2={0} y2={0}>
              <stop offset={0} stopColor={frothStops.lo} />
              <stop offset={0.5} stopColor={frothStops.mid} />
              <stop offset={1} stopColor={frothStops.hi} />
            </linearGradient>
            <radialGradient id={id(`ft${k}`)}>
              <stop offset={0} stopColor={frothStops.hi} />
              <stop offset={0.6} stopColor={frothStops.mid} />
              <stop offset={0.86} stopColor={frothStops.mid} />
              <stop offset={1} stopColor={frothStops.lo} />
            </radialGradient>
          </>
        )}
        <linearGradient id={liqId} gradientUnits="userSpaceOnUse" x1={0} y1={g.inner.bot} x2={0} y2={g.inner.top}>
          {Array.from({ length: N }, (_, i) => (
            <stop key={i} data-k="stop" offset={(i + 0.5) / N} stopColor="#3a1e0e" />
          ))}
        </linearGradient>
        {[0, 1].map((s) => (
          <linearGradient key={s} id={id(`st${k}-${s}`)} gradientUnits="userSpaceOnUse" x1={0} y1={-FLOOR} x2={0} y2={-FLOOR + 70}>
            <stop data-k={`sstop${s}`} offset={0} stopOpacity={0} stopColor="#3a1e0e" />
            <stop data-k={`sstop${s}`} offset={1} stopColor="#3a1e0e" />
          </linearGradient>
        ))}
        <clipPath id={sclip}>
          <path data-k="sclip" />
        </clipPath>
      </defs>
      <Shadow g={g} id={id} />
      <g data-k="body" transform={`translate(${W + 160} ${FLOOR})`}>
        <VesselBack g={g} id={id} />
        <g data-k="liquid" opacity={0} clipPath={`url(#${clip})`}>
          <path data-k="liq" fill={`url(#${liqId})`} />
          {g.glass && <path data-k="depth" fill={`url(#${id("liqDepth")})`} />}
          {g.glass && (
            <g filter={`url(#${id("blur3")})`} fill="none" strokeLinecap="round">
              {Array.from({ length: TENDRILS }, (_, i) => (
                <path key={i} data-k="tendril" strokeWidth={6 - i} />
              ))}
            </g>
          )}
          {it.fizz && (
            <g fill="rgba(255,255,255,0.85)">
              {Array.from({ length: FIZZ }, (_, i) => (
                <circle key={i} data-k="bub" r={0} />
              ))}
            </g>
          )}
          <path data-k="foam" fill={`url(#${foamFill})`} />
          <path data-k="surf" fill="#3a1e0e" />
          <g clipPath={`url(#${sclip})`}>
            <g data-k="decor">
              <circle r={1.1} fill={`url(#${id("sheen")})`} />
              {it.crema && (
                <g data-k="crema" opacity={0}>
                  <circle r={1.1} fill={`url(#${id("crema")})`} />
                  <ellipse cx={-0.3} cy={-0.1} rx={0.16} ry={0.1} fill="rgba(110,55,22,0.35)" />
                  <ellipse cx={0.28} cy={0.25} rx={0.12} ry={0.08} fill="rgba(110,55,22,0.3)" />
                  <ellipse cx={0.1} cy={-0.4} rx={0.1} ry={0.06} fill="rgba(110,55,22,0.25)" />
                  <ellipse cx={-0.1} cy={0.1} rx={0.42} ry={0.32} fill="rgba(240,195,130,0.22)" />
                  {BUBBLES.map(([x, y, r], j) => (
                    <circle key={j} cx={x} cy={y} r={r} fill="rgba(255,236,205,0.55)" />
                  ))}
                </g>
              )}
              {!!it.foam && it.art !== "heart" && (
                <g data-k="foamtop" opacity={0}>
                  <circle r={1.1} fill={`url(#${frothStops ? id(`ft${k}`) : id("foamTop")})`} />
                  {BUBBLES.map(([x, y, r], j) => (
                    <circle key={j} cx={x * 0.95} cy={y} r={r * 0.8} fill="rgba(200,170,130,0.35)" />
                  ))}
                </g>
              )}
              {it.art === "heart" && (
                <>
                  <g data-k="foamtop" opacity={0}>
                    <circle r={1.1} fill={`url(#${id("artBase")})`} />
                  </g>
                  <g data-k="art" opacity={0}>
                    <path d={HEART} fill={`url(#${id("heart")})`} transform="scale(0.62)" />
                    <path d="M0 0.48C0.02 0.2 -0.02 -0.05 0 -0.28" fill="none" stroke="rgba(170,110,60,0.35)" strokeWidth={0.035} transform="scale(0.62)" />
                  </g>
                </>
              )}
            </g>
          </g>
          <g fill="none" strokeLinecap="round" filter={`url(#${id("blur1")})`}>
            <path data-k="swirl" strokeWidth={3.2} />
            <path data-k="swirl" strokeWidth={2.2} />
          </g>
          <g fill="none" stroke="rgba(255,250,240,1)" strokeWidth={0.9}>
            {Array.from({ length: RIPPLES }, (_, i) => (
              <ellipse key={i} data-k="ripple" opacity={0} />
            ))}
          </g>
        </g>
        {mintCount + limeCount > 0 && (
          <g clipPath={`url(#${clip})`}>
            {Array.from({ length: limeCount }, (_, i) => (
              <g key={`l${i}`} data-k="lime" opacity={0.92}>
                <LimeSlice />
              </g>
            ))}
            {Array.from({ length: mintCount }, (_, i) => (
              <g key={`m${i}`} data-k="mint">
                <MintLeaf />
              </g>
            ))}
          </g>
        )}
        {iceCount > 0 && (
          <g clipPath={`url(#${clip})`}>
            {Array.from({ length: iceCount }, (_, i) => (
              <g key={i} data-k="ice">
                <rect x={-0.5} y={-0.5} width={1} height={1} rx={0.2} fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.85)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <path d="M-0.3 -0.3L0.2 -0.3M-0.3 -0.3L-0.3 0.1" fill="none" stroke="white" strokeOpacity={0.9} strokeWidth={1.3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </g>
        )}
        {[0, 1].map((s) => (
          <g key={s}>
            <path data-k={`stream${s}`} fill={`url(#${id(`st${k}-${s}`)})`} />
            <path data-k={`streamhi${s}`} fill="none" stroke="white" strokeWidth={0.9} strokeLinecap="round" />
          </g>
        ))}
        <g>
          {Array.from({ length: PARTS }, (_, i) => (
            <circle key={i} data-k="part" r={0} />
          ))}
        </g>
        {mintCount > 0 && (
          // drawn behind the front wall, unclipped, so the top pokes out over the rim
          <g data-k="sprig" opacity={0}>
            <path d="M0 0.05C0.02 -0.4 -0.01 -0.7 0.03 -1" fill="none" stroke="#3f7d35" strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {SPRIG.map(([h, ang, size], i) => (
              <g key={i} transform={`translate(0.02 ${-h}) rotate(${ang}) translate(${size / 2} 0) scale(${size})`}>
                <MintLeaf fill="#5aa84c" />
              </g>
            ))}
          </g>
        )}
        <VesselFront g={g} id={id} />
      </g>
    </g>
  );
});

const BUBBLES: [number, number, number][] = [
  [-0.82, -0.3, 0.035],
  [-0.88, 0.1, 0.028],
  [-0.7, 0.55, 0.03],
  [0.86, -0.2, 0.03],
  [0.8, 0.4, 0.036],
  [0.55, 0.72, 0.026],
  [-0.4, -0.84, 0.024],
  [0.3, -0.88, 0.028],
  [-0.2, 0.9, 0.025],
];

function Defs({ id }: { id: (s: string) => string }) {
  const lin = (name: string, stops: [number, string][], v = false) => (
    <linearGradient id={id(name)} x1={0} y1={v ? 0 : 0} x2={v ? 0 : 1} y2={v ? 1 : 0}>
      {stops.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </linearGradient>
  );
  const rad = (name: string, stops: [number, string][], cx = 0.5, cy = 0.5, r = 0.5) => (
    <radialGradient id={id(name)} cx={cx} cy={cy} r={r}>
      {stops.map(([o, c]) => (
        <stop key={o} offset={o} stopColor={c} />
      ))}
    </radialGradient>
  );
  const blur = (name: string, s: number) => (
    <filter id={id(name)} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation={s} />
    </filter>
  );
  return (
    <defs>
      {blur("blur05", 0.5)}
      {blur("blur1", 1)}
      {blur("blur2", 2)}
      {blur("blur3", 3.2)}
      {lin("cerCream", [[0, "#c3b49e"], [0.1, "#ddd1c0"], [0.3, "#f6f0e6"], [0.42, "#fffdf9"], [0.62, "#f1e8dc"], [0.85, "#d7c9b6"], [1, "#bba98f"]])}
      {lin("cerTerra", [[0, "#7c3f22"], [0.12, "#9a5230"], [0.32, "#c27447"], [0.44, "#cf8556"], [0.64, "#ac6136"], [0.86, "#8b4a2a"], [1, "#723a20"]])}
      {lin("handleCream", [[0, "#efe6da"], [0.5, "#d9ccba"], [1, "#b5a48c"]])}
      {lin("handleTerra", [[0, "#b8693e"], [0.5, "#9a5230"], [1, "#743b20"]])}
      {lin("edgeCream", [[0, "#b9a990"], [0.3, "#e7ded1"], [0.55, "#ddd2c2"], [1, "#b7a68d"]])}
      {lin("edgeTerra", [[0, "#7a3e22"], [0.3, "#b8693e"], [0.55, "#a65d35"], [1, "#743b20"]])}
      {(["aoCream", "aoTerra"] as const).map((n) => (
        <linearGradient key={n} id={id(n)} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={n === "aoCream" ? "rgb(96,64,38)" : "rgb(70,30,12)"} stopOpacity={0} />
          <stop offset={0.55} stopColor={n === "aoCream" ? "rgb(96,64,38)" : "rgb(70,30,12)"} stopOpacity={0} />
          <stop offset={1} stopColor={n === "aoCream" ? "rgb(96,64,38)" : "rgb(70,30,12)"} stopOpacity={n === "aoCream" ? 0.28 : 0.38} />
        </linearGradient>
      ))}
      {rad("innerCream", [[0, "#fffdf9"], [0.55, "#f1e9dd"], [0.85, "#dccfbd"], [1, "#c9b9a2"]], 0.42, 0.18, 0.75)}
      {rad("saucerCream", [[0, "#fffefb"], [0.5, "#f6f0e7"], [0.8, "#e9e0d3"], [0.93, "#ddd1c0"], [1, "#efe7dc"]], 0.45, 0.4, 0.55)}
      {rad("shadow", [[0, "rgba(70,40,18,0.48)"], [0.5, "rgba(70,40,18,0.18)"], [1, "rgba(70,40,18,0)"]])}
      {lin("glassWall", [[0, "rgba(72,44,22,0.5)"], [0.05, "rgba(255,255,255,0.62)"], [0.13, "rgba(255,255,255,0.16)"], [0.5, "rgba(255,255,255,0.08)"], [0.84, "rgba(255,255,255,0.16)"], [0.94, "rgba(255,255,255,0.58)"], [1, "rgba(72,44,22,0.48)"]])}
      {lin("glassFace", [[0, "rgba(255,255,255,0)"], [0.1, "rgba(255,255,255,0.22)"], [0.18, "rgba(255,255,255,0.05)"], [0.6, "rgba(255,255,255,0)"], [0.88, "rgba(255,255,255,0.14)"], [1, "rgba(255,255,255,0)"]])}
      <linearGradient id={id("glassBase")} x1={0} y1={0} x2={0} y2={1}>
        <stop offset={0} stopColor="white" stopOpacity={0.35} />
        <stop offset={0.5} stopColor="white" stopOpacity={0.05} />
        <stop offset={1} stopColor="rgb(90,66,46)" stopOpacity={0.18} />
      </linearGradient>
      {lin("liqDepth", [[0, "rgba(18,8,3,0.55)"], [0.16, "rgba(18,8,3,0.1)"], [0.38, "rgba(255,230,200,0.08)"], [0.62, "rgba(18,8,3,0)"], [0.84, "rgba(18,8,3,0.12)"], [1, "rgba(18,8,3,0.6)"]])}
      {rad("sheen", [[0, "rgba(255,255,255,0.28)"], [0.6, "rgba(255,255,255,0.06)"], [1, "rgba(255,255,255,0)"]], 0.38, 0.3, 0.6)}
      {rad("crema", [[0, "#dba468"], [0.45, "#c88a4f"], [0.8, "#a0602f"], [1, "#6e3a1a"]], 0.45, 0.42, 0.5)}
      {rad("foamTop", [[0, "#fffdf8"], [0.6, "#f7efe3"], [0.86, "#ead9c1"], [1, "#cfae86"]])}
      {rad("artBase", [[0, "#b87d4c"], [0.55, "#a66b3d"], [0.74, "#8d552c"], [0.83, "#c39467"], [0.88, "#f1e5d3"], [1, "#f7efe3"]])}
      {rad("heart", [[0, "#fffdf9"], [0.7, "#f8f0e4"], [1, "#e8d6bb"]])}
      <linearGradient id={id("foamBand")} x1={0} y1={1} x2={0} y2={0}>
        <stop offset={0} stopColor="#dcc19e" />
        <stop offset={0.5} stopColor="#f3e8d8" />
        <stop offset={1} stopColor="#fdf9f2" />
      </linearGradient>
      <linearGradient id={id("cremaBand")} x1={0} y1={1} x2={0} y2={0}>
        <stop offset={0} stopColor="#7a4220" />
