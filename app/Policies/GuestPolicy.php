<?php

namespace App\Policies;

use App\Models\Guest;
use App\Models\User;

class GuestPolicy
{
    /**
     * Hanya pemilik undangan yang boleh menghapus tamunya.
     */
    public function delete(User $user, Guest $guest): bool
    {
        return $guest->invitation?->user_id === $user->id;
    }
}
