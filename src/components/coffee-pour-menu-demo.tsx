import { CoffeePourMenu } from "@/components/ui/coffee-pour-menu";
import { MENU } from "@/data/menu";

export default function CoffeePourMenuDemo() {
  return (
    <div className="flex w-full flex-col items-center bg-[#e4cdb0] p-2 sm:p-6">
      <CoffeePourMenu categories={MENU} defaultValue="cappuccino" className="max-w-5xl" />
