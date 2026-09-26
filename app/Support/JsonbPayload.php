<?php

namespace App\Support;

/**
 * Safety layer for client-supplied JSONB columns.
 *
 * Laravel's validated() output is not guaranteed to drop unknown nested
 * keys, so every JSONB payload is whitelisted against a canonical schema
 * before it is persisted. Updates are deep-merged (assoc objects merge,
 * lists and scalars replace) so partial edits never wipe saved values.
 */
final class JsonbPayload
{
    /** Canonical key schemas per JSONB column. `true` = scalar leaf kept as-is. */
    private const SCHEMAS = [
        'template_config' => [
            'palette' => [
                'primary' => true,
                'secondary' => true,
                'accent' => true,
            ],
            'font' => [
                'heading' => true,
                'body' => true,
            ],
            'music_url' => true,
            'music_enabled' => true,
            'music_title' => true,
            'cover_photo' => true,
            'gallery' => ['*' => true],
            'gift' => [
                'enabled' => true,
                'accounts' => [
                    '*' => [
                        'bank' => true,
                        'number' => true,
                        'name' => true,
                    ],
                ],
            ],
        ],
        'bride_data' => [
            'groom' => [
                'name' => true,
                'nick' => true,
                'father' => true,
                'mother' => true,
                'instagram' => true,
                'photo' => true,
            ],
            'bride' => [
                'name' => true,
                'nick' => true,
                'father' => true,
                'mother' => true,
                'instagram' => true,
                'photo' => true,
            ],
            'story' => [
                '*' => [
                    'title' => true,
                    'date' => true,
                    'text' => true,
                ],
            ],
        ],
        'event_data' => [
            'akad' => [
                'date' => true,
                'time' => true,
                'venue' => true,
                'address' => true,
                'maps_url' => true,
            ],
            'resepsi' => [
                'date' => true,
                'time' => true,
                'venue' => true,
                'address' => true,
                'maps_url' => true,
            ],
        ],
    ];

    /**
     * Whitelist a payload against the schema of the given column.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public static function clean(string $column, array $payload): array
    {
        return self::filter($payload, self::SCHEMAS[$column] ?? []);
    }

    /**
     * Deep-merge an incoming (already cleaned) payload into the stored value.
     * Associative arrays merge key-by-key; lists, scalars and null overwrite.
     *
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $incoming
     * @return array<string, mixed>
     */
    public static function merge(array $current, array $incoming): array
    {
        foreach ($incoming as $key => $value) {
            $base = $current[$key] ?? null;

            if (
                is_array($value) && ! array_is_list($value)
                && is_array($base) && ! array_is_list($base)
            ) {
                $current[$key] = self::merge($base, $value);
            } else {
                $current[$key] = $value;
            }
        }

        return $current;
    }

    /**
     * Apply "null deletes the key" semantics to a merged payload. Every
     * associative path explicitly sent as null in the raw request is removed
     * from the merged result, and branches left empty are dropped. This is
     * how the editor clears optional fields (empty form inputs arrive as
     * null); without it merge() would keep the stored value forever. Lists
     * are not walked, they replace wholesale via clean()/merge().
     *
     * @param  array<string, mixed>  $merged
     * @param  array<string, mixed>  $raw
     * @return array<string, mixed>
     */
    public static function stripCleared(array $merged, array $raw): array
    {
        foreach ($raw as $key => $value) {
            if (! array_key_exists($key, $merged)) {
                continue;
            }

            if ($value === null) {
                unset($merged[$key]);

                continue;
            }

            if (
                is_array($value) && ! array_is_list($value)
                && is_array($merged[$key]) && ! array_is_list($merged[$key])
            ) {
                $nested = self::stripCleared($merged[$key], $value);

                if ($nested === []) {
                    unset($merged[$key]);
                } else {
                    $merged[$key] = $nested;
                }
            }
        }

        return $merged;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $schema
     * @return array<string, mixed>
     */
    private static function filter(array $data, array $schema): array
    {
        $filtered = [];

        foreach ($schema as $key => $spec) {
            if (! array_key_exists($key, $data) || $data[$key] === null) {
                continue;
            }

            if ($spec === true) {
                $filtered[$key] = $data[$key];

                continue;
            }

            if (! is_array($data[$key])) {
                continue;
            }

            // List values: `*` => true keeps scalar items (gallery),
            // `*` => schema filters each object (gift.accounts). An explicitly
            // empty list is kept so the owner can clear a list field (the
            // merge step would otherwise preserve the stored value).
            if (array_key_exists('*', $spec)) {
                $items = [];

                foreach ($data[$key] as $item) {
                    if ($spec['*'] === true) {
                        if (is_string($item)) {
                            $items[] = $item;
                        }
                    } elseif (is_array($item)) {
                        $items[] = self::filter($item, $spec['*']);
                    }
                }

                if ($items !== [] || $data[$key] === []) {
                    $filtered[$key] = $items;
                }

                continue;
            }

            // Nested object: filter recursively.
            $nested = self::filter($data[$key], $spec);

            if ($nested !== []) {
                $filtered[$key] = $nested;
            }
        }

        return $filtered;
    }
}
