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
