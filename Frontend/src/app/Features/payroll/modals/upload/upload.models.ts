export interface AttendanceUpload {
    detachment: string;
    employeeNo: string;
    employeeName: string;
  
    regularRate: number | null;
    regularHours: number | null;
    regularPay: number | null;
  
    overtimeHours: number | null;
    overtimePay: number | null;
  
    grossPay: number | null;
  
    sssEmployee: number | null;
    sssEmployer: number | null;
    philhealthEmployee: number | null;
    philhealthEmployer: number | null;
    pagibig: number | null;
  
    cashBond: number | null;
    training: number | null;
  
    totalDeductions: number | null;
    netPay: number | null;
  
    rawCells: string[];
  }

  export interface AttendanceRecord {
    employeeNo?: string | null;
    employeeName: string;
    regularHours: number | null;
    overtimeHours: number | null;
    nightDifferentialHours: number | null;
    wdoHours: number | null;
    btrHours: number | null;
    legalHolidayHours: number | null;
    legalHolidayOtHours: number | null;
    specialHolidayHours: number | null;
    specialHolidayOtHours: number | null;
  }

  export interface AttendanceParseResult {
    agency: string | null;
    branch: string | null;
    address: string | null;
    period: string | null;
    totalEmployees: number;
    employees: AttendanceRecord[];
    errors: string[];
    validationError: string;
  }

  export interface UploadValidation {
    isShown: boolean;
    isAccepted: boolean;
    message: string;
  }

  export interface Upload {
    attendance: AttendanceParseResult[];
    expense: AttendanceParseResult[];
    allowance: AttendanceParseResult[];
  }