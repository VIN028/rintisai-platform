# Prompt Refinement UI/UX untuk AI Lain

Gunakan prompt di bawah ini untuk dimasukkan ke AI lain (seperti Claude 3.5 Sonnet atau GPT-4o) untuk memoles antarmuka (UI/UX) aplikasi ini menjadi jauh lebih premium, modern, dan interaktif.

---

### Salin Prompt di Bawah Ini:

```text
Halo! Saya memiliki sebuah aplikasi ChatGPT & Claude Clone fullstack yang dibuat menggunakan Next.js 16, React 19, SQLite (Prisma), Tailwind CSS v4, Vanilla CSS, dan Lucide Icons.

Secara fungsionalitas, aplikasi ini sudah berjalan 100% sukses (termasuk streaming SSE chat, database riwayat chat, otentikasi login/register, dan pembatasan kredit/token limit per 5 jam, mingguan, dan bulanan).

Tugas Anda adalah memoles file frontend utama (`src/app/page.js`, `src/app/login/page.js`, `src/app/register/page.js`, dan `src/app/globals.css`) agar memiliki tampilan UI/UX yang sangat premium, modern, "wow" saat dipandang, dan memiliki animasi yang interaktif.

Berikut adalah poin-poin peningkatan UI/UX yang saya inginkan:
1. Efek Glassmorphism yang Lebih Kuat: Modifikasi backdrop-blur, filter saturasi, serta berikan efek bayangan (box-shadow) dan garis tepi (border-glow) yang terlihat sangat premium.
2. Animasi dan Transisi Mikro: 
   - Efek transisi halus saat sidebar dibuka/ditutup (slide & fade).
   - Animasi memantul/mengambang halus pada ikon bot atau saat pesan dikirim.
   - Hover efek interaktif pada daftar percakapan, tombol model selector, dan tombol kirim.
   - Efek pengetikan (typing indicator) asisten yang lebih dinamis.
3. Fitur Kenyamanan pada Chat Box:
   - Tambahkan tombol "Salin Kode" (Copy Code) di setiap blok kode markdown yang dihasilkan AI.
   - Berikan styling syntax highlighting yang lebih kontras dan indah pada tag <code> dan <pre>.
   - Area input (textarea) yang otomatis bertambah tinggi (autosize) ketika teks panjang, dengan batas maksimal tinggi tertentu.
4. Tampilan Indikator Token yang Mewah:
   - Modifikasi visual widget limits (5h, weekly, monthly) di sidebar agar terlihat seperti dashboard analitik futuristik (menggunakan gradient progresif, persentase teks, dan indikator status bahaya/peringatan jika limit mendekati 100%).
5. Desain Halaman Login/Register yang Memukau:
   - Berikan latar belakang gradasi dinamis atau radial glow yang seolah bergerak lambat di belakang kartu login/register yang transparan (glass card).
6. Optimasi Responsif Mobile:
   - Pastikan drawer sidebar di mobile memiliki latar belakang overlay gelap (backdrop overlay) saat dibuka, dan dapat ditutup kembali dengan swipe atau menyentuh area luar.

Struktur file yang perlu dimodifikasi:
- globals.css: Berisi variabel warna tema dan kelas-kelas utility custom.
- page.js: Komponen chat utama (sidebar, model selector, chat feed, input bar, upgrade modal).
- login/page.js & register/page.js: Kartu otentikasi.

Tolong berikan kode lengkap untuk file-file tersebut dengan mempertahankan semua logika bisnis (sistem streaming SSE, routing API, state management, penanganan error, login, logout, dan event listener database) yang sudah ada. Jangan menghapus logika penting!
```
