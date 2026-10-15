<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- GBTS uses separate domain modules and protected named routes under `_authenticated`; the public index shows only flagged fictional records for safe preview.
- Private operations use authenticated server functions and partner-only RLS; technical admins do not automatically inherit partner access.
- Contracts and receipts are created through transactional database functions; amounts use decimal storage and integer-cent client calculations to preserve reconciliation.
- The dashboard and financial statuses derive from stored receipts and due dates; never persist periodic overdue transitions or seed on page load.
- Import the global stylesheet directly in the root module so client navigation retains institutional styling on protected screens.
- New demonstration data uses database data tools because the migration tool accepts DDL only; production preparation must establish isolated environments before real records are introduced.
