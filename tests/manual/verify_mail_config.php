<?php

/**
 * Verifikasi konfigurasi mailer tanpa mengirim email sungguhan ke luar.
 *
 *   php tests/manual/verify_mail_config.php
 *
 * Yang diperiksa:
 * - MAIL_MAILER bukan lagi 'log' (syarat utama: link reset tidak boleh
 *   cuma nyangkut di storage/logs/laravel.log).
 * - FRONTEND_URL tidak menunjuk ke IP/port Vite dev — kalau masih
 *   (http://…:5173), tautan di email akan mati saat dibuka tamu.
 * - Transport Resend terpasang dan API key terbaca.
 * - Render notifikasi reset menghasilkan tautan yang benar-benar
 *   mengandung FRONTEND_URL.
 *
 * Email tidak dikirim: hanya render MailMessage jadi teks biasa.
 */

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$passed = 0;
$failed = 0;

function check(string $label, bool $ok, string $detail = ''): void
{
    global $passed, $failed;
    if ($ok) {
        $passed++;
        echo "  PASS  {$label}".($detail ? " — {$detail}" : '')."\n";
    } else {
        $failed++;
        echo "  FAIL  {$label}".($detail ? " — {$detail}" : '')."\n";
    }
}

echo "== T1: driver mailer ==\n";
$mailer = (string) config('mail.default');
check('MAIL_MAILER bukan log', $mailer !== 'log', "sekarang: {$mailer}");
check('MAIL_MAILER adalah resend', $mailer === 'resend', "sekarang: {$mailer}");

echo "\n== T2: kredensial Resend ==\n";
$key = (string) env('RESEND_API_KEY', '');
check('RESEND_API_KEY terisi', $key !== '', $key !== '' ? 'panjang '.strlen($key).' char' : 'kosong');
check(
    'RESEND_API_KEY berawalan re_',
    str_starts_with($key, 're_'),
    $key !== '' ? substr($key, 0, 5).'…' : 'kosong'
);

echo "\n== T3: FRONTEND_URL ==\n";
$frontend = (string) env('FRONTEND_URL', '');
check('FRONTEND_URL terisi', $frontend !== '', $frontend);
// :5173 = Vite dev server, tidak boleh dipakai untuk tautan yang dikirim tamu.
check('FRONTEND_URL tidak menunjuk Vite dev (:5173)', ! str_contains($frontend, ':5173'));
check('FRONTEND_URL memakai https', str_starts_with($frontend, 'https://'));
check('FRONTEND_URL tidak ada slash di akhir', ! str_ends_with($frontend, '/'));

echo "\n== T4: pengirim email ==\n";
$from = (string) config('mail.from.address');
$name = (string) config('mail.from.name');
check('MAIL_FROM_ADDRESS terisi', filter_var($from, FILTER_VALIDATE_EMAIL) !== false, $from);
check('MAIL_FROM_NAME terisi', $name !== '', $name);

echo "\n== T5: render tautan reset ==\n";
$user = new App\Models\User([
    'name' => 'Uji Coba',
    'email' => 'uji.mail@uji.test',
]);
// Token dibuat manual: hanya butuh bentuk URL-nya, bukan token asli dari DB.
$notification = new App\Notifications\ResetPasswordNotification('token-uji-coba-123');
$mail = $notification->toMail($user);
// Catatan: $mailMessage->render() hanya mengembalikan BODY html, tanpa header
// subject — jadi pengecekan subject harus lewat property, bukan render().
$renderedBody = (string) $mail->render();

check(
    'tautan reset memakai FRONTEND_URL',
    str_contains($renderedBody, rtrim($frontend, '/').'/reset-password'),
    'URL: '.rtrim($frontend, '/').'/reset-password'
);
check('email menyertakan token', str_contains($renderedBody, 'token-uji-coba-123'));
check(
    'subjek berbahasa Indonesia',
    str_contains((string) $mail->subject, 'Atur ulang password'),
    "subjek: {$mail->subject}"
);

echo "\n== SUMMARY: {$passed} passed, {$failed} failed ==\n";

exit($failed === 0 ? 0 : 1);
