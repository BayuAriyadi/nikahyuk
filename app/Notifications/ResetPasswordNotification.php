<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Notifikasi reset password berbahasa Indonesia.
 *
 * URL di dalam email diarahkan ke halaman reset di frontend (bukan route
 * web Laravel), karena aplikasi ini API-only + SPA. Alamat frontend diambil
 * dari satu sumber: AppServiceProvider::boot() (FRONTEND_URL).
 */
class ResetPasswordNotification extends ResetPassword
{
    /**
     * @param  mixed  $notifiable
     */
    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Atur ulang password nikahyuk')
            ->greeting('Halo, '.($notifiable->name ?? 'kamu'))
            ->line('Kamu menerima email ini karena ada permintaan mengatur ulang password akun nikahyuk.')
            ->action('Atur Ulang Password', $this->resetUrl($notifiable))
            ->line('Tautan ini berlaku selama '.config('auth.passwords.'.config('auth.defaults.passwords').'.expire').' menit.')
            ->line('Kalau kamu tidak merasa meminta ini, abaikan saja email ini; passwordmu tidak berubah.');
    }
}
