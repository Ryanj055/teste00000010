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

- GBTS uses separate domain modules and protected named routes under `_authenticated`; the public index is institutional only and never reads office data.
- Every business row carries `organization_id`; RLS uses `can_access(organization_id)` (active membership + server-date subscription check) so office isolation and commercial suspension are enforced in the database.
- RTG platform admins live in `rtg_admins` and manage organizations only through definer RPCs; they never get office financial or legal data by default.
- Private operations use authenticated server functions; `is_partner()` now means access to the caller's current organization.
- Contracts and receipts are created through transactional database functions; amounts use decimal storage and integer-cent client calculations to preserve reconciliation.
- The dashboard and financial statuses derive from stored receipts and due dates; never persist periodic overdue transitions or seed on page load.
- Import the global stylesheet directly in the root module so client navigation retains institutional styling on protected screens.
- Use the shared developer signature in application and access footers only; keep technology attribution separate from legal documents and financial content.
- New demonstration data uses database data tools because the migration tool accepts DDL only; production preparation must establish isolated environments before real records are introduced.
