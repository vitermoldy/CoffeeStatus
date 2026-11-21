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
