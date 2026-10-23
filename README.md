# Dynamic Lab Workstation Tracker

The project now contains a Vite frontend, a Node.js API backed by SQLite, and a separately run Python monitoring agent. The dashboards display information received by the API; they do not inspect computers from the browser. A device is not considered available unless a recent heartbeat, fresh metrics, and an explicit availability signal have all been reported.

## Requirements

- Node.js 22.13 or later (the API uses Node's built-in `node:sqlite` module).
- Python 3.10 or later on each authorized workstation.
- Network access from authorized workstations to the API. Use HTTPS for remote agent connections.

## Start locally

Run these commands from the `dynamic-lab-arrengment` project folder. Use two PowerShell terminals and keep both running.

### 1. Start the API

```powershell
$env:API_HOST = "127.0.0.1"
$env:API_PORT = "3001"
$env:CORS_ORIGIN = "http://localhost:5173"
$env:HEARTBEAT_TIMEOUT_SECONDS = "90"
$env:ADMIN_SETUP_TOKEN = "replace-this-with-a-long-random-one-time-value"
npm run api
```

Keep the setup token private; enter the same value in the administrator setup form. The setup screen can create only the first administrator, and only while that account does not exist. Do not expose the local API to a public network without HTTPS, a strong setup token, and institution-approved deployment controls.

The database is created at `.\data\lab-tracker.sqlite` by default. Set `DATABASE_PATH` to use a different location. The database directory is created automatically.

### 2. Start the frontend

In a second PowerShell terminal, from the same project folder:

```powershell
npm run dev
```

Open `http://localhost:5173`. During development, Vite proxies `/api` requests to the local API on port 3001, so the browser does not need direct access to that port. If dependencies are not installed, run `npm install` from this project folder first. The parent folder is not the project root.

The npm scripts call Vite through Node directly so they also work when the project folder path contains `&`. Build with `npm run build`.

## Using the portals

- **Student search** starts matching detected software as you type; choose lab, operating system, or status to apply an additional filter. Use **Clear filters** to reset the search. Workstation lists are paginated; select **View system details** on a workstation to open its complete structured record and search software detected on that system. The detail view also shows other workstations with fresh matches and can be refreshed or reopened directly by its URL.
- **Administrator search** filters workstations and applications as you type. Status filters apply immediately; **Apply filters** submits the current search, and **Clear** removes search and status filters. Use the page controls to move through longer lists.
- In the admin portal, use **Expand all** / **Collapse all** for the currently visible records or open one **Structured details** / **Record details** disclosure. Software records show version, publisher, device, lab, freshness, detection time, and source.
- Open a workstation from its linked ID in the **Workstations** or **System Health** table to view its full structured record and search its reported software inventory.
- **Refresh data** reloads the active page from the API. A visible loading state prevents accidental duplicate submissions.
- Workstation **Maintenance** / **Restore** changes the server-side maintenance flag behind a confirmation dialog; **Rotate token** immediately revokes the old device credential and displays the new one once.
- **Profile** shows your account details. **Edit profile** opens a validated form for name, phone, department, and (for students) semester and section; email and USN/employee ID can only be changed by an administrator. The same page hosts a **Change password** form that signs out every other device.
- **Settings** offers light, dark, and system themes (applied immediately and stored in the browser), a shortcut to change your password, **Sign out of all devices**, and a **Delete account** action behind a typed-confirmation dialog.
- A consistent footer links to static **About**, **Contact**, **Help**, **Privacy Policy**, and **Terms of Service** pages (reachable at `#/about`, `#/contact`, `#/help`, `#/privacy`, `#/terms`; unknown routes show a 404 page).
- The navigation collapses into a toggleable menu on small screens, and the current page is highlighted.

## Accounts

- Use **Administrator setup** to provision the initial authorized administrator with the one-time server environment token.
- Students can register from the sign-in page with their name, college email, USN, phone, department, semester, section, and password.
- Passwords must be at least 12 characters and include uppercase, lowercase, and a number. They are stored as salted bcrypt hashes (cost factor 12).
- Administrator privileges cannot be selected during student registration. Further administrator provisioning requires an authorized operational process; this initial local implementation does not provide public admin invitations.
- Sign out from the navigation menu. Sessions use an HTTP-only cookie and expire after 12 hours; **Sign out of all devices** in Settings revokes every session at once.
- **Forgot password?** on the sign-in page lets a user set a new password with a one-time code. Because this deployment sends no email, an administrator issues the code from **Accounts → Reset password** (valid 30 minutes, shown once); the code and all sessions are invalidated after use.
- **Delete account** (Settings) requires typing `DELETE` and re-entering the password in a confirmation dialog. The account, its sessions, and its password-reset code are removed; audit records are retained with the user reference cleared, and workstation/laboratory data is unaffected. The last remaining administrator account cannot be deleted.

## Register and connect an authorized workstation

1. Sign in as an administrator and open **Workstations**.
2. Register an ID and laboratory. The API displays a device-specific random agent token once. Copy it immediately and store it securely; the server stores only its hash. If a token is exposed or lost, use **Rotate token** on that workstation; this immediately revokes the old token and displays the replacement once.
3. On the institution-authorized workstation, install the agent dependency:

   ```powershell
   python -m pip install -r .\agent\requirements.txt
   ```

4. Configure the identity and token in that workstation's environment. Do not commit the token:

   ```powershell
   $env:LAB_TRACKER_API_URL = "https://your-institution-api.example"
   $env:LAB_TRACKER_WORKSTATION_ID = "PC-014"
   $env:LAB_TRACKER_AGENT_TOKEN = "<device-specific-token>"
   python .\agent\monitor.py
   ```

   For local development only, the API URL can be `http://localhost:3001`. The agent refuses plain HTTP for non-local addresses. Do not silently install the agent: an administrator must authorize the device and approve its deployment.

5. Leave the agent running to send heartbeats about every 20 seconds, health metrics about every 60 seconds, and software inventory at startup and every 30 minutes. Use the institution's approved service/scheduled-task procedure for unattended operation; do not run this service as an administrator unless required by deployment policy.
6. Confirm that heartbeat, inventory, and metric timestamps appear in the administrator pages. To verify offline inference, stop the agent and wait longer than `HEARTBEAT_TIMEOUT_SECONDS`. The next administrator refresh will show the workstation as offline and create an alert.

The Windows scanner reads installed-application uninstall registry entries. Linux scans supported `dpkg` or `rpm` package databases. Portable applications and development environments may not appear. On Windows, an authorized agent running in the active console session reports `In use` or `Idle` from last-input time; when there are no logged-in sessions it reports `Available`. If it runs in a different session (such as many service configurations), it reports `Unknown`. On Linux, no logged-in sessions reports `Available`; a logged-in session remains `Unknown` because this agent does not infer idle state there. CPU utilization is never used to decide whether a computer is in use.

## Configuration

See [.env.example](./.env.example) for the supported API environment variables:

- `API_HOST`, `API_PORT`: API bind address and port.
- `CORS_ORIGIN`: exact Vite origin allowed to make browser requests.
- `HEARTBEAT_TIMEOUT_SECONDS`: threshold after which a missing device is inferred offline (default 90).
- `DATABASE_PATH`: SQLite database location.
- `COOKIE_SECURE`: set to `true` when the frontend/API are served over HTTPS.
- `ADMIN_SETUP_TOKEN`: private, temporary first-admin provisioning token.
- `LAB_TRACKER_IDLE_AFTER_SECONDS`: agent-side Windows input inactivity threshold before reporting `Idle` (default 600).
- `VITE_API_URL`: optional frontend API URL override. In development, the default is same-origin `/api` through the Vite proxy; outside development, the default is `http://localhost:3001`.

Never put administrator setup tokens or device agent tokens in frontend environment variables or source control. The SQLite setup is intended for local development and small controlled demonstrations; institution deployment should use a managed database, HTTPS termination, backups, credential rotation, monitoring, and formal account provisioning.

## API overview

- Authentication: `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/logout-all`, `/api/auth/setup-admin`, `/api/auth/change-password`, `/api/auth/reset-password`, `PATCH /api/auth/profile`, `DELETE /api/auth/account`, `GET /api/auth/me`.
- Student: `GET /api/student/labs`, `/api/student/workstations`, `/api/student/software`.
- Administrator: `GET /api/admin/dashboard`, `/api/admin/workstations`, `/api/admin/alerts`, `/api/admin/reports`, `/api/admin/users`; `POST /api/admin/workstations`, `/api/admin/workstations/:id/rotate-token`, `/api/admin/users/:id/reset-code`; `PATCH /api/admin/workstations/:id`.
- Authorized agent: `POST /api/agent/heartbeat`, `/api/agent/inventory`, `/api/agent/metrics`.

Administrator endpoints require an administrator session; student endpoints require a student session; agent endpoints require a per-device bearer token. Student search only matches software in fresh inventory. The reports endpoint contains current counts only; historical utilization is not yet collected. There is no reservation workflow, real-time push channel, or alert-resolution UI.

## Current implementation limits

- This is a local functional baseline, not a production security certification. Before campus deployment, configure HTTPS, institution identity requirements, operational rate limits, database backups, admin approval, and device credential rotation/revocation.
- Session activity classification depends on the OS and execution session; an `Unknown` device is not shown as available.
- No actual authorized lab computer has been connected or validated in this workspace. Test the agent only on a device approved by the institution.
- Inventory, health, and status are real only after an authorized agent reports them; the application does not seed demonstration workstation records.
