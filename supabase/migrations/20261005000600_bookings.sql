-- =============================================================================
-- Reservas y asistencia. Solo se escriben por RPC (book_session, cancel_booking,
-- check_in, cancel_session).
-- =============================================================================

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  session_id uuid not null,
  student_id uuid not null,
  student_pack_id uuid,
  dance_role public.dance_role,
  status public.booking_status not null default 'booked',
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  credit_refunded boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, id),
  check (status <> 'attended' or checked_in_at is not null),
  check (status <> 'cancelled' or cancelled_at is not null),
  foreign key (studio_id, session_id) references public.sessions (studio_id, id) on delete restrict,
  foreign key (studio_id, student_id) references public.students (studio_id, id) on delete restrict,
  foreign key (studio_id, student_pack_id) references public.student_packs (studio_id, id) on delete restrict
);

-- Un solo lugar activo por alumno y sesión.
create unique index bookings_one_active_per_student
  on public.bookings (session_id, student_id)
  where status in ('booked', 'attended');

create index bookings_session_idx on public.bookings (session_id) where status in ('booked', 'attended');
create index bookings_student_idx on public.bookings (student_id, created_at desc);

create trigger bookings_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();

alter table public.pack_credit_events
  add constraint pack_credit_events_booking_fk
  foreign key (studio_id, booking_id) references public.bookings (studio_id, id) on delete set null (booking_id);

-- -----------------------------------------------------------------------------
-- RLS: el staff ve las reservas de su estudio; el alumno, las suyas.
-- -----------------------------------------------------------------------------
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;

create policy bookings_read on public.bookings for select to authenticated
  using (
    private.is_studio_staff(studio_id)
    or student_id in (select private.my_student_ids())
  );
