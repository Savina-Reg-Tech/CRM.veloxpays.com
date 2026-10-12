import type { ReactNode } from 'react'
import {
  CARD_CHARGE_TOOLTIP,
  NO_CARD_CHARGE_TOOLTIP,
  cardChargeLabel,
  cn,
  formatMoney,
  type CardChargeKind,
} from '@/lib/utils'

interface DualAmountProps {
  /** Customer amount, in the customer's own currency (major units). */
  amount: number | null | undefined
  currency?: string | null
  /** What Mint moved on the card, as sent by VeloxVerse. `null` = no card charge; leave
   * `undefined` when the screen's data source doesn't carry the field at all. */
  cardChargeAmount?: number | null
  cardChargeCurrency?: string | null
  /** 'refunded' on refund rows — the second line then reads "AUD 0.86 refunded". */
  kind?: CardChargeKind
  /** Sign shown before the customer amount, e.g. "+" / "−". */
  prefix?: string
  /** Replaces the formatted customer amount (e.g. a "VeloxClub" label) while keeping the layout. */
  primary?: ReactNode
  align?: 'left' | 'right'
  className?: string
}

/**
 * The one way a VeloxVerse order amount is printed in the CRM:
 *
 *   INR 57.44
 *   AUD 0.86 charged      ← smaller, muted
 *
 * Line 2 appears only when VeloxVerse sent a card charge in a different currency from the
 * customer's — see `cardChargeLabel`.
 */
export default function DualAmount({
  amount,
  currency,
  cardChargeAmount,
  cardChargeCurrency,
  kind = 'charged',
  prefix = '',
  primary,
  align = 'right',
  className,
}: DualAmountProps) {
  const charge = cardChargeLabel(currency, cardChargeAmount, cardChargeCurrency, kind)
  // Only claim "no card charge" when VeloxVerse explicitly said so (null), not when unknown.
  const noCharge = cardChargeAmount === null && primary === undefined
  return (
    <span
      className={cn(
        'inline-flex flex-col tabular-nums leading-tight',
        align === 'right' ? 'items-end text-right' : 'items-start text-left',
        className
      )}
    >
      <span className="whitespace-nowrap" title={noCharge ? NO_CARD_CHARGE_TOOLTIP : undefined}>
        {primary ?? `${prefix}${formatMoney(amount, currency)}`}
      </span>
      {charge && (
        <span
          title={CARD_CHARGE_TOOLTIP}
          className="mt-0.5 whitespace-nowrap text-[11px] font-normal text-gray-500"
        >
          {charge}
        </span>
      )}
    </span>
  )
}
