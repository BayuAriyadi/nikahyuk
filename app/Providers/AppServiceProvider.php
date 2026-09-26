<?php

namespace App\Providers;

use App\Notifications\ResetPasswordNotification;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Aturan password default (dipakai Password::defaults() bila perlu).
        Password::defaults(fn () => Password::min(8));

        // Tautan reset password mengarah ke halaman SPA (aplikasi ini API-only,
        // tidak punya route web 'password.reset'). Alamat frontend diatur lewat
        // FRONTEND_URL di .env; default dev: Vite di port 5173.
        ResetPassword::createUrlUsing(function ($user, string $token): string {
            $frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/');

            return $frontend.'/reset-password?'.http_build_query([
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]);
        });

        // Pakai notifikasi bahasa Indonesia.
        ResetPassword::toMailUsing(
            fn ($notifiable, string $token) => (new ResetPasswordNotification($token))->toMail($notifiable),
        );
    }
}
