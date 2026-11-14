import { Component, Input, Output, EventEmitter, inject, OnInit,DestroyRef  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormControl  } from '@angular/forms';
import { fileTypeList, expenseTypeList, allowanceTypeList, expenseTypeLabel, allowanceTypeLabel, fileTypeLabel } from './upload-constants'
import { form, required, email } from '@angular/forms/signals';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

//Components Import
import { DoubleDatePickerComponent } from './../../../../Components/double-date-picker/double-date-picker'
import { DropdownComponent } from './../../../../Components/dropdown/dropdown'
import { FileBoxComponent } from './../../../../Components/file-box/file-box'
import { ButtonComponent } from '../../../../Components/button/button';
import { UploadService} from './upload.service'
import { AttendanceParseResult, UploadValidation, Upload } from './upload.models';


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
  private uploadService = inject(UploadService);

  @Input() isOpen = false;
  @Input() title = '';
  @Input() startDate: string ='';
  @Input() endDate: string ='';
  @Output() isSubmit = new EventEmitter<boolean>();
  @Output() dataUploadOutput: EventEmitter<Upload> = new EventEmitter<Upload>();
  
  public fileTypeOptions = fileTypeList; 
  public expenseTypeOptions = expenseTypeList;
  public allowanceOptions = allowanceTypeList;
  public fileTypeLabel: string = fileTypeLabel;
  public expenseTypeLabel: string = expenseTypeLabel;
  public allowanceTypeLabel: string = allowanceTypeLabel;
  public validatedInputList: AttendanceParseResult[] = [];
  public uploadValidationList: UploadValidation[] = [];
  public upload: Upload = {attendance: [], expense: [], allowance: []};
  uploadFormGroup!: FormGroup
  isDisabledUpload: boolean = true;

  ngOnInit(){
    this.uploadFormGroup = this.fb.group({
      startDate: this.startDate,
      endDate: this.endDate,
      uploadFileArray: this.fb.array([this.createUploadFileGroup()])
    })
    this.addUploadValidation();
  }

  createUploadFileGroup(): FormGroup{
    let group = this.fb.group({
      fileType:['', Validators.required],
      expenseType:['',],
      allowanceType: [''],
      fileName:['', Validators.required],
      fileContent:['', Validators.required],
      file: [File]
    })
    this.uploadFileGroupListener(group);
    return group
  }

  addUploadValidation(): void{
    let uploadValidation: UploadValidation = {
      isAccepted: false,
      isShown: false,
      message:''
    }
    this.uploadValidationList.push(uploadValidation);
  }

  addUploadFileGroup(): void {
    let newForm = this.createUploadFileGroup();
    this.uploadFileArray.push(newForm);
    this.addUploadValidation();
    this.isDisabledUpload = true;
  }

  removeFileGroup(i: number){
    this.uploadFileArray.removeAt(i);
    this.uploadValidationList = this.uploadValidationList.filter((_, index) => index !== i);
    this.isDisabledUpload = this.uploadValidationList.filter(u=> !u.isAccepted).length > 0 ? true: false;
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
  closeUploadModal() {
    this.isOpen = false;
    this.isSubmit.emit(false);
    this.uploadFormGroup.reset();
    this.uploadFileArray.clear();
    this.uploadFileArray.push(this.createUploadFileGroup());
  }

  get uploadFileArray(): FormArray {
    return this.uploadFormGroup.get('uploadFileArray') as FormArray;
  }
  get formControl(): FormArray {
    return this.uploadFileArray
  }

  submitForm(){
    this.isOpen = false;
    this.isSubmit.emit(true);
    this.dataUploadOutput.emit(this.upload)
  }
  validateInput(){
    //Remove all data inside upload
    this.upload = {attendance: [], expense: [], allowance: []}
    this.uploadFileArray.controls.forEach((control, i) => {
      let validatedInput;
      switch (control.value.fileType){
        case 'attendance':
          validatedInput = this.uploadService.parseAttendace(control.value.fileContent);
          this.upload.attendance.push(validatedInput);
          break
        case 'expense':
          //do something
          ''
          break
        case 'allowance':
          ''
          break
      }
      this.uploadValidationList[i].isShown = true;
      if(validatedInput.validationError ==''){
        this.uploadValidationList[i].isAccepted = true;
        this.uploadValidationList[i].message = `File accepted. ${control.value.fileType.toUpperCase()} of ${validatedInput.totalEmployees} employees added.`
        this.isDisabledUpload = false;
      }
      else{
        this.uploadValidationList[i].isAccepted = false;
        this.uploadValidationList[i].message = `File not accepted. ${validatedInput.validationError}`
        this.isDisabledUpload = true;
      }
    })
    let validatedInput = this.uploadService.parseAttendace(this.uploadFileArray.controls[0].value.fileContent);
    let dateRange = this.uploadService.dateRangeConverter(validatedInput.period? validatedInput.period : '');
    if(dateRange[0].toString() == this.startDate && dateRange[1].toString() == this.endDate && validatedInput.employees.length > 0){
      // this.isDisabledUpload = false
    }
    else{

    }
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
    this.uploadFileArray.at(i).get('fileContent')?.setValue(message)
  }
  fileNameOutputListener(message:string, i:number){
    this.uploadFileArray.at(i).get('fileName')?.setValue(message)
  }
}
