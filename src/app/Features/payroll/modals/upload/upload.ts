import { Component, Input, Output, EventEmitter, inject, OnInit  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule  } from '@angular/forms';

//Components Import
import {DoubleDatePickerComponent} from './../../../../Components/double-date-picker/double-date-picker'

@Component({
  imports: [CommonModule, DoubleDatePickerComponent, ReactiveFormsModule ],
  selector: 'upload-modal',
  styleUrl: './upload.scss',
  templateUrl: './upload.html',
})
export class UploadModal implements OnInit {
  private fb = inject(FormBuilder)

  @Input() isOpen = false;
  @Input() title = 'Modal Title';
  @Input() startDate: string ='';
  @Input() endDate: string ='';
  @Output() closeEvent = new EventEmitter<void>();

  uploadFormGroup = this.fb.group({
    startDate: this.startDate,
    endDate: this.endDate
  })
  closeModal() {
    this.isOpen = false;
    this.closeEvent.emit();
  }
  ngOnInit(){
  }

    //Double date picker output listener
    startDateOutputListener(message:string){
      this.uploadFormGroup.controls.startDate.setValue(message)
    }
    endDateOutputListener(message:string){
      this.uploadFormGroup.controls.endDate.setValue(message)
    }
}
