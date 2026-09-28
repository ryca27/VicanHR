import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import {Textbox} from './../Components/textbox/textbox'
@Component({
  selector: 'app-home',
  imports: [RouterOutlet, RouterLink, Textbox],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {}
