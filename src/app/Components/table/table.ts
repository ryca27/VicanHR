import { Component, Input, OnInit, inject, OnChanges, DestroyRef, Output, EventEmitter } from '@angular/core';
import { NgClass } from '@angular/common';
import { actionList, CheckBoxOutputInterface } from './table-constants'
import {FormControl, ReactiveFormsModule, Validators, FormArray, FormGroup, FormBuilder,} from '@angular/forms'
import { MatFormFieldModule } from '@angular/material/form-field';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Component({
  selector: 'app-table',
  imports: [NgClass, MatFormFieldModule, ReactiveFormsModule],
  templateUrl: './table.html',
  styleUrl: './table.scss',
})


export class TableComponent implements OnInit {
  @Input() columnsInput: String[] = []
  @Input() rowsInput: any[] = [];
  @Input() includeCheckBox: boolean = false;
  @Input() rowsIdInput: Array<string> = [];
  @Input() includeStatus: boolean = false;
  @Input() actionRowsInput: Array<Array<{value: number, isDisabled:boolean}>> = [];
  @Output() checkBoxOutput: EventEmitter<Array<string>> = new EventEmitter<Array<string>>();
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef); 
  actionColumnIndex: number = -1;
  statusColumnIndex: number = -1;
  displayIndex: number = 1 ;
  actionRows: Array<Array<{imgSrc: string, isDisabled: boolean}>> = [];
  idRows: Array<string> = [];
  tableRows: Array<Array<string| number| boolean>>= [];
  tableRowsDisplay: Array<Array<string| number| boolean>>= [];
  tableFormGroup!: FormGroup;
  checkAll: boolean = false;
  

  //Pagination Variables
  pageSize: number = 3;
  currentPage: number = 1;
  pageArray: number[] = [];


  ngOnInit(){
    this.getTableRows;
    this.getActionColumn();
    this.getStatusColumn();
    this.getActionRows();
    this.initializeTableFormGroup();
    if(this.includeCheckBox){
      this.onChangeCheckBox();
    }
    
    this.getPageArray(this.pageSize);
    this.getDisplayByPageNumber();
  }

  ngOnChanges(){
    this.getTableRows();
    this.reloadTable();
    this.initializeTableFormGroup();
    if(this.includeCheckBox){
      this.onChangeCheckBox();
    }
    
  }

  getTableRows(){
    this.tableRows = [];
    for (const row of this.rowsInput){
      let rowToAdd: any[] = []
      for (const key of this.getObjectKeys(row)){
        rowToAdd.push(key)
      }
      this.tableRows.push(rowToAdd);
    }
  }

  getObjectKeys<T extends object>(obj: T) {
    return Object.values(obj) as Array<keyof T>;
  }

  getActionColumn(): void {
    this.actionColumnIndex = this.columnsInput.indexOf('Actions');
  }

  getStatusColumn(): void {
    this.statusColumnIndex = this.columnsInput.indexOf('Status');
  }

  initializeTableFormGroup(): void{
    let formArray = []
    const startingIndex = (this.currentPage-1)*this.pageSize;
    const endingIndex = (this.currentPage*this.pageSize) > this.rowsIdInput.length ? this.rowsIdInput.length: (this.currentPage*this.pageSize);
    if(this.includeCheckBox){
      for(const i of this.rowsIdInput.slice(startingIndex,endingIndex)){
        let group = this.createCheckBoxFormGroup(i);
        formArray.push(group);
      }
    }
    else{
      for(const i of this.rowsIdInput){
        let group = this.createIdFormGroup(i);
        formArray.push(group);
      }
    }
    
    this.tableFormGroup = this.fb.group({
      allCheck: false,
      tableFormArray : this.fb.array(formArray)
    })
    
  }

  createCheckBoxFormGroup(id: string): FormGroup{
    let group = this.fb.group({
      isChecked: [false],
      id: [id]
    })
    return group;
  }

  createIdFormGroup(id: string): FormGroup{
    let group = this.fb.group({
      id:[id]
    })
    return group;
  }

  getActionRows(){
    for (const rowArray of this.actionRowsInput){
      let rowToAdd = [];
      for(const row of rowArray){
        let actionToAppend: {imgSrc: string, isDisabled: boolean} = {
          imgSrc : actionList.filter(a => a.value == row.value)[0].imgSrc,
            isDisabled: row.isDisabled
        }
        rowToAdd.push(actionToAppend)
      }
      
      this.actionRows.push(rowToAdd);
    }
  }

  //CheckBox functions
  get tableFormArray(): FormArray{
    
    return this.tableFormGroup?.get('tableFormArray') as FormArray
  }
  get allCheck(){
    return this.tableFormGroup?.get('allCheck') as FormControl
  }

  get tableFormArrayDisplay(): FormArray{
    const startingIndex = (this.currentPage-1)*this.pageSize;
    const  endingIndex = this.currentPage*this.pageSize;
    const formArray = this.fb.array(this.tableFormArray.controls.slice(startingIndex,endingIndex))
    return formArray
  }


  onClickAllCheck(value: boolean){
    for(const control of this.tableFormArray.controls){
      control.get('isChecked')?.setValue(value);
    }
  }

  onChangeCheckBox(){
    this.tableFormArray.valueChanges
    .pipe(
      takeUntilDestroyed(this.destroyRef) 
    )
    .subscribe((formArrayValue) => {
      const totalRows = this.tableRowsDisplay.length;
      
      const checkedCount = (this.tableFormArray.controls as FormGroup[]).filter(t => {
        return t.controls['isChecked']?.value === true && !t.disabled;
      }).length;
      let idArray = formArrayValue.filter((f: CheckBoxOutputInterface)=> f.isChecked).map((f: CheckBoxOutputInterface) => {return f.id})
      this.checkBoxOutput.emit(idArray);

      if (checkedCount === totalRows) {
        this.allCheck.setValue(true, { emitEvent: false });
      } else {
        this.allCheck.setValue(false, { emitEvent: false });
      }

    });
  }
  //End of CheckBox functions

  //Pagination Functions
  getPageArray(rowPerPage: number): void {
    this.pageArray = Array.from({length: Math.ceil(this.tableRows.length/rowPerPage)}, (_,index) => index + 1);
  }

  getIdArray(rowPerPage: number): void {
  }

  movePageNumber(page: number): void {
    this.currentPage = page;
    this.getDisplayByPageNumber();
    this.initializeTableFormGroup();
    if(this.includeCheckBox){
      this.onChangeCheckBox();
    }
  }

  decreasePageNumber(): void{
    this.currentPage > 1 ? this.currentPage -= 1 : '';
    this.getDisplayByPageNumber();
  }

  increasePageNumber(): void{
    this.currentPage < this.pageArray.length ? this.currentPage +=1 :'';
    this.getDisplayByPageNumber();
  }

  getDisplayByPageNumber(): void {
    let startingIndex = (this.currentPage-1)*this.pageSize;
    let endingIndex = this.currentPage*this.pageSize;
    this.displayIndex = startingIndex;
    this.tableRowsDisplay = this.tableRows.slice(startingIndex,endingIndex);
    this.allCheck?.setValue(false, { emitEvent: false });
    // this.disableIsCheckedFormControl();
  }
  disableIsCheckedFormControl(): void{
    let startingIndex = (this.currentPage-1)*this.pageSize;
    // let endingIndex = (this.currentPage*this.pageSize) -1 == this.tableFormArray?.controls.length ? (this.currentPage*this.pageSize) -1 : this.tableFormArray?.controls.length
    let endingIndex = (this.currentPage*this.pageSize) -1;
    this.displayIndex = startingIndex;
    this.tableFormArray?.controls.forEach((form, index) => {
      form.get('isChecked')?.setValue(false, {emitEvent: false})
      if((startingIndex <= index) &&( index <= endingIndex)){
        form.get('isChecked')?.enable();
      }
      else{
        form.get('isChecked')?.disable();
      }
    })
  }

  reloadTable(){
    // this.checkBoxArray.disable();
    this.currentPage = 1;
    this.getDisplayByPageNumber();
    this.disableIsCheckedFormControl();
    this.getPageArray(this.pageSize);
    this.allCheck?.setValue(false, { emitEvent: false });
  }
}
