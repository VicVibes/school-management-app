create table if not exists online_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) not null,
  student_id uuid references students(id) not null,
  amount numeric not null check (amount > 0),
  reference text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'FAILED')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table online_payments enable row level security;

drop policy if exists "online_payments_select" on online_payments;
create policy "online_payments_select" on online_payments for select to public
using (auth_role() = 'SUPER_ADMIN' or school_id = auth_school_id());

create or replace function confirm_online_payment(payment_reference text, paid_amount numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_payment online_payments;
begin
  select * into pending_payment from online_payments where reference = payment_reference for update;
  if not found then raise exception 'Unknown payment reference'; end if;
  if pending_payment.status = 'PAID' then return false; end if;
  if pending_payment.amount <> paid_amount then raise exception 'Payment amount mismatch'; end if;
  update online_payments set status = 'PAID', paid_at = now() where id = pending_payment.id;
  insert into payments (school_id, student_id, amount, mode, notes)
  values (pending_payment.school_id, pending_payment.student_id, pending_payment.amount, 'Paystack', 'Online payment: ' || pending_payment.reference);
  return true;
end;
$$;

revoke all on function confirm_online_payment(text, numeric) from public;
grant execute on function confirm_online_payment(text, numeric) to service_role;

notify pgrst, 'reload schema';
