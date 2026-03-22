import { pgEnum } from "drizzle-orm/pg-core";

export const tripStatusEnum = pgEnum('trip_status', ['scheduled', 'canceled', 'closed']);
export const bookingStatusEnum = pgEnum('booking_status', ['pending', 'confirmed', 'checked_in', 'paid', 'canceled', 'refunded', 'unseated']);
export const channelEnum = pgEnum('channel', ['CSO', 'WEB', 'APP', 'OTA']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'qr', 'ewallet', 'bank']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'success', 'failed']);
export const printStatusEnum = pgEnum('print_status', ['queued', 'sent', 'failed']);
export const priceRuleScopeEnum = pgEnum('price_rule_scope', ['pattern', 'trip', 'leg', 'time']);
export const ticketStatusEnum = pgEnum('ticket_status', ['active', 'canceled', 'refunded', 'checked_in', 'no_show', 'unseated']);
export const promoTypeEnum = pgEnum('promo_type', ['percentage', 'fixed']);
export const promoScopeEnum = pgEnum('promo_scope', ['global', 'pattern', 'trip', 'outlet', 'channel']);
export const voucherStatusEnum = pgEnum('voucher_status', ['active', 'used', 'expired', 'revoked']);
export const driverStatusEnum = pgEnum('driver_status', ['active', 'inactive', 'suspended']);
export const cargoRateScopeEnum = pgEnum('cargo_rate_scope', ['global', 'pattern', 'trip']);
export const cargoStatusEnum = pgEnum('cargo_status', ['pending', 'received', 'loaded', 'in_transit', 'arrived', 'delivered', 'returned', 'canceled']);
export const spjStatusEnum = pgEnum('spj_status', ['draft', 'issued', 'on_trip', 'settled']);
export const costItemCategoryEnum = pgEnum('cost_item_category', ['bbm', 'tol', 'makan', 'parkir', 'lainnya']);
export const bookingHistoryActionEnum = pgEnum('booking_history_action', ['unseated', 'reassigned', 'rescheduled', 'canceled', 'status_change']);
