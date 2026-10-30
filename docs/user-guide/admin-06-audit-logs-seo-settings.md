# Admin 6. Audit logs, SEO and settings

[Back to the guide index](README.md)

## Part A. Audit logs

The audit log is the record of **who changed what, and when**. Every admin change and every organisation or billing
change adds one line. Use it to answer "who unpublished that offer?" or "when was this category switched off?".

Reading it needs the `audit.read` permission (a Super Admin has it).

### Step 1. Open the log

1. Click **Audit Logs** (under **More** on a phone).
2. The page says "Track all administrative actions and system events", then a **Filters** card (see Step 2) and a
   card **Recent Activity** with a line such as "Showing 1 to 10 of 10 entries (newest first)".
3. The table has these columns:

| Column | What it shows |
| --- | --- |
| **Timestamp** | Date and time in UTC, for example "30 Oct 2026, 08:57 UTC" |
| **Action** | A short code in a grey outline: `admin.offers.create`, `admin.offers.verify`, `admin.offers.publish`, `admin.offers.unpublish`, `admin.offers.expire`, `admin.offers.archive`, and similar for categories, merchants, users and billing |
| **Resource** | What kind of thing it was ("offers") |
| **User ID** | The id of the admin who did it |
| **IP Address** | Where the request came from |

![The audit log](images/admin-audit-logs-d.png)

Phone:

![The audit log on a phone](images/admin-audit-logs-m.png)

In the screenshot, the ten lines are the real record of the two test offers created while writing this guide (create,
verify, publish, expire and archive for each), made by the test admin account from the local computer.

### Step 2. Filter and page through the log

The **Filters** card narrows the list. Every filter you add must match (an entry has to fit all of them).

| Control | What it does |
| --- | --- |
| **Action** | Only entries with exactly this action, for example `admin.offers.update` |
| **User ID** | Only entries made by this admin (their id, as shown in the **User ID** column) |
| **Organisation ID** | Only entries about this organisation |
| **From date** and **To date** | Only entries on or between these days. Dates are in UTC and each includes the whole day |
| **Entries per page** | 25, 50 (the default) or 100 |

1. Fill in one or more controls and press **Apply filters**. The list reloads from the first page.
2. Press **Reset filters** to clear everything and go back to the plain newest-first list.
3. The line above the table says which entries you are looking at, for example "Showing 51 to 100 of 250 entries
   (newest first)". If nothing matches, the page says "No entries match these filters" with a **Reset filters** button.
4. When there is more than one page, **Previous** and **Next** appear under the table with "Page 2 of 5". They keep
   your filters.
5. The address of the page holds the filters, so you can bookmark it or send the link to another admin (who needs
   the audit-log permission to open it).

If a value cannot be used (an action that is not written like `admin.offers.update`, an id with spaces, a date that
does not exist, or a "To" date before the "From" date) it is ignored and a red note under the controls says which
one.

### Step 3. What is recorded, and what is not

- **Recorded**: creating, editing and every status change of an offer ("verify", "publish", "unpublish", "expire",
  "archive"), affiliate link changes, category and merchant changes (create, edit, enable/disable, activate/deactivate),
  admin changes to users and admin roles, subscription grants/cancellations/refunds, organisation and billing
  changes, and a person's own **Export my data** download.
- **Not recorded**: a refused action (for example the "could not publish" in [Admin 2](admin-02-offers.md)), simply
  looking at a page, signing in, and changes to a person's own profile, settings or two-factor.
- The log keeps *which* fields changed, not secrets: passwords, tokens and card details are never stored in it.

### Limits of the screen

- You can page back through at most the newest **10,000 entries** of any search. Beyond that, the page tells you to
  narrow the filters or the date range (for example pick a month) to reach older entries.
- You can filter by action, user, organisation and date. There is no free-text search, no filter by resource or by
  IP address, and no way to pick an action from a list: type it exactly.
- The screenshots below still show the earlier version of the page without the **Filters** card. **Screenshot refresh
  pending**: it needs the signed-in test admin account.

## Part B. SEO

**SEO** in the sidebar is switched off. The page is headed "SEO Management" with "Meta tags and redirects are not
available yet" and a panel **Not available yet**: "This page is switched off until its backend service is ready.
Nothing is lost: it will return in a later release." The **Go to Users** button leaves the page.

Search-engine behaviour of the public site (which pages are indexed, the sitemap, the page titles) is set by the
site's code today, not from this screen.

![The SEO page](images/admin-seo-d.png)

Phone:

![The SEO page on a phone](images/admin-seo-m.png)

## Part C. Settings

**Settings** shows **statistics only**. The page says "System statistics. Editing settings, flags and templates is
not available yet." Under **System stats** it lists how many of each of these exist: **Application settings**,
**Feature flags**, **Email templates**, **SEO entries**, **URL redirects**, **Audit log entries**, **Stripe events
processed** and **Platform admins**. Use **Refresh** to reload.

You cannot change the site name, currency, language, theme or feature flags from this page. (Developer notes in
[admin-settings.md](../developer/admin-settings.md) describe editable General, Theme and Feature flag tabs. Those are
not what the page does today.)

![The Settings page](images/admin-settings-d.png)

Phone:

![The Settings page on a phone](images/admin-settings-m.png)

## When a page cannot load

Each of these pages shows a red box with a short message and a **Retry** button if the system behind it is not
reachable ("Something went wrong. Please try again." is typical). Nothing has been lost; try again, and tell a
developer if it keeps happening.
