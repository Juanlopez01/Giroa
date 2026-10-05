-- =============================================================================
-- Datos de catálogo que necesita producción: planes, features y disciplinas.
-- (seed.sql es solo para desarrollo local.)
-- =============================================================================

insert into public.plans (key, name, monthly_price_cents, max_active_students, max_active_formations, sort) values
  ('profe',   'Profe',   1500000,   20, 0,    1),
  ('inicial', 'Inicial', 2990000,   50, 0,    2),
  ('estudio', 'Estudio', 5990000,  150, 2,    3),
  ('pro',     'Pro',     9990000, null, null, 4);

-- Núcleo: Profe e Inicial. Las features por disciplina vienen incluidas.
with core(feature) as (values
  ('students'), ('regular_classes'), ('packs'), ('manual_payments'), ('mp_checkout'),
  ('qr_checkin'), ('reminders'), ('student_app'), ('income_dashboard'), ('csv_import'),
  ('role_balance'), ('couple_packs'), ('equipment_capacity'), ('levels')
),
estudio(feature) as (values
  ('specials'), ('event_tickets'), ('formations'), ('auditions'), ('waitlist'),
  ('trial_class'), ('churn_alert'), ('pack_freeze'), ('library'), ('coupons'),
  ('gift_cards'), ('referrals'), ('embed_widget'), ('teacher_permissions')
),
pro(feature) as (values
  ('certificates'), ('audition_jury'), ('audition_rubrics'), ('audition_video'),
  ('auto_waitlist_admission'), ('teacher_payouts'), ('multi_site'), ('custom_domain'),
  ('arca_invoicing'), ('sell_material'), ('advanced_reports'), ('priority_support')
)
insert into public.plan_features (plan, feature)
select p.plan::public.studio_plan, f.feature
from (values ('profe'), ('inicial'), ('estudio'), ('pro')) as p(plan)
cross join core f
union all
select p.plan::public.studio_plan, f.feature
from (values ('estudio'), ('pro')) as p(plan)
cross join estudio f
union all
select 'pro'::public.studio_plan, f.feature from pro f;

insert into public.disciplines (key, name, features, sort) values
  ('tango',            'Tango',              '{"role_balance": true, "couple_packs": true}', 10),
  ('salsa',            'Salsa',              '{"role_balance": true, "couple_packs": true}', 20),
  ('bachata',          'Bachata',            '{"role_balance": true, "couple_packs": true}', 30),
  ('swing',            'Swing',              '{"role_balance": true, "couple_packs": true}', 40),
  ('folklore',         'Folklore',           '{"role_balance": true, "couple_packs": true}', 50),
  ('yoga',             'Yoga',               '{}', 60),
  ('pilates',          'Pilates',            '{}', 70),
  ('pilates_maquinas', 'Pilates con máquinas', '{"equipment_capacity": true}', 80),
  ('ballet',           'Ballet',             '{"levels": true}', 90),
  ('contemporaneo',    'Contemporáneo',      '{}', 100),
  ('artes_marciales',  'Artes marciales',    '{"levels": true}', 110),
  ('funcional',        'Funcional',          '{}', 120),
  ('otra',             'Otra disciplina',    '{}', 999);
