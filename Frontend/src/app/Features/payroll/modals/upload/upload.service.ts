
import { Injectable } from '@angular/core';
import {AttendanceUpload, AttendanceRecord, AttendanceParseResult,} from './upload.models'
import { monthMap} from './upload-constants'
import * as Papa from 'papaparse';

@Injectable({
  providedIn: 'root'
})
export class UploadService {    
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
            detachment: branch,
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
