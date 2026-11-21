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
