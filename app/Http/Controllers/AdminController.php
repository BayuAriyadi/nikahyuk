<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

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

    public function destroy(Request $request, User $user)
    {
        // Delete related invitations and files
        foreach ($user->invitations as $invitation) {
            if ($invitation->photo_path && \Storage::exists($invitation->photo_path)) {
                \Storage::delete($invitation->photo_path);
            }
            // delete files in public/samples related to this invitation
            $invitation->delete();
        }
        
        $user->delete();
        return response()->noContent();
    }
    
    public function stats(Request $request)
    {
        return [
            'total_users' => User::count(),
            'total_admins' => User::where('role', 'admin')->count(),
        ];
    }
}