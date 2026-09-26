<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kolom statistik kunjungan halaman publik: berapa kali dibuka dan kapan
     * terakhir dilihat. Disimpan sebagai counter di baris undangan supaya
     * daftar undangan tidak perlu query agregat.
     */
    public function up(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            $table->unsignedInteger('visit_count')->default(0);
            $table->timestamp('last_visited_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            $table->dropColumn(['visit_count', 'last_visited_at']);
        });
    }
};
