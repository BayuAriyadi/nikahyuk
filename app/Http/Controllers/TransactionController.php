<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\Invitation;
use App\Models\Transaction;
use App\Payments\PaymentGateway;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class TransactionController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly PaymentGateway $gateway)
    {
    }

    /**
     * POST /api/invitations/{slug}/checkout
     *
     * Buat tagihan QRIS untuk undangan draft (dipicu tombol "Terbitkan" di UI).
     * Kalau masih ada transaksi pending yang belum kedaluwarsa, transaksi itu
     * yang dikembalikan — tidak membuat tagihan dobel.
     */
    public function store(string $slug): JsonResponse
    {
        $invitation = Invitation::query()->where('slug', $slug)->firstOrFail();

        $this->authorize('update', $invitation);

        if ($invitation->status === 'published') {
            return response()->json([
                'message' => 'Undangan sudah terbit — tidak perlu dibayar lagi.',
            ], 422);
        }

        $pending = $invitation->transactions()
            ->where('payment_status', 'pending')
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->latest()
            ->first();

        if ($pending) {
            return (new TransactionResource($pending))->response()->setStatusCode(200);
        }

        $transaction = $invitation->transactions()->create([
            'order_id' => $this->makeOrderId($invitation),
            'amount' => (int) config('payment.amount'),
            'payment_status' => 'pending',
            'payment_type' => 'qris',
            'gateway' => $this->gateway->name(),
        ]);

        try {
            $charge = $this->gateway->createQrisCharge($transaction, $invitation);
        } catch (\Throwable $error) {
            $transaction->update(['payment_status' => 'failed']);
            report($error);

            return response()->json([
                'message' => 'Gagal membuat tagihan ke payment gateway. Coba lagi nanti.',
            ], 502);
        }

        $transaction->update([
            'gateway_txn_id' => $charge['gateway_txn_id'],
            'qr_string' => $charge['qr_string'],
            'qr_url' => $charge['qr_url'],
            'expires_at' => $charge['expires_at'],
            'payment_link' => $charge['qr_url'],
        ]);

        return (new TransactionResource($transaction->refresh()))->response()->setStatusCode(201);
    }

    /**
     * GET /api/transactions/{transaction:order_id}
     *
     * Status satu transaksi — dipakai UI untuk polling setelah user scan QRIS.
     */
    public function show(Transaction $transaction): TransactionResource
    {
        $this->authorize('view', $transaction);

        return new TransactionResource($transaction->load('invitation'));
    }

    /**
     * Order ID unik & pendek (batas Midtrans 50 karakter):
     * NKY-<8 hex id undangan>-<12 digit waktu>-<5 acak>
     */
    private function makeOrderId(Invitation $invitation): string
    {
        return sprintf(
            'NKY-%s-%s-%s',
            Str::upper(substr(str_replace('-', '', $invitation->id), 0, 8)),
            now()->format('ymdHis'),
            Str::upper(Str::random(5)),
        );
    }
}
