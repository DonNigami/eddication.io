-- Boonyang stock sync: apply a sheet->DB diff atomically.
--
-- The edge function `boonyang-stock-sync` reads the stock sheet, diffs it against the table as a
-- multiset of rows (there is no unique key in this data, so an upsert would silently merge rows),
-- and calls this function with only the rows that changed. Delete + insert run in ONE transaction:
-- if anything fails the table is left exactly as it was, never half-replaced.
--
-- Replaces the old Apps Script import that deleted and re-inserted every row on each run
-- (~17,500 row writes/day), which was exhausting the project's disk IO budget.

create or replace function public.sync_stock_apply(
  p_table      text,
  p_delete_ids bigint[],
  p_insert     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted  int := 0;
  v_inserted int := 0;
begin
  if p_table = 'botdata' then
    delete from public.botdata where id = any(coalesce(p_delete_ids, '{}'));
    get diagnostics v_deleted = row_count;

    insert into public.botdata
      (item_code, field_unknown, item_name, lot_number, on_hand_quantity, alternative_key_1, alternative_key_2)
    select item_code, field_unknown, item_name, lot_number, coalesce(on_hand_quantity, 0),
           alternative_key_1, alternative_key_2
    from jsonb_populate_recordset(null::public.botdata, coalesce(p_insert, '[]'::jsonb));
    get diagnostics v_inserted = row_count;

  elsif p_table = 'inventdata' then
    delete from public.inventdata where id = any(coalesce(p_delete_ids, '{}'));
    get diagnostics v_deleted = row_count;

    insert into public.inventdata
      ("ItemName", "Standard", "ItemName2", "ItemName3", "OnhandQtyByTotalPiece")
    select "ItemName", "Standard", "ItemName2", "ItemName3", coalesce("OnhandQtyByTotalPiece", 0)
    from jsonb_populate_recordset(null::public.inventdata, coalesce(p_insert, '[]'::jsonb));
    get diagnostics v_inserted = row_count;

  else
    raise exception 'sync_stock_apply: unknown table %', p_table;
  end if;

  return jsonb_build_object('table', p_table, 'deleted', v_deleted, 'inserted', v_inserted);
end;
$$;

-- Only the edge function (service_role) may call it.
revoke all on function public.sync_stock_apply(text, bigint[], jsonb) from public, anon, authenticated;
grant execute on function public.sync_stock_apply(text, bigint[], jsonb) to service_role;
