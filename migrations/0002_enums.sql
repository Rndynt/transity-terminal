CREATE TYPE "public"."booking_history_action" AS ENUM('unseated', 'reassigned', 'rescheduled', 'cancelled', 'status_change');
--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'checked_in', 'paid', 'cancelled', 'refunded', 'unseated');
--> statement-breakpoint
CREATE TYPE "public"."cargo_rate_kind" AS ENUM('regular', 'seasonal');
--> statement-breakpoint
CREATE TYPE "public"."cargo_status" AS ENUM('pending', 'received', 'loaded', 'in_transit', 'arrived', 'delivered', 'returned', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."cashier_session_status" AS ENUM('open', 'closing', 'closed', 'approved');
--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('CSO', 'WEB', 'APP', 'OTA');
--> statement-breakpoint
CREATE TYPE "public"."cost_item_category" AS ENUM('bbm', 'tol', 'makan', 'parkir', 'lainnya');
--> statement-breakpoint
CREATE TYPE "public"."customer_tag" AS ENUM('regular', 'vip', 'frequent', 'blacklist');
--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('active', 'inactive', 'suspended');
--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('scheduled', 'in_progress', 'completed', 'overdue');
--> statement-breakpoint
CREATE TYPE "public"."maintenance_type" AS ENUM('routine_service', 'repair', 'inspection', 'tire_change', 'oil_change', 'other');
--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'warning', 'critical');
--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_pending', 'trip_no_driver', 'spj_overdue', 'capacity_alert', 'cargo_status', 'refund_request', 'cashier_closing', 'maintenance_due', 'general');
--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'qr', 'ewallet', 'bank', 'online');
--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'success', 'failed');
--> statement-breakpoint
CREATE TYPE "public"."price_rule_scope" AS ENUM('pattern', 'trip', 'leg', 'time');
--> statement-breakpoint
CREATE TYPE "public"."print_status" AS ENUM('queued', 'sent', 'failed');
--> statement-breakpoint
CREATE TYPE "public"."promo_scope" AS ENUM('global', 'pattern', 'trip', 'outlet', 'channel');
--> statement-breakpoint
CREATE TYPE "public"."promo_type" AS ENUM('percentage', 'fixed');
--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'approved', 'processed', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."spj_status" AS ENUM('draft', 'issued', 'on_trip', 'settled');
--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('active', 'cancelled', 'refunded', 'checked_in', 'no_show', 'unseated');
--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('scheduled', 'cancelled', 'closed');
--> statement-breakpoint
CREATE TYPE "public"."voucher_status" AS ENUM('active', 'used', 'expired', 'revoked');
