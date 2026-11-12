//File type list
export const fileTypeList = [
    {'value':'attendance', 'label':'Attendance'},
    {'value':'expenses', 'label':'Expense'},
    {'value':'allowance', 'label':'Allowance'}
]

export const expenseTypeList =[
    {'value':'training', 'label':'Training'},
    {'value':'equipment', 'label':'Equipment'},
]

export const allowanceTypeList = [
    {'value':'allowance', 'label':'Allowance'},
    {'value':'uniformAllowance', 'label':'Uniform Allowance'},
]

export const fileTypeLabel: string = 'File Type';
export const expenseTypeLabel: string = 'Expense Type';
export const allowanceTypeLabel: string = 'Allowance Type';

export const monthMap: Record<string,number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
}