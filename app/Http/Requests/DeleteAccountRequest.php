<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeleteAccountRequest extends FormRequest
{
    /**
     * Hanya user yang sedang terautentikasi (route ada di dalam auth:sanctum),
     * dan hanya untuk akunnya sendiri.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Wajib password saat ini: akun yang tertinggal terbuka di perangkat
            // lain tidak boleh bisa menghapus akun tanpa tahu passwordnya.
            'password' => ['required', 'string'],
            // Konfirmasi teks ketik-ulang; nilainya diverifikasi di controller
            // supaya pesan errornya konsisten (case-sensitive di klien).
            'confirm' => ['required', 'string', 'in:HAPUS AKUN SAYA'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'password.required' => 'Masukkan password kamu untuk mengonfirmasi.',
            'confirm.required' => 'Ketik konfirmasi persis seperti yang diminta.',
            'confirm.in' => 'Teks konfirmasi tidak cocok.',
        ];
    }
}
