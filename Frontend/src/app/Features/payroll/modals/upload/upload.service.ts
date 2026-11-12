
import { Injectable } from '@angular/core';
import {AttendanceUpload, AttendanceRecord, AttendanceParseResult,} from './upload.models'
import { monthMap} from './upload-constants'
import * as Papa from 'papaparse';

@Injectable({
  providedIn: 'root'
})
export class UploadService {

    sample(csvText: string): {
        payrollPeriod: string;
        employees: AttendanceUpload[];
        errors: string[];
      } {
    
        // Step 1: Convert CSV string into rows
        const result = Papa.parse<string[]>(csvText, {
          delimiter: ',',
          skipEmptyLines: false,
          dynamicTyping: false
        });
    
        if (result.errors.length > 0) {
          throw new Error(
            result.errors.map(e => e.message).join('; ')
          );
        }
    
        const rows = result.data;
        const errors: string[] = [];
    
        // Step 2: Extract payroll period
        const periodRow = rows.find(row =>
          row.some(cell =>
            cell.toLowerCase().includes('payroll period:')
          )
        );
    
        const labelIndex = periodRow?.findIndex(cell =>
          cell.toLowerCase().includes('payroll period:')
        ) ?? -1;
    
        const payrollPeriod =
          periodRow && labelIndex >= 0
            ? periodRow.slice(labelIndex + 1)
                .find(cell => cell.trim() !== '')?.trim() ?? ''
            : '';
    
        // Step 3: Convert payroll values into numbers
        const parseNumber = (
          value: string | undefined,
          rowNumber: number,
          field: string
        ): number | null => {
    
          const text = (value ?? '').trim();
    
          // Blank or dash means no reported value
          if (!text || /^[-–—]$/.test(text)) {
            return null;
          }
    
          // Detect Excel formula errors
          if (text.startsWith('#')) {
            errors.push(
              `Row ${rowNumber}: ${field} contains ${text}`
            );
            return null;
          }
    
          // Remove thousand separators and whitespace
          const cleaned = text.replace(/[,\s₱]/g, '');
          const number = Number(cleaned);
    
          if (!Number.isFinite(number)) {
            errors.push(
              `Row ${rowNumber}: Invalid ${field}: ${text}`
            );
            return null;
          }
    
          return number;
        };
    
        // Step 4: Extract employee records
        const employees: AttendanceUpload[] = [];
    
        rows.forEach((row, index) => {
    
          const employeeNo = (row[1] ?? '').trim();
          const employeeName = (row[2] ?? '').trim();
    
          // Skip titles, headers, detachment labels,
          // blank rows and total rows.
          if (!/^\d+$/.test(employeeNo) || !employeeName) {
            return;
          }
    
          const num = (column: number, field: string) =>
            parseNumber(row[column], index + 1, field);
    
          employees.push({
            detachment: (row[0] ?? '').trim(),
            employeeNo,
            employeeName,
    
            regularRate: num(3, 'Regular Rate'),
            regularHours: num(4, 'Regular Hours'),
            regularPay: num(5, 'Regular Pay'),
    
            overtimeHours: num(7, 'Overtime Hours'),
            overtimePay: num(9, 'Overtime Pay'),
    
            grossPay: num(28, 'Gross Pay'),
    
            sssEmployee: num(31, 'SSS Employee'),
            sssEmployer: num(32, 'SSS Employer'),
    
            philhealthEmployee: num(33, 'PhilHealth Employee'),
            philhealthEmployer: num(34, 'PhilHealth Employer'),
    
            cashBond: num(37, 'Cash Bond'),
            training: num(43, 'Training'),
            pagibig: num(46, 'Pag-IBIG'),
    
            totalDeductions: num(56, 'Total Deductions'),
            netPay: num(57, 'Net Pay'),
    
            // Preserve every original column
            rawCells: row
          });
        });
    
        return {
          payrollPeriod,
          employees,
          errors
        };
      }

    
      parseAttendace(csvText: string): AttendanceParseResult {

        // Detect CSV or tab-separated input.
        const headerLine = csvText.split(/\r?\n/).find(line =>
          line.includes('EMPLOYEE NO.') &&
          line.includes('EMPLOYEE NAME')
        );
    
        const delimiter = headerLine?.includes('\t')
          ? '\t'
          : ',';
    
        const parsed = Papa.parse<string[]>(csvText, {
          delimiter,
          skipEmptyLines: 'greedy',
          dynamicTyping: false
        });
    
        const rows = parsed.data;
    
        const errors: string[] = parsed.errors.map(error =>
          `CSV row ${error.row !== undefined ? error.row + 1 : 'Unknown'}: ${error.message}`
        );
    
        // Normalize headers, including multiline headers.
        const normalize = (value: string): string =>
          value.trim().replace(/\s+/g, ' ').toUpperCase();
    
        // Extract metadata from the top section.
        const getMetadata = (label: string): string | null => {
          for (const row of rows) {
            const index = row.findIndex(cell =>
              normalize(cell).replace(/:$/, '') === label
            );
    
            if (index !== -1) {
              return row.slice(index + 1)
                .find(cell => cell.trim() !== '')
                ?.trim() ?? null;
            }
          }
    
          return null;
        };
    
        const agency = getMetadata('NAME OF AGENCY');
        const branch = getMetadata('BRANCH');
        const address = getMetadata('ADDRESS');
        const period = getMetadata('PERIOD');
    
        // Find the actual attendance table header.
        const headerIndex = rows.findIndex(row =>
          row.some(cell => normalize(cell) === 'EMPLOYEE NAME') &&
          row.some(cell => normalize(cell) === 'TOTAL REG HRS') &&
          row.some(cell => normalize(cell) === 'TOTAL OT HRS') 
          // row.some(cell => normalize(cell) === 'TOTAL ND HRS') &&
          // row.some(cell => normalize(cell) === 'TOTAL WDO') &&
          // row.some(cell => normalize(cell) === 'BTR HRS') &&
          // row.some(cell => normalize(cell) === 'TOTAL LH') &&
          // row.some(cell => normalize(cell) === 'TOTAL LH OT') &&
          // row.some(cell => normalize(cell) === 'TOTAL SH') &&
          // row.some(cell => normalize(cell) === 'TOTAL SH OT')
        );
    
        if (headerIndex === -1) {
          return {
            agency,
            branch,
            address,
            period,
            totalEmployees: 0,
            employees: [],
            errors,
            validationError: 'Attendance Header row not found'
          }
          throw new Error('Attendance header row not found.');
        }
    
        const headers = rows[headerIndex].map(normalize);
    
        // Resolve column positions by header name.
        const expectedHeaders = {
          employeeNo: 'EMPLOYEE NO.',
          employeeName: 'EMPLOYEE NAME',
          regularHours: 'TOTAL REG HRS',
          overtimeHours: 'TOTAL OT HRS',
          nightDifferentialHours: 'TOTAL ND HRS',
          wdoHours: 'TOTAL WDO',
          btrHours: 'BTR HRS',
          legalHolidayHours: 'TOTAL LH',
          legalHolidayOtHours: 'TOTAL LH OT',
          specialHolidayHours: 'TOTAL SH',
          specialHolidayOtHours: 'TOTAL SH OT'
        };
    
        const columns = {} as Record<
          keyof typeof expectedHeaders,
          number
        >;
    
        for (const key of Object.keys(expectedHeaders) as
          (keyof typeof expectedHeaders)[]) {
    
          const index = headers.indexOf(expectedHeaders[key]);
    
          if (index === -1) {
            return {
              agency,
              branch,
              address,
              period,
              totalEmployees: 0,
              employees: [],
              errors,
              validationError: `Missing required column: ${expectedHeaders[key]}`
            }
            throw new Error(
              `Missing required column: ${expectedHeaders[key]}`
            );
          }
    
          columns[key] = index;
        }
    
        // Parse an attendance hour value.
        const toNumber = (
          value: string | undefined,
          rowNumber: number,
          field: string
        ): number | null => {
    
          const text = (value ?? '').trim();
    
          if (!text) {
            errors.push(`Row ${rowNumber}: Missing ${field}`);
            return null;
          }
    
          const number = Number(text.replace(/,/g, ''));
    
          if (!Number.isFinite(number) || number < 0) {
            errors.push(
              `Row ${rowNumber}: Invalid ${field}: ${text}`
            );
            return null;
          }
    
          return number;
        };
    
        const employees: AttendanceRecord[] = [];
    
        // Process rows after the header.
        rows.slice(headerIndex + 1).forEach((row, index) => {
    
          const sourceRow = headerIndex + index + 2;
    
          // First column is the row number (1, 2, 3...).
          const rowNumberText = (row[0] ?? '').trim();
    
          // Skip blank, summary, and non-employee rows.
          if (!/^\d+$/.test(rowNumberText)) {
            return;
          }
    
          const employeeName =
            (row[columns.employeeName] ?? '').trim();
    
          if (!employeeName) {
            errors.push(
              `Row ${sourceRow}: Missing employee name`
            );
            return;
          }
    
          const employeeNoText =
            (row[columns.employeeNo] ?? '').trim();
    
          const employeeNo =
            !employeeNoText ||
            employeeNoText.toUpperCase() === 'N/A'
              ? null
              : employeeNoText;
    
          const hours = (
            column: number,
            field: string
          ): number | null =>
            toNumber(row[column], sourceRow, field);
    
          employees.push({
            employeeNo,
            employeeName,
    
            regularHours: hours(
              columns.regularHours, 'Regular Hours'
            ),
    
            overtimeHours: hours(
              columns.overtimeHours, 'OT Hours'
            ),
    
            nightDifferentialHours: hours(
              columns.nightDifferentialHours, 'ND Hours'
            ),
    
            wdoHours: hours(
              columns.wdoHours, 'WDO Hours'
            ),
    
            btrHours: hours(
              columns.btrHours, 'BTR Hours'
            ),
    
            legalHolidayHours: hours(
              columns.legalHolidayHours, 'LH Hours'
            ),
    
            legalHolidayOtHours: hours(
              columns.legalHolidayOtHours, 'LH OT Hours'
            ),
    
            specialHolidayHours: hours(
              columns.specialHolidayHours, 'SH Hours'
            ),
    
            specialHolidayOtHours: hours(
              columns.specialHolidayOtHours, 'SH OT Hours'
            )
          });
        });
    
        return {
          agency,
          branch,
          address,
          period,
          totalEmployees: employees.length,
          employees,
          errors,
          validationError: ''
        };
      }

      dateRangeConverter(dateStr: string): Date[]{
        if (dateStr==''){
          return [new Date('2000-01-01'), new Date('2000-01-01')];
        }
        let month = monthMap[dateStr.slice(0, dateStr.indexOf(' ')).trim().toLowerCase()];
        let startDay = dateStr.slice(dateStr.indexOf(' ')+ 1, dateStr.indexOf('-'));
        let endDay = dateStr.slice(dateStr.indexOf('-')+ 1, dateStr.indexOf(','));
        let year = dateStr.slice(-4);

        let startDate = new Date(`${year}-${month}-${startDay}`);
        let endDate = new Date(`${year}-${month}-${endDay}`)
        return [startDate, endDate];
      }
}
