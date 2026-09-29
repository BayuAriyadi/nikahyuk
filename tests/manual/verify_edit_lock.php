<?php

/**
 * Uji aturan kunci edit: mencegah satu undangan berbayar dipakai berulang
 * untuk banyak klien.
 *
 *   php tests/manual/verify_edit_lock.php
 *
 * Celah yang ditutup: pembayaran dilakukan sekali, lalu isi undangan diganti
 * menjadi pasangan lain (dan slug ikut berganti sehingga tautan tetap hidup).
 * Dua lapis aturan yang diuji:
 *   1. Hari H lewat -> SEMUA field dikunci.
 *   2. Sudah published -> nama mempelai & slug dikunci (walau belum hari H),
 *      karena menunggu hari H saja tidak cukup: penjual bisa menggeser tanggal
 *      acara ke masa depan supaya kunci tidak pernah aktif.
 *
 * Pemakai jujur tetap bisa merevisi tanggal, tempat, galeri, cerita, musik,
 * dan hadiah setelah published — itu ikut diuji supaya aturan tidak mencekik
 * pemakaian wajar.
 */

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Invitation;
use App\Models\User;
use App\Support\InvitationEditWindow;
use Illuminate\Support\Facades\Hash;

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

$user = User::firstOrCreate(
    ['email' => 'qa.editlock@uji.test'],
    ['name' => 'QA Edit Lock', 'password' => Hash::make('QaEditLock12345')]
);

function buatUndangan(User $user, string $status, ?string $tanggal): Invitation
{
    return Invitation::create([
        'user_id' => $user->id,
        'slug' => 'lock-'.Str::lower(Str::random(8)),
        'template_name' => 'klasik',
        'status' => $status,
        'bride_data' => [
            'groom' => ['name' => 'Budi', 'nick' => 'Bud'],
            'bride' => ['name' => 'Sari', 'nick' => 'Sar'],
        ],
        'event_data' => ['resepsi' => ['date' => $tanggal, 'time' => '09:00', 'venue' => 'Balai']],
    ]);
}

$hariIni = now()->format('Y-m-d');
$besok = now()->addDay()->format('Y-m-d');
$kemarin = now()->subDay()->format('Y-m-d');

$draft = buatUndangan($user, 'draft', $besok);
$published = buatUndangan($user, 'published', $besok);
$lewat = buatUndangan($user, 'published', $kemarin);

try {
    echo "== T1: draft tetap bebas diedit ==\n";
    check(
        'draft tidak mengunci apa pun',
        InvitationEditWindow::lockedFields($draft) === [],
        'terkunci: '.json_encode(InvitationEditWindow::lockedFields($draft))
    );
    check(
        'draft: mengubah nama mempelai tidak melanggar',
        InvitationEditWindow::violatedFields($draft, [
            'slug' => 'baru-banget',
            'bride_data' => ['groom' => ['name' => 'Andi']],
        ]) === [],
        'pelanggaran: '.json_encode(InvitationEditWindow::violatedFields($draft, ['slug' => 'baru-banget']))
    );

    echo "\n== T2: published mengunci identitas (inti celah) ==\n";
    $terkunci = InvitationEditWindow::lockedFields($published);
    check('slug ikut terkunci', in_array('slug', $terkunci, true), json_encode($terkunci));
    check('nama mempelai pria terkunci', in_array('bride_data.groom.name', $terkunci, true));
    check('nama mempelai wanita terkunci', in_array('bride_data.bride.name', $terkunci, true));

    $pelanggaran = InvitationEditWindow::violatedFields($published, [
        'slug' => 'klien-lain',
        'bride_data' => ['groom' => ['name' => 'Joko'], 'bride' => ['name' => 'Ani']],
    ]);
    check('mengganti slug terdeteksi', in_array('slug', $pelanggaran, true), json_encode($pelanggaran));
    check('mengganti nama pria terdeteksi', in_array('bride_data.groom.name', $pelanggaran, true));
    check('mengganti nama wanita terdeteksi', in_array('bride_data.bride.name', $pelanggaran, true));

    echo "\n== T3: pengiriman ulang Nilai Yang Sama tidak dianggap pelanggaran ==\n";
    // Ini penting: form edit mengirim ulang seluruh field. Kalau sekadar "field
    // ada di payload" sudah dihitung pelanggaran, pemakai tidak bisa menyimpan
    // apa pun setelah published — termasuk revisi tanggal yang wajar.
    $sama = InvitationEditWindow::violatedFields($published, [
        'slug' => $published->slug,
        'bride_data' => ['groom' => ['name' => 'Budi'], 'bride' => ['name' => 'Sari']],
        'event_data' => ['resepsi' => ['date' => $hariIni, 'time' => '10:00']],
    ]);
    check('nilai identik tidak dilaporkan', $sama === [], json_encode($sama));

    echo "\n== T4: revisi yang wajar tetap boleh setelah published ==\n";
    $wajar = InvitationEditWindow::violatedFields($published, [
        'event_data' => ['resepsi' => ['date' => $besok, 'time' => '13:00', 'venue' => 'Gedung Baru']],
        'template_config' => ['palette' => ['primary' => '#112233']],
    ]);
    check('ubah tanggal/tempat tidak diblokir', $wajar === [], json_encode($wajar));
    check(
        'ubah nick mempelai tidak diblokir',
        InvitationEditWindow::violatedFields($published, ['bride_data' => ['groom' => ['nick' => 'Be']]]) === []
    );

    echo "\n== T5: hari H lewat -> semua terkunci ==\n";
    check('hari H terdeteksi lewat', InvitationEditWindow::hasPassedEvent($lewat));
    check('semua field terkunci', InvitationEditWindow::lockedFields($lewat) === ['*']);
    check("undangan besok belum hari H", ! InvitationEditWindow::hasPassedEvent($published));
    check(
        'hari ini belum dianggap lewat (H masih boleh diedit)',
        ! InvitationEditWindow::hasPassedEvent(buatUndangan($user, 'published', $hariIni))
    );

    echo "\n== T6: tanggal digeser ke masa depan tidak membuka kunci identitas ==\n";
    // Penjual bisa saja mengubah event_data supaya hari H mundur jauh.
    // publishedLocked tidak bergantung tanggal, jadi tetap mengunci.
    $digeser = buatUndangan($user, 'published', now()->addYears(3)->format('Y-m-d'));
    check(
        'identitas tetap terkunci walau acara 3 tahun lagi',
        InvitationEditWindow::lockedFields($digeser) === InvitationEditWindow::PUBLISHED_LOCKED,
        json_encode(InvitationEditWindow::lockedFields($digeser))
    );

    echo "\n== T7: ambil tanggal paling awal (akad sebelum resepsi) ==\n";
    $dua = Invitation::create([
        'user_id' => $user->id,
        'slug' => 'lock-'.Str::lower(Str::random(8)),
        'template_name' => 'klasik',
        'status' => 'published',
        'bride_data' => ['groom' => ['name' => 'A'], 'bride' => ['name' => 'B']],
        'event_data' => [
            'akad' => ['date' => $besok, 'time' => '08:00'],
            'resepsi' => ['date' => now()->addYears(2)->format('Y-m-d'), 'time' => '10:00'],
        ],
    ]);
    check(
        'pakai akad sebagai hari H',
        InvitationEditWindow::eventDate($dua)?->toDateString() === $besok,
        'hari H: '.InvitationEditWindow::eventDate($dua)?->toDateString()
    );
    $dua->delete();
} finally {
    foreach ([$draft, $published, $lewat] as $inv) {
        $inv->guests()->delete();
        $inv->delete();
    }
    $user->tokens()->delete();
    $user->delete();
}

echo "\n== SUMMARY: {$passed} passed, {$failed} failed ==\n";
exit($failed === 0 ? 0 : 1);
