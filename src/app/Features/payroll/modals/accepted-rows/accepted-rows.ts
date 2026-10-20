import { Component, Input, Output, EventEmitter, inject, OnInit,DestroyRef  } from '@angular/core';
import { CommonModule } from '@angular/common';


@Component({
  imports: [],
  selector: 'accepted-rows-modal',
  styleUrl: './accepted-rows.scss',
  templateUrl: './accepted-rows.html',
})
export class AcceptedRowsModal {
  constructor(){
  }
  @Input() isOpen = false;
  title :string = 'Validated Rows to Add';

  closeAcceptedRowsModal(){
    this.isOpen = false;
  }
}
