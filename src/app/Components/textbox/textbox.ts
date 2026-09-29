import { Component, model, input } from '@angular/core';
import {FormControl, ReactiveFormsModule, FormGroup} from '@angular/forms'
import {FormValueControl } from '@angular/forms/signals'

@Component({
  selector: 'app-textbox',
  imports: [ReactiveFormsModule],
  templateUrl: './textbox.html',
  styleUrl: './textbox.scss',
})
export class Textbox implements FormValueControl<string> {
  inputControl = new FormControl('');
  readonly value = model('')
  readonly disabled = input<boolean>(false);
}
