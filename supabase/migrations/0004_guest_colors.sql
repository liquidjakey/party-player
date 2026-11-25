-- Stable guest colors (2026-11-20): each guest keeps the color they got when added,
-- so adding a new name never shifts everyone else's color.
alter table guests add column if not exists color smallint check (color between 0 and 4);

-- Existing guests: give each party's guests colors in A→Z order (what they see today).
update guests g
set color = sub.c
from (select id, ((row_number() over (partition by event_id order by name)) - 1) % 5 as c from guests) sub
where g.id = sub.id and g.color is null;
