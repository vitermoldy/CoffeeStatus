import { CoffeePourMenu } from "@/components/ui/coffee-pour-menu";
import { MENU } from "@/data/menu";

export default function CoffeePourMenuDemo() {
  return (
    <div className="flex w-full flex-col items-center bg-[#e4cdb0] p-2 sm:p-6">
      <CoffeePourMenu categories={MENU} defaultValue="cappuccino" className="max-w-5xl" />
      <p className="mt-4 text-center text-sm tracking-tight text-[#6b4a35]">
        Komponen asli oleh{" "}
        <a
          href="https://aakashmehra.com/ref/coffeepourmenu"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#3a271d] underline-offset-4 hover:underline"
        >
          aakashmehra.com
        </a>
