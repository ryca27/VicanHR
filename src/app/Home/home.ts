import { Component, model, input } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import {Textbox} from './../Components/textbox/textbox'
import {FormControl, ReactiveFormsModule, FormGroup} from '@angular/forms'
import {FormValueControl } from '@angular/forms/signals'
@Component({
  selector: 'app-home',
  imports: [RouterOutlet, RouterLink,ReactiveFormsModule, Textbox],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  myForm = new FormGroup({
    username: new FormControl('')
  });
}
