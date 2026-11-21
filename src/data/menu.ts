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
