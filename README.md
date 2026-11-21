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
