import { Component, Input, Output, EventEmitter, inject, OnInit,DestroyRef  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormControl  } from '@angular/forms';
import { fileTypeList, expenseTypeList } from './upload-constants'
import { form, required, email } from '@angular/forms/signals';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

//Components Import
import { DoubleDatePickerComponent } from './../../../../Components/double-date-picker/double-date-picker'
import { DropdownComponent } from './../../../../Components/dropdown/dropdown'
import { FileBoxComponent } from './../../../../Components/file-box/file-box'
import { ButtonComponent } from '../../../../Components/button/button';


@Component({
  imports: [CommonModule, ReactiveFormsModule, DoubleDatePickerComponent, DropdownComponent, FileBoxComponent, MatIconModule, MatButtonModule, ButtonComponent],
  selector: 'upload-modal',
  styleUrl: './upload.scss',
  templateUrl: './upload.html',
})
export class UploadModal implements OnInit {
  constructor(){
  }
  private fb = inject(FormBuilder)
  private destroyRef = inject(DestroyRef)

  @Input() isOpen = false;
  @Input() title = '';
  @Input() startDate: string ='';
  @Input() endDate: string ='';
  @Output() closeEvent = new EventEmitter<void>();
  

  public fileTypeOptions = fileTypeList; 
  public expenseTypeOptions = expenseTypeList;
  public fileTypeLabel: string = 'File Type'
  public expenseTypeLabel: string = 'Expense Type'
  // uploadFormGroup = this.fb.group({
  //   startDate: this.startDate,
  //   endDate: this.endDate,
  //   uploadFileArray: this.fb.array([this.createUploadFileGroup()])
  // })
  uploadFormGroup!: FormGroup

  closeUploadModal() {
    this.isOpen = false;
    this.closeEvent.emit();
    this.uploadFormGroup.reset();
    this.uploadFileArray.clear();
    this.uploadFileArray.push(this.createUploadFileGroup());
    debugger;
  }
  ngOnInit(){
    this.uploadFormGroup = this.fb.group({
      startDate: this.startDate,
      endDate: this.endDate,
      uploadFileArray: this.fb.array([this.createUploadFileGroup()])
    })
  }

  createUploadFileGroup(): FormGroup{
    let group = this.fb.group({
      fileType:['', Validators.required],
      expenseType:['',],
      fileName:['', Validators.required],
      fileContent:['', Validators.required]
    })
    this.uploadFileGroupListener(group);
    return group
  }

  addUploadFileGroup(): void {
    let newForm = this.createUploadFileGroup();
    this.uploadFileArray.push(newForm);
  }

  removeFileGroup(i: number){
    this.uploadFileArray.removeAt(i)
  }

  uploadFileGroupListener(group: FormGroup) {
    group.get('fileType')?.valueChanges.
      pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((newValue: string) => {
        if(newValue=='expenses'){
          group.get('expenseType')?.setValidators([Validators.required])
          group.get('expenseType')?.updateValueAndValidity();
        }
        else{
          group.get('expenseType')?.clearValidators()
          group.get('expenseType')?.updateValueAndValidity();
        }
    })
  }
  get uploadFileArray(): FormArray {
    return this.uploadFormGroup.get('uploadFileArray') as FormArray;
  }
  get formControl(): FormArray {
    return this.uploadFileArray
  }

  submitForm(){
    debugger;
  }
  validateInput(){
    debugger;
  }

  //Double date picker output listener
  startDateOutputListener(message:string){
    this.uploadFormGroup.controls['startDate'].setValue(message)
  }
  endDateOutputListener(message:string){
    this.uploadFormGroup.controls['endDate'].setValue(message)
  }

  //File box output listener
  fileContentOutputListener(message:string, i:number){
    debugger;
    this.uploadFileArray.at(i).get('fileContent')?.setValue(message)
  }
  fileNameOutputListener(message:string, i:number){
    debugger;
    this.uploadFileArray.at(i).get('fileName')?.setValue(message)
  }
}
