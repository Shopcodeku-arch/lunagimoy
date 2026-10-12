# Luna AI

Asisten AI **Luna** oleh Gimoy Studio. AI berjalan lewat [Puter.js](https://developer.puter.com) langsung dari
browser dengan model `gpt-5.6-luna` — **tidak ada API key** di kode maupun server.

## Menjalankan

```bash
npm install        # atau: bun install
npm run dev        # http://localhost:3000
```

Produksi:

```bash
npm run build
npm start          # menjalankan dist/server.js
```

Vercel: cukup deploy repo ini (folder `api/` dan `vercel.json` sudah disiapkan).

## Cara kerja

- `src/services/ai.ts` — memanggil `puter.ai.chat(..., { model: 'gpt-5.6-luna', stream: true })`.
  Saat pertama kali bertanya, pengguna diminta masuk ke akun Puter (gratis).
- `src/services/storage.ts` — penyimpanan *local-first*: riwayat disimpan di `localStorage`
  dan dicadangkan ke server (`/api/*`) bila tersedia. Keduanya digabung saat dibaca.
- `server/` — Express: akun (PIN ter-hash) dan riwayat obrolan, disimpan di `data/database.json`
  (di Vercel memakai `/tmp`, sehingga bersifat sementara; salinan di browser tetap aman).

## Catatan

- Akun hanya berbasis username (+ PIN opsional), bukan sistem login penuh. Jangan dipakai
  untuk data sensitif.
- Jika Puter.js terblokir (pemblokir iklan / jaringan), Luna menampilkan pesan kesalahan yang jelas.
