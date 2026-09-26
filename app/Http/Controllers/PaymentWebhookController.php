<?php

namespace App\Http\Controllers;

use App\Models\PaymentEvent;
use App\Models\Transaction;
use App\Support\MidtransSignature;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentWebhookController extends Controller
{
    /**
     * POST /webhooks/midtrans — notifikasi pembayaran dari server Midtrans.
     *
     * Bukan endpoint user:
     *  - sengaja di LUAR grup auth:sanctum (tidak ada bearer token);
     *  - berada di routes/api.php sehingga tidak terkena middleware CSRF
     *    (ValidateCsrfToken hanya aktif di grup "web");
     *  - payload diautentikasi lewat signature SHA512 dengan server key.
     *
     * Idempoten: notifikasi ganda untuk order yang sudah lunas dijawab 200
     * tanpa efek samping tambahan (Midtrans bisa mengirim ulang notifikasi).
     */
    public function midtrans(Request $request): JsonResponse
    {
        $payload = $request->json()->all();

        $signatureValid = MidtransSignature::verify($payload, config('midtrans.server_key'));

        // Catat semua notifikasi (termasuk yang signature-nya salah) untuk audit.
        PaymentEvent::create([
            'gateway' => 'midtrans',
            'order_id' => is_string($payload['order_id'] ?? null) ? $payload['order_id'] : null,
            'transaction_status' => is_string($payload['transaction_status'] ?? null) ? $payload['transaction_status'] : null,
            'signature_valid' => $signatureValid,
            'payload' => $payload,
        ]);

        if (! $signatureValid) {
            return response()->json(['message' => 'Signature tidak valid.'], 403);
        }

        $orderId = $payload['order_id'];
        $transaction = Transaction::query()->where('order_id', $orderId)->first();

        if (! $transaction) {
            return response()->json(['message' => "Order {$orderId} tidak dikenal."], 404);
        }

        if ($transaction->isPaid()) {
            return response()->json(['message' => 'OK — transaksi sudah lunas sebelumnya.']);
        }

        $status = (string) ($payload['transaction_status'] ?? '');
        $fraud = $payload['fraud_status'] ?? null;

        // Lunas: "settlement" penuh, atau "capture" yang bukan challenge.
        $settled = $status === 'settlement'
            || ($status === 'capture' && in_array($fraud, [null, 'accept'], true));

        if ($settled) {
            $this->markPaid($transaction);
        } elseif ($status === 'expire') {
            $transaction->update(['payment_status' => 'expired']);
        } elseif (in_array($status, ['cancel', 'deny'], true)) {
            $transaction->update(['payment_status' => 'failed']);
        }
        // 'pending' dan 'capture' dengan fraud 'challenge' → biarkan pending.

        return response()->json(['message' => 'OK']);
    }

    /**
     * Tandai transaksi lunas lalu terbitkan undangan terkait (draft → published).
     * Dibungkus satu transaksi DB supaya tidak pernah setengah jalan.
     */
    private function markPaid(Transaction $transaction): void
    {
        DB::transaction(function () use ($transaction): void {
            $transaction->update([
                'payment_status' => 'paid',
                'paid_at' => now(),
            ]);

            // Hanya undangan yang masih draft yang diterbitkan (idempoten).
            $transaction->invitation()
                ->where('status', 'draft')
                ->update(['status' => 'published']);
        });
    }
}
