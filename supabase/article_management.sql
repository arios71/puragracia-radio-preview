-- Funciones para administrar el estado y la eliminación de artículos.
-- Ejecutar una sola vez en el SQL Editor del proyecto Pura Gracia Radio - Artículos.

create or replace function public.unpublish_article(article_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select public.current_app_role()) not in ('admin', 'publisher') then
    raise exception 'No tienes permiso para despublicar artículos';
  end if;

  update public.articles
  set status = 'draft',
      published_at = null,
      updated_at = now()
  where id = article_id;

  if not found then
    raise exception 'Artículo no encontrado';
  end if;
end;
$function$;

create or replace function public.delete_article(article_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select public.current_app_role()) <> 'admin' then
    raise exception 'Solo un administrador puede eliminar artículos definitivamente';
  end if;

  delete from public.articles
  where id = article_id;

  if not found then
    raise exception 'Artículo no encontrado';
  end if;
end;
$function$;

revoke all on function public.unpublish_article(uuid) from public;
revoke all on function public.delete_article(uuid) from public;
grant execute on function public.unpublish_article(uuid) to authenticated;
grant execute on function public.delete_article(uuid) to authenticated;
