<?php

namespace App\Policies;

use App\Models\Transaction;
use App\Models\User;

class TransactionPolicy
{
    /**
     * Hanya pemilik undangan terkait yang boleh melihat status transaksi.
     */
    public function view(User $user, Transaction $transaction): bool
    {
        return $user->id === $transaction->invitation->user_id;
    }
}
