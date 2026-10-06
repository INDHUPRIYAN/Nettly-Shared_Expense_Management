import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field, NativeSelect } from '@/components/ui/primitives'
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from '@/lib/settlement'
import { fieldErrors, groupSchema, type GroupInput } from '@/lib/validation'

/** Shared form for creating and editing a group. */
export function GroupForm({
  initial,
  submitLabel,
  pending,
  currencyLocked = false,
  readOnly = false,
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; description: string | null; currency: CurrencyCode }
  submitLabel: string
  pending: boolean
  currencyLocked?: boolean
  readOnly?: boolean
  onSubmit: (input: GroupInput) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [currency, setCurrency] = useState<string>(initial?.currency ?? 'INR')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = groupSchema.safeParse({ name, description, currency })
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    onSubmit(result.data)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id="group-name" label="Group name" error={errors.name}>
        {(aria) => (
          <Input
            {...aria}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Delhi Trip 2026"
            maxLength={80}
            autoComplete="off"
            disabled={readOnly}
            autoFocus={!initial}
          />
        )}
      </Field>
      <Field id="group-description" label="Description" optional error={errors.description}>
        {(aria) => (
          <Textarea
            {...aria}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Four friends, one week, lots of chaat"
            maxLength={500}
            rows={2}
            disabled={readOnly}
          />
        )}
      </Field>
      <Field
        id="group-currency"
        label="Currency"
        error={errors.currency}
        hint={currencyLocked ? "The currency can't be changed after expenses or payments have been added." : undefined}
      >
        {(aria) => (
          <NativeSelect {...aria} value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={readOnly || currencyLocked}>
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code} {CURRENCIES[code].symbol} — {CURRENCIES[code].label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      {!readOnly && (
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}
