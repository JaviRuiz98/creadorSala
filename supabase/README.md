# Supabase setup

Run the migration in `migrations/0001_initial.sql`.

After creating the first account, promote it manually from the SQL editor:

```sql
update public.profiles set role = 'ADMIN' where id = 'AUTH_USER_UUID';
```

Do not expose the service role key to the browser.
