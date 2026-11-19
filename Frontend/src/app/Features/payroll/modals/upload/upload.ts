import { Router } from '@angular/router';
import { postToBackend } from '../../../../backend';
import { ChangeDetectorRef } from '@angular/core';
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
      fileType:['attendance', Validators.required],
      expenseType:['',],
      allowanceType: [''],
      fileName:['', Validators.required],
      fileContent:['', Validators.required],
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

  private router = inject(Router);
  @Output() cutoffSaved = new EventEmitter<number>();
  saving = false;
  submitError = '';
  private changes = inject(ChangeDetectorRef);

  async submitForm() {
    if (this.saving || this.isDisabledUpload) return;
    this.validateInput();
    if (this.isDisabledUpload) return;
    this.saving = true;
    this.submitError = '';
    try {
      let lastCutoffId: number | undefined;
      for (const summary of this.upload.attendance) {
        const saved = await postToBackend('/api/attendance/', {
          period: summary.period, detachment: summary.branch,
          employees: summary.employees.map(row => ({ ...row, detachment: summary.branch })),
        });
        lastCutoffId = saved.cutoffId;
      }
      this.isOpen = false;
      this.isSubmit.emit(true);
      this.dataUploadOutput.emit(this.upload);
      if (lastCutoffId !== undefined) {
        this.cutoffSaved.emit(lastCutoffId);
        await this.router.navigate(['/cutoff', lastCutoffId]);
      }
    } catch (error) {
      this.submitError = error instanceof Error ? error.message : 'Upload failed.';
    } finally {
      this.saving = false;
      this.changes.markForCheck();
    }
  }

  validateInput() {
    this.upload = { attendance: [], expense: [], allowance: [] };
    this.submitError = '';
    this.uploadValidationList = this.uploadFileArray.controls.map(control => {
      if (control.value.fileType !== 'attendance') {
        return { isShown: true, isAccepted: false, message: 'Choose Attendance as the file type.' };
      }
      if (!control.value.fileContent) {
        return { isShown: true, isAccepted: false, message: control.value.fileName ? 'File content is unavailable. Check the status below the filename.' : 'Choose a summary CSV or Excel workbook.' };
      }
      const result = this.uploadService.parseAttendace(control.value.fileContent || '');
      const error = result.validationError || result.errors.join(' ') ||
        (!result.period || !result.branch || !result.employees.length ? 'Missing cutoff, branch, or employee rows.' : '');
      if (!error) this.upload.attendance.push(result);
      return { isShown: true, isAccepted: !error, message: error || `Validated ${result.employees.length} employees.` };
    });
    this.isDisabledUpload = !this.upload.attendance.length || this.uploadValidationList.some(item => !item.isAccepted);
  }

  //Double date picker output listener
  startDateOutputListener(message:string){
    this.uploadFormGroup.controls['startDate'].setValue(message)
  }
  endDateOutputListener(message:string){
    this.uploadFormGroup.controls['endDate'].setValue(message)
  }

  //File box output listener
  fileContentOutputListener(message:string | string[][], i:number){
    this.isDisabledUpload = true;
    this.uploadValidationList[i] = { isShown: false, isAccepted: false, message: '' };
    this.uploadFileArray.at(i).get('fileContent')?.setValue(message);
    this.changes.markForCheck();
  }
  fileNameOutputListener(message:string, i:number){
    this.uploadFileArray.at(i).get('fileName')?.setValue(message)
  }
}
