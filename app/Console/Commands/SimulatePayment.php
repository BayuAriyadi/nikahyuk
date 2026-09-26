<?php

namespace App\Console\Commands;

use App\Models\Transaction;
use App\Support\MidtransSignature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Simulasi pembayaran lokal: kirim payload notifikasi Midtrans (dummy,
 * ditandatangani server key dari .env) ke endpoint webhook milik sendiri.
 *
 * Contoh:
 *   php artisan payments:simulate NKY-XXXXXXXX-260925035501-AB12C
 *   php artisan payments:simulate <order_id> --status=expire
 *   php artisan payments:simulate <order_id> --dry-run
 */
class SimulatePayment extends Command
{
    protected $signature = 'payments:simulate
                            {order_id : order_id transaksi (contoh: NKY-...)}
                            {--status=settlement : settlement|capture|pending|expire|cancel|deny}
                            {--url= : Base URL backend yang menjalankan webhook (default http://127.0.0.1:8010)}
                            {--dry-run : Cetak payload saja, tidak dikirim}';

    protected $description = 'Kirim payload webhook Midtrans dummy untuk mensimulasikan pembayaran (mode lokal)';

    public function handle(): int
    {
        $orderId = (string) $this->argument('order_id');
        $transaction = Transaction::query()->where('order_id', $orderId)->first();

        if (! $transaction) {
            $this->error("Transaksi {$orderId} tidak ditemukan.");

            return self::FAILURE;
        }

        $serverKey = (string) config('midtrans.server_key');
        $statusCode = '200';
        $grossAmount = number_format((float) $transaction->amount, 2, '.', '');
        $status = (string) $this->option('status');

        $payload = [
            'transaction_id' => (string) Str::uuid(),
            'order_id' => $orderId,
            'gross_amount' => $grossAmount,
            'currency' => 'IDR',
            'payment_type' => 'qris',
            'status_code' => $statusCode,
            'transaction_status' => $status,
            'fraud_status' => 'accept',
            'transaction_time' => now()->format('Y-m-d H:i:s'),
            'signature_key' => MidtransSignature::make($orderId, $statusCode, $grossAmount, $serverKey),
        ];

        if ($this->option('dry-run')) {
            $this->line(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return self::SUCCESS;
        }

        $baseUrl = rtrim((string) ($this->option('url') ?: 'http://127.0.0.1:8010'), '/');

        $response = Http::acceptJson()->timeout(10)->post($baseUrl.'/api/webhooks/midtrans', $payload);

        $this->line("POST {$baseUrl}/api/webhooks/midtrans -> HTTP {$response->status()} ".trim($response->body()));

        $transaction->refresh();

        $this->table(
            ['order_id', 'payment_status', 'paid_at', 'status undangan'],
            [[
                $transaction->order_id,
                $transaction->payment_status,
                (string) $transaction->paid_at,
                (string) $transaction->invitation?->status,
            ]],
        );

        return $response->successful() ? self::SUCCESS : self::FAILURE;
    }
}
