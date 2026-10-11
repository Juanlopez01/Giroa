-- Alerta de abandono (feature 'churn_alert', Estudio y Pro): cuántos días sin
-- venir cuentan como "dejó de venir". El cálculo vive en src/lib/churn.ts.
alter table public.studios
  add column churn_days smallint not null default 14 check (churn_days in (14, 21, 30));
grant update (churn_days) on public.studios to authenticated;
