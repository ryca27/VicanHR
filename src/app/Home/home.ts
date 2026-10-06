import { Component, model, input, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import {TextboxComponent} from './../Components/textbox/textbox'
import {DropdownComponent} from './../Components/dropdown/dropdown'
import {TableComponent} from './../Components/table/table'
import {FormControl, ReactiveFormsModule, FormGroup, Validators} from '@angular/forms'
import {FormValueControl } from '@angular/forms/signals'
@Component({
  selector: 'app-home',
  imports: [RouterOutlet, RouterLink,ReactiveFormsModule, TextboxComponent, DropdownComponent, TableComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
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

  tableColumns = ['Full Name', 'Age','Gender']
  tableRows = [
     {
      'name':'Ryan',
      'age': 33,
      'gender': 'Male'
    },
    {
      'name':'Lea',
      'age': 32,
      'gender': 'Female'
    }
  ]

  ngOnInit(){
  }
}
