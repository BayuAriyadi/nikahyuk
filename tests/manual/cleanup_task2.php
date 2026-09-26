<?php

/**
 * Remove Task 2 test fixtures (users @uji.test + their invitations/guests/tokens).
 * Regenerate anytime with: php /opt/data/cache/scratch/verify_task2.php
 */

use App\Models\Guest;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;

$base = '/opt/data/projects/nikahyuk';

require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$users = User::query()->where('email', 'like', '%@uji.test')->get();

foreach ($users as $user) {
    $user->tokens()->delete();
}

$guests = Guest::query()->whereHas('invitation', fn ($q) => $q->whereHas('user', fn ($qq) => $qq->where('email', 'like', '%@uji.test')))->delete();
$invitations = Invitation::query()->whereHas('user', fn ($q) => $q->where('email', 'like', '%@uji.test'))->delete();
$deletedUsers = User::query()->where('email', 'like', '%@uji.test')->delete();

echo "deleted: {$guests} guests, {$invitations} invitations, {$deletedUsers} users\n";
echo "remaining: ".User::count()." users, ".Invitation::count()." invitations, ".Guest::count()." guests\n";
