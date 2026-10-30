# Admin 4. Users and two-factor sign-in

[Back to the guide index](README.md)

**Users** in the sidebar lets an admin look people up, edit their profile details, and suspend or restore their
access. Deleting accounts and granting or removing admin roles are not on these screens yet. (The two accounts in the screenshots, "E2E Admin" and "E2E
Plain User" on `example.test` addresses, are test accounts that came with the test setup. They are not real people.)

Looking people up needs the `users.read` permission. Editing, suspending and restoring need `users.update`; without
it the screen answers "You do not have permission to do that". Every change is recorded in the audit log (see
[Admin 6](admin-06-audit-logs-seo-settings.md)).

## Step 1. Open the user list

1. Click **Users** (under **More** on a phone).
2. The page is headed **User Management**: "View and manage all platform users".
3. Under the search box, **All Users (*n*)** shows how many accounts there are, then a table:

| Column | What it shows |
| --- | --- |
| **User** | Display name ("Not set" if none) and email address |
| **Status** | **Verified** (green) or **Unverified** (orange): whether the person has confirmed their email |
| **Role** | The admin role as a blue badge (for example **Super Admin**), or "User" for an ordinary account |
| **Last sign-in** | The date, or **Never** |
| **Joined** | The date the account was created |
| **Actions** | A three-dot menu: **View Details**, **Edit User**, **Suspend User** and **Restore Access** |

![The user list on a desktop screen](images/admin-users-d.png)

Phone:

![The user list on a phone](images/admin-users-m.png)

## Step 2. Search for someone

1. Type part of a name or an email address into **Search users by name or email**.
2. Press **Search**. The heading counts the matches. If nothing matches the page says "No users match '*your
   words*'" with a **Clear** button.
3. If the list runs to more than one page, use **Previous** and **Next** at the bottom.

![Searching for "plain"](images/admin-users-search-d.png)

Phone:

![Searching on a phone](images/admin-users-search-m.png)

> The search word travels in the page address, so an email address you type can stay in your browser history and in
> server logs. This is noted in the privacy information.

## Step 3. Open a user's details

1. Click the three dots in the **Actions** column, then **View Details**.
2. The **User Details** page has an **Edit user** button and **Back to Users**, and shows three panels:
   - **Basic Information**: **Email**, **Display Name**, **User ID**, **Email Verified**, **Two-factor** (**Enabled**
     or **Disabled**), **Last Login** and **Member Since**.
   - **Profile**: **Bio**, **Location**, **Website** and **Phone** (a dash when not filled in).
   - **Admin Access**: the **Admin Role** (or "None") and, for admins, the list of **Permissions**.
3. **Back to Users** returns to the list.

![The user menu (this picture predates the Edit User and Restore Access items; screen pending, see the end of this
page)](images/admin-users-row-menu-d.png)

![A user's details on a desktop screen](images/admin-user-detail-d.png)

Phone:

![A user's details on a phone](images/admin-user-detail-m.png)

## Step 4. Edit a user's profile

1. Click the three dots, then **Edit User** (or open **View Details** and click **Edit user**).
2. The **Edit user** page shows the person's email and a form with **Display name**, **Bio**, **Location**, **Website**
   and **Phone**. The email address, admin role and two-factor setting cannot be changed here.
3. Change what you need and press **Save changes**. Leave a box empty to clear that value.
4. A green "Changes saved." message and a "User updated" notice confirm it. If something is wrong, an
   error says what: the website must start with `http://` or `https://`, the phone number may hold only digits,
   spaces and `+ ( ) - .`, and each box has a length limit. A refusal ("You do not have permission to do that") appears
   as **Could not save**.
5. **Back to user details** returns to the details page.

The audit log records which fields were changed, never their values.

## Step 5. Suspend or restore a user

1. Click the three dots, then **Suspend User**.
2. A box asks "Suspend this user?". It names the person and says they will be signed out and cannot sign in until you
   restore their access. You can type an optional **Reason** (up to 200 characters). It is kept in the audit log and is
   not shown to the user.
3. Press **Suspend user** to confirm, or **Cancel** to leave things as they are. On success the box closes and a notice
   says the user was suspended.
4. To undo it, choose **Restore Access** from the same menu and confirm. The person can sign in again.

Some refusals are expected. You cannot suspend or restore your own account (the box shows "You cannot suspend or restore
your own account."). Suspending or restoring an admin also needs the `admins.delete` permission and every permission
that admin holds; without them the box shows "You do not have permission to do that". The list and details pages do not
show whether someone is suspended, so **Restore Access** is always offered; restoring someone who is not suspended
leaves their access as it is (an audit entry is still written).

## Not on these screens yet

The backend can also delete accounts and grant or remove admin roles, but there is no screen for either yet; a
developer does those through the backend.

*Screens pending: needs the Firebase test project (owner action).* The pictures of the row menu and the **User Details**
page above were taken before **Edit User**, **Restore Access** and the **Edit user** button existed, and there are no
pictures yet of the **Edit user** form or of the **Suspend this user?** box. They need a signed-in admin.

## Two-factor authentication (2FA)

Two-factor authentication adds a six-digit code from an authenticator app to signing in. Where it stands today:

- **Account level.** 2FA belongs to each person's own account, not to the admin area. Each person manages it on their
  own **Security** page, reached from their dashboard (`/dashboard/security`).
- **Status only.** The Security page has a **Two-Factor Authentication** panel that says either "Two-factor
  authentication is enabled" or "Two-factor authentication is not enabled" (or "Two-factor status unavailable" if it
  cannot be read).
- **Signing in with 2FA.** If an account has 2FA on, signing in has a second step. After the email and password (or
  **Continue with Google** or **GitHub**) are accepted, the page shows **Two-factor authentication** with one box,
  **Authenticator code**. Type the six-digit code from the authenticator app and press **Verify and sign in**. The code
  changes every 30 seconds, so type the current one. The messages you may see:
  - **That code did not work**: the code was wrong or had expired. The box is cleared; try the new code.
  - **Enter the six-digit code**: the box did not hold six digits.
  - **Too many attempts**: after a few wrong codes (at most four in 15 minutes) sign-in is blocked; wait 15 minutes.
  - **Your sign-in timed out**: the first step is only valid for about five minutes. The page returns to the sign-in
    form with this message; sign in again.
  - **Sign-in is unavailable right now**: a problem on our side. Try again in a few minutes.

  **Back to sign in** returns to the first step with the email still filled in (the password is cleared) and signs the
  browser out of the half-finished sign-in. There are **no backup codes**: if you
  cannot get a code, the page offers **Contact support**, but nothing in the screens can switch 2FA off for you (see
  below).
- **Changing your password signs you out.** For an account with 2FA on, changing the password on the Security page
  ends the session, because the new session needs a code too. You are sent to the sign-in page and sign in with the
  new password and a code.
- **Setting it up is switched off.** The Security page has no **Enable** button, on purpose: with no backup codes, a
  person who loses their phone would be locked out. To enable 2FA today a developer has to call the backend's two
  set-up routes (enrol, then confirm with a code) with that person's own signed-in session. Ordinary users cannot do it
  themselves yet, so in practice almost no account has 2FA on.
- **Turning it off.** An account that does have 2FA enabled sees a **Disable 2FA** button. It asks for your password
  (or a Google or GitHub sign-in) and a six-digit code from your authenticator app ("Disable Two-Factor
  Authentication"). Someone who has lost their authenticator cannot use it, because it needs a code; a developer would
  have to clear the setting in the database.
- **For admins.** An admin can see whether another user has 2FA enabled on that user's **User Details** page. Admins
  cannot switch another person's 2FA on or off from the screens.

![The Security page of an ordinary account, with the 2FA status panel](images/security-d.png)

Phone:

![The Security page on a phone](images/security-m.png)

*Screen pending: needs the Firebase test project (owner action).* There are no screenshots of the sign-in code step
(**Two-factor authentication**), the **Disable Two-Factor Authentication** dialog or changing a password, because each
needs a real Firebase sign-in and an account with 2FA turned on. The sign-in screenshots elsewhere in this guide show
the first step, which has not changed.

The Security page also holds **Change Password**, **Login History**, **Export my data** and **Delete Account**. They
are account features for the signed-in person and are not covered further in this guide. The word "Your App" at the top
of the sidebar is a placeholder name left over from the template.
