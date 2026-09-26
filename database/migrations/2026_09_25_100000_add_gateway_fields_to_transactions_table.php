<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kolom QRIS + jejak pembayaran pada tabel transactions.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->string('gateway')->nullable();          // 'midtrans' | 'fake'
            $table->string('payment_type')->nullable();      // 'qris'
            $table->string('gateway_txn_id')->nullable();    // id transaksi di sisi gateway
            $table->text('qr_string')->nullable();           // payload QR (kalau gateway mengirim)
            $table->text('qr_url')->nullable();              // URL gambar QR
            $table->timestamp('expires_at')->nullable();     // masa berlaku tagihan
            $table->timestamp('paid_at')->nullable();        // waktu lunas
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn([
                'gateway',
                'payment_type',
                'gateway_txn_id',
                'qr_string',
                'qr_url',
                'expires_at',
                'paid_at',
            ]);
        });
    }
};
