# CoffeeStatus

Menu minuman interaktif di browser. Pilih minuman, gelas yang sedang tampil terlempar dari panggung,
gelas baru meluncur masuk, lalu minumannya dituang lapis demi lapis. Kartu resep di sebelahnya
menghitung berapa ml tiap bahan yang sudah masuk. Semua gelas dan cairan digambar dengan SVG di
dalam kode.

Komponen dasarnya `coffee-pour-menu` karya Aakash Mehra
([aakashmehra.com](https://aakashmehra.com/ref/coffeepourmenu)), dikembangkan di proyek ini untuk
jus, teh, dan soda.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5193
npm run build      # cek tipe + build ke dist/
```

Di Windows, jalankan dari `C:\MyRepo\CoffeeStatus` (huruf C besar).

## Menu

| Tab | Minuman | Gelas | Resep |
|---|---|---|---|
| Kopi | Espresso | demitasse | espresso 30 ml |
| Kopi | Americano | glass-mug | air panas 180 ml, espresso 60 ml |
| Kopi | Cappuccino | cup | espresso 60 ml, susu panas 120 ml |
| Kopi | Latte | tall-glass | espresso 60 ml, susu panas 240 ml |
| Jus | Jus Jeruk Wortel | tumbler + es | jus jeruk 150 ml, jus wortel 100 ml |
| Jus | Jus Alpukat | tall-glass | sirup gula 20 ml, jus alpukat 200 ml, susu cokelat 30 ml |
| Jus | Stroberi Pisang | jar | stroberi 120 ml, pisang 80 ml, yogurt 60 ml |
| Jus | Mango Lassi | glass-mug | mangga 140 ml, yogurt 100 ml, susu 40 ml |
| Teh & soda | Es Teh Susu | jar + es | teh hitam 150 ml, susu kental manis 40 ml, susu evaporasi 50 ml |
| Teh & soda | Matcha Latte | tumbler + es | susu dingin 170 ml, matcha 70 ml |
| Teh & soda | Teh Lemon Madu | glass-mug | teh 200 ml, air lemon 25 ml, madu 25 ml |
| Teh & soda | Soda Gembira | tall-glass + es | sirup merah 30 ml, susu kental manis 30 ml, air soda 190 ml |
| Teh & soda | Mojito (tanpa alkohol) | tall-glass + es | air jeruk nipis 30 ml, sirup gula 20 ml, air soda 150 ml, dengan 6 lembar daun mint dan 2 iris jeruk nipis |

Data menu ada di [src/data/menu.ts](src/data/menu.ts).

## Struktur

```
src/
  components/
    ui/coffee-pour-menu.tsx      komponen menu (folder ui ala shadcn)
    coffee-pour-menu-demo.tsx    halaman menu + kredit pembuat
  data/menu.ts                   tab dan resep minuman
  lib/utils.ts                   helper cn() (clsx + tailwind-merge)
  App.tsx                        halaman
  index.css                      Tailwind 4 dan font
components.json                  konfigurasi shadcn CLI
```

Stack: Vite 8, React 19, TypeScript, Tailwind CSS 4, `motion` untuk animasi pil pilihan.

## Menambah minuman

```tsx
{
  id: "es-kopi-susu",
  name: "Es Kopi Susu",
  subtitle: "250 ml, manis",
  description: "espresso, susu dan sirup gula aren",
  vessel: "tumbler",          // demitasse | glass-mug | cup | tall-glass | tumbler | jar
  fill: 0.8,                  // tinggi isi gelas, dibagi ke tiap lapisan sesuai ml
  layers: [
    { type: "sugar", ml: 20, label: "Gula aren" },
    { type: "milk", ml: 170 },
    { type: "espresso", ml: 60 },
  ],
  blend: 0.2,                 // 0 tetap berlapis, 1 tercampur rata
  ice: 3,                     // es batu, 0 sampai 4
}
```

- `layers` dituang berurutan. `ml` tampil di kartu resep, `label` mengganti nama bahan di kartu.
  Tanpa `amount`, tinggi tiap lapisan dihitung dari `fill` dan perbandingan ml.
- Cairan yang tersedia: `espresso`, `water`, `milk`, `orange`, `carrot`, `avocado`, `sugar`,
  `chocolate`, `strawberry`, `banana`, `yogurt`, `mango`, `tea`, `condensed`, `matcha`, `lemon`,
  `honey`, `syrup`, `lime`, `soda`. Warna, kepekatan, dan cara tuangnya ada di `LIQUIDS` dalam
  komponen.
- `garnish` untuk bahan padat yang ditumbuk di gelas sebelum dituang:
  `[{ type: "mint", count: 6 }, { type: "lime", count: 2 }]`. Mint juga memunculkan setangkai daun
  di atas gelas setelah selesai dituang. Garnish dan es batu ditulis di bawah kartu resep
  ("Dengan 6 lembar daun mint, 2 iris jeruk nipis dan es batu").
- Opsi lain: `foam` (tebal busa), `foamColor` (warna busa selain susu), `crema`, `art: "heart"`,
  `fizz` (gelembung soda selama dituang).

Komponennya bisa dipakai dengan satu daftar (`items`) atau berkelompok di tab (`categories`),
