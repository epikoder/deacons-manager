-- Dev fixtures: one app client with the four swarm namespaces, plus enough orders to
-- make the earnings RPCs return something checkable.
--
-- Namespaces mirror the source names registered in pages/(authenticated)/+Layout.tsx,
-- which is also what deacons-resource-manager uses as its swarm/owner name.

INSERT INTO auth.apps(name, client_id, client_secret)
  VALUES ('deacons-resource-manager', 'drm-local', 'drm-local-secret')
ON CONFLICT (client_id)
  DO NOTHING;

INSERT INTO auth.app_namespaces(app_id, namespace, source_list)
SELECT
  a.id,
  ns,
  ARRAY[ns]
FROM
  auth.apps a,
  unnest(ARRAY['Ella', 'Emeka', 'Arinze', 'Nnacho']) AS ns
WHERE
  a.client_id = 'drm-local'
ON CONFLICT (app_id, namespace)
  DO NOTHING;

-- A curated affiliate row for Ella only, so me_namespace() can be checked both ways:
-- Ella resolves display metadata, Emeka returns scope with NULL metadata.
INSERT INTO public.affiliates(fullname, phone, email, source_list)
  VALUES ('Ella Onyeka', '07060752869', 'ella@prep50.com.ng', ARRAY['Ella'])
ON CONFLICT
  DO NOTHING;

-- Orders. delivered_on drives the earnings functions; created_at drives the order counts.
INSERT INTO public.orders(id, source, fullname, item, order_amount, state, delivery_status, delivery_cost, office_charge, books, created_at, delivered_on)
  VALUES
    -- Ella: 3 delivered this month, 1 pending
    ('E1', 'Ella', 'Buyer One', 'jamb-science', 15000, 'Enugu', 'delivered', 2000, 1500, '{"Physics":1}', LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '2 day'), LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '3 day')),
    ('E2', 'Ella', 'Buyer Two', 'jamb-art', 12000, 'Enugu', 'delivered', 1500, 1200, '{"Government":1}', LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '4 day'), LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '5 day')),
    ('E3', 'ella', 'Buyer Three', 'waec-science', 18000, 'Lagos', 'delivered', 2500, 1800, '{"Biology":2}', LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '6 day'), LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '7 day')),
    ('E4', 'Ella', 'Buyer Four', 'jamb-science', 15000, 'Abia', 'pending', 2000, 1500, '{"Chemistry":1}', LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '8 day'), NULL),
    -- Emeka: 2 delivered this month, deliberately different amounts
    ('M1', 'Emeka', 'Buyer Five', 'jamb-waec-art', 25000, 'Imo', 'delivered', 3000, 2000, '{"Literature":1}', LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '2 day'), LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '3 day')),
    ('M2', 'Emeka', 'Buyer Six', 'waec-art', 9000, 'Imo', 'delivered', 1000, 900, '{"CRS":1}', LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '5 day'), LEAST(CURRENT_DATE, date_trunc('month', CURRENT_DATE) + interval '6 day')),
    -- Arinze: one delivered earlier in the year, to exercise the by-month path
    ('A1', 'Arinze', 'Buyer Seven', 'jamb-commercial', 11000, 'Anambra', 'delivered', 1200, 1000, '{"Economics":1}', date_trunc('year', CURRENT_DATE) + interval '40 day', date_trunc('year', CURRENT_DATE) + interval '41 day')
ON CONFLICT (source, id)
  DO NOTHING;

-- An admin, so the test script can prove the existing Vike path still works after the
-- REVOKE ... FROM PUBLIC on the arg-taking functions. Note auth.create_user() cannot be
-- used: it inserts a `fullname` column that auth.users does not have.
INSERT INTO auth.users(email, password, role)
  VALUES ('admin@prep50.com.ng', 'secret123', 'admin')
ON CONFLICT
  DO NOTHING;
