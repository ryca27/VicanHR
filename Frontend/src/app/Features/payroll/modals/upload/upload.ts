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
import { CheckedAttendanceFile, FileBoxComponent } from './../../../../Components/file-box/file-box'
import { ButtonComponent } from '../../../../Components/button/button';
import { UploadValidation, Upload } from './upload.models';


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
  @Input() targetCutoffId: string | null = null;
  @Input() targetCutoffPeriod = '';
  @Input() savedCutoffs: { cutoffId: number; period: string; detachment: string }[] = [];
  @Input() title = '';
  @Input() startDate: string ='';
  @Input() endDate: string ='';
  @Output() isSubmit = new EventEmitter<boolean>();
  @Output() dataUploadOutput: EventEmitter<Upload> = new EventEmitter<Upload>();
  
  public fileTypeOptions = fileTypeList;

  get adjustmentCutoffOptions() {
    return this.savedCutoffs.map(cutoff => ({
      value: String(cutoff.cutoffId),
      label: `${cutoff.detachment} · ${cutoff.period}`,
    }));
  }

  private adjustmentTarget(selectedId: string) {
    if (this.targetCutoffId) return { id: this.targetCutoffId, period: this.targetCutoffPeriod };
    const cutoff = this.savedCutoffs.find(item => String(item.cutoffId) === selectedId);
    return cutoff ? { id: selectedId, period: cutoff.period } : null;
  }

  public expenseTypeOptions = expenseTypeList;
  public allowanceOptions = allowanceTypeList;
  public fileTypeLabel: string = fileTypeLabel;
  public expenseTypeLabel: string = expenseTypeLabel;
  public allowanceTypeLabel: string = allowanceTypeLabel;
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
      adjustmentCutoffId: [''],
      expenseType:['',],
      allowanceType: [''],
      fileName:['', Validators.required],
      fileContent: this.fb.control<CheckedAttendanceFile | null>(null, Validators.required),
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
      const files = this.uploadFileArray.controls.map(control => {
        const checked: CheckedAttendanceFile = control.value.fileContent;
        const form = new FormData();
        form.append('file', checked.file);
        if (control.value.fileType === 'attendance_adjustment') {
          const target = this.adjustmentTarget(control.value.adjustmentCutoffId);
          if (!target) throw new Error('Select a saved cutoff for the attendance adjustment.');
          form.append('type', 'attendance_adjustment');
          form.append('cutoffId', target.id);
        }
        return form;
      });
      let lastCutoffId: number | undefined;
      for (const form of files) {
        const saved = await postToBackend('/api/attendance/', form);
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
    const adjustments: CheckedAttendanceFile['preview'][] = [];
    this.uploadValidationList = this.uploadFileArray.controls.map(control => {
      const adjustment = control.value.fileType === 'attendance_adjustment';
      if (control.value.fileType !== 'attendance' && !adjustment) {
        return { isShown: true, isAccepted: false, message: 'Choose an available attendance upload type.' };
      }
      if (!control.value.fileContent) {
        return { isShown: true, isAccepted: false, message: control.value.fileName ? 'File content is unavailable. Check the status below the filename.' : 'Choose a summary CSV or Excel workbook.' };
      }
      const target = adjustment ? this.adjustmentTarget(control.value.adjustmentCutoffId) : null;
      if (adjustment && !target) {
        return {
          isShown: true, isAccepted: false,
          message: 'Select a saved cutoff for the attendance adjustment.',
        };
      }
      const { preview }: CheckedAttendanceFile = control.value.fileContent;
      (adjustment ? adjustments : this.upload.attendance).push(preview);
      return {
        isShown: true, isAccepted: true,
        message: target
          ? `Validated ${preview.totalEmployees} employees from ${preview.period}. Apply to ${target.period}.`
          : `Validated ${preview.totalEmployees} employees.`,
        warnings: preview.warnings,
      };
    });
    this.isDisabledUpload = !(this.upload.attendance.length || adjustments.length) || this.uploadValidationList.some(item => !item.isAccepted);
  }

  //Double date picker output listener
  startDateOutputListener(message:string){
    this.uploadFormGroup.controls['startDate'].setValue(message)
  }
  endDateOutputListener(message:string){
    this.uploadFormGroup.controls['endDate'].setValue(message)
  }

  //File box output listener
  fileContentOutputListener(message: CheckedAttendanceFile | null, i: number){
    this.isDisabledUpload = true;
    this.uploadValidationList[i] = { isShown: false, isAccepted: false, message: '' };
    this.uploadFileArray.at(i).get('fileContent')?.setValue(message);
    this.changes.markForCheck();
  }
  fileNameOutputListener(message:string, i:number){
    this.uploadFileArray.at(i).get('fileName')?.setValue(message)
  }
}
