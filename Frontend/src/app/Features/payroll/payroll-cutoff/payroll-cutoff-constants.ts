export const statusList = [
    {'value':'1', 'label':'Payroll Ready'},
    {'value':'2', 'label':'For Approval'},
    {'value':'3', 'label':'Needs Attention'},
]

export const demoEmployees = [
    { name: 'Santos, Alex', detachment: 'Demo Detachment', status: 1 },
    { name: 'Reyes, Jamie', detachment: 'Demo Detachment', status: 1 },
    { name: 'Cruz, Morgan', detachment: 'Demo Detachment', status: 2 },
    { name: 'Tabernilla, Ryan', detachment: 'SM Megamall', status: 1 },
    { name: 'Viernes, Lea', detachment: 'Mall of Asia', status: 2 },
    { name: 'Regalado, Jeremy', detachment: 'SM Megamall', status: 3 },
    { name: 'Lopez, Rusty', detachment: 'Mall of Asia', status: 3 },
    { name: 'Raymundo, Carlo', detachment: 'Mall of Asia', status: 2 },
];

export const demoAttentionIssues: Record<string, { reason: string; details: string; action: string }> = {
    'Kukulit, Ryan': {
        reason: 'Duplicate attendance name',
        details: 'Demo DTR rows 12 and 18 both contain “Kukulit, Ryan” under Megabold.',
        action: 'Compare both source rows with the payroll register and confirm which attendance row belongs to this employee.',
    },
    'Babaet, Lea': {
        reason: 'Missing regular hours',
        details: 'Regular hours are blank on row 21 of the demo attendance Summary.',
        action: 'Confirm the regular hours in the source DTR, update the Summary, and re-upload it before finalizing.',
    },
};

export const payrollColumns = [
    'Employee Name', 'Regular Hours', 'Regular Pay', 'Allowance', 'OT Hours', 'OT Pay', 'LH OT Hours', 'LH OT Pay', 'SH OT Hours', 'SH OT Pay', 'ND Hours',
    'ND Pay', 'Uniform Allowance', 'WDO Pay', 'SSS Loan Refund', 'CB Refund', 'SSS Cont. Refund', 'Gross Pay', 'Regular Month', 'SSS EYEE', 'SSS EYER',
    'PhilHealth EYEE', 'PhilHealth EYER', 'SSS Loan Salary', 'SSS Loan Calamity', 'Cash Bond', 'Benlife Insurance', 'Group Insurance', 'Uniform Paraphernalia',
    'Paraphernalia', 'Training', 'Additional PHIC Contribution', 'Additional SSS Contribution', 'Pagibig Contribution', 'SSS Condonation', 'Family Support', 'Training School',
    'License', 'SOGCC-1 Credit Coop', 'SOGCC-2 Credit Coop', 'Total Deductions', 'Net Pay'
]
