# VicanHR

VicanHR is a local development app for importing attendance, reviewing saved cutoffs, and reconciling payroll drafts against Excel registers. Angular runs in the browser, Django serves the API and admin pages, and PostgreSQL stores local data.

## Start locally

Run the commands from your checkout of this repository. You’ll need Docker with Compose and a Node.js version supported by the Angular CLI in this project. Node.js 26 and npm 11 match the development setup.

### 1. Start Django and PostgreSQL

Start your Docker engine first. If you use Colima on macOS, run `colima start`. See the [backend setup guide](Backend/README.md#first-run-on-macos) for installing the macOS tools.

From the repository root:

```sh
docker-compose -f Backend/compose.yaml up --build -d
docker-compose -f Backend/compose.yaml ps
curl -fsS -H 'Accept: application/json' http://localhost:8080/api/tasks/
```

If Compose is installed as a Docker CLI plugin, use `docker compose` in place of `docker-compose` throughout this guide. Compose starts PostgreSQL, runs the Django migrations, and serves the API on port 8080. The tasks endpoint returns `[]` on an empty database.

### 2. Create a local sign-in

From the repository root, create the sample accounts and set a local password for the finance user:

```sh
docker-compose -f Backend/compose.yaml exec api python manage.py setup_demo_users
docker-compose -f Backend/compose.yaml exec api python manage.py changepassword rctabernilla
```

Sign in as `rctabernilla` using the password you just set. You can also set a password for `kteruel` (application admin) or `leviernes` (HR). Attendance and payroll draft APIs require the finance or admin application role.

Django’s admin console requires a staff account. For local access, create a superuser with `docker-compose -f Backend/compose.yaml exec api python manage.py createsuperuser`.

### 3. Start Angular

Open a second terminal at the repository root:

```sh
cd Frontend
npm ci
npm start -- --host 127.0.0.1 --port 4200
```

Leave this terminal running and open the [Angular sign-in page](http://localhost:4200/login). Use port 4200 for all browser links below. Angular serves the project documentation and proxies the Django API, admin, and attendance uploader to port 8080 using the [development proxy](Frontend/proxy.conf.cjs). Restart Angular to refresh its documentation snapshot.

## Test from another machine

For your own PostgreSQL database, follow the local setup above on your machine.
To work with the same saved cutoffs, drafts, and employee history as the host,
run Angular locally and connect it to the host's Django backend using the
[shared backend setup](Frontend/README.md#use-a-shared-development-backend).

## Local pages

Open these links in a browser on the machine running the services.

| Page | Local URL | What to try |
| --- | --- | --- |
| Angular sign-in | [localhost:4200/login](http://localhost:4200/login) | Sign in with your local finance account. |
| Payroll dashboard | [localhost:4200/payroll](http://localhost:4200/payroll) | Upload an attendance Summary CSV or Excel workbook and open the saved cutoff. |
| Demo payroll cutoff | [localhost:4200/cutoff/demo](http://localhost:4200/cutoff/demo) | Try Finalize, Undo Finalize, and PDF payslips using fictional data. |
| Saved attendance and cutoff | [Attendance example](http://localhost:4200/attendance/1) · [Cutoff example](http://localhost:4200/cutoff/1) | Replace `1` with the cutoff ID returned after an upload. A fresh database has no saved cutoffs. |
| Django attendance uploader | [localhost:4200/attendance/upload/](http://localhost:4200/attendance/upload/) | Sign in with the finance or admin application role and upload an attendance workbook. |
| Django admin | [localhost:4200/admin/](http://localhost:4200/admin/) | Sign in with a Django staff account. |
| Django tasks API | [localhost:4200/api/tasks/](http://localhost:4200/api/tasks/) | Check whether Django is responding. |
| Project summary and handoff | [Summary](http://localhost:4200/vicanhr-update.html) · [Frontend handoff](http://localhost:4200/vicanhr-frontend-handoff.html) | Review the current workflow and API contracts. |

## Backend API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/auth/csrf/` | Get a CSRF token. |
| POST | `/api/auth/login/` | Start a Django session. |
| POST | `/api/attendance/preview/` | Preview the Summary rows from a multipart upload in the `file` field. |
| GET, POST | `/api/attendance/` | List saved cutoffs or submit attendance as JSON. |
| GET | `/api/attendance/<cutoffId>/` | Read a cutoff and its employee hours. |
| POST | `/api/payroll/drafts/` | Create a reconciliation draft from multipart fields `register` and `deductions`. |
| GET | `/api/payroll/drafts/<draftId>/` | Read a saved draft with totals, employee differences, and warnings. |
| GET, POST | `/api/tasks/` | List or create demo tasks. |

Send the session cookie and CSRF token for session-authenticated POST requests. See the [backend guide](Backend/README.md#sample-accounts-and-login-api) for the login flow and [payroll draft contract](Backend/README.md#smco-payroll-draft) for request and response details. The [Django URL configuration](Backend/config/urls.py) points to the handlers.

If you have the SMCO sample workbooks, use the **DTR** file for attendance and the **PAYROLL** and **DEDUCTIONS** files together for reconciliation. The payroll draft review is available through the API. The [frontend handoff](vicanhr-frontend-handoff.html) covers the upload and review UI still to build, along with the sample acceptance checks.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Port 4200 won’t open | Check that `npm start` is still running in the frontend terminal. Open [the sign-in page](http://localhost:4200/login) on the machine running Angular. |
| Port 8080 won’t open | Run `docker-compose -f Backend/compose.yaml ps` and `docker-compose -f Backend/compose.yaml logs --tail=50 api db`. Check that the Docker engine is running. |
| Angular opens but API calls fail | Run `curl -fsS http://localhost:4200/api/auth/csrf/`. A JSON response containing `csrfToken` verifies the proxy connection. For a 403 on attendance or payroll, also check your session and application role. |
| Backend changes haven’t appeared | Run `docker-compose -f Backend/compose.yaml up --build -d api`. The container image includes a copy of the Django source. |

See the [frontend README](Frontend/README.md) for Angular commands and the [backend README](Backend/README.md) for Django and database commands. Open `vicanhr-update.html` from your checkout in a browser to view the [development summary](vicanhr-update.html) and its local page links.
