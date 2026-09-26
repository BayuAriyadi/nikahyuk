<?php

namespace App\Policies;

use App\Models\Invitation;
use App\Models\User;

class InvitationPolicy
{
    /**
     * Only the owner may modify an invitation.
     */
    public function update(User $user, Invitation $invitation): bool
    {
        return $user->id === $invitation->user_id;
    }

    /**
     * Only the owner may delete an invitation.
     */
    public function delete(User $user, Invitation $invitation): bool
    {
        return $user->id === $invitation->user_id;
    }
}
