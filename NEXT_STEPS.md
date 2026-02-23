# FinTrack – Next steps plan

## ✅ Already done (recent)

- Loans list filter default = **Active**
- Delete loan (with confirmation) in Loan Details
- Payment progress bar based on **money collected** (not weeks)
- Foreclose: optional settlement amount, date; all pending weeks closed with that date
- **Settle & close**: one settlement amount on one date, rest weeks settled; button is text (not icon)
- Edit loan: **first payment date** editable; payment due dates recalc
- Mass record past payments (with Settings toggle); only when setting enabled
- Borrower details on click: open + closed loans, View → Loan Details
- Analytics: borrowers (active/inactive), principal out, interest rate, interest earned (all loans), settled loans table
- Loan Details: Paid vs Pending with full/partial/extra paid, **weeks by cost** (pending ÷ weekly)
- Payment schedule: **Due** de‑emphasized, **Paid** highlighted
- Migrations: `010_allow_mass_record_past`, `011_settle_and_close_trigger`
- Currency: INR/₹ used in app (no dollar symbols in main flows)

---

## High priority

1. **Apply migrations**  
   Run `010_allow_mass_record_past.sql` and `011_settle_and_close_trigger.sql` on your Supabase DB if not already applied.

2. **Foreclose error (week_number check)**  
   If foreclose still errors with `payments_week_number_check`: ensure foreclose only **updates** existing payment rows (no insert). Current code updates by `id`; if anything inserts a row with invalid `week_number`, find and remove that path.

3. **Record payment / modals on mobile**  
   - Loan Details: “Pay” / “Edit payment” → Record payment modal should **slide up from bottom** (like Collections), not center.
   - Collections: Record payment modal – **Cancel / close** and primary action should stay above the bottom nav (scroll or padding so they’re not behind footer icons).

4. **Overdue in Analytics**  
   Show **overview**: per **loan** (borrower + loan), **number of weeks overdue** and total amount. On click/expand, show the list of weeks (not replace the overview with a long list of every week).

---

## Medium priority

5. **Collections tab naming**  
   Rename “Overdue” to **“Pending”** where it refers to overdue + future pending. Keep wording consistent with Loan Details (Pending = overdue + future).

6. **Collections: per‑loan pending dropdown**  
   Under Pending, each **loan** (borrower + loan) has a **dropdown** to expand and see that loan’s pending/overdue weeks, instead of only a single global dropdown at the top.

7. **Create loan UI on mobile**  
   Add Loan form: larger tap targets, spacing, and layout so it’s comfortable on small screens (e.g. stack fields, full‑width buttons, bottom sheet style if needed).

8. **Foreclose label on Loans tab**  
   Where Foreclose is shown (e.g. LoanCard or list), use **text “Foreclose”** (not only an icon), for consistency with “Settle & close”.

9. **Foreclosure date on Loans tab**  
   When a loan is foreclosed, show the **foreclosure date** in the loans list/card (e.g. “Foreclosed · 22 Feb 2025”) so it’s visible without opening details.

---

## Polish / UX

10. **Mobile: duplicate actions**  
    If “Add borrower” and “Create loan” appear both in header and in bottom nav on mobile, consider hiding or simplifying the **top** actions so the bottom nav is the main CTA and the screen is less cluttered.

11. **Loan number in Analytics settled list**  
    If you want “Loan #” in the Settled loans table, add `loan_number` to the `loan_summary` view (e.g. in a new migration) and use it in the Analytics table.

12. **Currency audit**  
    Search codebase for “$” or “dollar” and replace any remaining with ₹/INR wording or `formatCurrency` so everything is clearly rupees.

---

## Later / backlog

13. **Import functionality**  
    Design and implement data import (e.g. CSV/JSON for borrowers, loans, or payments) with validation and conflict handling.

14. **Export**  
    You already have export in Settings; optionally add “Export settled loans” (CSV/PDF) from Analytics.

15. **Testing**  
    Add a few critical-path tests (e.g. create loan → record payment → foreclose or settle) to avoid regressions.

---

## Quick reference – what to do next

- **If foreclose still breaks:** focus on **(2)** and migration **011**.
- **If mobile modals feel wrong:** do **(3)** (record payment from bottom, buttons above footer).
- **If you want clearer overdue view:** do **(4)** and **(6)** (overview + per‑loan dropdown).
- **If you want consistency and polish:** do **(5)**, **(8)**, **(9)**, **(10)** and **(12)** as a batch.

You can copy items from here into `src/components/Loans/taskslist.md` or your own tracker and tick them off as you go.
