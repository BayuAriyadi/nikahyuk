<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreGuestRequest extends FormRequest
{
    /**
     * Public endpoint — anyone holding the published slug may RSVP.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Trim and strip HTML tags from free-text input before validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->name) ? trim(strip_tags($this->name)) : $this->name,
            'message' => is_string($this->message) ? trim(strip_tags($this->message)) : $this->message,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'rsvp_status' => ['required', 'string', 'in:attending,not_attending'],
            'message' => ['nullable', 'string', 'max:500'],
        ];
    }
}
