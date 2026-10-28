import { Component, Input, OnInit, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { actionList } from './table-constants'
import {FormControl, ReactiveFormsModule, Validators, FormArray, FormGroup, FormBuilder,} from '@angular/forms'
import { MatFormFieldModule } from '@angular/material/form-field';
import { Subscription } from 'rxjs';
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
  @Input() actionRowsInput: Array<Array<{value: number, isDisabled:boolean}>> = [];
  actionColumnIndex: number = -1;
  actionRows: Array<Array<{imgSrc: string, isDisabled: boolean}>> = [];
  tableRows: Array<Array<string| number| boolean>>= [];
  checkBoxFormGroup!: FormGroup;
  checkAll: boolean = false;
  private fb = inject(FormBuilder);
  allCheckSubsription!: Subscription;
  checkBoxSubsciption!: Array<Subscription>;

  ngOnInit(){
    for (const row of this.rowsInput){
      let rowToAdd: any[] = []
      for (const key of this.getObjectKeys(row)){
        rowToAdd.push(key)
      }
      this.tableRows.push(rowToAdd)
    }
    this.getActionColumn();
    this.getActionRows();
    this.initializeCheckFormGroup();
    this.onChangeCheckBox();
  }

  getObjectKeys<T extends object>(obj: T) {
    return Object.values(obj) as Array<keyof T>;
  }

  getActionColumn(): void {
    this.actionColumnIndex = this.columnsInput.indexOf('Actions');
  }

  initializeCheckFormGroup(): void{
    if(this.includeCheckBox){
      this.checkBoxFormGroup = this.fb.group({
        allCheck: false,
        checkBoxArray : this.fb.array(this.tableRows.map(() => new FormControl(false)))
      })
    }
  }

  get checkBoxArray(){
    return this.checkBoxFormGroup.get('checkBoxArray') as FormArray
  }
  get allCheck(){
    return this.checkBoxFormGroup.get('allCheck') as FormControl
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

  onChangeAllCheckBox(event: Event){
    const checkbox = event.target as HTMLInputElement
    this.checkAll = checkbox.checked
  }

  isAllChecked(){

  }

  onClickAllCheck(value: boolean){
    for(const checkBoxControl of this.checkBoxArray.controls){
      debugger;
      checkBoxControl.setValue(value);
    }
  }

  initializeCheckBoxSubscription(){
    
  }

  onChangeCheckBox(){

    for(const checkBoxControl of this.checkBoxArray.controls){

      checkBoxControl.valueChanges.subscribe((c) => {
        if(this.checkBoxArray.controls.filter((cba: any) => cba.value == true).length == this.rowsInput.length){
          this.allCheck.setValue(true)
        }
        else if(this.checkBoxArray.controls.filter((cba: any) => cba.value == false).length > 0)
        {
          this.allCheck.setValue(false)
        }
      })
    }
  }
}
