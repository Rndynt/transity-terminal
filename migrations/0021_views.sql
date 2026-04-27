CREATE OR REPLACE VIEW "customer_bookings" AS
SELECT
  b.id,
  b.trip_id,
  b.origin_stop_id,
  b.destination_stop_id,
  b.origin_seq,
  b.destination_seq,
  b.status,
  b.total_amount,
  b.channel,
  b.app_user_id,
  b.created_at,
  t.service_date,
  tp.code AS pattern_code,
  tp.name AS pattern_name,
  tp.vehicle_class,
  os.name AS origin_name,
  os.city AS origin_city,
  ds.name AS destination_name,
  ds.city AS destination_city,
  au.name AS customer_name,
  au.email AS customer_email,
  au.phone AS customer_phone,
  (SELECT COUNT(*)::int FROM passengers p WHERE p.booking_id = b.id) AS passenger_count
FROM bookings b
INNER JOIN trips t ON t.id = b.trip_id
INNER JOIN trip_patterns tp ON tp.id = t.pattern_id
LEFT JOIN stops os ON os.id = b.origin_stop_id
LEFT JOIN stops ds ON ds.id = b.destination_stop_id
LEFT JOIN app_users au ON au.id = b.app_user_id
WHERE b.app_user_id IS NOT NULL;
