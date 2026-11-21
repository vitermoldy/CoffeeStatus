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
