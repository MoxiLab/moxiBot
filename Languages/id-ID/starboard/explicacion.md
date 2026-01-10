# Apa itu perintah starboard?

Perintah `starboard` memungkinkan Anda menyoroti pesan terbaik dari server Anda di saluran khusus. Ketika sebuah pesan menerima cukup reaksi (misalnya, ⭐), bot secara otomatis mempostingnya di saluran starboard agar semua orang dapat melihatnya.

## Cara menggunakannya?

1. **Atur saluran starboard:**
   - Gunakan perintah `/starboard set <saluran>` untuk memilih di mana pesan yang disorot akan muncul.

2. **Tentukan jumlah reaksi yang dibutuhkan:**
   - Anda dapat menentukan berapa banyak reaksi (misalnya, bintang) yang dibutuhkan sebuah pesan untuk ditampilkan. Contoh: `/starboard threshold 3` hanya akan menampilkan pesan dengan 3 bintang atau lebih.

3. **Nonaktifkan atau sesuaikan sistem:**
   - Untuk menonaktifkan starboard, gunakan `/starboard disable`.
   - Anda dapat mengubah saluran atau ambang batas kapan saja dengan perintah yang sama.

## Contoh penggunaan

- `/starboard set #sorotan` → Menetapkan #sorotan sebagai saluran starboard.
- `/starboard threshold 5` → Hanya pesan dengan 5 bintang atau lebih yang akan ditampilkan.
- `/starboard disable` → Menonaktifkan sistem starboard.

## Catatan
- Hanya administrator yang dapat mengonfigurasi starboard.
- Bot memerlukan izin untuk melihat dan mengirim pesan di saluran starboard.
- Pesan yang dihapus atau diedit mungkin tidak lagi muncul di starboard.

Dengan cara ini, Anda dapat memotivasi komunitas Anda untuk berbagi konten berkualitas dan mengakui kontribusi terbaik!
