<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Register: create an account and issue a token right away (auto-login).
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create($request->validated());

        $token = $user->createToken('web')->plainTextToken;

        return response()->json([
            'user' => (new UserResource($user))->resolve(),
            'token' => $token,
        ], 201);
    }

    /**
     * Login: exchange email + password for a fresh bearer token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::query()->where('email', $request->validated('email'))->first();

        if (! $user || ! Hash::check($request->validated('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Email atau password salah.'],
            ]);
        }

        $token = $user->createToken('web')->plainTextToken;

        return response()->json([
            'user' => (new UserResource($user))->resolve(),
            'token' => $token,
        ]);
    }

    /**
     * Logout: revoke the token used for this request.
     */
    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->noContent();
    }

    /**
     * Ganti password milik user yang sedang masuk.
     *
     * Wajib menyertakan password saat ini (current_password) supaya akun yang
     * ditinggal terbuka di perangkat lain tidak bisa dipakai mengganti password
     * tanpa tahu password lamanya.
     *
     * Semua token lama dicabut sesudah berhasil: sesi lain harus masuk ulang.
     * Token yang dipakai request ini ikut terhapus, jadi responsnya sekaligus
     * berarti "silakan masuk lagi" — klien cukup membersihkan sesi lokal.
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        if (! Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Password saat ini salah.'],
            ]);
        }

        $user->forceFill([
            'password' => $validated['password'],
            'remember_token' => Str::random(60),
        ])->save();

        $user->tokens()->delete();

        event(new PasswordReset($user));

        return response()->json([
            'message' => 'Password berhasil diganti. Silakan masuk lagi dengan password baru.',
        ]);
    }

    /**
     * Kirim tautan reset password.
     *
     * Selalu membalas pesan sukses yang sama, baik email terdaftar maupun
     * tidak, supaya endpoint ini tidak bisa dipakai menebak email pengguna
     * (user enumeration). Di lingkungan ini MAIL_MAILER=log, jadi tautannya
     * muncul di storage/logs/laravel.log.
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        Password::broker()->sendResetLink($request->validated());

        return response()->json([
            'message' => 'Kalau email itu terdaftar, kami sudah mengirim tautan untuk mengatur ulang password.',
        ]);
    }

    /**
     * Simpan password baru dari tautan reset.
     *
     * Token dari email divalidasi Laravel lewat password broker (hash token +
     * cek kedaluwarsa); kalau tidak valid dibalas 422 dengan pesan yang sama
     * seperti Laravel, tanpa membocorkan alasan detailnya.
     */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::broker()->reset(
            $request->validated(),
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                // Semua token lama dicabut: sesi lain tidak boleh tetap hidup
                // dengan password lama setelah password diganti.
                $user->tokens()->delete();

                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json(['message' => 'Password berhasil diganti. Silakan masuk dengan password baru.']);
    }
}
