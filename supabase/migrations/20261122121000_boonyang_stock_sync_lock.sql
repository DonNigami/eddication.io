-- Boonyang stock sync: guard against two syncs applying the same diff.
--
-- The diff is computed in the edge function, outside the database. If the pg_cron run and the
-- manual "Import" menu overlap, both see the same table state and compute the same diff; without
-- a guard the second one would insert the same rows again (duplicated stock until the next run).
--
-- Under a per-table advisory lock, the apply now aborts (and rolls back) when the table no longer
-- matches what the diff was computed from:
--   * the row count differs from p_expected_count, or
--   * some of the rows to delete are already gone (covers replacements, where the count matches).
-- The caller reports the error; the next run recomputes a fresh diff.

drop function if exists public.sync_stock_apply(text, bigint[], jsonb);

create or replace function public.sync_stock_apply(
  p_table          text,
  p_delete_ids     bigint[],
  p_insert         jsonb,
  p_expected_count int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids      bigint[] := coalesce(p_delete_ids, '{}');
  v_current  int;
  v_deleted  int := 0;
  v_inserted int := 0;
begin
  if p_table not in ('botdata', 'inventdata') then
    raise exception 'sync_stock_apply: unknown table %', p_table;
  end if;

  perform pg_advisory_xact_lock(hashtext('boonyang_stock_sync:' || p_table));

  execute format('select count(*) from public.%I', p_table) into v_current;
  if v_current <> p_expected_count then
    raise exception 'sync_stock_apply: stale diff for % (expected % rows, found %) — another sync ran; retry',
      p_table, p_expected_count, v_current;
  end if;

  if p_table = 'botdata' then
    delete from public.botdata where id = any(v_ids);
    get diagnostics v_deleted = row_count;
    if v_deleted <> cardinality(v_ids) then
      raise exception 'sync_stock_apply: stale diff for botdata (% of % rows to delete were already gone) — retry',
        cardinality(v_ids) - v_deleted, cardinality(v_ids);
    end if;

    insert into public.botdata
      (item_code, field_unknown, item_name, lot_number, on_hand_quantity, alternative_key_1, alternative_key_2)
    select item_code, field_unknown, item_name, lot_number, coalesce(on_hand_quantity, 0),
           alternative_key_1, alternative_key_2
    from jsonb_populate_recordset(null::public.botdata, coalesce(p_insert, '[]'::jsonb));
    get diagnostics v_inserted = row_count;

  else
    delete from public.inventdata where id = any(v_ids);
    get diagnostics v_deleted = row_count;
    if v_deleted <> cardinality(v_ids) then
      raise exception 'sync_stock_apply: stale diff for inventdata (% of % rows to delete were already gone) — retry',
        cardinality(v_ids) - v_deleted, cardinality(v_ids);
    end if;

    insert into public.inventdata
      ("ItemName", "Standard", "ItemName2", "ItemName3", "OnhandQtyByTotalPiece")
    select "ItemName", "Standard", "ItemName2", "ItemName3", coalesce("OnhandQtyByTotalPiece", 0)
    from jsonb_populate_recordset(null::public.inventdata, coalesce(p_insert, '[]'::jsonb));
    get diagnostics v_inserted = row_count;
  end if;

  return jsonb_build_object('table', p_table, 'deleted', v_deleted, 'inserted', v_inserted);
end;
$$;

revoke all on function public.sync_stock_apply(text, bigint[], jsonb, int) from public, anon, authenticated;
grant execute on function public.sync_stock_apply(text, bigint[], jsonb, int) to service_role;
