import { DEFAULT_COFFEE_ITEMS, type CoffeeCategory } from "@/components/ui/coffee-pour-menu";

// Layers without `amount` share the glass height (`fill`, default 0.8) in proportion to their ml.
export const MENU: CoffeeCategory[] = [
  { id: "kopi", label: "Kopi", items: DEFAULT_COFFEE_ITEMS },
  {
    id: "jus",
    label: "Jus",
    items: [
      {
        id: "jus-jeruk-wortel",
        name: "Jus Jeruk Wortel",
        subtitle: "250 ml, segar",
        description: "jeruk peras dan wortel, diaduk rata di atas es batu",
        vessel: "tumbler",
        fill: 0.78,
        layers: [
          { type: "orange", ml: 150 },
          { type: "carrot", ml: 100 },
        ],
        foam: 0.04,
        foamColor: "#f9c98a",
        ice: 3,
      },
      {
        id: "jus-alpukat",
        name: "Jus Alpukat",
        subtitle: "250 ml, kental",
        description: "alpukat diblender dengan sirup gula, disiram susu cokelat di atasnya",
        vessel: "tall-glass",
        fill: 0.8,
        layers: [
          { type: "sugar", ml: 20 },
          { type: "avocado", ml: 200 },
          { type: "chocolate", ml: 30 },
        ],
        blend: 0.12,
      },
      {
        id: "stroberi-pisang",
        name: "Stroberi Pisang",
        subtitle: "260 ml, smoothie",
        description: "stroberi, pisang dan yogurt diblender jadi smoothie",
        vessel: "jar",
        fill: 0.8,
        layers: [
          { type: "strawberry", ml: 120 },
          { type: "banana", ml: 80 },
          { type: "yogurt", ml: 60 },
        ],
        foam: 0.05,
        foamColor: "#f6c3c8",
      },
      {
        id: "mango-lassi",
        name: "Mango Lassi",
        subtitle: "280 ml, asam manis",
        description: "mangga, yogurt dan susu diblender ala India",
        vessel: "glass-mug",
        fill: 0.78,
        layers: [
          { type: "mango", ml: 140 },
          { type: "yogurt", ml: 100 },
          { type: "milk", ml: 40 },
        ],
        foam: 0.04,
        foamColor: "#fde2a8",
      },
    ],
  },
  {
    id: "teh-soda",
    label: "Teh & soda",
    items: [
      {
        id: "es-teh-susu",
        name: "Es Teh Susu",
        subtitle: "240 ml, manis",
        description: "teh hitam pekat dengan susu kental manis, disiram susu evaporasi di atasnya",
        vessel: "jar",
        fill: 0.8,
        layers: [
          { type: "tea", ml: 150, label: "Teh hitam" },
          { type: "condensed", ml: 40 },
          { type: "milk", ml: 50, label: "Susu evaporasi" },
        ],
        blend: 0.22,
        ice: 3,
      },
      {
        id: "matcha-latte",
        name: "Matcha Latte",
