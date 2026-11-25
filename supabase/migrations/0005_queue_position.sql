-- The host can reorder the queue. A song's place = position if set, else the time it was added.
alter table tracks add column if not exists position double precision;
