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
