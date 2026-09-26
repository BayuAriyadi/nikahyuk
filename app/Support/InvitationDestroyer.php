<?php

namespace App\Support;

use App\Models\Invitation;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Satu tempat untuk memusnahkan undangan beserta berkasnya.
 *
 * Dipakai dua pemanggil yang tadinya punya logika sendiri-sendiri:
 * hapus satu undangan (pemilik) dan hapus akun (semua undangan pemilik).
 * Kalau keduanya beda jalan, yang satu bisa meninggalkan berkas yatim.
 *
 * Transaksi pembayaran SENGAJA tidak dihapus: FK transaksi bersifat
 * ON DELETE SET NULL (lihat migrasi retain_transactions_on_invitation_delete),
 * jadi riwayat penerimaan tetap utuh untuk rekap walaupun undangan lenyap.
 */
class InvitationDestroyer
{
    /**
     * Kumpulkan URL berkas milik undangan ini dari semua kolom JSONB.
     *
     * @return list<string>
     */
    public function photoUrls(Invitation $invitation): array
    {
        $urls = array_merge(
            (array) data_get($invitation->template_config, 'gallery', []),
            [
                data_get($invitation->template_config, 'cover_photo'),
                data_get($invitation->bride_data, 'groom.photo'),
                data_get($invitation->bride_data, 'bride.photo'),
            ],
        );

        return array_values(array_filter($urls, fn ($url) => is_string($url) && $url !== ''));
    }

    /**
     * Hapus undangan + berkas fisiknya. Transaksi pembayaran dibiarkan.
     *
     * @return array{folders: int, files: int} berkas dan folder yang dibuang
     */
    public function destroy(Invitation $invitation): array
    {
        $removedFiles = 0;

        foreach ($this->photoUrls($invitation) as $url) {
            if (str_starts_with($url, '/storage/')) {
                $removedFiles += (int) Storage::disk('public')->delete(Str::after($url, '/storage/'));
            }
        }

        // Sapu sisa berkas di folder galeri dan musik milik undangan ini.
        $removedFolders = 0;
        foreach (['gallery/'.$invitation->slug, 'music/'.$invitation->slug] as $folder) {
            if (Storage::disk('public')->directoryExists($folder)) {
                Storage::disk('public')->deleteDirectory($folder);
                $removedFolders++;
            }
        }

        $invitation->delete();

        return ['folders' => $removedFolders, 'files' => $removedFiles];
    }
}
