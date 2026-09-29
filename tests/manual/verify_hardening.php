<?php

/**
 * Pastikan mode produksi tidak membocorkan detail internal ke publik.
 *
 *   php tests/manual/verify_hardening.php [baseUrl]
 *
 * Yang diuji (semuanya dari luar, lewat domain/tunnel yang sesungguhnya):
 * - APP_ENV=production dan APP_DEBUG=false. Saat APP_DEBUG masih true, setiap
 *   error mengembangkan "file" => "/opt/data/projects/nikahyuk/vendor/...",
 *   nama exception, dan jejak stack — peta gratis bagi penyerang.
 * - Error 400/404/405 menjawab JSON tanpa field "file", "exception", "trace",
 *   atau path absolut.
 * - Halaman publik tetap 200 (hardening tidak boleh mematikan aplikasi).
 * - Endpoint terproteksi tetap 401, bukan 500.
 *
 * Catatan yang perlu diingat: config Laravel di-cache. Perubahan .env tidak
 * berlaku sebelum `php artisan config:clear`.
 */

$base = rtrim($argv[1] ?? 'https://nikahyuk.pujin.my.id', '/');

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$passed = 0;
$failed = 0;

function ok(string $label, bool $cond, string $detail = ''): void
{
    global $passed, $failed;
    if ($cond) {
        $passed++;
        echo "  PASS  {$label}".($detail ? " — {$detail}" : '')."\n";
    } else {
        $failed++;
        echo "  FAIL  {$label}".($detail ? " — {$detail}" : '')."\n";
    }
}

function get(string $url, string $accept = 'application/json'): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Accept: {$accept}"],
        CURLOPT_TIMEOUT => 25,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_USERAGENT => 'nikahyuk-hardening/1.0',
    ]);
    $body = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [$code, $body];
}

echo "Host: {$base}\n\n";

echo "== T1: konfigurasi aplikasi ==\n";
ok('APP_ENV = production', config('app.env') === 'production', 'sekarang: '.config('app.env'));
ok('APP_DEBUG mati', config('app.debug') !== true, 'debug: '.(config('app.debug') ? 'true' : 'false'));

echo "\n== T2: cookie sesi aman (domain HTTPS) ==\n";
ok('SESSION_SECURE_COOKIE aktif', config('session.secure') === true, 'secure: '.(config('session.secure') ? 'true' : 'false'));

echo "\n== T3: tidak ada kebocoran detail internal dari luar ==\n";
// Endpoint yang memicu 404 model, 401 auth, dan 405 method.
$paths = [
    'api/invitations/slug-yang-tidak-ada-xyz',
    'api/invitations',
    'api/user',
];
$leakTokens = ['"file"', '"exception"', '"trace"', '/opt/data/', 'vendor/laravel', 'Symfony\\', '.php"'];

foreach ($paths as $path) {
    [$code, $body] = get($base.'/'.$path);
    $leak = null;
    foreach ($leakTokens as $t) {
        if (str_contains($body, $t)) {
            $leak = $t;
            break;
        }
    }
    ok(
        "GET /{$path} tidak membocorkan internal",
        $leak === null,
        $leak === null ? "HTTP {$code}" : "HTTP {$code}, bocor token: {$leak}"
    );
}

echo "\n== T4: aplikasi tetap hidup (hardening tidak mematikan) ==\n";
[$code, $body] = get($base.'/', 'text/html');
ok('halaman depan 200', $code === 200, "dapat {$code}");
ok('memuat <div id="root">', str_contains($body, 'id="root"'));

[$code] = get($base.'/api/invitations');
ok('endpoint terproteksi -> 401 (bukan 500)', $code === 401, "dapat {$code}");

echo "\n== SUMMARY: {$passed} passed, {$failed} failed ==\n";
exit($failed === 0 ? 0 : 1);
