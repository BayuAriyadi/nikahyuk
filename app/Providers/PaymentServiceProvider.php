<?php

namespace App\Providers;

use App\Payments\FakeQrisGateway;
use App\Payments\MidtransGateway;
use App\Payments\PaymentGateway;
use Illuminate\Support\ServiceProvider;

class PaymentServiceProvider extends ServiceProvider
{
    /**
     * Bind gateway pembayaran sesuai config('payment.driver').
     *
     * Ganti driver cukup lewat .env (PAYMENT_DRIVER) — tidak ada kode lain
     * yang perlu diubah karena konsumennya bergantung pada interface
     * PaymentGateway, bukan class konkret.
     */
    public function register(): void
    {
        $this->app->singleton(PaymentGateway::class, function (): PaymentGateway {
            return match (config('payment.driver')) {
                'midtrans' => new MidtransGateway(),
                default => new FakeQrisGateway(),
            };
        });
    }
}
