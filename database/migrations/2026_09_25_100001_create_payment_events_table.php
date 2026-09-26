<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Log semua notifikasi webhook pembayaran yang masuk (audit & debugging),
     * termasuk percobaan dengan signature tidak valid.
     */
    public function up(): void
    {
        Schema::create('payment_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('gateway')->nullable();
            $table->string('order_id')->nullable()->index();
            $table->string('transaction_status')->nullable();
            $table->boolean('signature_valid')->default(false);
            $table->jsonb('payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_events');
    }
};
