<?php

/**
 * Buktikan autentikasi Sanctum tembus lewat Cloudflare Tunnel, bukan cuma
 * lewat localhost. Dipakai untuk memastikan header Authorization tidak hilang
 * atau dirusak di jalur proxy.
 *
 *   php tests/manual/verify_tunnel_auth.php [baseUrl]
 *
 * Menjalankan tiga request lewat host yang sama:
 *   1. GET /api/invitations TANPA token  -> harus 401
 *   2. GET /api/invitations DENGAN token -> harus 200
 *   3. GET /                             -> harus 200
 *
 * Token dibuat di DB lalu dihapus lagi; tidak menyentuh akun asli mana pun
 * selain user pertama yang sudah ada.
 */

$base = rtrim($argv[1] ?? 'https://nikahyuk.pujin.my.id', '/');

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$passed = 0;
$failed = 0;

function http(string $url, ?string $token = null, bool $json = true): array
{
    // Catatan: Vite preview menjawab 404 untuk '/' bila dikirimi header
    // `Accept: application/json` — halaman HTML hanya diberikan saat klien
    // meminta text/html. Makanya Accept bisa dimatikan lewat argumen $json.
    $headers = $json ? ['Accept: application/json'] : ['Accept: text/html'];
    if ($token !== null) {
        $headers[] = 'Authorization: Bearer '.$token;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 15,
        // Jangan ikuti redirect: kalau malah redirect, itu gejala salah konfigurasi.
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_USERAGENT => 'nikahyuk-tunnel-verify/1.0',
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    return [$code, (string) $body, $err];
}

function report(string $label, bool $ok, string $detail = ''): void
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

echo "Host: {$base}\n\n";

// Token uji: dibuat lalu dihapus di akhir supaya tidak menumpuk di DB.
$user = App\Models\User::first();
$token = $user->createToken('uji-tunnel')->plainTextToken;

try {
    echo "== T1: endpoint terproteksi TANPA token ==\n";
    [$code, $body, $err] = http($base.'/api/invitations');
    report('tanpa token -> 401', $code === 401, "dapat {$code}".$err ? " cURL: {$err}" : '');
    report('bukan 500 ( Route login )', $code !== 500, "dapat {$code}");
    report(
        'balasan JSON "Unauthenticated."',
        str_contains($body, 'Unauthenticated'),
        'body: '.substr($body, 0, 60)
    );

    echo "\n== T2: endpoint terproteksi DENGAN token ==\n";
    [$code, $body, $err] = http($base.'/api/invitations', $token);
    report('dengan token -> 200', $code === 200, "dapat {$code}".($err ? " cURL: {$err}" : ''));
    $json = json_decode($body, true);
    report(
        'body JSON berisi data undangan',
        is_array($json) && (isset($json['data']) || array_is_list($json)),
        is_array($json) ? 'jumlah: '.(is_array($json['data'] ?? null) ? count($json['data']) : count($json)) : 'bukan JSON'
    );

    echo "\n== T3: halaman depan ==\n";
    [$code, $body, $err] = http($base.'/', null, json: false);
    report('halaman depan -> 200', $code === 200, "dapat {$code}");
    report('punya <div id="root">', str_contains($body, 'id="root"'), 'len '.strlen($body));

    echo "\n== T4: TLS ==\n";
    $parts = parse_url($base);
    $tls = false;
    $ctx = stream_context_create(['ssl' => ['capture_peer_cert' => true, 'verify_peer' => true]]);
    $sock = @stream_socket_client(
        'ssl://'.$parts['host'].':443',
        $errno,
        $errstr,
        15,
        STREAM_CLIENT_CONNECT,
        $ctx
    );
    if ($sock) {
        $params = stream_context_get_params($ctx);
        $cert = openssl_x509_parse($params['options']['ssl']['peer_certificate'] ?? null);
        if ($cert) {
            $tls = true;
            echo '  INFO  issuer: '.($cert['issuer']['O'] ?? '?')
                .' | berlaku sampai: '.date('Y-m-d', $cert['validTo_time_t'])."\n";
        }
        fclose($sock);
    }
    report('TLS valid', $tls);
} finally {
    // Bersihkan token uji.
    $user->tokens()->where('name', 'uji-tunnel')->delete();
}

echo "\n== SUMMARY: {$passed} passed, {$failed} failed ==\n";
exit($failed === 0 ? 0 : 1);
