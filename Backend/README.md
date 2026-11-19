# VicanHR backend

Django serves the API, Gunicorn runs Django, and PostgreSQL 17 stores local development data. The current API exposes demo tasks. Payroll imports, calculations, and payslips are planned features.

## First run on macOS

Run the commands below in the **Backend** directory. From the repository root, enter it with `cd Backend`. The Docker image supplies Python and the packages in `requirements.txt`.

1. On a new Mac, install [Homebrew](https://brew.sh/) and follow its shell setup instructions. Then install the local container tools. This step is already complete on the Mac used to set up this repository.

   ```sh
   brew install colima docker docker-compose
   ```

2. Start Colima, which runs Docker on the Mac, then build and start both services.

   ```sh
   colima start
   docker-compose up --build -d
   ```

   The first run downloads a Linux VM and container images. Compose waits for PostgreSQL to become healthy, applies the Django migrations, and starts the API on port 8080.

3. Check the services and query the API.

   ```sh
   docker-compose ps
   curl -fsS -H 'Accept: application/json' http://localhost:8080/api/tasks/
   ```

   A fresh database returns `[]`. You can also open the [tasks API](http://localhost:8080/api/tasks/) in a browser.

## Everyday commands

| Task | Command from Backend |
| --- | --- |
| Start after a reboot | Run `colima start`, then `docker-compose up -d` |
| Apply source or dependency changes | `docker-compose up --build -d` |
| Follow API and database logs | `docker-compose logs -f api db` (Ctrl-C exits the log view) |
| Check Django configuration | `docker-compose exec api python manage.py check` |
| Run the backend tests | `docker-compose exec api python manage.py test` |
| Check applied migrations | `docker-compose exec api python manage.py showmigrations` |
| Open a PostgreSQL session | `docker-compose exec db psql -U vican -d vican` |
| Stop the services | `docker-compose stop` |
| Shut down the local Docker VM | `colima stop` |

The API image contains a copy of the source. Rebuild after edits and include any new Django app directories in the Dockerfile. Compose stores PostgreSQL data in the named volume `payroll_db`. Stopping services preserves data. Removing the volume with `down -v` deletes the local database. The repository's SQLite file belongs to a separate development configuration.

If Docker reports it cannot connect to the daemon, run `colima status` and start Colima. If port 8080 is already occupied, change the host side of the port mapping in `compose.yaml`, run `docker-compose up -d`, and use the new port in the verification URL.

## Planned Google Cloud test environment

Local development incurs no Google Cloud charges. Cloud deployment requires access to a client-owned, billing-enabled project. The following steps describe the proposed deployment. The local setup has been verified and the cloud deployment is pending.

1. Obtain the project ID and deployment permissions from the client administrator. Agree on a region, monthly test budget, and alert recipients. Singapore (`asia-southeast1`) is the proposed region. Include database compute, storage, and backups in the estimate.
2. Build the backend container for Linux AMD64 using the Backend directory as the build context and push it to Artifact Registry. Use a private Cloud Run service for testing.
3. Provision Cloud SQL for PostgreSQL in the chosen region. Create the application database and database user. Grant the Cloud Run service account Cloud SQL Client access and access to its required secrets.
4. Attach the Cloud SQL instance to the Cloud Run service. Configure the variables below for the service and its migration job.
5. Run `python manage.py migrate` in a Cloud Run job using the same image, database connection, credentials, and service account. Verify the job succeeds before sending traffic to the new revision. Local Compose runs migrations automatically. The production image starts Gunicorn directly.
6. Verify the tasks endpoint with authenticated access. Before using real payroll records, configure and test database recovery, restrict payroll access, and use private object storage for uploads. Test payroll generation against a de-identified approved cutoff once that feature is implemented.

| Variable | Cloud setting |
| --- | --- |
| DJANGO_DEBUG | `false` |
| DJANGO_SECRET_KEY | A generated secret supplied through Secret Manager |
| DJANGO_ALLOWED_HOSTS | Approved API hostnames, comma-separated without spaces or URL schemes |
| POSTGRES_DB, POSTGRES_USER | Application database name and database user |
| POSTGRES_PASSWORD | Database user's password supplied through Secret Manager |
| POSTGRES_HOST | For the attached Cloud SQL Unix socket, `/cloudsql/PROJECT:REGION:INSTANCE` |
| POSTGRES_PORT | Defaults to `5432` |

For deployment details, see [Cloud Run connections to PostgreSQL](https://cloud.google.com/sql/docs/postgres/connect-run) and [Cloud SQL pricing](https://cloud.google.com/sql/pricing).

## Upload an attendance summary

Rebuild with `docker-compose up --build -d` to install the workbook reader and apply the attendance migration. For first-time local access, create an administrator with `docker-compose exec api python manage.py createsuperuser`. Open [Import attendance](http://localhost:8080/attendance/upload/), assign the admin or finance application role before signing in, and select the Excel workbook containing the SUMMARY worksheet. The uploader requires the admin or finance application role.

Each import saves the evaluated worksheet values and employee rows together. Reuploading the identical file returns the existing import. A revised workbook for the same branch and period updates matching employee rows and adds new employees. Omitted employees retain their saved hours. Name matching ignores case and extra spaces, with employee numbers distinguishing namesakes. Each distinct workbook is retained as an import record. Repeating an older identical file leaves the current cutoff intact. Save the workbook in Excel after recalculation so formula results are available.

### Frontend JSON upload

POST JSON to `/api/attendance/` with `period`, `detachment`, and an `employees` array. Send the parsed summary branch as the top-level detachment. Each row requires employeeName, detachment (string or null), and the nine camelCase hour fields from the attendance record. employeeNo is an optional string. A null row detachment uses the cutoff scope. A supplied row detachment must match that scope. Null hours are stored as unknown. A revision replaces the complete matching employee row.

Authenticate with an admin or finance account. Session-authenticated browser requests require the session cookie and CSRF token. The response contains cutoffId, status, and employeeCount. New cutoffs return 201, updates and exact retries return 200, and invalid submissions return 400.

## Sample accounts and login API

From Backend, run `docker-compose exec api python manage.py setup_demo_users` to create the local sample users and roles. New accounts require a password. Set each password interactively:

```sh
docker-compose exec api python manage.py changepassword rctabernilla
docker-compose exec api python manage.py changepassword kteruel
docker-compose exec api python manage.py changepassword leviernes
```

The initial assignments are rctabernilla (finance), kteruel (admin), and leviernes (hr). Only admin and finance may submit attendance. The admin application role grants no Django superuser privileges.

For a browser session, GET `/api/auth/csrf/`, then POST `{"username":"kteruel","password":"…","rememberMe":false}` to `/api/auth/login/` with the returned token in `X-CSRFToken`. Send cookies on both requests (Angular `withCredentials: true`). A successful login returns username, roles, and a refreshed csrfToken. Send that token and the session cookie when posting to `/api/attendance/`. Use the same hostname for Angular and Django during local testing.

## SMCO payroll draft

Admin and finance can POST multipart form data to `/api/payroll/drafts/` with two Excel files in the fields `register` and `deductions`. Use the same login and CSRF flow as attendance uploads. GET `/api/payroll/drafts/<draftId>/` retrieves the saved results. Retrying with the same files returns the existing draft.

The calculator reproduces the register's formulas using its hours, rates, manual earnings and deductions. It matches external deductions by normalized employee name within the submitted workbook pair. It returns calculated gross pay, deductions, and net pay with the reference register amounts and differences. Values are calculated with decimals and reported to cents. The SSS amounts come from saved Excel values because the rate table is external. This draft is for reconciliation and uses the payroll register's roster and cutoff. It requires a verified employee mapping before it can use hours from a saved attendance cutoff.

Both draft responses include a `summary` with `employeeCount`, `rowsWithDifferences`, and `rowsWithoutDeductionMatch`. The `calculatedTotals`, `registerTotals`, and `totalDifferences` objects each contain `grossPay`, `totalDeductions`, and `netPay` as two-decimal strings. Totals sum displayed row amounts. Row and total differences subtract the register amount from the calculated amount. Offsetting differences can leave a zero total while individual rows still need review.

Use `employees[].differences` for row comparisons, `employees[].deductionsMatched` to identify missing deductions overrides, and `warnings` for workbook-wide review notes. Older drafts receive the same summary and cent-rounded comparisons when retrieved. See the [frontend handoff](../vicanhr-frontend-handoff.html) for integration and sample acceptance checks.

Each draft employee also has an `issues` array. Each issue has a `code`, `reason`, and recommended `action`. The `register_difference` issue includes a `fields` array naming the affected amounts. A `deductions_match_missing` issue asks the reviewer to verify the workbook match and confirm the deduction source.
