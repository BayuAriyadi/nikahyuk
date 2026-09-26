<?php

/**
 * Task 3 verification — auth endpoints (register / login / logout) and the
 * token lifecycle the React frontend relies on: issued, usable, revocable.
 *
 * Self-contained: sweeps its own fixtures (@uji3.test) before and after.
 */

use App\Models\Guest;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

$base = '/opt/data/projects/nikahyuk';

require $base.'/vendor/autoload.php';

$app = require $base.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

// Fresh rate-limiter state: a rerun must never inherit throttle counters
// left behind by an earlier run (they share one bucket per route+IP).
Cache::flush();

$pass = 0;
$fail = 0;

function check(string $label, bool $ok, mixed $detail = null): void
{
    global $pass, $fail;

    if ($ok) {
        $pass++;
        echo "  PASS  {$label}\n";
    } else {
        $fail++;
        echo "  FAIL  {$label}".($detail !== null ? '   ['.json_encode($detail, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE).']' : '')."\n";
    }
}

function api(string $method, string $uri, array $payload = [], ?string $token = null): array
{
    global $kernel, $app;

    $server = ['HTTP_ACCEPT' => 'application/json'];

    if ($token !== null) {
        $server['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
    }

    $request = Request::create($uri, $method, $payload, [], [], $server);
    $response = $kernel->handle($request);

    // Reset resolved guards so the next simulated request starts clean.
    $app['auth']->forgetGuards();

    return [$response->getStatusCode(), json_decode((string) $response->getContent(), true)];
}

function sweep_fixtures(): void
{
    foreach (User::query()->where('email', 'like', '%@uji3.test')->get() as $user) {
        $user->tokens()->delete();
    }

    Guest::query()->whereHas('invitation', fn ($q) => $q->whereHas('user', fn ($qq) => $qq->where('email', 'like', '%@uji3.test')))->delete();
    Invitation::query()->whereHas('user', fn ($q) => $q->where('email', 'like', '%@uji3.test'))->delete();
    User::query()->where('email', 'like', '%@uji3.test')->delete();
}

echo "== Fixture cleanup (reruns) ==\n";
sweep_fixtures();

echo "== T1: register a new account ==\n";

$register = [
    'name' => 'Andi Tester',
    'email' => 'auth-1@uji3.test',
    'password' => 'rahasia-123',
    'password_confirmation' => 'rahasia-123',
];

[$code, $body] = api('POST', '/api/register', $register);
$user = $body['user'] ?? [];
$tokenReg = $body['token'] ?? '';

check('POST /api/register (valid) -> 201', $code === 201, $code);
check('token issued (string, > 20 chars)', is_string($tokenReg) && strlen($tokenReg) > 20);
check('uuid user id (36 chars)', is_string($user['id'] ?? null) && strlen($user['id']) === 36);
check('name + email echoed back', ($user['name'] ?? null) === 'Andi Tester' && ($user['email'] ?? null) === 'auth-1@uji3.test');
check('no password key in user payload', ! array_key_exists('password', $user));

$dbUser = User::query()->where('email', 'auth-1@uji3.test')->first();
check('password stored hashed (not plaintext)', $dbUser !== null && $dbUser->password !== 'rahasia-123' && Hash::check('rahasia-123', $dbUser->password));

echo "== T2: register validation ==\n";

[$code, $body] = api('POST', '/api/register', $register);
check('duplicate email -> 422 errors.email', $code === 422 && isset($body['errors']['email']), [$code, array_keys($body['errors'] ?? [])]);

$short = $register;
$short['email'] = 'auth-2@uji3.test';
$short['password'] = 'short';
$short['password_confirmation'] = 'short';
[$code, $body] = api('POST', '/api/register', $short);
check('password < 8 chars -> 422 errors.password', $code === 422 && isset($body['errors']['password']), [$code, array_keys($body['errors'] ?? [])]);

$mismatch = $register;
$mismatch['email'] = 'auth-2@uji3.test';
$mismatch['password_confirmation'] = 'berbeda-456';
[$code, $body] = api('POST', '/api/register', $mismatch);
check('confirmation mismatch -> 422 errors.password', $code === 422 && isset($body['errors']['password']), [$code, array_keys($body['errors'] ?? [])]);

$noname = $register;
$noname['email'] = 'auth-2@uji3.test';
unset($noname['name']);
[$code, $body] = api('POST', '/api/register', $noname);
check('missing name -> 422 errors.name', $code === 422 && isset($body['errors']['name']), [$code, array_keys($body['errors'] ?? [])]);

echo "== T3: login ==\n";

[$code, $body] = api('POST', '/api/login', ['email' => 'auth-1@uji3.test', 'password' => 'rahasia-123']);
$tokenLogin = $body['token'] ?? '';
check('POST /api/login (correct) -> 200', $code === 200, $code);
check('login returns fresh token + user', is_string($tokenLogin) && strlen($tokenLogin) > 20 && ($body['user']['email'] ?? null) === 'auth-1@uji3.test');
check('login token differs from register token', $tokenLogin !== $tokenReg);

[$code, $body] = api('POST', '/api/login', ['email' => 'auth-1@uji3.test', 'password' => 'salah-banget']);
check('wrong password -> 422 errors.email', $code === 422 && isset($body['errors']['email']), [$code, array_keys($body['errors'] ?? [])]);

[$code, $body] = api('POST', '/api/login', ['email' => 'hantu@uji3.test', 'password' => 'rahasia-123']);
check('unknown email -> 422 errors.email', $code === 422 && isset($body['errors']['email']), [$code, array_keys($body['errors'] ?? [])]);

echo "== T4: token lifecycle (login token) ==\n";

[$code, $body] = api('GET', '/api/user', [], $tokenLogin);
check('GET /api/user with login token -> 200', $code === 200 && ($body['email'] ?? null) === 'auth-1@uji3.test', [$code, $body['email'] ?? null]);

[$code] = api('POST', '/api/logout', [], $tokenLogin);
check('POST /api/logout -> 204', $code === 204, $code);

[$code] = api('GET', '/api/user', [], $tokenLogin);
check('revoked token rejected -> 401', $code === 401, $code);

[$code] = api('GET', '/api/user', [], $tokenReg);
check('register token still valid after other logout -> 200', $code === 200, $code);

[$code] = api('POST', '/api/logout');
check('logout without token -> 401', $code === 401, $code);

echo "== T5: logout is scoped to one token ==\n";

[$code, $body] = api('POST', '/api/login', ['email' => 'auth-1@uji3.test', 'password' => 'rahasia-123']);
$tokenB = $body['token'] ?? '';
[$code, $body] = api('POST', '/api/login', ['email' => 'auth-1@uji3.test', 'password' => 'rahasia-123']);
$tokenC = $body['token'] ?? '';

[$code] = api('POST', '/api/logout', [], $tokenB);
check('first token revoked -> 204', $code === 204, $code);
[$code] = api('GET', '/api/user', [], $tokenB);
check('revoked one rejected -> 401', $code === 401, $code);
[$code] = api('GET', '/api/user', [], $tokenC);
check('other token unaffected -> 200', $code === 200, $code);

echo "== Cleanup ==\n";
sweep_fixtures();
$left = User::query()->where('email', 'like', '%@uji3.test')->count();
check('fixtures removed after run', $left === 0, $left);

Cache::flush();

echo "\n== SUMMARY: {$pass} passed, {$fail} failed ==\n";
exit($fail === 0 ? 0 : 1);
