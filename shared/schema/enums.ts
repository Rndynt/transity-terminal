import { pgEnum } from "drizzle-orm/pg-core";

export const tripStatusEnum = pgEnum('trip_status', ['scheduled', 'cancelled', 'closed']);
export const bookingStatusEnum = pgEnum('booking_status', ['pending', 'confirmed', 'checked_in', 'paid', 'cancelled', 'refunded', 'unseated']);
export const channelEnum = pgEnum('channel', ['CSO', 'WEB', 'APP', 'OTA']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'qr', 'ewallet', 'bank', 'online']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'success', 'failed']);
export const printStatusEnum = pgEnum('print_status', ['queued', 'sent', 'failed']);
export const priceRuleScopeEnum = pgEnum('price_rule_scope', ['global', 'pattern']);
export const priceRuleKindEnum = pgEnum('price_rule_kind', ['regular', 'seasonal']);
export const ticketStatusEnum = pgEnum('ticket_status', ['active', 'cancelled', 'refunded', 'checked_in', 'no_show', 'unseated']);
export const promoTypeEnum = pgEnum('promo_type', ['percentage', 'fixed']);
/**
 * Legacy enum from migration 0004_thin_xorn.sql. New code should use the
 * promotion_conditions table instead of the scope/scope_ref_id/applicable_channels
 * columns. Kept in ORM so Drizzle introspection matches the live DB; will be
 * dropped in a future migration once all operators have run
 * server/scripts/backfill-promo-conditions.ts.
 */
export const promoScopeEnum = pgEnum('promo_scope', ['global', 'pattern', 'trip', 'outlet', 'channel']);
export const voucherStatusEnum = pgEnum('voucher_status', ['active', 'used', 'expired', 'revoked']);
export const driverStatusEnum = pgEnum('driver_status', ['active', 'inactive', 'suspended']);
export const cargoRateScopeEnum = pgEnum('cargo_rate_scope', ['global', 'pattern', 'trip']);
export const cargoStatusEnum = pgEnum('cargo_status', ['pending', 'received', 'loaded', 'in_transit', 'arrived', 'delivered', 'returned', 'cancelled']);
export const spjStatusEnum = pgEnum('spj_status', ['draft', 'issued', 'on_trip', 'settled']);
export const costItemCategoryEnum = pgEnum('cost_item_category', ['bbm', 'tol', 'makan', 'parkir', 'lainnya']);
export const bookingHistoryActionEnum = pgEnum('booking_history_action', ['unseated', 'reassigned', 'rescheduled', 'cancelled', 'status_change']);

export const notificationSeverityEnum = pgEnum('notification_severity', ['info', 'warning', 'critical']);
export const notificationTypeEnum = pgEnum('notification_type', ['booking_pending', 'trip_no_driver', 'spj_overdue', 'capacity_alert', 'cargo_status', 'refund_request', 'cashier_closing', 'maintenance_due', 'general']);
export const cashierSessionStatusEnum = pgEnum('cashier_session_status', ['open', 'closing', 'closed', 'approved']);
export const refundStatusEnum = pgEnum('refund_status', ['pending', 'approved', 'processed', 'rejected']);
export const maintenanceTypeEnum = pgEnum('maintenance_type', ['routine_service', 'repair', 'inspection', 'tire_change', 'oil_change', 'other']);
export const maintenanceStatusEnum = pgEnum('maintenance_status', ['scheduled', 'in_progress', 'completed', 'overdue']);
export const customerTagEnum = pgEnum('customer_tag', ['regular', 'vip', 'frequent', 'blacklist']);
