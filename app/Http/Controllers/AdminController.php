<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\InvitationDestroyer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function users(Request $request)
    {
        return User::orderByDesc('created_at')->paginate(20);
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'role' => 'sometimes|string|in:user,admin',
        ]);

        $user->update($validated);
        return response()->json(['status' => 'updated', 'user' => $user]);
    }

    public function destroy(Request $request, User $user): JsonResponse|\Illuminate\Http\Response
    {
        // Admin yang menghapus dirinya sendiri akan kehilangan token dan akses
        // panel pada request ini juga. Itu hampir selalu kecelakaan klik.
        if ($request->user()->id === $user->id) {
            return response()->json([
                'message' => 'Tidak bisa menghapus akun sendiri dari panel admin.',
            ], 422);
        }

        $destroyer = app(InvitationDestroyer::class);

        DB::transaction(function () use ($user, $destroyer) {
            // Satu jalur dengan hapus akun mandiri: berkas foto ikut dibuang,
            // bukan cuma baris database. Rekap pendapatan tidak berubah mundur
            // karena transaksi sengaja dipertahankan (FK SET NULL).
            foreach ($user->invitations()->get() as $invitation) {
                $destroyer->destroy($invitation);
            }

            $user->delete();
        });

        return response()->noContent();
    }
    
    public function stats(Request $request)
    {
        $totalRevenue = \App\Models\Transaction::where('payment_status', 'paid')->sum('amount');
        $paidCount = \App\Models\Transaction::where('payment_status', 'paid')->count();
        $pendingCount = \App\Models\Transaction::where('payment_status', 'pending')->count();

        return [
            'total_users' => User::count(),
            'total_admins' => User::where('role', 'admin')->count(),
            'total_revenue' => (int) $totalRevenue,
            'paid_transactions' => $paidCount,
            'pending_transactions' => $pendingCount,
        ];
    }

    public function transactions(Request $request)
    {
        $transactions = \App\Models\Transaction::with('invitation.user')
            ->orderByDesc('created_at')
            ->paginate(30);

        return $transactions;
    }

    /** Rekap pendapatan bulanan (paid) 6 bulan terakhir untuk grafik. */
    public function revenueSeries(Request $request)
    {
        return \App\Models\Transaction::where('payment_status', 'paid')
            ->where('paid_at', '>=', now()->subMonths(5)->startOfMonth())
            ->selectRaw("to_char(paid_at, 'YYYY-MM') as month, sum(amount) as total, count(*) as count")
            ->groupByRaw("to_char(paid_at, 'YYYY-MM')")
            ->orderBy('month')
            ->get();
    }
}