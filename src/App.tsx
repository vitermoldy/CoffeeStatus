import CoffeePourMenuDemo from '@/components/coffee-pour-menu-demo'

export default function App() {
  return (
    // top-aligned: the menu changes height between drinks, and centring it would make it jump
    <main className="grid min-h-dvh content-start justify-items-center sm:pt-[4vh]">
      <h1 className="sr-only">CoffeeStatus</h1>
