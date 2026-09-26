<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Putus rantai cascade dari invitations ke transactions.
 *
 * Sebelumnya: hapus undangan -> baris transactions ikut hilang (ON DELETE CASCADE).
 * Itu merugikan rekap keuangan: invoice pembayaran yang sudah lunas seharusnya
 * tetap tercatat walau undangannya dibuang pemiliknya, sama seperti toko yang
 * menyimpan struk walau pelanggan sudah tidak terdaftar.
 *
 * Sesudah migrasi ini: invitation_id dikosongkan (SET NULL) saat undangan
 * dihapus. Kolom dibuat nullable karena itu.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropForeign(['invitation_id']);
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->foreignUuid('invitation_id')->nullable()->change();
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->foreign('invitation_id')
                ->references('id')
                ->on('invitations')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropForeign(['invitation_id']);
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->foreignUuid('invitation_id')->nullable(false)->change();
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->foreign('invitation_id')
                ->references('id')
                ->on('invitations')
                ->cascadeOnDelete();
        });
    }
};
