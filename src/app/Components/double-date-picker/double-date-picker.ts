import { Component, OnInit, model, input, Input, Output, EventEmitter } from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms'
import {FormValueControl } from '@angular/forms/signals'
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';

@Component({
  imports: [    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    ReactiveFormsModule],
    providers:[provideNativeDateAdapter()],
  selector: 'app-double-date-picker',
  styleUrl: './double-date-picker.scss',
  templateUrl: './double-date-picker.html',
})
export class DoubleDatePickerComponent implements OnInit, FormValueControl<string> {
  constructor(private fb: FormBuilder) {}
  @Input() label: string = '';
  @Input() startDate: string ='';
  @Input() endDate: string ='';
  @Input() startDateDisabled: boolean = false
  @Input() endDateDisabled: boolean = false
  @Output() startDateOutput: EventEmitter<string> = new EventEmitter<string>();
  @Output() endDateOutput: EventEmitter<string> = new EventEmitter<string>();

  startDateControl: FormControl = new FormControl('')
  endDateControl: FormControl = new FormControl('')
  readonly value = model('')
  readonly disabled = input<boolean>(false);
  ngOnInit(){
    this.startDateControl = new FormControl({value: this.startDate, disabled: this.startDateDisabled})
    this.endDateControl =  new FormControl({value: this.endDate, disabled: this.endDateDisabled})
    this.startDateControl.valueChanges.subscribe((newValue => {
      this.startDateOutput.emit(newValue)
    }))
    this.endDateControl.valueChanges.subscribe((newValue => {
      this.endDateOutput.emit(newValue)
    }))
  }

  
}
