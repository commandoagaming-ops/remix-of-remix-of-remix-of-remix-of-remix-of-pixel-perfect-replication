
create type public.app_role as enum ('admin','user');
create type public.submission_status as enum ('submitted','under_review','approved','rejected');
create type public.withdrawal_status as enum ('pending','under_review','approved','processing','paid','rejected','failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, phone text, country text default 'India',
  preferred_language text default 'en', avatar_url text,
  profile_completed boolean not null default false,
  account_status text not null default 'active',
  last_seen_at timestamptz default now(),
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (full_name, phone, country, preferred_language, avatar_url, profile_completed, last_seen_at) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null, unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name, avatar_url, phone)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.raw_user_meta_data->>'avatar_url', new.phone);
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  currency text not null default 'INR',
  min_withdrawal numeric not null default 100,
  fee_percent numeric not null default 2,
  fee_flat numeric not null default 0,
  processing_time text not null default '2-5 working days',
  support_email text not null default 'support@untotogether.app',
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values (1);
grant select, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "settings read" on public.app_settings for select to authenticated using (true);
create policy "settings admin" on public.app_settings for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text not null default '',
  category text not null default 'learning',
  instructions text not null default '', eligibility text not null default 'All verified users',
  reward_amount numeric not null default 0 check (reward_amount >= 0),
  estimated_minutes int not null default 5,
  deadline timestamptz, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create policy "tasks read" on public.tasks for select to authenticated using (is_active or public.has_role(auth.uid(),'admin'));
create policy "tasks admin write" on public.tasks for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, task_id uuid not null references public.tasks(id) on delete cascade,
  evidence text not null default '', status submission_status not null default 'under_review',
  review_reason text, submitted_at timestamptz not null default now(), reviewed_at timestamptz,
  unique(user_id, task_id)
);
grant select on public.task_submissions to authenticated;
grant all on public.task_submissions to service_role;
alter table public.task_submissions enable row level security;
create policy "subs read" on public.task_submissions for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, task_id uuid, withdrawal_id uuid,
  kind text not null, amount numeric not null, note text,
  created_at timestamptz not null default now()
);
grant select on public.reward_ledger to authenticated;
grant all on public.reward_ledger to service_role;
alter table public.reward_ledger enable row level security;
create policy "ledger read" on public.reward_ledger for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.payout_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  method_type text not null check (method_type in ('upi','bank')),
  holder_name text not null, upi_id text, account_number text, ifsc text, bank_name text,
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.payout_methods to authenticated;
grant all on public.payout_methods to service_role;
alter table public.payout_methods enable row level security;
create policy "pm read" on public.payout_methods for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "pm insert" on public.payout_methods for insert to authenticated with check (user_id = auth.uid());
create policy "pm delete" on public.payout_methods for delete to authenticated using (user_id = auth.uid());

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, amount numeric not null, fees numeric not null, net_amount numeric not null,
  currency text not null, payout_method_id uuid references public.payout_methods(id) on delete set null,
  payout_label text, status withdrawal_status not null default 'pending',
  provider_reference text, admin_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select on public.withdrawals to authenticated;
grant all on public.withdrawals to service_role;
alter table public.withdrawals enable row level security;
create policy "wd read" on public.withdrawals for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text not null default '', video_url text not null,
  thumbnail_url text, language text not null default 'en',
  is_published boolean not null default true, is_featured boolean not null default false,
  display_order int not null default 0, created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.videos to authenticated;
grant all on public.videos to service_role;
alter table public.videos enable row level security;
create policy "videos read" on public.videos for select to authenticated using (is_published or public.has_role(auth.uid(),'admin'));
create policy "videos admin" on public.videos for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null, action text not null, target_id uuid, details text,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit admin" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.get_my_balances()
returns table(available numeric, pending numeric, total_earned numeric, withdrawn numeric)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(amount) from reward_ledger where user_id = auth.uid()),0),
    coalesce((select sum(t.reward_amount) from task_submissions s join tasks t on t.id=s.task_id where s.user_id=auth.uid() and s.status in ('submitted','under_review')),0),
    coalesce((select sum(amount) from reward_ledger where user_id = auth.uid() and kind='reward'),0),
    coalesce((select sum(net_amount) from withdrawals where user_id = auth.uid() and status='paid'),0)
$$;
grant execute on function public.get_my_balances() to authenticated;

create or replace function public.submit_task(_task_id uuid, _evidence text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _t tasks;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into _t from tasks where id=_task_id and is_active;
  if not found then raise exception 'Task not available'; end if;
  if _t.deadline is not null and _t.deadline < now() then raise exception 'Task deadline has passed'; end if;
  if length(coalesce(_evidence,'')) < 3 or length(_evidence) > 2000 then raise exception 'Please add valid proof (3-2000 characters)'; end if;
  if exists (select 1 from task_submissions where user_id=auth.uid() and task_id=_task_id) then raise exception 'You already submitted this task'; end if;
  insert into task_submissions(user_id, task_id, evidence) values (auth.uid(), _task_id, _evidence) returning id into _id;
  return _id;
end $$;
grant execute on function public.submit_task(uuid,text) to authenticated;

create or replace function public.admin_review_submission(_id uuid, _approve boolean, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare _s task_submissions; _amt numeric;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Not authorized'; end if;
  select * into _s from task_submissions where id=_id for update;
  if not found then raise exception 'Not found'; end if;
  if _s.status in ('approved','rejected') then raise exception 'Already reviewed'; end if;
  update task_submissions set status = case when _approve then 'approved'::submission_status else 'rejected'::submission_status end,
    review_reason=_reason, reviewed_at=now() where id=_id;
  if _approve then
    select reward_amount into _amt from tasks where id=_s.task_id;
    insert into reward_ledger(user_id, task_id, kind, amount, note) values (_s.user_id, _s.task_id, 'reward', _amt, 'Task approved');
  end if;
  insert into audit_log(admin_id, action, target_id, details) values (auth.uid(), case when _approve then 'approve_submission' else 'reject_submission' end, _id, _reason);
end $$;
grant execute on function public.admin_review_submission(uuid,boolean,text) to authenticated;

create or replace function public.request_withdrawal(_amount numeric, _payout_method_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _bal numeric; _set app_settings; _pm payout_methods; _fee numeric; _id uuid; _label text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select * into _set from app_settings where id=1;
  select * into _pm from payout_methods where id=_payout_method_id and user_id=auth.uid();
  if not found then raise exception 'Choose a payout method'; end if;
  if _amount is null or _amount < _set.min_withdrawal then raise exception 'Minimum withdrawal is %', _set.min_withdrawal; end if;
  if exists (select 1 from profiles where id=auth.uid() and account_status<>'active') then raise exception 'Account is not active'; end if;
  if exists (select 1 from withdrawals where user_id=auth.uid() and status in ('pending','under_review','approved','processing')) then raise exception 'You already have a withdrawal in progress'; end if;
  select coalesce(sum(amount),0) into _bal from reward_ledger where user_id=auth.uid();
  if _amount > _bal then raise exception 'Insufficient available balance'; end if;
  _fee := round(_amount * _set.fee_percent / 100 + _set.fee_flat, 2);
  _label := case when _pm.method_type='upi' then 'UPI ' || left(_pm.upi_id,3) || '***' else 'Bank ****' || right(coalesce(_pm.account_number,''),4) end;
  insert into withdrawals(user_id, amount, fees, net_amount, currency, payout_method_id, payout_label)
    values (auth.uid(), _amount, _fee, _amount - _fee, _set.currency, _pm.id, _label) returning id into _id;
  insert into reward_ledger(user_id, withdrawal_id, kind, amount, note) values (auth.uid(), _id, 'withdrawal_hold', -_amount, 'Withdrawal requested');
  return _id;
end $$;
grant execute on function public.request_withdrawal(numeric,uuid) to authenticated;

create or replace function public.admin_update_withdrawal(_id uuid, _status withdrawal_status, _reference text, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare _w withdrawals;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Not authorized'; end if;
  select * into _w from withdrawals where id=_id for update;
  if not found then raise exception 'Not found'; end if;
  if _w.status in ('paid','rejected','failed') then raise exception 'Withdrawal already closed'; end if;
  if _status='paid' and coalesce(trim(_reference),'')='' then raise exception 'Payment reference is required to mark as paid'; end if;
  update withdrawals set status=_status, provider_reference=coalesce(nullif(_reference,''),provider_reference), admin_note=_note, updated_at=now() where id=_id;
  if _status in ('rejected','failed') then
    insert into reward_ledger(user_id, withdrawal_id, kind, amount, note) values (_w.user_id, _id, 'withdrawal_release', _w.amount, 'Withdrawal ' || _status::text || ' - funds released');
  end if;
  insert into audit_log(admin_id, action, target_id, details) values (auth.uid(), 'withdrawal_' || _status::text, _id, _note);
end $$;
grant execute on function public.admin_update_withdrawal(uuid,withdrawal_status,text,text) to authenticated;

create or replace function public.admin_set_user_status(_user uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Not authorized'; end if;
  if _status not in ('active','suspended') then raise exception 'Invalid status'; end if;
  update profiles set account_status=_status where id=_user;
  insert into audit_log(admin_id, action, target_id, details) values (auth.uid(), 'user_' || _status, _user, null);
end $$;
grant execute on function public.admin_set_user_status(uuid,text) to authenticated;

insert into public.tasks(title, description, category, instructions, reward_amount, estimated_minutes) values
('Watch: How Unto Together Works','Watch the introduction video fully and share one thing you learned.','learning',E'1. Open Earn / Learn\n2. Watch the featured video\n3. Write one key learning as proof',10,5),
('Complete your profile','Add your photo, name and country.','onboarding',E'1. Open Profile\n2. Fill all details\n3. Submit "done" as proof',5,3),
('Share feedback on the app','Tell us what you like and what we can improve.','survey',E'1. Use the app for a few minutes\n2. Write at least 2 sentences of honest feedback',15,10);

insert into public.videos(title, description, video_url, language, is_featured, display_order) values
('Join Unto Together — Learn How It Works','A short walkthrough of tasks, rewards and withdrawals.','https://www.youtube.com/embed/ysz5S6PUM-U','en',true,0);
