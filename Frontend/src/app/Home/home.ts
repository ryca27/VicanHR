import { Component, model, input, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

import {FormControl, ReactiveFormsModule, FormGroup, Validators} from '@angular/forms'

import { Router } from '@angular/router';

//Component Imports
import {TextboxComponent} from './../Components/textbox/textbox'
import {DropdownComponent} from './../Components/dropdown/dropdown'
import {TableComponent} from './../Components/table/table'
import { VicanHeader } from '../Components/vican-header/vican-header';
import {TaskListComponent} from './../Components/task-list/task-list'
@Component({
  selector: 'app-home',
  imports: [RouterOutlet, RouterLink, ReactiveFormsModule, TextboxComponent, DropdownComponent, TableComponent, VicanHeader, TaskListComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private router = inject(Router);


  genderOptions = [
    {label: "Boy", value: "Boy"},
    {label: "Girl", value: "Girl"},
    {label: "Bakla", value: "Bakla"},
    {label: "Tomboy", value: "Tomboy"},
  ]

  tableColumns = ['Full Name', 'Age','Gender', 'Utotin']
  tableRows = [
     {
      'name':'Ryan',
      'age': 33,
      'gender': 'Male',
      'utotin': 'No'
    },
    {
      'name':'Lea',
      'age': 32,
      'gender': 'Female',
      'utotin': 'No'
    }
  ]

  ngOnInit(){
  }

  navigate(path: string): void{
    this.router.navigateByUrl(`/${path}`);
  }
}
