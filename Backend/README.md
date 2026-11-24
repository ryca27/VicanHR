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

## Shared development access

Compose publishes Django on the host's loopback interface. A teammate running Angular on a separate machine can reach the same Django instance and PostgreSQL records through the [SSH tunnel setup](../Frontend/README.md#use-a-shared-development-backend). For a separate development database, start this Compose stack on each machine.

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


### Attendance source checks

Send a DTR workbook with a Summary tab or a comma-delimited Summary CSV as multipart `file` to `POST /api/attendance/preview/`. The response contains parsed employee rows and warnings. Send the same file to `POST /api/attendance/` to repeat the checks and save.

Missing employee numbers and unavailable source totals are warnings. For each available source total, discrepancies up to 0.01 hours are warnings and larger discrepancies block the upload. Invalid or missing hours, duplicate or ambiguous rows, and rows with hours or an ID but no name block the upload. Excel imports use the workbook’s saved formula results. Recalculate and save the workbook before importing if formulas are stale or missing results.

Numeric attendance and payroll cells use a decimal point. Grouped commas or spaces and a single `₱` or `PHP` marker are accepted. Payroll accounting parentheses preserve the negative sign. Attendance hours must be nonnegative. Ambiguous separators, percentage text, and other currency markers are rejected. Employee IDs are kept as identifiers.

For an attendance adjustment, include multipart fields `type=attendance_adjustment` and `cutoffId`. The Summary must use the target cutoff’s branch and a different source period. All employees must match existing rows uniquely. One adjustment per source period contributes to a cutoff at a time. A corrected file for that period replaces the previous adjustment.

### Philippine statutory payroll drafts

For a draft that calculates government deductions, add the optional multipart text field `statutoryInputs` to `POST /api/payroll/drafts/`. Send a JSON object alongside the `register` and `deductions` workbooks. Requests with just the two workbooks continue using the register reconciliation mode. The new mode covers regular Philippine private-sector employees on semi-monthly and monthly payrolls using the verified 2025–2026 contribution schedules. Special coverage arrangements and older backpay periods require their own verified schedules.

Example with fictional inputs:

```json
{
  "payDate": "2026-11-30",
  "contributionMonth": "2026-11-01",
  "payFrequency": "semi_monthly",
  "contributionShareThroughCutoff": "1",
  "taxExemptEmployeeTypes": ["security_guard"],
  "employees": [{
    "registerRow": 8,
    "employeeName": "Fictional, Employee",
    "employeeType": "staff",
    "minimumDailyWage": "755.00",
    "wageOrder": "NCR-28",
    "minimumWageEarnerConfirmed": false,
    "sssMonthlyRemuneration": "34400.00",
    "philhealthMonthlyBasicSalary": "30000.00",
    "pagibigMonthlyFundSalary": "30000.00",
    "alreadyDeducted": {"sss": "0", "philhealth": "0", "pagibig": "0"},
    "otherTaxableRegularPay": "0",
    "otherTaxableSupplementaryPay": "0",
    "withholdingMethod": "periodic"
  }]
}
```

Supply a matching register row and employee name for every employee. Choose `security_guard`, `staff`, `driver`, or `other`. The draft applies zero withholding first for any employee type listed in `taxExemptEmployeeTypes`, even if pay or overtime would result in BIR withholding. The list defaults to `["security_guard"]`. Pass `[]` to use BIR treatment for all types. The response records applied treatment and withholding separately from `birComparison`. A conflicting or unavailable comparison raises a draft review issue. The override records the client's draft policy and does not establish a statutory exemption.

For employees outside the exempt list, supply the wage order and daily minimum applicable to the employee's site, sector, and date. Payroll must confirm minimum-wage eligibility where applicable. Above-minimum employees use standard withholding. For the `other` type, supply `otherTaxTreatment` as `standard` or `minimum_wage` for the BIR calculation. The same inputs can be used to generate an informational BIR comparison for exempt types.

Use independently approved monthly bases for SSS, PhilHealth and Pag-IBIG. The contribution share through the cutoff is `0`, `0.5`, or `1`. Subtract contributions already withheld in the same month from the amount due through this cutoff. The monthly schedule requires `1`. The result separates employee deductions and monthly employer liabilities, including employer-only EC.

For standard withholding, the register supplies basic pay and regular overtime. Include any other approved taxable regular and supplementary items in their own fields, or explicitly send zero. Provide the BIR method appropriate to the employee's history. `cumulative` requires `withholdingHistory` with `taxablePay`, `taxWithheld`, and `periodsIncludingCurrent`. `annual` requires the first two fields and is for year-end or final-pay review. Prior totals exclude the current pay period and include applicable previous-employer amounts. Where ordinary period payroll requires the cumulative method because of the amounts involved, the endpoint asks for the approved history. When employee-type exemption takes precedence, it instead marks the BIR comparison as unavailable until the history is supplied. Use the same cumulative method for the remainder of the year where required. The API returns a signed negative withholding amount when annual reconciliation produces a refund.

See [BIR rules on compensation withholding](https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%2011-2018.pdf), [BIR Annex E withholding tables](https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf), [BIR annual income tax rates](https://www.bir.gov.ph/income-tax), [SSS Circular 2024-006](https://www.sss.gov.ph/wp-content/uploads/2024/12/CI-2024-006-Publication.pdf), [PhilHealth premium guidance](https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf), [Pag-IBIG Circular 460](https://dmw.gov.ph/archives/v1/resources/dsms/DMW/ISN-EXT/2025/DMW-ADVISORY-37-2025.pdf), and [NWPC regional wage orders](https://nwpc.dole.gov.ph/summary-of-current-regional-daily-minimum-wage-rates-non-agriculture-agriculture-and-other-wage-categories/).

### Multiple detachments and expense allocation

For one or more employee assignments, add the optional multipart JSON text field `detachmentInputs` to `POST /api/payroll/drafts/`. Supply an entry in `rows` for every register row. The register must have a separate row for each employee, detachment, and applicable rate segment. Entries use:

| Field | Meaning |
|---|---|
| `registerRow`, `employeeName` | Row number and matching name from the register. |
| `employeeId`, `detachment` | Stable employee ID and site name. The same employee ID can repeat for additional sites or rate periods. |
| `workedHours` | Approved actual worked hours used to rank detachments. Leave overlapping premium hours out of this figure. |
| `workFrom`, `workThrough` | Actual work dates covered by this row, inclusive. |
| `basicPayEffectiveFrom`, `basicPayEffectiveThrough` | Approved rate dates, inclusive. Use null or omit the end date for a current rate. |
| `approvedDailyRate` | Approved PHP daily rate for this row. Must match the register's daily rate. |
| `wageOrder`, `minimumDailyWage` | Required on each row when combining multiple rows with statutory mode. They must match the statutory profile for the employee. |
| `sssRemuneration`, `pagibigFundSalary` | Required on each assignment row in grouped statutory mode. Supply that row’s approved eligible earnings for this cutoff, using the actual site hours and rates. These specify the site split, while the employee's approved monthly bases determine the contributions due. |

Blank or null expense amounts count as zero. The highest-hours detachment receives expenses first. Ties use register order. The draft uses available take-home pay after other deductions, then moves any excess to the next detachment. It splits an expense if necessary, keeps any uncovered balance visible for review, and leaves single-detachment expense handling intact. Approved deductions-workbook overrides replace the group's matching expense once. Enter register-only expenses once or distribute them across rows without duplicating the same charge.

With both input fields present, supply one `statutoryInputs` employee profile per employee ID, keyed to that employee's first register row at the highest-hours detachment. Contributions and withholding are calculated once from the approved bases and combined basic pay and regular overtime. The draft splits SSS and Pag-IBIG across assignment rows using their respective site earnings, with rounding that preserves the employee total. Fixed monthly PhilHealth and employee-level withholding are booked on the primary row. The draft applies each row’s allocated contributions before calculating its available pay for expenses. Each grouped row returns `statutoryAllocation`. Mixed wage orders across a grouped employee's rows need a separate payroll review. Without statutory mode, use the approved contribution inputs on each register row.

The saved draft includes `employeeId`, `detachment`, `workedHours`, and `allocatedExpenses` for each row, plus `expenseAllocations` identifying the primary site and any balance. The simple Employee Profile workbook is a client intake file. Its dated assignments can be used to prepare draft inputs.

### Finalized payroll, 13th-month pay, and loans

- For a finalizable draft, send multipart `payrollPeriodDates` as JSON with ISO dates `start` and `end`, along with `detachmentInputs`. Stable employee IDs, work dates, and approved rates must be present for every register row. Split work segments crossing October 31 or December 31 so earnings are assigned to the correct period.
- After reviewing the draft, call `POST /api/payroll/drafts/<draftId>/finalize/`. This saves the draft's earnings, deductions, adjustments, and approval metadata together with each matched loan payment. Repeating the request returns the existing approval without posting payments again. The endpoint rejects overlapping or out-of-order payroll for the same employee, negative take-home amounts, and drafts whose loan calculation became stale. Review any unmatched or uncovered expenses before approval.
- Call `GET /api/payroll/thirteenth-month/<year>/` for finalized basic-pay totals grouped by employee ID across detachments. It shows the **October 31 working estimate**, recorded calendar-year accrual, and the November–December difference. The amount is eligible basic salary earned divided by 12. Overtime, premiums, and deductions are excluded. Payroll should confirm applicable eligibility, any amounts already released, and any earnings not yet recorded in this system. The endpoint does not release payment or generate a government filing. [DOLE 13th-month guidance](https://dole.gov.ph/news/dole-clarifies-13th-month-pay-rules-ensures-workers-receive-rightful-benefits/)
- Create or list loans at `/api/payroll/loans/`. POST JSON with `employeeId`, unique `reference` per employee, `label`, `principal`, `monthlyInstallment`, and ISO `startsOn`. A loan may have an optional `registerColumn` of `AJ` or `AK` to replace the corresponding register amount with the tracked deduction. Once enrolled, that legacy column remains suppressed for the employee after payoff. For other loan types, omit the column and keep the same charge out of the register to avoid double-counting. Multiple loans can have independent principals, installments, and payment histories.
- Each dated draft plans the remaining installment for each loan in the cutoff-end month, capped at the outstanding balance. Expense placement and available-pay limits determine how much can actually be deducted. Finalization records only what the draft deducted against each unique loan. A cleared loan drops out of future automatic deductions, and a partial payment can leave a balance for the next eligible cutoff. For off-payroll payments, POST `reference`, `paymentDate`, and `amount` to `/api/payroll/loans/<loanId>/payments/`. A payment reference can be retried without posting it twice.


The Payroll dashboard links to read-only pages at `/payroll/loans`, `/payroll/thirteenth-month`, and `/payroll/drafts`. The draft list uses `GET /api/payroll/drafts/` for period and status. Draft details use `GET /api/payroll/drafts/<id>/`. Loans and the 13th-month report accept an optional `employeeId` filter.

The **Expenses and Payments** tab opens `/expay`. Its employee overview uses `GET /api/payroll/expense-employees/` with optional `employeeId`, `employeeName`, and `page`. Each ledger employee appears once with their loan types and outstanding balance. A name link opens `/expay/employee?employeeId=...`. Its detail endpoint uses the same employee ID to return matched loan payments and allocated expenses from finalized payroll. Latest finalized payroll supplies the employee name. When recording a loan before the first finalization, send the optional `employeeName` with the stable ID. Existing unnamed accounts remain searchable by ID.
