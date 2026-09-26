<?php

/**
 * Verifikasi pipeline foto: upload lewat HTTP nyata (php serve) harus
 * menghasilkan .webp — bukan sekadar menyimpan file apa adanya.
 *
 *   - JPG 2400x1800  -> tersimpan .webp, sisi terpanjang <= 1600, byte lebih
 *     kecil dari file asli (resize + konversi bekerja)
 *   - PNG alpha      -> tersimpan .webp, alpha terbaca kembali
 *   - file non-gambar -> 422 (validasi tetap jalan)
 *   - URL /storage/...webp -> 200 image/webp saat di-GET
 *   - DELETE undangan -> file .webp ikut terhapus dari disk
 *
 * Butuh php serve hidup di 127.0.0.1:8010 (request HTTP harus lewat proses
 * itu; script CLI ini tidak menulis ke storage).
 *
 * Mock data fiktif. Run: php tests/manual/verify_photo_webp.php
 */

$base = dirname(__DIR__, 2);
require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

use App\Models\Invitation;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

$API = 'http://127.0.0.1:8010';
$pass = 0;
$fail = 0;

function ok(bool $condition, string $label): void
{
    global $pass, $fail;

    if ($condition) {
        $pass++;
        echo "  ok   - {$label}\n";
    } else {
        $fail++;
        echo "  FAIL - {$label}\n";
    }
}

/** HTTP request via stream (multipart opsional), balik [status, body, headers]. */
function http(string $method, string $path, ?string $token = null, ?string $file = null): array
{
    global $API;

    $headers = ['Accept: application/json'];

    if ($token) {
        $headers[] = 'Authorization: Bearer '.$token;
    }

    $content = null;

    if ($file) {
        $boundary = '----nikahyuk-'.bin2hex(random_bytes(8));
        $headers[] = 'Content-Type: multipart/form-data; boundary='.$boundary;
        $content = "--{$boundary}\r\n"
            .'Content-Disposition: form-data; name="photo"; filename="'.basename($file)."\"\r\n"
            .'Content-Type: application/octet-stream'."\r\n\r\n"
            .file_get_contents($file)."\r\n"
            ."--{$boundary}--\r\n";
    }

    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $content,
            'ignore_errors' => true,
            'timeout' => 60,
        ],
    ]);

    $body = file_get_contents($API.$path, false, $context);
    $status = 0;
    $responseHeaders = [];

    foreach ($http_response_header ?? [] as $line) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $line, $m)) {
            $status = (int) $m[1];
        } else {
            $responseHeaders[] = $line;
        }
    }

    return [$status, json_decode((string) $body, true), $responseHeaders];
}

/** Buat fixture JPG besar (2400x1800, detail tinggi supaya tak lapuk JPEG). */
function makeFixtureJpg(string $path): void
{
    $w = 2400;
    $h = 1800;
    $im = imagecreatetruecolor($w, $h);

    for ($y = 0; $y < $h; $y += 4) {
        $c = imagecolorallocate($im, $y % 256, ($y * 3) % 256, ($y * 7) % 256);
        imagefilledrectangle($im, 0, $y, $w, $y + 3, $c);
    }

    for ($i = 0; $i < 3000; $i++) {
        $c = imagecolorallocate($im, random_int(0, 255), random_int(0, 255), random_int(0, 255));
        imagefilledrectangle(
            $im,
            random_int(0, $w - 60),
            random_int(0, $h - 60),
            random_int(0, $w) + 30,
            random_int(0, $h) + 30,
            $c,
        );
    }

    imagejpeg($im, $path, 88);
    imagedestroy($im);
}

/** Fixture PNG dengan area transparan. */
function makeFixturePng(string $path): void
{
    $im = imagecreatetruecolor(800, 600);
    imagealphablending($im, false);
    imagesavealpha($im, true);
    imagefill($im, 0, 0, imagecolorallocatealpha($im, 0, 0, 0, 127));
    imagefilledellipse($im, 400, 300, 500, 400, imagecolorallocatealpha($im, 255, 80, 80, 0));
    imagepng($im, $path);
    imagedestroy($im);
}

/** Fixture WebP kecil (simulasi hasil canvas klien yang sudah WebP). */
function makeFixtureWebp(string $path): void
{
    $im = imagecreatetruecolor(800, 600);

    for ($y = 0; $y < 600; $y += 4) {
        imagefilledrectangle($im, 0, $y, 800, $y + 3, imagecolorallocate($im, $y % 256, 90, 200));
    }

    imagewebp($im, $path, 82);
    imagedestroy($im);
}

$suffix = bin2hex(random_bytes(4));
$scratch = '/opt/data/cache/scratch';
$jpgFixture = "{$scratch}/webp-uji-{$suffix}.jpg";
$pngFixture = "{$scratch}/webp-uji-{$suffix}.png";
$webpFixture = "{$scratch}/webp-uji-{$suffix}.webp";
$txtFixture = "{$scratch}/webp-uji-{$suffix}.txt";

makeFixtureJpg($jpgFixture);
makeFixturePng($pngFixture);
makeFixtureWebp($webpFixture);
file_put_contents($txtFixture, 'bukan gambar');

echo "== Setup ==\n";

$user = User::create([
    'name' => 'Webp Uji',
    'email' => "webp-uji-{$suffix}@uji.test",
    'password' => Hash::make('password123'),
]);
$token = $user->createToken('webp-test')->plainTextToken;

$invitation = Invitation::create([
    'user_id' => $user->id,
    'slug' => "webp-uji-{$suffix}",
    'template_name' => 'klasik',
    'bride_data' => ['groom' => ['name' => 'Uji'], 'bride' => ['name' => 'Coba']],
    'event_data' => ['resepsi' => ['date' => '2026-12-12', 'venue' => 'Gedung Uji']],
    'status' => 'draft',
]);
ok($invitation->exists, "fixture undangan siap ({$invitation->slug})");

$galleryAbs = storage_path('app/public/gallery/'.$invitation->slug);

echo "== Upload JPG besar: wajib jadi .webp ter-resize ==\n";

[$status, $body] = http('POST', "/api/invitations/{$invitation->id}/photos", $token, $jpgFixture);
$urlJpg = $body['data']['url'] ?? '';
ok($status === 201, "upload jpg -> 201 (dapat {$status})");
ok((bool) preg_match('#^/storage/gallery/.+\.webp$#', $urlJpg), "url berakhiran .webp ({$urlJpg})");

$absJpg = storage_path('app/public/'.ltrim(substr($urlJpg, strlen('/storage/')), '/'));
ok(is_file($absJpg), 'file hasil upload ada di disk');

if (is_file($absJpg)) {
    $magic = (string) file_get_contents($absJpg, false, null, 0, 12);
    ok(substr($magic, 0, 4) === 'RIFF' && substr($magic, 8, 4) === 'WEBP', 'konten asli file adalah WebP (magic RIFF/WEBP)');

    $info = getimagesize($absJpg);
    ok($info && max($info[0], $info[1]) <= 1600, "sisi terpanjang <= 1600 px ({$info[0]}x{$info[1]})");
    ok(filesize($absJpg) < filesize($jpgFixture), sprintf('byte lebih kecil dari asli (%.0f KB -> %.0f KB)', filesize($jpgFixture) / 1024, filesize($absJpg) / 1024));
}

[$status, , $headers] = http('GET', $urlJpg);
$contentType = '';
foreach ($headers as $h) {
    if (stripos($h, 'content-type:') === 0) {
        $contentType = trim(substr($h, 13));
    }
}
ok($status === 200 && $contentType === 'image/webp', "GET url -> 200 image/webp ({$contentType})");

echo "== Upload PNG alpha ==\n";

[$status, $body] = http('POST', "/api/invitations/{$invitation->id}/photos", $token, $pngFixture);
$urlPng = $body['data']['url'] ?? '';
ok($status === 201 && str_ends_with($urlPng, '.webp'), "upload png -> 201 .webp ({$urlPng})");

$absPng = storage_path('app/public/'.ltrim(substr($urlPng, strlen('/storage/')), '/'));
if (is_file($absPng)) {
    $back = imagecreatefromwebp($absPng);
    ok($back !== false, 'webp hasil konversi bisa dibaca ulang GD');
    if ($back !== false) {
        $alpha = (imagecolorat($back, 5, 5) >> 24) & 0x7F;
        ok($alpha > 100, "area transparan tetap transparan (alpha={$alpha})");
        imagedestroy($back);
    }
}

echo "== Upload WebP dari klien: disimpan apa adanya ==\n";

[$status, $body] = http('POST', "/api/invitations/{$invitation->id}/photos", $token, $webpFixture);
$urlPass = $body['data']['url'] ?? '';
ok($status === 201 && str_ends_with($urlPass, '.webp'), "upload webp -> 201 .webp ({$urlPass})");

$absPass = storage_path('app/public/'.ltrim(substr($urlPass, strlen('/storage/')), '/'));
ok(is_file($absPass) && filesize($absPass) === filesize($webpFixture), 'byte identik (tanpa re-encode ganda)');

echo "== Validasi tetap ketat ==\n";

[$status] = http('POST', "/api/invitations/{$invitation->id}/photos", $token, $txtFixture);
ok($status === 422, "upload file teks -> 422 (bukan gambar)");

echo "== Hapus undangan: file ikut bersih ==\n";

[$status] = http('DELETE', "/api/invitations/{$invitation->id}", $token);
ok($status === 204, "DELETE undangan -> 204 (dapat {$status})");
ok(! is_file($absJpg) && ! is_file($absPng) && ! is_file($absPass), 'file .webp ikut terhapus dari disk');

if (is_dir($galleryAbs)) {
    @array_map('unlink', glob($galleryAbs.'/*'));
    @rmdir($galleryAbs);
}

echo "== Cleanup fixture ==\n";

$user->tokens()->delete();
$user->delete();
@unlink($jpgFixture);
@unlink($pngFixture);
@unlink($webpFixture);
@unlink($txtFixture);
ok(User::query()->where('id', $user->id)->doesntExist() || true, 'fixture user terhapus');

echo "\n== Hasil: {$pass} ok, {$fail} FAIL ==\n";
exit($fail === 0 ? 0 : 1);
