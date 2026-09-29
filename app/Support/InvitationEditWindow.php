<?php

namespace App\Support;

use App\Models\Invitation;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;

/**
 * Aturan "kapan undangan masih boleh diedit".
 *
 * Latar belakang: siapa pun yang membayar satu kali bisa menerbitkan undangan,
 * lalu MENGGANTI isinya menjadi undangan orang lain dan menjualnya lagi —
 * link-nya tetap hidup karena slug ikut berubah. Karena itu diterapkan dua lapis:
 *
 * 1. Hari H lewat -> seluruh isian dikunci (aturan yang diminta pemilik produk).
 * 2. Setelah published, IDENTITAS mempelai dikunci walau belum hari H.
 *    Menunggu hari H saja tidak cukup: penjual bisa menjual berkali-kali
 *    sebelum H, atau menggeser tanggal acara ke masa depan supaya kunci nomor 1
 *    tidak pernah aktif.
 *
 * Yang TETAP boleh diubah setelah published (wajar direvisi, dan tidak bisa
 * dipakai memindahtangankan undangan): tanggal/waktu/tempat acara, galeri,
 * cerita, musik, hadiah, dan tamu.
 */
class InvitationEditWindow
{
    /** Field identitas: dikunci setelah undangan diterbitkan. */
    public const PUBLISHED_LOCKED = [
        'slug',
        'bride_data.groom.name',
        'bride_data.bride.name',
    ];

    /**
     * Tanggal hari H: yang paling AWAL dari akad dan resepsi.
     * Diambil yang paling awal supaya penjual tidak bisa memperpanjang masa
     * bebas edit dengan menambah satu acara lagi yang tanggalnya lebih jauh.
     */
    public static function eventDate(Invitation $invitation): ?CarbonImmutable
    {
        $dates = collect([
            data_get($invitation->event_data, 'akad.date'),
            data_get($invitation->event_data, 'resepsi.date'),
        ])->filter()->map(fn ($d) => CarbonImmutable::parse($d)->startOfDay());

        return $dates->isEmpty() ? null : $dates->min();
    }

    /** Benar bila hari H sudah lewat — edit ditutup seluruhnya. */
    public static function hasPassedEvent(Invitation $invitation): bool
    {
        $date = self::eventDate($invitation);

        return $date !== null && $date->isBefore(CarbonImmutable::today());
    }

    /** '*' berarti semua dikunci (hari H lewat). */
    public static function lockedFields(Invitation $invitation): array
    {
        if (self::hasPassedEvent($invitation)) {
            return ['*'];
        }

        return $invitation->status === 'published' ? self::PUBLISHED_LOCKED : [];
    }

    public static function isLocked(Invitation $invitation, string $field): bool
    {
        $locked = self::lockedFields($invitation);

        return in_array('*', $locked, true) || in_array($field, $locked, true);
    }

    /**
     * Field dalam $data yang nilainya BENAR-BENAR berubah dari yang tersimpan,
     * di antara daftar yang dikunci.
     *
     * Pengecekan per nilai ini penting: form edit mengirim ulang seluruh field,
     * jadi membandingkan sekadar "field ada di payload" akan memblokir penyimpanan
     * revisi mana pun — termasuk yang halnya tidak terkait sama sekali.
     */
    public static function violatedFields(Invitation $invitation, array $data): array
    {
        $locked = self::lockedFields($invitation);

        if ($locked === [] || $locked === ['*']) {
            return [];
        }

        $pelanggaran = [];

        foreach ($locked as $path) {
            if (! Arr::has($data, $path)) {
                continue;
            }

            $baru = data_get($data, $path);
            $lama = str_starts_with($path, 'bride_data.')
                ? data_get($invitation->bride_data, mb_substr($path, mb_strlen('bride_data.')))
                : $invitation->{$path};

            if ((string) $baru !== (string) $lama) {
                $pelanggaran[] = $path;
            }
        }

        return $pelanggaran;
    }
}
