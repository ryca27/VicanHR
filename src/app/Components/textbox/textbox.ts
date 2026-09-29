import { Component, model, input, Input } from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms'
import {FormValueControl } from '@angular/forms/signals'

@Component({
  selector: 'app-textbox',
  imports: [ReactiveFormsModule],
  templateUrl: './textbox.html',
  styleUrl: './textbox.scss',
})
export class TextboxComponent implements FormValueControl<string> {
  @Input() isRequired: boolean = false;
  inputControl = new FormControl('');
  readonly value = model('')
  readonly disabled = input<boolean>(false);

}
