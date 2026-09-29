<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Aplikasi ini murni API: tidak ada halaman login web. Secara bawaan
        // Illuminate\Auth\Middleware\Authenticate mengalihkan tamu ke route
        // bernama `login`, yang tidak ada di sini — akibatnya request tanpa
        // token memicu RouteNotFoundException dan menjawab 500, bukan 401.
        // Set fallback ke '/' mengalihkan ke route web, dan
        // shouldRenderJsonWhen() di bawah mengubahnya jadi 401 JSON.
        $middleware->redirectGuestsTo('/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
