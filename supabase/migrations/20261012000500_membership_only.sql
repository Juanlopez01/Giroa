-- =============================================================================
-- Pack que se vende solo como abono (pack_products.membership_only): online no
-- se puede comprar suelto ni regalar por MP; solo abonarse. En el mostrador el
-- estudio lo sigue pudiendo vender (p. ej. alguien paga el mes en efectivo).
--
-- Se controla con triggers sobre los inserts que hacen create_pack_payment y
-- create_gift_card_order (pagos por MP sin abono), sin reescribir esas RPC.
-- =============================================================================

alter table public.pack_products add column membership_only boolean not null default false;
alter table public.pack_products add constraint pack_products_membership_only_check
  check (not membership_only or is_membership);

create function private.check_membership_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_online boolean;
begin
  -- Cada tabla con su condición (new no tiene las mismas columnas en las dos).
  if tg_table_name = 'payments' then
    v_online := new.method = 'mercadopago' and new.purpose = 'pack' and new.subscription_id is null;
  else
    v_online := new.method = 'mercadopago';
  end if;
  if v_online and exists (select 1 from public.pack_products where id = new.pack_product_id and membership_only) then
    perform private.fail('Este pack es solo por abono mensual.', 'membership_only');
  end if;
  return new;
end;
$$;

revoke execute on function private.check_membership_only() from public, anon, authenticated;

create trigger payments_membership_only before insert on public.payments
  for each row when (new.pack_product_id is not null) execute function private.check_membership_only();

create trigger gift_cards_membership_only before insert on public.gift_cards
  for each row when (new.pack_product_id is not null) execute function private.check_membership_only();
