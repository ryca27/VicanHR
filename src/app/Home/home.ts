import { Component, model, input } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import {TextboxComponent} from './../Components/textbox/textbox'
import {DropdownComponent} from './../Components/dropdown/dropdown'
import {FormControl, ReactiveFormsModule, FormGroup, Validators} from '@angular/forms'
import {FormValueControl } from '@angular/forms/signals'
@Component({
  selector: 'app-home',
  imports: [RouterOutlet, RouterLink,ReactiveFormsModule, TextboxComponent, DropdownComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  myForm = new FormGroup({
    name: new FormControl(''),
    gender: new FormControl('')
  });

  genderOptions = [
    {label: "Boy", value: "Boy"},
    {label: "Girl", value: "Girl"},
    {label: "Bakla", value: "Bakla"},
    {label: "Tomboy", value: "Tomboy"},
  ]
}
